# Evolution e notícias por WhatsApp

Stack do servidor: `/home/SEU_USUARIO/docker/evolution`, projeto Compose `evolution`.
API fixada em `evoapicloud/evolution-api:v2.3.7`, PostgreSQL 16 e Redis 7 em containers.
Dados em volumes Docker `evolution_instances`, `evolution_postgres` e `evolution_redis`.
PostgreSQL e Redis ficam na rede interna da stack, sem portas publicadas.
A API também participa da rede existente `n8n_default`. O Compose do n8n não foi alterado.

## Acesso e clientes

- API na LAN: http://SEU_IP_LAN:8080
- Painel público: https://SEU_DOMINIO_PUBLICO/manager — entre com a URL `https://SEU_DOMINIO_PUBLICO` e a chave administrativa do `.env`.
- Dentro do n8n: `http://evolution-api:8080`
- Chave administrativa: propriedade `AUTHENTICATION_API_KEY` do `.env` no servidor, permissão 600.
- Credencial por cliente: `tenants/<cliente>.json` no servidor, permissão 600.

ssh -p SUA_PORTA_SSH SEU_USUARIO@SEU_IP_LAN "grep '^AUTHENTICATION_API_KEY=' ~/docker/evolution/.env"

Uma instância WhatsApp e um token exclusivo por cliente. É separação lógica dentro da mesma API e banco; não há portal SaaS, cobrança, quotas ou isolamento físico por cliente. O administrador da instalação tem acesso a todas as instâncias. Mantenha os tokens no n8n sob sua administração.

No servidor:

```sh
cd /home/SEU_USUARIO/docker/evolution
python3 tenant.py create nome-do-cliente
python3 tenant.py status nome-do-cliente
python3 tenant.py verify-isolation nome-do-cliente
docker compose ps
docker compose logs --tail 100 api
```

O comando de verificação cria e remove uma instância temporária sem parear telefone ou enviar mensagens. Confere acesso à própria instância, recusa de acesso cruzado e listagem restrita.

Para parear, abra a instância no painel e gere o QR, ou use `GET /instance/connect/<cliente>` com o token correspondente no header `apikey`. Escaneie no WhatsApp em **Aparelhos conectados**. Cada cliente precisa conectar seu número.

Verificado nesta instalação: três containers saudáveis, API e painel respondendo HTTP 200, acesso a partir do container n8n, token próprio aceito, acesso cruzado recusado com 401 nos dois sentidos e listagem restrita à própria instância. A instância do cliente foi pareada pelo usuário e o envio de texto foi confirmado por ele.

Os limites iniciais dos containers são 768 MiB para API, 256 MiB para PostgreSQL e 160 MiB para Redis, considerando os 4 GB do host. São limites de arranque, não uma capacidade validada para vários clientes; dimensione após medir uso com números conectados. O túnel Cloudflare existente publica `https://SEU_DOMINIO_PUBLICO` apontando para `http://SEU_IP_LAN:8080`, sem abrir portas no roteador. `SERVER_URL` usa o domínio HTTPS; o n8n e o script administrativo continuam acessando a API pela rede interna.

## Importar o fluxo

**Formato atual:** um único resumão dinâmico por execução. A especificação
atual de texto, links, imagem e tamanho está em [RESUMAO.md](RESUMAO.md).

Importe `noticias_investimento_whatsapp.json` no n8n. Ele fica inativo e com `enviar: false`.

1. Em **Configurar Cliente**, preencha os campos: `numero` aceita telefone com país e DDD (inclusive +55, espaços e parênteses) ou ID de grupo; `instancia` identifica o WhatsApp que envia; `usarImagem` ativa a capa da matéria; `maxNoticias` limita a quantidade; `enviar=false` apenas revisa. O modelo `gemini-3.6-flash` foi validado com a credencial da conta.
2. No nó Gemini, selecione uma credencial **Header Auth**: nome `x-goog-api-key`, valor sua chave Gemini. A chave que estava embutida na versão original foi removida do arquivo; substitua-a na conta se ela foi compartilhada.
3. Nos dois nós Evolution (texto e imagem), selecione a mesma credencial **Header Auth**: nome `apikey`, valor do arquivo `tenants/<cliente>.json`. Use o token da instância, nunca a chave administrativa. No workflow já instalado, as credenciais Gemini e Evolution foram preservadas e corrigidas.
4. Execute em modo de teste e revise a saída de **Extrair Resposta da IA** e **Ver Resultado (Teste)**.
5. Após parear o telefone e definir o grupo, altere `enviar` para `true` e ative a agenda, se desejado. A agenda é diária às 08h, fuso `America/Sao_Paulo`.

Duplique o workflow e selecione outra credencial para cada cliente. A configuração do cliente é fixa no workflow, não vem dos feeds ou da IA.


Timeout, falha temporária de rede e respostas HTTP 408, 429 ou 5xx do Gemini são repetidos sem limite de tentativas. O limite de cada chamada é 120 segundos. Entre tentativas, o workflow aguarda aproximadamente 90 segundos, 3 minutos, 6 minutos e depois 10 minutos, com pequena variação aleatória, respeitando um prazo maior informado em Retry-After ou RetryInfo. O nó Wait persiste a espera no n8n. O prompt e as notícias da execução são preservados. Veja tentativaGemini, motivo e proximaTentativa em **Gemini · Conferir resposta**; não inicie novamente uma execução que está aguardando.

Erros de configuração, chave, permissão ou modelo (por exemplo 400/401/403/404) interrompem para correção. JSON inválido ou notícia sem resumo também interrompem na validação editorial. Não há fallback de título e link. Array vazio válido encerra sem enviar. Somente a chamada Gemini é repetida: o envio para WhatsApp para no primeiro erro e não tem repetição automática. Após timeout de envio, confirme se a mensagem chegou antes de repetir. Não há deduplicação entre execuções; a agenda do dia seguinte pode iniciar outra execução mesmo que a anterior ainda aguarde o Gemini. A falha de um RSS interrompe a execução, como no fluxo original.

Validação local: `node manutencao/testes/test_editorial.cjs`. Teste integrado: uma matéria real do Brazil Journal foi extraída pelo nó HTML instalado no n8n; Gemini respondeu HTTP 200 com resumo; a imagem respondeu HTTP 200 como JPEG. Prévia em `previa_editorial.md`. Nenhuma mensagem foi enviada pelo teste editorial; a entrega da imagem ainda precisa ser confirmada no WhatsApp.

## Imagem por URL

Com `usarImagem=true` e capa disponível, o workflow usa `POST /message/sendMedia/<instancia>`, passando a URL em `media` e o post em `caption`. A versão instalada aceita MIME opcional e detecta o tipo da mídia; o exemplo manual em `send-image.example.json` mostra MIME explícito. Sem capa ou com `usarImagem=false`, usa envio de texto. A imagem vem da fonte, nunca da IA. Se a URL de imagem estiver inacessível no envio, o fluxo para: desative `usarImagem` para testar texto. Não é necessário baixar a imagem no n8n ou salvar no projeto. Gráficos/cotações históricas de ativos não estão incluídos.

Referências: [mídia](https://evolution-74046672.mintlify.app/v2/api-reference/message-controller/send-media), [Docker oficial](https://github.com/EvolutionAPI/evolution-api/blob/main/docker-compose.yaml), [JSON estruturado Gemini](https://ai.google.dev/gemini-api/docs/structured-output), [loop n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.splitinbatches/).

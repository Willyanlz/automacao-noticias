# Automacao de conteudo para WhatsApp - n8n + Evolution + Gemini

Workflow generico para buscar conteudos em RSS, selecionar e resumir com Gemini, enviar pelo WhatsApp via Evolution API e registrar historico para evitar repeticao. Pode ser usado para noticias financeiras, pet shop, saude, varejo, educacao ou qualquer nicho baseado em fontes RSS.

A versao base gerada pelo repositorio e `noticias_v3.json`. O arquivo pode ser importado no n8n e adaptado no node `Configurar Cliente`.

## Arquivos principais

- `noticias_v3.json`: workflow base para importar no n8n.
- `create_v3_compact.js`: gerador antigo desativado para evitar recriar exports incompatíveis.
- `historico/`: servico HTTP simples com SQLite para deduplicacao, historico do dia e resumao.
- `evolution/docker-compose.yml`: stack com Evolution API, Redis, Postgres e historico.
- `manutencao/testes/test_v3_compact.cjs`: teste local de integridade do workflow.

## O que o workflow faz

- Roda por agenda, manualmente ou por webhook.
- Busca itens em uma ou mais fontes RSS.
- Filtra por dominio, janela de tempo e palavras-chave.
- Baixa o texto das paginas, limpa HTML/CSS/JS e rejeita conteudo sujo.
- Pede ao Gemini para escolher e reescrever os melhores itens.
- Envia texto ou imagem pelo WhatsApp usando Evolution API.
- Registra o que foi enviado para evitar duplicidade.
- Gera resumo do dia com base apenas no que ja foi enviado.
- Consulta IDs de grupos, comunidades e instancia do WhatsApp.

## Como configurar o node `Configurar Cliente`

Campos principais:

| Campo | Uso |
| --- | --- |
| `cliente` | Nome do cliente ou projeto. Entra no escopo do historico. |
| `numero` | Destino padrao. Pode ser telefone com DDI/DDD ou ID de grupo `@g.us`. |
| `instancia` | Nome da instancia na Evolution API. |
| `evolutionUrl` | URL interna ou externa da Evolution API. No Docker normalmente `http://evolution-api:8080`. |
| `evolutionApiKey` | API key geral da Evolution API. |
| `geminiApiKey` | Chave da API do Gemini. |
| `modeloGemini` | Modelo usado para gerar os resumos. |
| `historicoUrl` | URL do servico de historico. No Docker normalmente `http://historico:8090`. |
| `rssFeeds` | Lista de RSS, um por linha. |
| `dominiosPermitidos` | Opcional. Se vazio, usa os dominios dos RSS. Preencha para restringir. |
| `palavrasChave` | Termos usados para priorizar conteudos. Separe por virgula. |
| `promptNoticias` | Instrucao do nicho para selecionar e reescrever cada conteudo. |
| `promptResumao` | Instrucao para montar o resumo do dia. |
| `periodicidade` | `intervalo` ou `diario`. |
| `intervaloMinutos` | Intervalo entre buscas quando `periodicidade=intervalo`. |
| `inicioEnvios` / `fimEnvios` | Janela diaria em que o envio automatico pode ocorrer. |
| `horarioEnvioDiario` | Horario usado quando `periodicidade=diario`. |
| `horarioResumao` | Horario do resumo do dia. |
| `resumaoAtivo` | Liga/desliga o resumo automatico. |
| `maxNoticias` | Limite REAL de ENVIO por rodada (ex.: 5): a IA seleciona as melhores entre todas as noticias do periodo e o envio corta aqui; nao limita mais os candidatos. |
| `janelaHoras` | Idade maxima dos itens RSS. |
| `diasEnvio` | Dias da semana em que o envio automatico de noticias ocorre. Ex.: `seg a sex`, `seg qua sex`, `seg ter qua qui sex sab`. Vazio ou `todos` = todos os dias. |
| `diaResumao` | Dia da semana do resumao automatico. Ex.: `dom` com `resumaoPeriodoDias=6` resume D-6..D, ou seja, segunda a domingo. Vazio = resumao diario. |
| `resumaoPeriodoDias` | Quantos dias para tras entram no resumao, incluindo tambem o dia atual. Ex.: `6` em domingo resume segunda a domingo. |
| `usarImagem` | Se `true`, tenta enviar imagem da materia quando houver. |
| `enviar` | Se `false`, gera preview sem enviar. Se `true`, envia pelo WhatsApp. |
| `enviarLinksFontes` | Se `true`, adiciona o link da fonte na mensagem. |
| `numeroNoticias` | Destino especifico das noticias. Se vazio, usa `numero`. |
| `numeroResumao` | Destino especifico do resumao. Se vazio, usa `numero`. |
| `numeroHistorico` | Destino especifico do historico. Se vazio, usa `numero`. |
| `numeroErros` | Destino para alertas de erro do workflow. Pode ser numero individual, grupo `@g.us`, ou varios separados por linha, virgula ou ponto e virgula. Se vazio, o erro fica apenas no log do n8n. |

## Fluxos de entrada

- Manual `Manual - Iniciar`: abre um formulario para escolher `Enviar noticias agora`, `Enviar resumao agora`, `Enviar historico agora` ou `Consultar IDs`.
- Webhook `noticias-agora`: forca uma rodada por URL.
- Webhook `resumao-agora`: gera o resumo do dia com base no historico.
- Webhook `historico-agora`: envia a lista do que ja foi enviado no dia.
- Opcao manual `Consultar IDs`: consulta grupos, comunidades, broadcasts expostos pela API e estado da instancia.

## Teste local

```bash
node manutencao/testes/test_v3_compact.cjs
```

## Importacao no n8n

1. Importe `noticias_v3.json` no n8n.
2. Ajuste os campos do node `Configurar Cliente` para o nicho e destino.
3. Comece com `enviar=false` para validar texto e fontes.
4. Troque para `enviar=true` somente quando a instancia e o destino estiverem corretos.

Nunca versione tokens, chaves, senhas, IPs privados de clientes ou exports com credenciais reais.


## Logs e alertas de erro

Os workflows principais apontam para o workflow global `Noticias v3 - Notificar erros`. Quando qualquer workflow falha, o n8n registra no log a entrada `[NOTICIAS_V3_ERRO]` com workflow, node, execucao e mensagem do erro.

Se o campo `numeroErros` estiver preenchido no node `Configurar Cliente` do workflow que falhou, o workflow global `noticias_v3_error_handler.json` le essa configuracao do proprio workflow original e tenta enviar um alerta pelo WhatsApp via Evolution API com a mensagem `ALERTA / Ola Willyan, o sistema falhou` e os detalhes da execucao. Se `numeroErros` estiver vazio, nada e enviado no WhatsApp e o diagnostico fica apenas nos logs/output do n8n.

# Consultar IDs no workflow

Abra https://SEU_DOMINIO_N8N/workflow/<id-do-workflow> e localize o bloco **IDs**, abaixo do fluxo de notícias.

1. No botão **Execute workflow**, selecione o início **IDs · Iniciar consulta**.
2. Preencha o formulário **IDs · O que consultar?**. O n8n abre uma janela durante a execução; se ela não abrir, use o link mostrado pelo nó em espera.
3. Escolha a categoria e, opcionalmente, parte do nome (por exemplo, `XP`).
4. Envie o formulário, volte ao n8n e abra **IDs · Resultados → Output → Table**.
5. Copie o campo `id`. A consulta não muda o destinatário configurado nas notícias.

Opções: todos os grupos e comunidades, grupos comuns, comunidades, grupos de avisos e estado da instância. O filtro por nome ignora maiúsculas e acentos. Grupos de avisos incluem os grupos de anúncios de comunidades e os grupos onde somente administradores podem publicar.

**Comunidade (estrutura principal)** e **Grupo de avisos da comunidade** têm IDs diferentes. Para publicar avisos, use o ID do grupo de avisos apropriado, não o ID da estrutura principal. A coluna `comunidade` mostra o vínculo quando informado pela Evolution.

O formulário expira em 10 minutos. A execução usa apenas GET e a credencial de uma instância de exemplo. Não coleta a lista de participantes, não envia mensagens, não cria grupos nem inicia chamadas. O bloco não tem conexões com os nós de notícias e depende apenas dos próprios nós e da credencial Evolution.

A opção de canais de voz informa a limitação: não existe rota de listagem de IDs de canais de voz na Evolution 2.3.7. Ela não inicia uma chamada nem apresenta grupos como se fossem canais de voz.

Validação: `node manutencao/testes/test_ids.cjs`. Na instalação, foram consultados 33 registros: 31 grupos comuns e uma comunidade com seu grupo de avisos. A categoria avisos encontrou 4 grupos (inclui grupos comuns restritos a administradores). Contagens variam conforme os grupos da conta.

# Painel da Evolution

O Manager da imagem 2.3.7 referencia logos externos que retornam 404.
O diretório `manager/` contém os arquivos da própria imagem com os logos
substituídos pelo PNG que já vem nela. O Compose monta essa pasta somente
para leitura. Em uma instalação nova, execute `python3 prepare_manager.py`
antes de subir o Compose. Ao atualizar a imagem, regenere e revise o Manager
para não manter um frontend antigo por acidente.

As opções `DATABASE_SAVE_DATA_NEW_MESSAGE`, `DATABASE_SAVE_MESSAGE_UPDATE`,
`DATABASE_SAVE_DATA_CONTACTS`, `DATABASE_SAVE_DATA_CHATS`,
`DATABASE_SAVE_DATA_LABELS` e `DATABASE_SAVE_DATA_HISTORIC` estão ativadas.
O banco passa a guardar os eventos recebidos. Isso não recupera
automaticamente mensagens antigas que não foram gravadas. A sessão existente
foi preservada e continua com `syncFullHistory=false`.

Grupos podem ser consultados pelo bloco de IDs no n8n, mesmo quando o banco
de chats ainda está vazio. O endpoint de grupos consulta o WhatsApp; os
contadores da visão geral refletem os registros locais do banco.

Depois da alteração, recarregue o painel com Ctrl+F5. Se precisar autenticar
novamente, use a URL pública da API e a credencial da instância. O acesso pelo
Cloudflare pode ter regras diferentes do acesso pela rede local.

## Correção do Chat

`patch_manager_chat.py` aplica correções ao bundle original da versão 2.3.7:

- O botão Chat + abre um formulário de telefone ou ID com validação.
- Abrir uma conversa apenas navega; não envia mensagens.
- A lista inclui contatos @lid e consulta contatos e grupos pela API,
  além das conversas já armazenadas.
- O bundle corrigido recebe um nome com hash para evitar cache antigo.

O script verifica os trechos esperados antes de publicar a alteração.
O original é preservado. Em upgrades, revise o patch para a nova versão.
`prepare_manager.py` aplica também este patch ao preparar uma instalação.
O teste de navegador em `manutencao/testes/verify_manager_chat.cjs` valida
formulário, navegação e listas, bloqueando mutações da API. Requer Playwright
em `manutencao/browser-tools` e Chromium instalado para o teste.

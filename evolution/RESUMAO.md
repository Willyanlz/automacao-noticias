# Resumão dinâmico para WhatsApp

O fluxo agora transforma várias notícias em uma única mensagem. O Gemini
seleciona os acontecimentos pela relevância, sem fixar a quantidade em três.
`maxNoticias` continua limitando as fontes de entrada, não a quantidade
obrigatória de assuntos no resultado.

O retorno é `[]` quando nada for relevante, ou um array com exatamente um
objeto contendo `emoji`, `titulo`, `resumo`, `link` e `referencias`. O campo
`link` reúne as URLs utilizadas separadas por ` | `. `referencias` associa
cada número de notícia às suas URLs. O código valida todas contra as fontes
originais, remove repetições dentro de cada notícia e monta uma linha por
assunto: `Notícia 1: URL`, `Notícia 2: URL`. Havendo duas fontes do mesmo
assunto, usa `Notícia 1: URL | URL`, sem criar uma notícia adicional.

Em **Configurar Cliente**, o booleano `enviarLinksFontes` controla o rodapé:
`true` mostra os links numerados; `false` envia apenas abertura e resumo.
O padrão é `true`. As fontes continuam obrigatórias e validadas internamente
nos dois modos, inclusive para escolher a imagem. Com links desligados,
as URLs não ocupam o orçamento de 3000 caracteres da mensagem final.

A abertura aparece uma única vez. O título informa a quantidade real de
blocos. Cada notícia tem um emoji, título curto em caixa alta entre asteriscos
simples e explicação acessível. A conclusão é opcional quando houver conexão
sustentada pelas fontes. O teto de 3000 caracteres vale para a mensagem final,
incluindo abertura, formatação, quebras e links. Não há truncamento de texto
nem de URLs: uma resposta inválida interrompe antes do envio.

Com imagens habilitadas, usa a primeira imagem disponível entre as fontes
efetivamente utilizadas. Sem imagem, envia texto. Essa é a capa de uma das
matérias, não uma imagem que represente necessariamente todos os assuntos.

O loop existente recebe apenas um item. Não existe mais uma mensagem por
notícia; o card de intervalo continua conectado por compatibilidade, mas
recebe apenas o único resumão. As tentativas de falhas temporárias do Gemini,
o bloco de IDs e as configurações de clientes permanecem independentes.
Erros editoriais (por exemplo exceder 3000 caracteres ou inventar um link)
interrompem a validação; não fazem parte das tentativas de falhas de rede.

Para atualizar um arquivo preservando as demais configurações:

```sh
node manutencao/scripts/install_resumao.cjs entrada.json saida.json
node manutencao/testes/test_resumao.cjs
```

O arquivo principal na raiz está atualizado e continua sendo suficiente
para importar em outro n8n, após configurar as credenciais e o cliente.

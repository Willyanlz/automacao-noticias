# Ferramentas de manutenção

Esta pasta não precisa acompanhar o JSON enviado a outra pessoa.
Os `.js` são fontes de códigos já embutidos nos cards. Os `.cjs` são
ferramentas Node.js que editam o JSON ou verificam o comportamento.

Execute os comandos a partir da raiz do projeto:

```sh
node manutencao/testes/test_keywords.cjs
node manutencao/testes/test_editorial.cjs
node manutencao/testes/test_ids.cjs
node manutencao/testes/test_gemini_retry.cjs
```

`test_keywords` valida a lista ampla de palavras-chave embutida no card
Selecionar Notícias. `test_editorial` valida os cards de prompt e extração
do fluxo atual (notícia individual didática + resumão diário em uma única
mensagem, sem cortes).

Os arquivos `verify_*` são verificações de integração para o ambiente do
servidor e dependem dos arquivos temporários, do n8n e de credenciais reais;
não entram no repositório público (`.gitignore`). Não fazem parte dos
testes locais acima.

## Regenerar o workflow a partir das fontes

```sh
node manutencao/scripts/install_individual_agenda.cjs entrada.json saida.json
```

O instalador reconstrói a agenda (`periodicidade`, horários, resumão), o
loop de envio e o histórico persistente sobre o workflow fornecido,
reembutindo as fontes atuais de `editorial_selection.js`,
`individual_prompt.js` e `individual_extract.js`. Para aplicar sobre o
arquivo principal:

```sh
node manutencao/scripts/install_individual_agenda.cjs noticias_investimento_whatsapp.json saida-temp.json
move saida-temp.json noticias_investimento_whatsapp.json  # após revisar
```

`build_editorial.cjs` restaura o formato antigo (um único resumão por
execução) e é usado apenas em manutenção legada.

Scripts `build_*` e `install_*` modificam arquivos de workflow; preserve uma
cópia antes de usá-los. Editar uma fonte `.js` não altera automaticamente o
JSON nem o workflow publicado. É necessário aplicar a ferramenta correspondente,
revisar o resultado e importar/publicar a versão desejada no n8n.

// Valida a lista de palavras-chave embutida no card Selecionar Notícias.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const code=fs.readFileSync('manutencao/scripts/editorial_selection.js','utf8');
const config={janelaHoras:24,maxNoticias:10};
const agora=new Date().toISOString();
const items=[
  {title:'BTG anuncia captação de R$ 1 bi',link:'https://www.infomoney.com.br/mercados/btg-captacao/',isoDate:agora},
  {title:'XP compra corretora por R$ 2 bi',link:'https://moneytimes.com.br/xp-compra-corretora/',isoDate:agora},
  {title:'S&P 500 renova máxima histórica',link:'https://braziljournal.com/sp500-maxima/',isoDate:agora},
  {title:'Itaú revisa guidance e projeta lucro maior',link:'https://www.infomoney.com.br/mercados/itau-guidance/',isoDate:agora},
  {title:'Prefeitura anuncia show no parque central',link:'https://veja.abril.com.br/cultura/show-parque/',isoDate:agora},
  {title:'Ações em alta',link:'http://127.0.0.1/private',isoDate:agora},
];
const fn=new Function('$input','$',code);
const out=fn({all:()=>items.map(j=>({json:j}))},()=>({first:()=>({json:config})}));
const titles=out.map(o=>o.json.titulo);
console.log('selecionadas:',titles);
assert.equal(titles.length,4,'Esperadas 4 notícias financeiras (fora show cultural e link inválido).');
for(const esperado of ['BTG','XP','S&P 500','Itaú']) {
  const palavra=esperado.split(' ')[0];
  assert.ok(titles.some(t=>t.includes(palavra)),'Faltou a palavra-chave: '+esperado);
}
assert.ok(!titles.some(t=>t.includes('Prefeitura')),'Notícia sem relevância financeira passou no filtro.');
console.log('PASS palavras-chave novas selecionam BTG/XP/S&P/Itaú e descartam cultura e link inválido.');
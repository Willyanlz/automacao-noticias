// Valida os cards do fluxo atual (notícia individual + resumão único).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const w=JSON.parse(fs.readFileSync('noticias_investimento_whatsapp.json','utf8'));
const get=name=>w.nodes.find(n=>n.name===name);
const config=Object.fromEntries(get('Configurar Cliente').parameters.assignments.assignments.map(a=>[a.name,a.value]));
config.enviar=false;
const run=(name,items,lookup)=>new Function('$input','$',get(name).parameters.jsCode)({all:()=>items.map(j=>({json:j})),first:()=>({json:items[0]})},key=>lookup[key]);
const C={first:()=>({json:config})};
// 1) Card Selecionar Notícias com a lista ampla de palavras-chave.
const sel=get('Selecionar Notícias').parameters.jsCode;
for(const kw of ['BTG','Open Finance','S&P 500','Itaú','Basileia','minério de ferro'])assert.ok(sel.includes(kw),'Faltou a palavra-chave: '+kw);
assert.ok(!sel.includes('aeronaves'),'Palavra-chave antiga ainda presente.');
// 2) Montar Prompt — ramo individual com regras de prioridade e schema de 4 campos.
const fonte={link:'https://braziljournal.com/a',titulo:'Fonte exemplo',trecho:'Texto da fonte com dados verificados. '.repeat(40),imagemRss:''};
const item={paragrafos:['Artigo com contexto econômico e números relevantes. '.repeat(40)],imagem:'https://exemplo.com/capa.jpg'};
const individual=run('Montar Prompt',[item],{
 'Configurar Cliente':C,
 'Agenda · Decidir execução':{first:()=>({json:{acao:'noticias'}})},
 'Preparar HTML':{itemMatching:()=>({json:{fonte}})},
 'Histórico · Filtrar inéditas':{first:()=>({json:{recentes:[]}})},
})[0].json;
assert.equal(individual.diario,false);
assert.ok(individual.prompt.includes('Priorizar notícias que tenham potencial de impacto'));
assert.ok(individual.prompt.includes('Ignorar notícias sem relevância financeira'));
assert.ok(individual.prompt.includes('últimas 24 horas'));
assert.deepEqual(individual.geminiBody.generationConfig.responseSchema.items.required,['id','emoji','titulo','resumo']);
// 3) Extrair Resposta da IA — notícia individual validada e pronta para envio.
const cand=arr=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(arr)}]}}]});
const send=run('Extrair Resposta da IA',[cand([{id:fonte.link,emoji:'📊',titulo:'TÍTULO TESTE',resumo:'Texto com mais de cem caracteres para passar na validação editorial e na checagem do card. '.repeat(2)}])],{'Configurar Cliente':C,'Montar Prompt':{first:()=>({json:individual})}});
assert.equal(send.length,1);
assert.equal(send[0].json.tipo,'noticia');
assert.ok(send[0].json.mensagem.includes('*TÍTULO TESTE*'));
assert.equal(send[0].json.imagemUrl,'https://exemplo.com/capa.jpg');
// 4) Resumão do dia — uma única mensagem, sem divisão nem omissão.
const planoResumao={acao:'resumao',noticias:[
 {titulo:'Primeira',resumo:'Primeiro resumo do dia.',registroId:'r1',link:'https://braziljournal.com/a'},
 {titulo:'Segunda',resumo:'Segundo resumo do dia.',registroId:'r2',link:'https://braziljournal.com/b'},
]};
const digest=run('Montar Prompt',[],{'Configurar Cliente':C,'Agenda · Decidir execução':{first:()=>({json:planoResumao})}})[0].json;
assert.equal(digest.diario,true);
assert.ok(digest.prompt.includes('resumir TODAS as notícias'));
const saida=run('Extrair Resposta da IA',[cand([{id:'r1',emoji:'📊',titulo:'PRIMEIRA',resumo:'Resumo extenso da primeira notícia enviada hoje, explicando o fato e sua importância para quem investe.'},{id:'r2',emoji:'📈',titulo:'SEGUNDA',resumo:'Resumo extenso da segunda notícia enviada hoje, com contexto econômico e consequências para o mercado.'}])],{'Configurar Cliente':C,'Montar Prompt':{first:()=>({json:digest})}});
assert.equal(saida.length,1);
assert.equal(saida[0].json.tipo,'resumao');
assert.ok(saida[0].json.mensagem.startsWith('🚨 *RESUMÃO DO MERCADO — 2 NOTÍCIAS DO DIA*'));
assert.equal(saida[0].json.quantidadeNoticias,2);
assert.ok(saida[0].json.mensagem.includes('*PRIMEIRA*'));
assert.ok(saida[0].json.mensagem.includes('*SEGUNDA*'));
assert.ok(saida[0].json.mensagem.includes('Notícia 1: https://braziljournal.com/a'));
// 5) Agenda, histórico e loop presentes no workflow.
const names=w.nodes.map(n=>n.name);
assert.ok(names.includes('Agenda · Decidir execução'));
assert.ok(names.includes('Histórico · Filtrar inéditas'));
assert.ok(names.includes('Uma notícia por vez'));
console.log('PASS prompt/extração individual e resumão único; workflow com agenda, histórico e loop.');
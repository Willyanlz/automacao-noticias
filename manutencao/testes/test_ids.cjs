const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const query=fs.readFileSync(path.join(__dirname,'../scripts/ids_query.js'),'utf8');
const format=fs.readFileSync(path.join(__dirname,'../scripts/ids_format.js'),'utf8');
const ask=(opcao,filtro='')=>new Function('$input',query)({first:()=>({json:{opcao,filtro}})})[0].json;
const rows=(q,data)=>new Function('$input','$',format)({all:()=>data.map(json=>({json}))},()=>({first:()=>({json:q})}));
const groups=[
 {id:'100@g.us',subject:'Comunidade XP',isCommunity:true,size:1},
 {id:'101@g.us',subject:'Avisos XP',isCommunityAnnounce:true,announce:true,linkedParent:'100@g.us',size:58},
 {id:'102@g.us',subject:'Família',size:5},
 {id:'103@g.us',subject:'Equipe XP',size:3},
];
assert.equal(rows(ask('Todos os grupos e comunidades'),groups).length,4);
assert.equal(rows(ask('Comunidades'),groups)[0].json.id,'100@g.us');
assert.equal(rows(ask('Grupos de avisos'),groups)[0].json.id,'101@g.us');
assert.equal(rows(ask('Grupos comuns','familia'),groups)[0].json.id,'102@g.us');
assert.equal(rows(ask('Todos os grupos e comunidades','inexistente'),groups)[0].json.id,'');
assert.equal(ask('Canais de voz (disponibilidade)').consultarAPI,false);
assert.equal(rows(ask('Canais de voz (disponibilidade)'),[])[0].json.id,'');
assert.equal(rows(ask('Instância e conexão'),[{instance:{instanceName:'SEU_CLIENTE',state:'open'}}])[0].json.estado,'open');
assert.throws(()=>ask('https://example.com/endpoint'));
assert.throws(()=>ask(''));
const w=JSON.parse(fs.readFileSync('noticias_investimento_whatsapp.json','utf8'));
const ids=w.nodes.filter(n=>n.id.startsWith('ids-'));
const names=new Set(ids.map(n=>n.name));
for(const [name,c]of Object.entries(w.connections))for(const out of c.main)for(const e of out)assert.equal(names.has(name),names.has(e.node),'Blocks must be disconnected');
assert.equal(ids.find(n=>n.id==='ids-http').parameters.method,'GET');
assert.equal(ids.find(n=>n.id==='ids-wait').parameters.formFields.values.length,2);
console.log('PASS filtros, tipos de grupo, IDs de avisos, estado, opções inválidas e isolamento do bloco.');

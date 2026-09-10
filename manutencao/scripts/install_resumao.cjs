const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const input=process.argv[2]||'noticias_investimento_whatsapp.json';
const output=process.argv[3]||input;
const raw=JSON.parse(fs.readFileSync(input,'utf8'));
const w=Array.isArray(raw)?raw[0]:raw;
const before=structuredClone(w);
const config=w.nodes.find(n=>n.name==='Configurar Cliente');
const assignments=config.parameters.assignments.assignments;
if(!assignments.some(a=>a.name==='enviarLinksFontes'))assignments.push({id:'campo-enviarLinksFontes',name:'enviarLinksFontes',type:'boolean',value:true});
const originalConfig=before.nodes.find(n=>n.id===config.id);
assert.deepEqual(assignments.filter(a=>a.name!=='enviarLinksFontes'),originalConfig.parameters.assignments.assignments.filter(a=>a.name!=='enviarLinksFontes'));
for(const [name,file] of [['Montar Prompt','editorial_prompt.js'],['Extrair Resposta da IA','editorial_extract.js']]){
 const node=w.nodes.find(n=>n.name===name);assert(node,name);
 node.parameters.jsCode=fs.readFileSync(path.join(__dirname,file),'utf8');
}
const gemini=w.nodes.find(n=>n.name==='Gemini (JSON estruturado)');
gemini.parameters.jsonBody='={{ $json.geminiBody }}';
for(const n of before.nodes)if(!['Montar Prompt','Extrair Resposta da IA',gemini.name,config.name].includes(n.name))assert.deepEqual(w.nodes.find(x=>x.id===n.id),n);
assert.deepEqual(w.connections,before.connections);
assert.deepEqual(w.settings,before.settings);
assert.deepEqual(gemini.credentials,before.nodes.find(n=>n.id===gemini.id).credentials);
fs.writeFileSync(output,JSON.stringify(Array.isArray(raw)?[w]:w,null,2)+'\n');
console.log('Resumão aplicado: demais cards, conexões, credenciais e configurações preservados.');

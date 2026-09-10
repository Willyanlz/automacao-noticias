const fs=require('fs');
const input=JSON.parse(fs.readFileSync(process.argv[2]));const w=Array.isArray(input)?input[0]:input;
w.id='news-integration-test';w.name='TESTE ISOLADO noticias';w.active=false;delete w.activeVersionId;delete w.versionId;delete w.meta;delete w.pinData;
const base='http://noticias-integration-test:8090';
const removed=new Set(w.nodes.filter(n=>n.id.startsWith('ids-')||n.type==='n8n-nodes-base.scheduleTrigger').map(n=>n.name));
w.nodes=w.nodes.filter(n=>!removed.has(n.name));
for(const k of removed)delete w.connections[k];
for(const n of w.nodes){
 delete n.credentials;
 if(n.name==='Configurar Cliente'){
  const patch={enviar:true,numero:'5511999999999',instancia:'teste',evolutionUrl:base,estadoUrl:base,inicioEnvios:'08:00',fimEnvios:'19:00',horarioResumao:'19:00',intervaloMinutos:60,maxNoticias:3};
  for(const a of n.parameters.assignments.assignments)if(a.name in patch)a.value=patch[a.name];
 }
 if(n.type==='n8n-nodes-base.rssFeedRead'){
  n.disabled=false;n.type='n8n-nodes-base.code';n.typeVersion=2;
  n.parameters={jsCode:"return [1,2,3].map(i=>({json:{title:'Bolsa teste '+i,link:'https://braziljournal.com/mock-'+i,isoDate:new Date().toISOString(),contentSnippet:'Dados financeiros da empresa e seus resultados no período. '.repeat(8)}}));"};
 }
 if(n.type==='n8n-nodes-base.httpRequest'){
  n.parameters.authentication='none';delete n.parameters.genericAuthType;
  if(n.name==='Buscar matéria')n.parameters.url=base+'/article';
  if(n.name==='Gemini (JSON estruturado)')n.parameters.url=base+'/gemini';
 }
 if(n.type==='n8n-nodes-base.wait'){
  n.type='n8n-nodes-base.code';n.typeVersion=2;n.parameters={jsCode:'return $input.all();'};
 }
}
fs.writeFileSync(process.argv[3],JSON.stringify([w]));
console.log('Isolated workflow uses mock endpoints only.');

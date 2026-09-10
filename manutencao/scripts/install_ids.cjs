// Substitui somente o bloco IDs; preserva os demais nós e conexões.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const input=process.argv[2] || 'noticias_investimento_whatsapp.json';
const output=process.argv[3] || input;
const data=JSON.parse(fs.readFileSync(input,'utf8'));
const w=Array.isArray(data)?data[0]:data;
const original=structuredClone(w);
const isIds=n=>n.id.startsWith('ids-');
const oldNames=new Set(w.nodes.filter(isIds).map(n=>n.name));
const others=w.nodes.filter(n=>!isIds(n));
for(const [name,c]of Object.entries(w.connections)){
 if(oldNames.has(name)) {
  for(const outputs of c.main||[])for(const edge of outputs)assert.ok(oldNames.has(edge.node),'Existing IDs block is connected to other nodes; stop.');
 } else for(const outputs of c.main||[])for(const edge of outputs)assert.ok(!oldNames.has(edge.node),'Existing IDs block has incoming connection; stop.');
}
const credential=others.find(n=>n.name==='Enviar WhatsApp (Evolution API)')?.credentials;
const y=Math.max(...others.map(n=>n.position[1]+(n.type.endsWith('stickyNote')?(n.parameters.height||300):0)))+500;
const make=(id,name,type,x,parameters,typeVersion=2)=>({id,name,type:'n8n-nodes-base.'+type,typeVersion,position:[x,y],parameters});
const names={manual:'IDs · Iniciar consulta',form:'IDs · O que consultar?',query:'IDs · Preparar consulta',gate:'IDs · Consultar API?',http:'IDs · Consultar Evolution',format:'IDs · Resultados'};
const newNodes=[
 make('ids-manual',names.manual,'manualTrigger',0,{},1),
 {...make('ids-wait',names.form,'wait',260,{
  resume:'form',formTitle:'Consultar IDs do WhatsApp',
  formDescription:'Escolha o que deseja listar na conexão SEU_CLIENTE. Você poderá copiar os IDs na tabela de resultados do n8n.',
  formFields:{values:[
   {fieldLabel:'O que você quer consultar?',fieldName:'opcao',fieldType:'dropdown',fieldOptions:{values:['Todos os grupos e comunidades','Grupos comuns','Comunidades','Grupos de avisos','Instância e conexão','Canais de voz (disponibilidade)'].map(option=>({option}))},defaultValue:'Todos os grupos e comunidades',requiredField:true},
   {fieldLabel:'Filtrar por nome (opcional)',fieldName:'filtro',fieldType:'text',placeholder:'Ex.: XP, família, trabalho',requiredField:false},
  ]},responseMode:'onReceived',options:{appendAttribution:false,formSubmittedText:'Consulta recebida. Volte ao n8n e abra o cartão IDs · Resultados na visualização Table para copiar o ID.'},
  limitWaitTime:true,limitType:'afterTimeInterval',resumeAmount:10,resumeUnit:'minutes',
 },1.1),webhookId:'8fa9ecc7-a4a7-4a81-ace4-19f6f20c0001',notes:'Ao executar o bloco, o n8n abre este formulário. Se o navegador bloquear a janela, clique no link da execução em espera. O formulário expira após 10 minutos.',notesInFlow:true},
 make('ids-url',names.query,'code',520,{mode:'runOnceForAllItems',jsCode:fs.readFileSync(path.join(__dirname,'ids_query.js'),'utf8')}),
 make('ids-gate',names.gate,'if',780,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'query-supported',leftValue:'={{ $json.consultarAPI }}',rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},2.2),
 {...make('ids-http',names.http,'httpRequest',1040,{method:'GET',url:'={{ $json.url }}',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',options:{timeout:30000}},4.2),credentials:credential,retryOnFail:false,onError:'stopWorkflow'},
 make('ids-formato',names.format,'code',1300,{mode:'runOnceForAllItems',jsCode:fs.readFileSync(path.join(__dirname,'ids_format.js'),'utf8')}),
 {id:'ids-guia',name:'IDs · Como consultar',type:'n8n-nodes-base.stickyNote',typeVersion:1,position:[-40,y+250],parameters:{width:780,height:340,content:'## Buscar IDs — bloco independente\n1. No botão **Execute workflow**, escolha o início **IDs · Iniciar consulta**. Não escolha o agendamento de notícias.\n2. O n8n abre o formulário **IDs · O que consultar?**. Escolha uma categoria e, se quiser, filtre por nome. Se a janela não abrir, clique no link do nó em espera.\n3. Envie o formulário e volte ao editor. Abra **IDs · Resultados → Output → Table**. Copie a coluna **id**.\n\n**Comunidade** é a estrutura principal; **grupo de avisos da comunidade** é o grupo vinculado onde os avisos são publicados.\n\nEste bloco só consulta dados. Não envia mensagens, não altera destinatários e não tem conexão com os nós de notícias. A credencial é da instância SEU_CLIENTE. Canais de voz não têm rota de listagem nesta versão.'}},
];
// A versão instalada do Wait usa `values` para a coleção de campos do formulário.
w.nodes=[...others,...newNodes];
for(const name of oldNames)delete w.connections[name];
const edge=node=>({node,type:'main',index:0});
for(const [a,b]of [[names.manual,names.form],[names.form,names.query],[names.query,names.gate],[names.http,names.format]])w.connections[a]={main:[[edge(b)]]};
w.connections[names.gate]={main:[[edge(names.http)],[edge(names.format)]]};
assert.deepEqual(w.nodes.filter(n=>!isIds(n)),original.nodes.filter(n=>!isIds(n)));
for(const [name,c]of Object.entries(original.connections))if(!oldNames.has(name))assert.deepEqual(w.connections[name],c);
for(const key of Object.keys(original))if(!['nodes','connections'].includes(key))assert.deepEqual(w[key],original[key]);
fs.writeFileSync(output,JSON.stringify(Array.isArray(data)?[w]:w,null,2)+'\n');
console.log(JSON.stringify({preservedNodes:others.length,idsNodes:newNodes.length,otherConnectionsUnchanged:true,settingsUnchanged:true}));

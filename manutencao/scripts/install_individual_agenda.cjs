const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const input=process.argv[2]||'noticias_investimento_whatsapp.json',output=process.argv[3]||input;
const stateCredential=process.argv[4];
const raw=JSON.parse(fs.readFileSync(input,'utf8')),w=Array.isArray(raw)?raw[0]:raw;
const before=structuredClone(w),get=name=>w.nodes.find(n=>n.name===name);
const oldNames=w.nodes.filter(n=>n.id.startsWith('agenda-')).map(n=>n.name);
w.nodes=w.nodes.filter(n=>!n.id.startsWith('agenda-'));for(const name of oldNames)delete w.connections[name];
const config=get('Configurar Cliente');
const fields=config.parameters.assignments.assignments;
const defaults={enviarLinksFontes:true,periodicidade:'intervalo',intervaloMinutos:60,inicioEnvios:'08:00',fimEnvios:'19:00',horarioEnvioDiario:'08:00',resumaoAtivo:true,horarioResumao:'19:00',estadoUrl:'http://noticias-estado:8090'};
for(const [name,value]of Object.entries(defaults))if(!fields.some(a=>a.name===name))fields.push({id:'config-'+name,name,value,type:typeof value});
config.notes='periodicidade: intervalo ou diario. intervaloMinutos: 5 ou mais (30, 60...). inicioEnvios/fimEnvios: HH:MM. No modo diario, use horarioEnvioDiario. horarioResumao interrompe as notícias individuais até o dia seguinte e monta uma única mensagem com TODAS as notícias registradas como enviadas hoje. enviar=false permite prévia manual sem registrar envios; agenda automática fica em silêncio. enviarLinksFontes controla os links em ambos os formatos. Publique após mudar os campos.';
const edge=node=>({node,type:'main',index:0});
const connect=(a,b)=>w.connections[a]={main:[[edge(b)]]};
const branch=(a,t,f)=>w.connections[a]={main:[[edge(t)],[edge(f)]]};
const make=(id,name,type,position,parameters,typeVersion=2)=>{const n={id:'agenda-'+id,name,type:'n8n-nodes-base.'+type,typeVersion,position,parameters};w.nodes.push(n);return n};
const code=(id,name,pos,jsCode)=>make(id,name,'code',pos,{mode:'runOnceForAllItems',jsCode});
const condition=(id,name,pos,value,expected)=>make(id,name,'if',pos,{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'cond-'+id,leftValue:value,rightValue:expected??'',operator:expected===undefined?{type:'boolean',operation:'true',singleValue:true}:{type:'string',operation:'equals'}}],combinator:'and'},options:{}},2.2);
const http=(id,name,pos,route,body,retry=false)=>{
 const base="$('Configurar Cliente').first().json.estadoUrl";
 const n=make(id,name,'httpRequest',pos,{method:'POST',url:`={{ (${base}.endsWith('/') ? ${base}.slice(0,-1) : ${base}) + '${route}' }}`,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:body,options:{timeout:30000}},4.2);
 if(stateCredential)n.credentials={httpHeaderAuth:{id:stateCredential,name:'Histórico de notícias'}};
 if(retry){n.retryOnFail=true;n.maxTries=3;n.waitBetweenTries=1000}
 return n;
};
const trigger=w.nodes.find(n=>n.type==='n8n-nodes-base.scheduleTrigger');
delete w.connections[trigger.name];trigger.name='Agenda · Verificar a cada minuto';trigger.parameters={rule:{interval:[{field:'cronExpression',expression:'* * * * *'}]}};trigger.position=[-2000,200];
trigger.notes='Verifica somente o relógio e o histórico. RSS e Gemini só executam nos horários configurados no card Configurar Cliente.';
const manual=make('manual','Notícias · Testar agenda','manualTrigger',[-2000,400],{},1);
connect(trigger.name,config.name);connect(manual.name,config.name);config.position=[-1780,200];
http('tick','Agenda · Decidir execução',[-1550,200],'/tick',"={{ {config:$('Configurar Cliente').first().json,executionId:$execution.id,manual:$execution.mode==='manual'} }}",true);
// Roteamento determinístico: calcula booleanos no código e usa IF boolean (Isee comprovado).
// IF com comparação de string + expressão falha de forma intermitente no n8n (rota 'nada' como true).
code('router','Agenda · Preparar rota',[-1330,200],"const t=$input.first().json;return [{json:{...t,rotaNoticias:t.acao==='noticias',rotaResumao:t.acao==='resumao'}}];");
condition('is-news','Agenda · Coletar notícias?',[-1170,200],'={{ $json.rotaNoticias }}');
condition('is-digest','Agenda · Montar resumão?',[-1390,500],'={{ $json.rotaResumao }}');
make('nothing','Agenda · Nada a enviar', 'noOp',[-850,700],{},1);
connect(config.name,'Agenda · Decidir execução');connect('Agenda · Decidir execução','Agenda · Preparar rota');connect('Agenda · Preparar rota','Agenda · Coletar notícias?');
const feeds=w.nodes.filter(n=>n.type==='n8n-nodes-base.rssFeedRead');
w.connections['Agenda · Coletar notícias?']={main:[feeds.map(n=>edge(n.name)),[edge('Agenda · Montar resumão?')]]};
for(const n of feeds){n.alwaysOutputData=true;n.onError='continueRegularOutput'}
branch('Agenda · Montar resumão?','Montar Prompt','Agenda · Nada a enviar');
const selection=fs.readFileSync(path.join(__dirname,'editorial_selection.js'),'utf8').replace('.slice(0,config.maxNoticias)','.slice(0,200)');
get('Selecionar Notícias').parameters.jsCode=`const result=(()=>{${selection}})();return result.length?result:[{json:{semNoticias:true}}];`;
http('filter','Histórico · Filtrar inéditas',[-250,300],'/filter',"={{ {config:$('Configurar Cliente').first().json,jobId:$('Agenda · Decidir execução').first().json.jobId,noticias:$input.all().map(i=>i.json).filter(n=>!n.semNoticias)} }}",true);
condition('has-news','Histórico · Há notícias novas?',[0,300],'={{ $json.noticias.length > 0 }}');
code('unpack','Histórico · Notícias inéditas',[220,300],"return $input.first().json.noticias.map(n=>({json:n}));");
connect('Selecionar Notícias','Histórico · Filtrar inéditas');connect('Histórico · Filtrar inéditas','Histórico · Há notícias novas?');
branch('Histórico · Há notícias novas?','Histórico · Notícias inéditas','Agenda · Concluir execução');connect('Histórico · Notícias inéditas','Buscar matéria');
get('Preparar HTML').parameters.jsCode="return {json:{fonte: $('Histórico · Notícias inéditas').item.json, data: typeof $json.data === 'string' ? $json.data.slice(0,2000000) : '<html></html>'}};";
get('Montar Prompt').parameters.jsCode=fs.readFileSync(path.join(__dirname,'individual_prompt.js'),'utf8');
get('Extrair Resposta da IA').parameters.jsCode=fs.readFileSync(path.join(__dirname,'individual_extract.js'),'utf8');
condition('has-source','IA · Há texto suficiente?',[800,500],'={{ !$json.semNoticias }}');
connect('Montar Prompt','IA · Há texto suficiente?');branch('IA · Há texto suficiente?','Gemini · Preparar tentativa','Agenda · Concluir execução');
http('touch','Agenda · Manter execução',[1100,0],'/touch',"={{ {jobId:$('Agenda · Decidir execução').first().json.jobId} }}",true);
condition('lease','Agenda · Execução válida?',[1320,0],'={{ $json.continuar }}');
code('payload','Gemini · Usar payload',[1540,0],"return [{json:$('Gemini · Preparar tentativa').first(0,-1).json}];");
connect('Gemini · Preparar tentativa','Agenda · Manter execução');connect('Agenda · Manter execução','Agenda · Execução válida?');
branch('Agenda · Execução válida?','Gemini · Usar payload','Agenda · Concluir execução');connect('Gemini · Usar payload','Gemini (JSON estruturado)');
get('Gemini (JSON estruturado)').parameters.jsonBody='={{ $json.geminiBody }}';
condition('has-output','IA · Há conteúdo para enviar?',[1550,550],'={{ !$json.semNoticias }}');
connect('Extrair Resposta da IA','IA · Há conteúdo para enviar?');branch('IA · Há conteúdo para enviar?','Uma notícia por vez','Agenda · Concluir execução');
const loop=get('Uma notícia por vez');loop.parameters={batchSize:1,options:{}};
w.connections[loop.name]={main:[[edge('Agenda · Concluir execução')],[edge('Envio habilitado?')]]};
connect('Ver Resultado (Teste)',loop.name);
http('reserve','Histórico · Reservar envio',[2040,300],'/reserve',"={{ {jobId:$('Agenda · Decidir execução').first().json.jobId||'',artigo:$json} }}");
condition('allowed','Histórico · Pode enviar?',[2260,300],'={{ $json.enviar }}');
code('restore','Histórico · Preparar envio',[2480,300],"const r=$input.first().json;return [{json:{...r.artigo,registroId:r.registroId}}];");
connect('Validar destino','Histórico · Reservar envio');connect('Histórico · Reservar envio','Histórico · Pode enviar?');
branch('Histórico · Pode enviar?','Histórico · Preparar envio','Intervalo 8–10 segundos');connect('Histórico · Preparar envio','Tem imagem?');
code('ack','Histórico · Conferir confirmação',[3100,300],"const r=$input.first().json;if(!r?.key?.id||['ERROR','FAILED'].includes(r.status))throw new Error('Envio sem confirmação da Evolution. A reserva impede repetição automática; confira a entrega.');return [{json:{jobId:$('Agenda · Decidir execução').first().json.jobId,registroId:$('Histórico · Preparar envio').first(0,-1).json.registroId,messageId:r.key.id}}];");
http('confirm','Histórico · Registrar enviado',[3320,300],'/confirm','={{ $json }}',true);
for(const name of ['Enviar WhatsApp (Evolution API)','Enviar imagem (Evolution API)']){
 const n=get(name);n.retryOnFail=false;delete n.onError;connect(name,'Histórico · Conferir confirmação');
}
connect('Histórico · Conferir confirmação','Histórico · Registrar enviado');connect('Histórico · Registrar enviado','Intervalo 8–10 segundos');connect('Intervalo 8–10 segundos',loop.name);
http('finish','Agenda · Concluir execução',[3600,600],'/finish',"={{ {jobId:$('Agenda · Decidir execução').first().json.jobId} }}",true);
make('guide','Agenda · Como usar','stickyNote',[-1800,-450],{width:950,height:400,content:'## Notícias individuais + fechamento do dia\nConfigure periodicidade (intervalo/diario), intervaloMinutos, inicioEnvios, fimEnvios e horarioEnvioDiario. O resumão usa horarioResumao e interrompe novos envios até o próximo dia.\nCada notícia sai com imagem, se houver, e texto didático. O histórico impede repetição entre execuções e destinos são separados. Sem inéditas/relevantes, não envia.\nO resumão é UMA mensagem com TODAS as notícias confirmadas hoje. enviarLinksFontes controla os links.\nPara prévia manual: enviar=false e executar Notícias · Testar agenda. Para produção: enviar=true e publicar. A verificação por minuto não chama Gemini fora dos horários.\nReservas sem confirmação não são reenviadas automaticamente: confira o WhatsApp antes de liberar um envio incerto.\nO histórico exige o serviço Docker noticias-estado e sua credencial Header Auth.'},1);
get('Como preencher').parameters.content='## Cliente e destino\nConfigure os campos em Configurar Cliente. O controle de agenda e o histórico estão explicados no card Agenda · Como usar. Texto + imagem por notícia; resumão em uma única mensagem no horário definido.';
// IDs e credenciais de Gemini/Evolution ficam como estavam.
for(const old of before.nodes.filter(n=>n.id.startsWith('ids-')))assert.deepEqual(get(old.name),old);
for(const name of ['Gemini (JSON estruturado)','Enviar WhatsApp (Evolution API)','Enviar imagem (Evolution API)'])assert.deepEqual(get(name).credentials,before.nodes.find(n=>n.name===name).credentials);
const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,w.nodes.length);
for(const n of w.nodes)if(n.type==='n8n-nodes-base.code'){
 try{new (Object.getPrototypeOf(async function(){}).constructor)(n.parameters.jsCode)}catch(e){throw new Error(`Código inválido em ${n.name}: ${e.message}`)}
}
for(const [a,routes]of Object.entries(w.connections)){assert(names.has(a),a);for(const channel of routes.main)for(const e of channel)assert(names.has(e.node),e.node)}
w.settings={...w.settings,timezone:'America/Sao_Paulo'};
fs.writeFileSync(output,JSON.stringify(Array.isArray(raw)?[w]:w,null,2)+'\n');
console.log(JSON.stringify({individuals:true,loop:true,persistentHistory:true,dailyDigest:true,nodes:w.nodes.length}));

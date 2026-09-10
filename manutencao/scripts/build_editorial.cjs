const fs=require('node:fs');
const file='noticias_investimento_whatsapp.json';
const w=JSON.parse(fs.readFileSync(file,'utf8'));
const find=name=>w.nodes.find(n=>n.name===name);
const edge=name=>({node:name,type:'main',index:0});
const config=find('Configurar Cliente');
if(config.type.endsWith('.code')) {
 const value=new Function(config.parameters.jsCode)()[0].json;
 config.type='n8n-nodes-base.set';config.typeVersion=3.4;
 config.parameters={mode:'manual',assignments:{assignments:Object.entries(value).map(([name,value])=>({id:'field-'+name,name,value,type:typeof value}))},options:{}};
}
const fields=config.parameters.assignments.assignments;
if(!fields.some(a=>a.name==='usarImagem'))fields.push({id:'usarImagem',name:'usarImagem',value:true,type:'boolean'});
config.notes='Preencha numero com seu telefone (país + DDD) ou ID do grupo. enviar=false revisa sem enviar; enviar=true envia. usarImagem=true envia a capa da notícia com o post na legenda, quando disponível. maxNoticias controla a quantidade.';
const added=['Selecionar Notícias','Buscar matéria','Preparar HTML','Extrair texto e imagem','Tem imagem?','Enviar imagem (Evolution API)'];
w.nodes=w.nodes.filter(n=>!added.includes(n.name));
const node=(id,name,type,position,parameters,typeVersion=2)=>({id,name,type:'n8n-nodes-base.'+type,typeVersion,position,parameters});
w.nodes.push(node('editorial-select','Selecionar Notícias','code',[-680,300],{jsCode:fs.readFileSync('manutencao/scripts/editorial_selection.js','utf8')}));
w.nodes.push({...node('editorial-fetch','Buscar matéria','httpRequest',[-460,300],{
 url:'={{ $json.link }}',options:{timeout:20000,response:{response:{responseFormat:'text',outputPropertyName:'data'}},batching:{batch:{batchSize:1,batchInterval:500}}},
},4.2),onError:'continueRegularOutput'});
w.nodes.push(node('editorial-html-input','Preparar HTML','code',[-240,300],{mode:'runOnceForEachItem',jsCode:"return {json:{fonte: $('Selecionar Notícias').item.json, data: typeof $json.data === 'string' ? $json.data.slice(0, 2000000) : '<html></html>'}};"}));
w.nodes.push(node('editorial-html','Extrair texto e imagem','html',[0,300],{
 operation:'extractHtmlContent',sourceData:'json',dataPropertyName:'data',extractionValues:{values:[
 {key:'paragrafos',cssSelector:'.post-content-text p, .entry-content p, .article-content p, .article-body p, .single-content p, article p:not(footer p):not(aside p):not(nav p)',returnValue:'text',returnArray:true,skipSelectors:'script, style, nav, footer, aside'},
 {key:'imagem',cssSelector:'meta[property="og:image"]',returnValue:'attribute',attribute:'content',returnArray:false},
 {key:'imagemTwitter',cssSelector:'meta[name="twitter:image"]',returnValue:'attribute',attribute:'content',returnArray:false},
 ]},options:{trimValues:true,cleanUpText:true}},1.2));
find('Montar Prompt').parameters.jsCode=fs.readFileSync('manutencao/scripts/editorial_prompt.js','utf8');find('Montar Prompt').position=[240,300];
const gemini=find('Gemini (JSON estruturado)');gemini.position=[480,300];gemini.onError='stopWorkflow';gemini.maxTries=2;
gemini.parameters.jsonBody='={{ $json.geminiBody }}';
find('Extrair Resposta da IA').parameters.jsCode=fs.readFileSync('manutencao/scripts/editorial_extract.js','utf8');find('Extrair Resposta da IA').position=[720,300];
find('Uma notícia por vez').position=[940,300];find('Envio habilitado?').position=[1160,300];find('Validar destino').position=[1380,220];find('Ver Resultado (Teste)').position=[1380,520];
const condition={conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'has-image',leftValue:'={{ Boolean($json.imagemUrl) }}',rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}};
w.nodes.push(node('editorial-has-image','Tem imagem?','if',[1600,220],condition,2.2));
const send=find('Enviar WhatsApp (Evolution API)');send.position=[1820,400];
const media=structuredClone(send);media.id='editorial-send-media';media.name='Enviar imagem (Evolution API)';media.position=[1820,160];
media.parameters.url=send.parameters.url.replace('/message/sendText/','/message/sendMedia/');
media.parameters.jsonBody="={{ JSON.stringify({number:$json.numero, mediatype:'image', media:$json.imagemUrl, caption:$json.mensagem}) }}";
media.notes='Envia a URL da capa obtida da matéria com o post completo na legenda. A Evolution detecta o MIME da mídia. Se a mídia falhar, o fluxo para; não repete automaticamente para evitar duplicatas.';
w.nodes.push(media);find('Intervalo 8–10 segundos').position=[2060,300];
w.connections['Juntar Notícias']={main:[[edge('Selecionar Notícias')]]};
for(const [a,b] of [['Selecionar Notícias','Buscar matéria'],['Buscar matéria','Preparar HTML'],['Preparar HTML','Extrair texto e imagem'],['Extrair texto e imagem','Montar Prompt'],['Validar destino','Tem imagem?'],['Enviar imagem (Evolution API)','Intervalo 8–10 segundos']])w.connections[a]={main:[[edge(b)]]};
w.connections['Tem imagem?']={main:[[edge(media.name)],[edge(send.name)]]};
fs.writeFileSync(file,JSON.stringify(w,null,2)+'\n');

// Somente leitura do banco n8n; exporta apenas textos com resposta de envio correspondente.
const fs=require('fs');
const {DatabaseSync}=require('node:sqlite');
const {parse}=require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});
const rows=db.prepare("select e.id,e.startedAt,d.data from execution_entity e join execution_data d on d.executionId=e.id where e.workflowId=? and e.startedAt>=datetime('now','-7 days') order by e.id asc").all('ivbnTE3V5021wcsv');
const batches=[];let matched=0,unmatched=0;
for(const row of rows){
 const runs=parse(row.data).resultData?.runData||{};
 const config=runs['Configurar Cliente']?.[0]?.data?.main?.[0]?.[0]?.json;
 if(!config)continue;
 const outputs=(runs['Extrair Resposta da IA']||[]).flatMap(r=>r.data?.main?.[0]||[]).map(x=>x.json);
 const sent=Object.entries(runs).filter(([name])=>name==='Enviar WhatsApp (Evolution API)'||name==='Enviar imagem (Evolution API)').flatMap(([,r])=>r.flatMap(x=>x.data?.main?.[0]||[])).map(x=>x.json).filter(x=>x.key?.id);
 const entries=[];
 for(const message of sent){
  const text=message.message?.conversation||message.message?.extendedTextMessage?.text||message.message?.imageMessage?.caption;
  const article=outputs.find(n=>n.mensagem===text);
  if(!article){unmatched++;continue}
  matched++;
  const stamp=Number(message.messageTimestamp)||Date.parse(row.startedAt.replace(' ','T')+'Z')/1000;
  const blocks=[...String(article.resumo).matchAll(/^([^\n*]+)\*([^*\n]+)\*[ \t]*$/gm)];
  if(blocks.length && Array.isArray(article.referencias) && article.referencias.length===blocks.length){
   for(let i=0;i<blocks.length;i++){
    const urls=article.referencias.find(r=>r.noticia===i+1)?.links;
    if(!urls?.length)continue;
    const b=blocks[i],resumo=article.resumo.slice(b.index+b[0].length,blocks[i+1]?.index).trim();
    entries.push({sent:stamp,messageId:message.key.id,artigo:{titulo:b[2],resumo,link:urls[0],links:urls,imagemUrl:article.imagemUrl||''}});
   }
  }else{
   const urls=article.links||String(article.link||'').split('|').map(x=>x.trim()).filter(Boolean);
   if(urls.length)entries.push({sent:stamp,messageId:message.key.id,artigo:{titulo:article.titulo,resumo:article.resumo,link:urls[0],links:urls,imagemUrl:article.imagemUrl||''}});
  }
 }
 if(entries.length)batches.push({config,entries});
}
fs.writeFileSync('/tmp/news-private/sent-history.json',JSON.stringify(batches),{mode:0o600});
console.log(JSON.stringify({matchedMessages:matched,unmatchedMessages:unmatched,entries:batches.reduce((n,b)=>n+b.entries.length,0)}));

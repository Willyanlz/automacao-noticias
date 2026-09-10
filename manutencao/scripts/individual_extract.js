const config=$('Configurar Cliente').first().json;
const prepared=$('Montar Prompt').first().json;
const candidate=$input.first().json?.candidates?.[0];
if(!candidate||(candidate.finishReason&&candidate.finishReason!=='STOP'))throw new Error('Gemini não concluiu o texto. Nenhuma mensagem desta resposta será enviada.');
let result;
try{result=JSON.parse(candidate.content.parts.filter(p=>!p.thought).map(p=>p.text||'').join(''));}catch{throw new Error('Gemini retornou JSON inválido.');}
if(!Array.isArray(result))throw new Error('Resposta da IA precisa ser um array.');
const fontes=prepared.noticias;
const ids=new Set();
const validated=result.map(n=>{
 if(!n||['id','emoji','titulo','resumo'].some(k=>typeof n[k]!=='string'||!n[k].trim()))throw new Error('Notícia incompleta.');
 const fonte=fontes.find(f=>f.id===n.id);
 if(!fonte||ids.has(n.id))throw new Error('Fonte desconhecida ou repetida na resposta.');
 ids.add(n.id);
 const titulo=n.titulo.replace(/\*/g,'').trim().toLocaleUpperCase('pt-BR');
 const resumo=n.resumo.trim();
 if(resumo.length<100||/https?:\/\//i.test(resumo))throw new Error('Texto insuficiente ou com links inesperados.');
 if(!prepared.diario&&titulo.length+resumo.length>1800)throw new Error('Notícia individual muito longa; limite editorial de 1800 caracteres.');
 return {...fonte,emoji:n.emoji.trim(),titulo,resumo,tituloOriginal:fonte.tituloOriginal||fonte.titulo};
});
if(prepared.diario){
 if(validated.length!==fontes.length||fontes.some(f=>!ids.has(f.id)))throw new Error('O resumão precisa incluir TODAS as notícias enviadas, sem omissões.');
 const ordered=fontes.map(f=>validated.find(n=>n.id===f.id));
 const blocks=ordered.map(n=>`${n.emoji} *${n.titulo}*\n${n.resumo}`);
 const links=ordered.map((n,i)=>`Notícia ${i+1}: ${(n.links||[n.link]).join(' | ')}`).join('\n');
 const mensagem=`🚨 *RESUMÃO DO MERCADO — ${ordered.length} ${ordered.length===1?'NOTÍCIA':'NOTÍCIAS'} DO DIA*\n\n${blocks.join('\n\n')}`+(config.enviarLinksFontes!==false?`\n\n${links}`:'');
 // Uma mensagem só: nunca cortar ou dividir silenciosamente o resumo solicitado.
 if(mensagem.length>60000)throw new Error('O resumão completo excede 60000 caracteres. Não foi cortado nem dividido; revise o volume antes de enviar.');
 return [{json:{...config,tipo:'resumao',mensagem,imagemUrl:'',quantidadeNoticias:ordered.length,noticias:ordered,semNoticias:false}}];
}
if(!validated.length)return [{json:{semNoticias:true}}];
return validated.map(n=>({json:{...config,...n,tipo:'noticia',links:n.links||[n.link],
 mensagem:`${n.emoji} *${n.titulo}*\n\n${n.resumo}`+(config.enviarLinksFontes!==false?`\n\n${n.link}`:''),
 imagemUrl:config.usarImagem!==false?n.imagemUrl||'':'',semNoticias:false}}));

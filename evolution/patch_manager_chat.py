"""Correções pontuais para o bundle do Manager incluído na Evolution 2.3.7."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / 'manager'
original = root / 'assets/index-CO3NSIFj.js'
content = original.read_text(encoding='utf-8')

def replace_once(old, new):
    global content
    if content.count(old) != 1:
        raise SystemExit('Bundle incompatível; nenhuma alteração publicada: ' + old[:70])
    content = content.replace(old, new, 1)

replace_once('rY=async({instanceName:e})=>(await Ee.post(`/chat/findChats/${e}`,{where:{}})).data', '''rY=async({instanceName:e})=>{
 const name=encodeURIComponent(e);
 const results=await Promise.allSettled([
  Ee.post(`/chat/findChats/${name}`,{where:{}}),
  Ee.post(`/chat/findContacts/${name}`,{where:{}}),
  Ee.get(`/group/fetchAllGroups/${name}?getParticipants=false`)
 ]);
 if(results[0].status==="rejected")throw results[0].reason;
 const rows=new Map();
 const merge=(v)=>{if(v.remoteJid)rows.set(v.remoteJid,{...rows.get(v.remoteJid),...v})};
 for(const [index,label] of [[1,"contatos"],[2,"grupos"]]){
  const result=results[index];
  if(result.status!=="fulfilled"){me.error(`Não foi possível carregar ${label}. Confira a conexão e a credencial.`);continue}
  for(const item of result.value.data||[]){
   const jid=item.remoteJid||(index===2?item.id:null);
   merge({...item,id:item.id||jid,remoteJid:jid,pushName:item.pushName||item.subject||jid});
  }
 }
 for(const item of results[0].value.data||[]){
  const old=rows.get(item.remoteJid);
  merge({...item,pushName:item.pushName||old?.pushName||item.remoteJid,
   profilePicUrl:item.profilePicUrl||old?.profilePicUrl});
 }
 return Array.from(rows.values());
}''')

dialog = '''function LocalNewChat({onSelect}){
 const [open,setOpen]=y.useState(false),[value,setValue]=y.useState(""),[error,setError]=y.useState("");
 const submit=(event)=>{
  event.preventDefault();let jid=value.trim();
  if(!jid.includes("@")){
   if(!/^\\+?[\\d\\s().-]+$/.test(jid)){setError("Digite o telefone com DDI e DDD ou um ID válido.");return}
   jid=jid.replace(/\\D/g,"");
   if(!/^\\d{10,15}$/.test(jid)){setError("Use de 10 a 15 dígitos, incluindo DDI e DDD.");return}
   jid+="@s.whatsapp.net";
  }
  if(!/^(?:\\d{10,15}@s\\.whatsapp\\.net|[\\d-]+@g\\.us|\\d+@lid)$/.test(jid)){
   setError("ID inválido. Use um telefone, ID de grupo @g.us ou contato @lid.");return
  }
  onSelect(jid);setOpen(false);setValue("");setError("");
 };
 return i.jsxs(qe.Fragment,{children:[
  i.jsxs(se,{variant:"ghost",className:"w-full justify-start gap-2 px-2 text-left",
   "aria-label":"Nova conversa",onClick:()=>{setError("");setOpen(true)},
   children:[i.jsx(Bl,{className:"h-4 w-4"}),i.jsx("span",{className:"grow",children:"Chat"}),i.jsx(cs,{className:"h-4 w-4"})]}),
  i.jsx(Pt,{open,onOpenChange:setOpen,children:i.jsxs(Nt,{children:[
   i.jsxs(Mt,{children:[i.jsx(zt,{children:"Nova conversa"}),i.jsx(eo,{children:"Informe um telefone com DDI e DDD ou o ID do grupo. Abrir a conversa não envia mensagens."})]}),
   i.jsxs("form",{onSubmit:submit,children:[
    i.jsx("label",{htmlFor:"local-chat-destination",children:"Telefone ou ID"}),
    i.jsx(ne,{id:"local-chat-destination",value,onChange:event=>{setValue(event.target.value);setError("")},placeholder:"Ex.: 5511999999999",autoFocus:true}),
    error&&i.jsx("p",{role:"alert",className:"text-red-500 text-sm mt-2",children:error}),
    i.jsx(se,{type:"submit",className:"mt-4",children:"Abrir conversa"})
   ]})
  ]})})
 ]});
}
'''
replace_once('function tk(){', dialog + 'function tk(){')
old='i.jsxs(se,{variant:"ghost",className:"w-full justify-start gap-2 px-2 text-left",children:[i.jsx("div",{className:"flex h-7 w-7 items-center justify-center rounded-full",children:i.jsx(Bl,{className:"h-4 w-4"})}),i.jsx("div",{className:"grow overflow-hidden text-ellipsis whitespace-nowrap text-sm",children:"Chat"}),i.jsx(cs,{className:"h-4 w-4"})]})'
replace_once(old, 'i.jsx(LocalNewChat,{onSelect:w})')
replace_once('u?.map(C=>C.remoteJid.includes("@s.whatsapp.net")', 'f?.map(C=>/(@s\\.whatsapp\\.net|@lid)$/.test(C.remoteJid)')
replace_once('g(`/manager/instance/${h}/chat/${C}`)', 'g(`/manager/instance/${h}/chat/${encodeURIComponent(C)}`)')
# Os links não devem navegar para # depois da seleção de uma conversa.
content=content.replace('to:"#",onClick:()=>w(C.remoteJid)', 'to:`/manager/instance/${h}/chat/${encodeURIComponent(C.remoteJid)}`')

digest=hashlib.sha256(content.encode()).hexdigest()[:12]
bundle='index-chat-'+digest+'.js'
(root / 'assets' / bundle).write_text(content,encoding='utf-8')
index=root/'index.html'
html=index.read_text(encoding='utf-8')
import re
html,count=re.subn(r'/assets/index-[^" ]+\.js(?:\?[^" ]*)?', '/assets/'+bundle,html)
assert count==1
index.write_text(html,encoding='utf-8')
print(json.dumps({'bundle':bundle,'patched':True}))

const fs=require('fs');const assert=require('assert/strict');const path=require('path');
const check=fs.readFileSync(path.join(__dirname,'../scripts/gemini_result.js'),'utf8');
const attempt=fs.readFileSync(path.join(__dirname,'../scripts/gemini_attempt.js'),'utf8');
const evaluate=(response,number=1)=>new Function('$input','$',check)({first:()=>({json:response})},()=>({first:()=>({json:{tentativaGemini:number}})}))[0].json;
for(const statusCode of [408,429,500,502,503,504]) {
 const r=evaluate({statusCode,body:JSON.stringify({error:{code:statusCode}})});
 assert.equal(r.geminiConcluido,false);assert.ok(r.esperaSegundos>=10&&r.esperaSegundos<=16,'espera='+r.esperaSegundos);
}
for(const error of ['ETIMEDOUT','The connection to the server was closed unexpectedly',{message:'Request timed out',code:'ESOCKETTIMEDOUT'}])assert.equal(evaluate({error}).geminiConcluido,false);
for(const statusCode of [400,401,403,404])assert.throws(()=>evaluate({statusCode,body:'{}'}),/não temporário/);
assert.throws(()=>evaluate({error:'Credentials not found'}),/não temporário/);
assert.equal(evaluate({statusCode:429,headers:{'retry-after':'45'},body:'{}'}).esperaSegundos,45);
assert.equal(evaluate({statusCode:429,headers:{'retry-after':'900'},body:'{}'}).esperaSegundos,60);
assert.equal(evaluate({statusCode:429,body:JSON.stringify({error:{details:[{retryDelay:'1200s'}]}})}).esperaSegundos,60);
assert.throws(()=>evaluate({statusCode:503,body:'{}'},6),/após 6 tentativa/);
const success={candidates:[{content:{parts:[{text:'[]'}]},finishReason:'STOP'}]};
assert.deepEqual(evaluate({statusCode:200,body:JSON.stringify(success)},4),{...success,geminiConcluido:true,tentativaGemini:4});
const source={prompt:'Notícias originais',noticias:[{link:'https://example.com'}],geminiBody:{contents:[]}};
const next=new Function('$input','$',attempt)({first:()=>({json:{tentativaGemini:3}})},()=>({first:()=>({json:source})}))[0].json;
assert.equal(next.tentativaGemini,4);assert.deepEqual(next.noticias,source.noticias);
let state={...source};let delivered=0;let threw=false;
for(const response of [{statusCode:503,body:'{}'},{error:'ETIMEDOUT'},{statusCode:429,body:'{}'},{statusCode:200,body:JSON.stringify(success)}]) {
  const prepared=new Function('$input','$',attempt)({first:()=>({json:state})},()=>({first:()=>({json:source})}))[0].json;
  try{state=evaluate(response,prepared.tentativaGemini);if(state.geminiConcluido)delivered++;}
  catch(e){threw=true;}
}
assert.equal(state.geminiConcluido,true);assert.equal(delivered,1);assert.equal(threw,false);

// Já na 6ª tentativa o sistema falha rápido.
let s6={...source};let falhouRapido=false;
for(let i=0;i<6;i++){const prep=new Function('$input','$',attempt)({first:()=>({json:s6})},()=>({first:()=>({json:source})}))[0].json;try{s6=evaluate({statusCode:503,body:'{}'},prep.tentativaGemini);}catch(e){falhouRapido=true;}}
assert.equal(falhouRapido,true,'Na 6ª tentativa deve falhar rápido sem esperar.');
console.log('PASS reintentos imediatos (10-16s), Retry-After com teto 60s, 6 tentativas com erro rápido e retorno após sucesso.');

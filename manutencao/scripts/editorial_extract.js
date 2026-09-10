const resposta = $input.first().json;
const fontes = $('Montar Prompt').first().json.noticias;
const config = $('Configurar Cliente').first().json;
const candidato = resposta?.candidates?.[0];
if (!candidato || (candidato.finishReason && candidato.finishReason !== 'STOP')) throw new Error('Gemini não concluiu o resumão. Envio interrompido.');
let noticias;
try { noticias = JSON.parse(candidato.content.parts.filter(p=>!p.thought).map(p=>p.text||'').join('').trim()); }
catch { throw new Error('Gemini retornou JSON inválido. Envio interrompido.'); }
if (!Array.isArray(noticias)) throw new Error('Gemini não retornou um array JSON válido.');
if (!noticias.length) return [];
if (noticias.length !== 1) throw new Error('O Gemini deve retornar exatamente 1 objeto contendo o resumão.');
const n = noticias[0];
if (!n || ['emoji','titulo','resumo','link'].some(k=>typeof n[k] !== 'string' || !n[k].trim())) throw new Error('Resumão incompleto retornado pela IA.');
const titulo = n.titulo.replace(/\*/g,'').trim().toLocaleUpperCase('pt-BR');
const resumo = n.resumo.trim();
if (resumo.length < 100 || /https?:\/\//i.test(resumo)) throw new Error('Resumão insuficiente ou com links no corpo. Envio interrompido.');
if (/RESUMÃO DO MERCADO/i.test(resumo)) throw new Error('A abertura deve aparecer somente no título, não no resumo.');
const links = [...new Set(n.link.split('|').map(link=>link.trim()).filter(Boolean))];
if (!links.length) throw new Error('Nenhuma fonte válida foi encontrada no resumão.');
const fontesUsadas = links.map(link=>{
 const fonte=fontes.find(f=>f.link===link);
 if (!fonte) throw new Error('Link retornado pelo Gemini não pertence às fontes recebidas.');
 return fonte;
});
const blocos = [...resumo.matchAll(/^([^\n*]+)\*([^*\n]+)\*[ \t]*$/gm)];
if (!blocos.length || blocos.some(b=>b[2]!==b[2].toLocaleUpperCase('pt-BR'))) throw new Error('Cada notícia precisa de título em caixa alta e negrito.');
const quantidade = blocos.length;
if (!Array.isArray(n.referencias) || n.referencias.length !== quantidade) throw new Error('Cada notícia precisa de referências associadas.');
const referencias = Array.from({length:quantidade},(_,i)=>{
 const entradas=n.referencias.filter(r=>r && r.noticia===i+1);
 if (entradas.length!==1 || !Array.isArray(entradas[0].links) || !entradas[0].links.length) throw new Error('Numeração ou referências de notícia inválidas.');
 const urls=entradas[0].links;
 if (urls.some(url=>typeof url!=='string' || !links.includes(url))) throw new Error('Referência fora das fontes selecionadas.');
 return {noticia:i+1,links:[...new Set(urls)]};
});
if (links.some(url=>!referencias.some(r=>r.links.includes(url)))) throw new Error('Fonte sem associação a uma notícia.');
const tituloEsperado = `RESUMÃO DO MERCADO — ${quantidade} ${quantidade===1?'NOTÍCIA':'NOTÍCIAS'} PARA FICAR DE OLHO`;
if (titulo !== tituloEsperado) throw new Error('A quantidade no título não corresponde aos blocos de notícias.');
const emoji = '🚨';
const rodape = referencias.map(r=>`Notícia ${r.noticia}: ${r.links.join(' | ')}`).join('\n');
const enviarLinksFontes = config.enviarLinksFontes !== false;
const mensagem = `${emoji} *${titulo}*\n\n${resumo}` + (enviarLinksFontes ? `\n\n${rodape}` : '');
if (mensagem.length > 3000) throw new Error('Mensagem final ultrapassou 3000 caracteres. Envio interrompido.');
const imagemUrl = config.usarImagem !== false
 ? (fontesUsadas.find(f=>typeof f.imagemUrl==='string' && /^https:\/\//i.test(f.imagemUrl))?.imagemUrl || '') : '';
return [{json:{emoji,titulo,resumo,link:links.join(' | '),links,referencias,enviarLinksFontes,quantidadeNoticias:quantidade,mensagem,fallback:false,imagemUrl,
 cliente:config.cliente,instancia:config.instancia,numero:config.numero,evolutionUrl:config.evolutionUrl,enviar:config.enviar}}];

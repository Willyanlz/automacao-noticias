#!/usr/bin/env node
// upgrade_multi_destino.cjs <workflow.json> [saida.json]
//
// Substitui o node "Enviar e Registrar" (template v3 compacta) por uma versao
// multi-destino equivalente ao PET, mantendo o hardening de imagem urLimagem
// (entidades HTML e sendText fallback).
//
// Aceita no "numero"/"numeroDestino":
//   1. array real            ["5511999999999","120363123@g.us"]
//   2. JSON em string        ["5511999999999","120363123@g.us"]
//   3. um por linha          5511999999999\n5511888888888
//   4. separado por virgula ou ponto e virgula
//
// Uso: node upgrade_multi_destino.cjs noticias_v3.json saida.json

const fs = require('fs');

const INPUT = process.argv[2];
const OUTPUT = process.argv[3];
if (require.main === module && !INPUT) {
  console.error('uso: node upgrade_multi_destino.cjs <workflow.json> [saida.json]');
  process.exit(1);
}

const NEW_SEND_PART1 = `const item = $input.first().json;
if (item.semNoticias) return [{ json: item }];
const config = { ...item.config };
const escopoHistorico = [config.cliente || 'cliente', config.instancia || 'instancia'].map(v => String(v).trim()).join('|');
if (config.enviar !== true) return [{ json: { preview: true, titulo: item.titulo, texto: item.texto } }];

// DESTINOS multiplos: array, JSON em string, um por linha, virgula ou ponto e virgula
let destinosRaw = item.numeroDestino ?? config.numero ?? '';
let destinos = [];
if (Array.isArray(destinosRaw)) {
  destinos = destinosRaw;
} else {
  const textoDest = String(destinosRaw).trim();
  if (!textoDest) throw new Error('Nenhum destinatario configurado');
  if (textoDest.startsWith('[')) {
    try {
      const parsed = JSON.parse(textoDest);
      if (!Array.isArray(parsed)) throw new Error('O campo numero precisa conter um array');
      destinos = parsed;
    } catch (error) {
      throw new Error('O campo numero contém JSON inválido. Exemplo: ["5511999999999","120363123@g.us"]');
    }
  } else {
    destinos = textoDest.split(/[\\n,;]+/).map(v => String(v).trim()).filter(Boolean);
  }
}
const normalizarDestino = valor => {
  const raw = String(valor ?? '').trim();
  if (!raw) throw new Error('Destino vazio');
  if (/^[0-9]+(?:-[0-9]+)?@g\\.us$/.test(raw)) return raw;
  if (/^[0-9]+@broadcast$/.test(raw)) return raw;
  if (raw === 'status@broadcast') return raw;
  const numero = raw.replace(/\\D/g, '');
  if (!/^[1-9][0-9]{7,14}$/.test(numero)) throw new Error('Destino invalido: ' + raw);
  return numero;
};
const destinosUnicos = [...new Set(destinos.map(normalizarDestino))];
if (!destinosUnicos.length) throw new Error('Nenhum destinatario valido encontrado');

const base = String(config.evolutionUrl || '').replace(/\\/$/, '');
const http = async ({ method = 'GET', url, headers = {}, body, json = false, timeout = 30000 }) => {
  if (this && this.helpers && this.helpers.httpRequest) {
    return await this.helpers.httpRequest({ method, url, headers, body, json, timeout });
  }
  if (typeof fetch !== 'function') throw new Error('Nenhum cliente HTTP disponivel no Code node');
  const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(timeout) };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!init.headers['Content-Type'] && !init.headers['content-type']) init.headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(method + ' ' + url + ' -> HTTP ' + response.status + ': ' + text.slice(0, 300));
  if (json) return text ? JSON.parse(text) : null;
  return text;
};
// send helper inserted
if (!base) throw new Error('evolutionUrl nao configurada');
// Corrige URLs de imagem com entidades HTML (ex.: &#039;) e caracteres especiais
const decodificar = value => String(value || '').replace(/&#0?39;|&#x27;/gi, "'").replace(/&quot;/gi, '"').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&');
const encUri = str => String(str).split(/(%[0-9A-Fa-f]{2})/g).map(p => /^%[0-9A-Fa-f]{2}$/.test(p) ? p : encodeURI(p)).join('');
const urlImagem = raw => {
  const limpa = decodificar(raw);
  if (!/^https?:\\/\\//i.test(limpa)) return '';
  try {
    const u = new URL(limpa);
    u.pathname = u.pathname.split('/').map(seg => encUri(seg).replace(/'/g, '%27').replace(/&/g, '%26')).join('/');
    if (u.search) u.search = encUri(u.search).replace(/'/g, '%27');
    return u.href;
  } catch {
    return limpa;
  }
};
const imagem = urlImagem(item.imagemUrl);`;

const NEW_SEND_PART2 = `
const enviarPara = async (destino) => {
  const headers = { apikey: config.evolutionApiKey || config.apikey || '' };
  let tentativa = null;
  if (imagem) {
    try {
      tentativa = await http({ method: 'POST', url: base + '/message/sendMedia/' + encodeURIComponent(config.instancia), headers, body: { number: destino, mediatype: 'image', media: imagem, caption: item.texto }, json: true, timeout: 30000 });
      if (tentativa?.status === 'ERROR') throw new Error('Evolution retornou erro no sendMedia');
    } catch (error) {
      console.log('sendMedia falhou (' + error.message + '), reenviando como texto');
      tentativa = null;
    }
  }
  if (!tentativa) {
    tentativa = await http({ method: 'POST', url: base + '/message/sendText/' + encodeURIComponent(config.instancia), headers, body: { number: destino, text: item.texto, linkPreview: false }, json: true, timeout: 30000 });
    if (tentativa?.status === 'ERROR') throw new Error('Evolution retornou erro');
  }
  return tentativa;
};

const resultados = [];
for (const destino of destinosUnicos) {
  try {
    const response = await enviarPara(destino);
    resultados.push({ destino, enviado: true, messageId: response?.key?.id || response?.messageId || '' });
  } catch (error) {
    console.log('Falha ao enviar para ' + destino + ': ' + error.message);
    resultados.push({ destino, enviado: false, erro: error.message });
  }
}
if (!resultados.some(r => r.enviado)) {
  throw new Error('Nenhum destinatario recebeu a mensagem');
}

if (item.link || item.tipo === 'resumao' || item.tipo === 'historico') {
  try {
    await http({ method: 'POST', url: String(config.historicoUrl || 'http://historico:8090').replace(/\\/$/, '') + '/registrar', body: { escopo: escopoHistorico, link: item.link || (item.tipo + ':' + item.plano?.dia + ':' + item.plano?.jobId), titulo: item.titulo, resumo: item.resumo || item.texto, tipo: item.tipo, dia: item.plano?.dia, jobId: item.plano?.jobId, messageId: resultados.filter(r => r.enviado).map(r => r.messageId).filter(Boolean).join(',') }, json: true });
  } catch (error) {
    console.log('Falha ao registrar historico: ' + error.message);
  }
}
return [{ json: { enviado: true, titulo: item.titulo, link: item.link, totalDestinos: destinosUnicos.length, enviados: resultados.filter(r => r.enviado).length, falhas: resultados.filter(r => !r.enviado).length, resultados } }];`;

const NEW_SEND = NEW_SEND_PART1 + NEW_SEND_PART2;

function patchWorkflow(wf) {
  const send = wf.nodes.find(n => n.name === 'Enviar e Registrar' && n.type === 'n8n-nodes-base.code');
  if (!send) {
    console.log('SKIP send (node ausente)');
    return false;
  }
  send.parameters.jsCode = NEW_SEND;
  console.log('PATCHED send [Enviar e Registrar] multi-destino');
  return true;
}

if (require.main === module) {
const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const isArray = Array.isArray(data);
const list = isArray ? data : [data];
let any = false;
for (const wf of list) {
  console.log('== ' + (wf.id || wf.name || '?') + ' :: ' + (wf.name || '') + ' ==');
  if (patchWorkflow(wf)) any = true;
}
if (!any) process.exit(2);

if (OUTPUT) {
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  console.log('gravado: ' + OUTPUT);
} else if (!isArray) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}
}

module.exports = { NEW_SEND, patchWorkflow };
const fs = require('node:fs');
const crypto = require('node:crypto');

const nodes = [];
const connections = {};
const id = prefix => `${prefix}-${crypto.randomBytes(5).toString('hex')}`;

function add(name, type, typeVersion, position, parameters = {}, extra = {}) {
  nodes.push({ id: id(type.split('.').pop()), name, type, typeVersion, position, parameters, ...extra });
  return name;
}

function link(from, to, output = 0) {
  connections[from] ||= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}

function code(name, position, jsCode) {
  return add(name, 'n8n-nodes-base.code', 2, position, { mode: 'runOnceForAllItems', jsCode });
}

function sticky(name, position, content) {
  return add(name, 'n8n-nodes-base.stickyNote', 1, position, { width: 920, height: 260, content });
}

const configFields = [
  ['cliente', 'Iguera', 'string'],
  ['numero', '', 'string'],
  ['instancia', 'iguera', 'string'],
  ['evolutionUrl', 'http://evolution-api:8080', 'string'],
  ['evolutionApiKey', '', 'string'],
  ['geminiApiKey', '', 'string'],
  ['modeloGemini', 'gemini-2.0-flash', 'string'],
  ['historicoUrl', 'http://historico:8090', 'string'],
  ['periodicidade', 'intervalo', 'string'],
  ['intervaloMinutos', 60, 'number'],
  ['inicioEnvios', '08:00', 'string'],
  ['fimEnvios', '19:00', 'string'],
  ['horarioEnvioDiario', '08:00', 'string'],
  ['horarioResumao', '19:00', 'string'],
  ['resumaoAtivo', true, 'boolean'],
  ['maxNoticias', 3, 'number'],
  ['janelaHoras', 24, 'number'],
  ['usarImagem', true, 'boolean'],
  ['enviar', true, 'boolean'],
  ['enviarLinksFontes', false, 'boolean'],
];

const decideCode = `
const config = $input.first().json;
const now = new Date();
const hm = value => {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) throw new Error('Horario invalido: ' + value);
  return h * 60 + m;
};
const current = now.getHours() * 60 + now.getMinutes();
const manual = $execution.mode === 'manual';
const start = hm(config.inicioEnvios || '08:00');
const end = hm(config.fimEnvios || '19:00');
const digestAt = hm(config.horarioResumao || '19:00');
const dailyAt = hm(config.horarioEnvioDiario || '08:00');
const interval = Math.max(5, Number(config.intervaloMinutos || 60));
let acao = 'nada';
if (manual) acao = 'noticias';
else if (config.resumaoAtivo !== false && current >= digestAt && current < digestAt + 5) acao = 'resumao';
else if (current >= start && current <= end && current < digestAt) {
  if (config.periodicidade === 'diario') acao = current >= dailyAt && current < dailyAt + 5 ? 'noticias' : 'nada';
  else acao = ((current - start) % interval) < 5 ? 'noticias' : 'nada';
}
return [{ json: { acao, config, manual, jobId: $execution.id, dia: now.toISOString().slice(0, 10) } }];
`.trim();

const collectCode = `
const plano = $('Decidir Acao').first().json;
const config = plano.config;
const baseHistorico = String(config.historicoUrl || 'http://historico:8090').replace(/\\/$/, '');
const strip = value => String(value || '').replace(/<!\\[CDATA\\[|\\]\\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
const tag = (xml, name) => strip((xml.match(new RegExp('<' + name + '[^>]*>([\\\\s\\\\S]*?)<\\\\/' + name + '>', 'i')) || [])[1] || '');
const attr = (html, pattern) => (html.match(pattern) || [])[1] || '';
const normalize = value => strip(value).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
if (plano.acao === 'nada') return [{ json: { semNoticias: true, motivo: 'Nada a executar agora', plano, config } }];
if (plano.acao === 'resumao') {
  const rows = await $http({ method: 'GET', url: baseHistorico + '/dia/' + plano.dia, json: true });
  const noticias = (Array.isArray(rows) ? rows : []).filter(row => row.link).map(row => ({ id: row.link, link: row.link, titulo: row.titulo || row.link, texto: row.titulo || row.link, imagemUrl: '' }));
  return noticias.length ? [{ json: { plano, config, noticias } }] : [{ json: { semNoticias: true, motivo: 'Nenhuma noticia enviada hoje', plano, config } }];
}
const feeds = [
  'https://www.infomoney.com.br/feed/',
  'https://www.moneytimes.com.br/feed/',
  'https://braziljournal.com/feed/',
  'https://veja.abril.com.br/feed/',
];
let candidates = [];
for (const feed of feeds) {
  try {
    const xml = await $http({ method: 'GET', url: feed, timeout: 20000 });
    const blocks = String(xml).match(/<item[\\s\\S]*?<\\/item>/gi) || [];
    for (const block of blocks) {
      const link = tag(block, 'link') || tag(block, 'guid');
      const date = Date.parse(tag(block, 'pubDate') || tag(block, 'dc:date') || tag(block, 'updated') || '');
      candidates.push({ titulo: tag(block, 'title'), link, trecho: tag(block, 'description'), data: date, imagemUrl: attr(block, /url=["']([^"']+)["']/i) });
    }
  } catch (error) {
    console.log('Falha no RSS ' + feed + ': ' + error.message);
  }
}
const allowedDomains = /^https:\\/\\/(?:www\\.)?(?:infomoney\\.com\\.br|moneytimes\\.com\\.br|braziljournal\\.com|veja\\.abril\\.com\\.br)\\//i;
const keywords = ['banco','itau','bradesco','santander','btg','nubank','xp','fed','banco central','copom','selic','juros','ipca','inflacao','pib','dolar','cambio','ibovespa','bolsa','acoes','b3','dividendos','jcp','resultado','lucro','receita','ebitda','guidance','fato relevante','petrobras','vale','commodities','petroleo','minerio','tesouro','cdb','lci','lca','fii','fundos','renda fixa','credito','china','eua','s&p 500','nasdaq'];
const seen = new Set();
candidates = candidates.filter(item => {
  if (!allowedDomains.test(item.link)) return false;
  if (Number.isFinite(item.data) && Date.now() - item.data > Number(config.janelaHoras || 24) * 3600000) return false;
  const key = normalize(item.titulo) + '|' + item.link;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).map(item => {
  const text = normalize(item.titulo + ' ' + item.trecho);
  const score = keywords.reduce((total, word) => total + (text.includes(normalize(word)) ? 1 : 0), 0);
  return { ...item, score };
}).filter(item => item.score > 0).sort((a, b) => b.score - a.score || b.data - a.data).slice(0, Math.max(12, Number(config.maxNoticias || 3) * 8));
if (!plano.manual && candidates.length) {
  try {
    const response = await $http({ method: 'POST', url: baseHistorico + '/verifica', body: { links: candidates.map(item => item.link) }, json: true });
    const allowed = new Set(response.links || []);
    candidates = candidates.filter(item => allowed.has(item.link));
  } catch (error) {
    console.log('Historico indisponivel em /verifica: ' + error.message);
  }
}
const noticias = [];
for (const item of candidates) {
  try {
    const html = await $http({ method: 'GET', url: item.link, timeout: 20000 });
    const textBlocks = [...String(html).matchAll(/<p[^>]*>([\\s\\S]*?)<\\/p>/gi)].map(match => strip(match[1])).filter(text => text.length > 45 && !/todos os direitos reservados|^compartilh|^assine|^leia tamb[eé]m|^veja tamb[eé]m/i.test(text));
    const image = attr(String(html), /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || attr(String(html), /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) || item.imagemUrl;
    const texto = [...new Set(textBlocks)].join('\\n').slice(0, 9000) || item.trecho;
    if (texto.length >= 120) noticias.push({ id: item.link, link: item.link, titulo: item.titulo, texto, imagemUrl: /^https?:\\/\\//i.test(image) ? image : '' });
  } catch (error) {
    console.log('Falha ao buscar materia ' + item.link + ': ' + error.message);
  }
}
return noticias.length ? [{ json: { plano, config, noticias } }] : [{ json: { semNoticias: true, motivo: 'Sem noticias novas com texto suficiente', plano, config } }];
`.trim();

const promptCode = `
const input = $input.first().json;
if (input.semNoticias) return [input];
const diario = input.plano.acao === 'resumao';
const fontes = input.noticias.map(item => ({ id: item.id, titulo: item.titulo, texto: String(item.texto || '').slice(0, diario ? 1200 : 5000) }));
const prompt = diario
  ? 'Escreva um unico resumao financeiro para WhatsApp, em portugues brasileiro, com ate tres paragrafos curtos. Use apenas as fontes. Sem links, listas numeradas ou markdown. Retorne {"tipo":"resumao","itens":[{"titulo":"MERCADO HOJE","resumo":"texto"}]}. FONTES: ' + JSON.stringify(fontes)
  : 'Selecione noticias relevantes para investidores e explique em linguagem simples. Use apenas as fontes. Retorne {"tipo":"noticias","itens":[{"id":"copie o id","emoji":"emoji","titulo":"TITULO CURTO","resumo":"75 a 130 palavras"}]}. Se nada for relevante, retorne itens vazio. FONTES: ' + JSON.stringify(fontes);
const schema = {
  type: 'OBJECT',
  properties: {
    tipo: { type: 'STRING' },
    itens: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: diario ? { titulo: { type: 'STRING' }, resumo: { type: 'STRING' } } : { id: { type: 'STRING' }, emoji: { type: 'STRING' }, titulo: { type: 'STRING' }, resumo: { type: 'STRING' } },
        required: diario ? ['titulo', 'resumo'] : ['id', 'emoji', 'titulo', 'resumo'],
      },
    },
  },
  required: ['tipo', 'itens'],
};
return [{ json: { ...input, prompt, geminiBody: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema } } } }];
`.trim();

const geminiCode = `
const input = $input.first().json;
if (input.semNoticias) return [input];
const model = input.config.modeloGemini || 'gemini-2.0-flash';
const key = input.config.geminiApiKey;
if (!key) throw new Error('geminiApiKey nao configurada');
let lastError;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const response = await $http({ method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), headers: { 'Content-Type': 'application/json' }, body: input.geminiBody, json: true, timeout: 120000 });
    const candidate = response?.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) throw new Error('Gemini nao concluiu');
    const raw = candidate.content.parts.filter(part => !part.thought).map(part => part.text || '').join('');
    const result = JSON.parse(raw);
    return [{ json: { ...input, ia: result } }];
  } catch (error) {
    lastError = error;
    if (!/timeout|ETIMEDOUT|ECONNRESET|429|50\\d|network/i.test(error.message || '') || attempt === 3) break;
    await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
  }
}
throw new Error('Gemini falhou: ' + (lastError?.message || 'erro desconhecido'));
`.trim();

const prepareMessagesCode = `
const input = $input.first().json;
if (input.semNoticias) return [{ json: input }];
const result = input.ia;
if (!result || !Array.isArray(result.itens) || !result.itens.length) return [{ json: { ...input, semNoticias: true, motivo: 'IA nao selecionou noticias' } }];
if (input.plano.acao === 'resumao') {
  const resumo = String(result.itens[0].resumo || '').replace(/\\*/g, '').trim();
  if (resumo.length < 80 || /https?:\\/\\//i.test(resumo)) throw new Error('Resumao invalido');
  return [{ json: { tipo: 'resumao', titulo: 'MERCADO HOJE', texto: '🚨 *MERCADO HOJE*\\n\\n' + resumo, link: '', imagemUrl: '', config: input.config, plano: input.plano } }];
}
const sources = new Map(input.noticias.map(item => [item.id, item]));
const messages = [];
for (const item of result.itens) {
  const source = sources.get(item.id);
  if (!source) continue;
  const titulo = String(item.titulo || '').replace(/\\*/g, '').trim().toLocaleUpperCase('pt-BR');
  const resumo = String(item.resumo || '').trim();
  if (!titulo || resumo.length < 80 || /https?:\\/\\//i.test(resumo)) continue;
  const link = source.link || source.id;
  const texto = (item.emoji || '📰') + ' *' + titulo + '*\\n\\n' + resumo + (input.config.enviarLinksFontes !== false ? '\\n\\n' + link : '');
  messages.push({ json: { tipo: 'noticia', titulo, texto, link, imagemUrl: input.config.usarImagem !== false ? source.imagemUrl || '' : '', config: input.config, plano: input.plano } });
}
return messages.length ? messages : [{ json: { ...input, semNoticias: true, motivo: 'Nenhuma mensagem valida' } }];
`.trim();

const sendCode = `
const item = $input.first().json;
if (item.semNoticias) return [{ json: item }];
const config = { ...item.config };
if (config.enviar !== true) return [{ json: { preview: true, titulo: item.titulo, texto: item.texto } }];
const rawNumber = String(config.numero || '').trim();
if (/^[0-9]+(?:-[0-9]+)?@g\\.us$/.test(rawNumber)) config.numero = rawNumber;
else {
  config.numero = rawNumber.replace(/\\D/g, '');
  if (!/^[1-9][0-9]{7,14}$/.test(config.numero)) throw new Error('Numero invalido');
}
const base = String(config.evolutionUrl || '').replace(/\\/$/, '');
if (!base) throw new Error('evolutionUrl nao configurada');
const path = item.imagemUrl ? '/message/sendMedia/' : '/message/sendText/';
const body = item.imagemUrl
  ? { number: config.numero, mediatype: 'image', media: item.imagemUrl, caption: item.texto }
  : { number: config.numero, text: item.texto, linkPreview: false };
const response = await $http({ method: 'POST', url: base + path + encodeURIComponent(config.instancia), headers: { apikey: config.evolutionApiKey || config.apikey || '' }, body, json: true, timeout: 30000 });
if (response?.status === 'ERROR') throw new Error('Evolution retornou erro');
if (item.link) {
  try {
    await $http({ method: 'POST', url: String(config.historicoUrl || 'http://historico:8090').replace(/\\/$/, '') + '/registrar', body: { link: item.link, titulo: item.titulo, jobId: item.plano?.jobId }, json: true });
  } catch (error) {
    console.log('Falha ao registrar historico: ' + error.message);
  }
}
return [{ json: { enviado: true, titulo: item.titulo, link: item.link, messageId: response?.key?.id || '' } }];
`.trim();

const idsPrepCode = `
const form = $input.first().json;
const config = $('Configurar Cliente - IDs').first().json;
const choice = String(form.opcao ?? form['O que você quer consultar?'] ?? '').trim();
const filter = String(form.filtro ?? form['Filtrar por nome (opcional)'] ?? '').trim();
const map = { 'Todos os grupos e comunidades': 'todos', 'Grupos comuns': 'grupos', 'Comunidades': 'comunidades', 'Grupos de avisos': 'avisos', 'Instância e conexão': 'instancia' };
const tipo = map[choice] || 'todos';
const base = String(config.evolutionUrl || 'http://evolution-api:8080').replace(/\\/$/, '');
const instancia = String(config.instancia || '').trim();
const url = tipo === 'instancia' ? base + '/instance/connectionState/' + encodeURIComponent(instancia) : base + '/group/fetchAllGroups/' + encodeURIComponent(instancia) + '?getParticipants=false';
return [{ json: { tipo, filtro: filter, url, config } }];
`.trim();

const idsFetchCode = `
const q = $input.first().json;
const rows = await $http({ method: 'GET', url: q.url, headers: { apikey: q.config.evolutionApiKey || q.config.apikey || '' }, json: true, timeout: 30000 });
return [{ json: { ...q, rows } }];
`.trim();

const idsFormatCode = `
const data = $input.first().json;
const normalize = text => String(text || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
if (data.tipo === 'instancia') {
  const info = data.rows?.instance || data.rows || {};
  return [{ json: { nome: info.instanceName || 'Instancia', id: info.instanceName || '', tipo: 'Instancia', estado: info.state || '' } }];
}
const source = Array.isArray(data.rows) ? data.rows : Array.isArray(data.rows?.groups) ? data.rows.groups : [data.rows];
const groups = source.filter(group => group?.id?.endsWith?.('@g.us'));
const result = groups.filter(group => {
  if (data.tipo === 'grupos' && (group.isCommunity || group.isCommunityAnnounce)) return false;
  if (data.tipo === 'comunidades' && !group.isCommunity) return false;
  if (data.tipo === 'avisos' && !group.isCommunityAnnounce && !group.announce) return false;
  return !data.filtro || normalize(group.subject).includes(normalize(data.filtro));
}).map(group => ({ json: { nome: group.subject || 'Sem nome', id: group.id, tipo: group.isCommunity ? 'Comunidade' : group.isCommunityAnnounce ? 'Grupo de avisos' : group.announce ? 'Somente administradores' : 'Grupo comum', participantes: group.size ?? null } }));
return result.length ? result : [{ json: { nome: 'Nenhum resultado', id: '', tipo: data.tipo } }];
`.trim();

const trigger = add('Agenda - Verificar a cada minuto', 'n8n-nodes-base.scheduleTrigger', 1.2, [-1600, 120], { rule: { interval: [{ field: 'cronExpression', expression: '* * * * *' }] } });
const manual = add('Noticias - Rodar Manualmente', 'n8n-nodes-base.manualTrigger', 1, [-1600, 300], {});
const config = add('Configurar Cliente', 'n8n-nodes-base.set', 3.4, [-1320, 200], {
  assignments: { assignments: configFields.map(([name, value, type]) => ({ id: id('field'), name, value, type })) },
  options: {},
});
const decide = code('Decidir Acao', [-1040, 200], decideCode);
const collect = code('Coletar Fontes e Historico', [-760, 200], collectCode);
const prompt = code('Montar Prompt', [-480, 200], promptCode);
const gemini = code('Gemini com Retry', [-200, 200], geminiCode);
const prepare = code('Preparar Mensagens', [80, 200], prepareMessagesCode);
const split = add('Uma mensagem por vez', 'n8n-nodes-base.splitInBatches', 3, [360, 200], { batchSize: 1, options: {} });
const send = code('Enviar e Registrar', [640, 200], sendCode);
const wait = add('Aguardar 8-10s', 'n8n-nodes-base.wait', 1.1, [920, 200], { amount: '={{ Math.floor(Math.random() * 3) + 8 }}' });
const end = add('Fim', 'n8n-nodes-base.noOp', 1, [640, 420], {});

const idsManual = add('IDs - Iniciar Consulta', 'n8n-nodes-base.manualTrigger', 1, [-1600, 760], {});
const idsConfig = add('Configurar Cliente - IDs', 'n8n-nodes-base.set', 3.4, [-1320, 760], {
  assignments: { assignments: configFields.map(([name, value, type]) => ({ id: id('field'), name, value, type })) },
  options: {},
});
const idsForm = add('IDs - O que Consultar?', 'n8n-nodes-base.wait', 1.1, [-1040, 760], {
  resume: 'form',
  formTitle: 'Consultar IDs do WhatsApp',
  formFields: { values: [
    { fieldLabel: 'O que você quer consultar?', fieldType: 'dropdown', defaultValue: 'Todos os grupos e comunidades', fieldOptions: { values: ['Todos os grupos e comunidades', 'Grupos comuns', 'Comunidades', 'Grupos de avisos', 'Instância e conexão'].map(option => ({ option })) }, requiredField: true },
    { fieldLabel: 'Filtrar por nome (opcional)', placeholder: 'Ex.: XP, familia, trabalho' },
  ] },
  limitWaitTime: true,
  resumeAmount: 10,
  resumeUnit: 'minutes',
  options: { appendAttribution: false },
}, { webhookId: 'ids-v3-compact-form' });
const idsPrep = code('IDs - Preparar Consulta', [-760, 760], idsPrepCode);
const idsFetch = code('IDs - Consultar Evolution', [-480, 760], idsFetchCode);
const idsResult = code('IDs - Resultados', [-200, 760], idsFormatCode);
sticky('V3 - Como usar', [-1600, -260], 'V3 compacta: 13 nos no fluxo de noticias e 5 nos no bloco de IDs. Mantem agenda, manual, intervalo/diario, janela de horario, resumao, RSS de 4 fontes, historico, Gemini com retry, imagem/texto, intervalo entre mensagens, registro e consulta de IDs. Configure Configurar Cliente; para Evolution em Code node use evolutionApiKey/apikey no proprio card se quiser enviar sem credencial HTTP.');

link(trigger, config);
link(manual, config);
link(config, decide);
link(decide, collect);
link(collect, prompt);
link(prompt, gemini);
link(gemini, prepare);
link(prepare, split);
link(split, end, 0);
link(split, send, 1);
link(send, wait);
link(wait, split);
link(idsManual, idsConfig);
link(idsConfig, idsForm);
link(idsForm, idsPrep);
link(idsPrep, idsFetch);
link(idsFetch, idsResult);

const workflow = {
  id: 'noticiasV3Compacta',
  name: 'Noticias de Investimento -> IA -> WhatsApp v3 compacta',
  nodes,
  connections,
  active: false,
  settings: { executionOrder: 'v1', binaryMode: 'separate', timezone: 'America/Sao_Paulo' },
  pinData: {},
  tags: [],
};

fs.writeFileSync('noticias_v3.json', JSON.stringify(workflow, null, 2) + '\n');
console.log(`V3 compacta criada: ${nodes.length} nos, ${Object.keys(connections).length} conexoes`);

const fs = require('node:fs');
const crypto = require('node:crypto');

const nodes = [];
const connections = {};
const id = prefix => `${prefix}-${crypto.randomBytes(5).toString('hex')}`;

const rssFeedsDefault = "https://www.infomoney.com.br/feed/\nhttps://www.moneytimes.com.br/feed/\nhttps://braziljournal.com/feed/\nhttps://veja.abril.com.br/feed/";
const dominiosPermitidosDefault = "";
const palavrasChaveDefault = "banco, bancos, itau, bradesco, santander, btg, nubank, inter, caixa, banco do brasil, xp, goldman sachs, jpmorgan, morgan stanley, blackrock, fed, banco central, copom, cmn, open finance, pix, credito, emprestimos, financiamento, inadimplencia, provisoes, basileia, fintech, seguradora, previdencia, cvm, anbima, susep, previc, bacen, empresas, companhia, acoes, b3, ibovespa, ipo, follow-on, oferta secundaria, opa, dividendos, jcp, resultados, balanco, lucro, lucro liquido, receita, receita liquida, ebitda, margem, guidance, ceo, m&a, aquisicao, fusao, venda de participacao, recompra de acoes, fato relevante, comunicado ao mercado, aviso aos acionistas, ri, conselho, capex, divida, endividamento, fluxo de caixa, geracao de caixa, consenso, estimativa, revisao de projecao, recuperacao judicial, falencia, desinvestimento, venda de ativos, mudanca de controle, reestruturacao, bolsa, small caps, blue chips, valuation, recomendacao, upgrade, downgrade, preco-alvo, volatilidade, insider, ifix, idiv, ibovespa futuro, fluxo estrangeiro, renda fixa, cdb, lci, lca, cdi, debentures, credito privado, cra, cri, fidc, tesouro direto, tesouro ipca, tesouro prefixado, ltn, ntn-b, ntn-f, ipca, igp-m, spread de credito, rating, default, emissao, resgate antecipado, duration, marcacao a mercado, covenant, curva de juros, di futuro, ima-b, ima-geral, fundos de investimento, fundos imobiliarios, fiis, etfs, bdrs, asset, gestora, corretora, fundos de credito, fundos de acoes, fundos multimercado, selic, juros, ipca-15, inflacao, taxa real, pib, desemprego, fiscal, politica fiscal, politica monetaria, deficit, superavit, divida publica, arrecadacao, impostos, reforma tributaria, arcabouco fiscal, gastos publicos, contingenciamento, orcamento, meta fiscal, fazenda, privatizacao, concessao, leilao, desoneracao, subsidios, risco-pais, cds, embi, ibc-br, boletim focus, producao industrial, varejo, balanca comercial, atividade economica, stf, stj, congresso, camara, senado, governo, planalto, presidente, ministro, pec, projeto de lei, medida provisoria, julgamento, decisao, liminar, marco regulatorio, eleicoes, bce, china, eua, estados unidos, europa, japao, hong kong, taiwan, russia, ucrania, oriente medio, guerra, sancoes, tarifas, comercio exterior, recessao, payroll, cpi, pce, emprego, juros americanos, treasuries, treasury, yield, s&p 500, nasdaq, dow jones, dax, ftse, nikkei, hang seng, msci, otan, israel, ira, palestina, coreia do norte, guerra comercial, tarifaco, conflitos, cessar-fogo, petroleo, brent, wti, gas natural, minerio de ferro, ouro, cobre, aluminio, litio, niquel, fertilizantes, soja, milho, trigo, cafe, acucar, etanol, celulose, carne, boi gordo, opep, commodities, dolar, dolar comercial, dolar futuro, euro, cambio, real, moeda, fluxo cambial, reservas internacionais, petroleo e gas, energia eletrica, saneamento, utilities, construcao civil, shoppings, agronegocio, mineracao, siderurgia, papel e celulose, telecomunicacoes, tecnologia, saude, educacao, transporte, aviacao, infraestrutura, liquidez, volatilidade implicita, aversao ao risco, apetite ao risco, alta, queda, disparada, colapso, crise, risco, alerta, surpresa, emergencia, intervencao, mudanca, corte, alta de juros, corte de juros, suspensao, investigacao, operacao, fraude, escandalo, rebaixamento, surpresa positiva, surpresa negativa, acima das expectativas, abaixo das expectativas, circuit breaker, estresse financeiro";
const promptNoticiasDefault = "Voce e editor de noticias financeiras para leitores leigos no WhatsApp. TAREFA: selecionar apenas noticias relevantes e ineditas para investidores. Ignore propaganda, educacao generica, opiniao sem fato e conteudo sem impacto economico, mesmo que tenha palavra-chave. Priorize fatos das ultimas 24 horas com impacto em mercados, investimentos, empresas, juros, inflacao, cambio, bolsa ou decisoes de investidores. Use apenas as fontes, nao invente numeros, causas, cotacoes, recomendacoes ou previsoes. Cada resumo deve ter 75 a 130 palavras, em linguagem simples, explicando quem fez o que, contexto e possivel impacto.";
const promptResumaoDefault = "Voce e editor financeiro para WhatsApp. TAREFA: escrever UM UNICO resumao do dia, baseado SOMENTE nas noticias individuais ja enviadas hoje. Escreva em portugues brasileiro, didatico, natural, sem inventar fatos, numeros ou causas. Use ate tres paragrafos curtos, sem links, sem markdown, sem lista numerada e sem emojis por noticia. Diga primeiro quem fez o que e explique o impacto para mercado, empresas, juros, inflacao, cambio, bolsa ou investidores.";


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
  ['rssFeeds', rssFeedsDefault, 'string'],
  ['dominiosPermitidos', dominiosPermitidosDefault, 'string'],
  ['palavrasChave', palavrasChaveDefault, 'string'],
  ['promptNoticias', promptNoticiasDefault, 'string'],
  ['promptResumao', promptResumaoDefault, 'string'],
  ['assinaturaMensagem', '', 'string'],
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
  ['numeroNoticias', '', 'string'],
  ['numeroResumao', '', 'string'],
  ['numeroHistorico', '', 'string'],
  ['forcarAgora', '={{ Boolean($json.forcarAgora) }}', 'boolean'],
  ['forcarResumao', '={{ Boolean($json.forcarResumao) }}', 'boolean'],
  ['forcarHistorico', '={{ Boolean($json.forcarHistorico) }}', 'boolean'],
  ['fluxo', '={{ $json.fluxo || \"noticias\" }}', 'string'],
];

const decideCode = `
const config = $input.first().json;
const now = new Date(); const fuso = 'America/Sao_Paulo'; const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); const pega = tipo => Number(partes.find(p => p.type === tipo)?.value ?? 0); const diaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const hm = value => {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) throw new Error('Horario invalido: ' + value);
  return h * 60 + m;
};
const current = pega('hour') * 60 + pega('minute');
const manualNoticias = config.forcarAgora === true || ($execution.mode === 'manual' && config.forcarResumao !== true && config.forcarHistorico !== true);
const start = hm(config.inicioEnvios || '08:00');
const end = hm(config.fimEnvios || '19:00');
const digestAt = hm(config.horarioResumao || '19:00');
const dailyAt = hm(config.horarioEnvioDiario || '08:00');
const interval = Math.max(5, Number(config.intervaloMinutos || 60));
let acao = 'nada';
if (config.forcarHistorico === true) acao = 'historico';
else if (config.forcarResumao === true) acao = 'resumao';
else if (manualNoticias) acao = 'noticias';
else if (config.resumaoAtivo !== false && current >= digestAt && current < digestAt + 5) acao = 'resumao';
else if (current >= start && current <= end && current < digestAt) {
  if (config.periodicidade === 'diario') acao = current >= dailyAt && current < dailyAt + 5 ? 'noticias' : 'nada';
  else acao = ((current - start) % interval) < 5 ? 'noticias' : 'nada';
}
return [{ json: { acao, config, manual: manualNoticias || config.forcarResumao === true || config.forcarHistorico === true, jobId: $execution.id, dia: diaLocal } }];
`.trim();

const collectCode = String.raw`
const plano = $('Decidir Acao').first().json;
const config = plano.config;
const baseHistorico = String(config.historicoUrl || 'http://historico:8090').replace(/\/$/, '');
const escopoHistorico = [config.cliente || 'cliente', config.instancia || 'instancia'].map(v => String(v).trim()).join('|');
const strip = value => String(value || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const tag = (xml, name) => strip((String(xml || '').match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i')) || [])[1] || '');
const attr = (html, pattern) => (html.match(pattern) || [])[1] || '';
const normalize = value => strip(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
// collect helper inserted
if (plano.acao === 'nada') return [{ json: { semNoticias: true, motivo: 'Nada a executar agora', plano, config } }];
if (plano.acao === 'resumao' || plano.acao === 'historico') {
  const rows = await http({ method: 'GET', url: baseHistorico + '/dia/' + plano.dia + '?escopo=' + encodeURIComponent(escopoHistorico), json: true });
  const noticias = (Array.isArray(rows) ? rows : [])
    .filter(row => row.link && row.tipo !== 'resumao' && row.tipo !== 'historico')
    .map(row => ({ id: row.link, link: row.link, titulo: row.titulo || row.link, texto: row.resumo || row.titulo || row.link, resumo: row.resumo || '', hora: row.hora || '', imagemUrl: '' }));
  if (plano.acao === 'historico') return noticias.length ? [{ json: { plano, config, noticias, historico: true } }] : [{ json: { semNoticias: true, motivo: 'Sem noticias enviadas hoje no historico', plano, config } }];
  return noticias.length ? [{ json: { plano, config, noticias } }] : [{ json: { semNoticias: true, motivo: 'Nenhuma noticia enviada hoje', plano, config } }];
}
const parseList = value => String(value || '').split(String.fromCharCode(10)).flatMap(line => line.split(/[;,]+/)).map(v => { const text = strip(v); const close = text.indexOf(']('); return text.startsWith('[') && close > 1 && text.endsWith(')') ? text.slice(1, close) : text; }).filter(Boolean);
const feeds = parseList(config.rssFeeds);
if (!feeds.length) throw new Error('Configure pelo menos um RSS no campo rssFeeds.');
let candidates = [];
let feedErrors = [];
for (const feed of feeds) {
  try {
    const xml = await http({ method: 'GET', url: feed, timeout: 20000 });
    const blocks = String(xml).match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const block of blocks) {
      const link = tag(block, 'link') || tag(block, 'guid');
      const date = Date.parse(tag(block, 'pubDate') || tag(block, 'dc:date') || tag(block, 'updated') || '');
      candidates.push({ titulo: tag(block, 'title'), link, trecho: tag(block, 'description'), data: date, imagemUrl: attr(block, /url=["']([^"']+)["']/i) });
    }
  } catch (error) {
    feedErrors.push(feed + ': ' + error.message);
    console.log('Falha no RSS ' + feed + ': ' + error.message);
  }
}
if (!candidates.length && feedErrors.length) throw new Error('Nenhum RSS lido: ' + feedErrors.join(' | '));
const hostOf = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { return new URL(raw.includes('://') ? raw : 'https://' + raw).hostname.replace(/^www[.]/i, '').toLowerCase(); } catch { return raw.split('/')[0].replace(/^www[.]/i, '').toLowerCase(); }
};
const domainTerms = parseList(config.dominiosPermitidos).map(hostOf).filter(Boolean);
const feedHosts = feeds.map(hostOf).filter(Boolean);
const allowedHosts = [...new Set(domainTerms.length ? domainTerms : feedHosts)];
const allowedDomain = link => {
  const host = hostOf(link);
  return !!host && allowedHosts.some(domain => host === domain || host.endsWith('.' + domain));
};
const keywords = parseList(config.palavrasChave);
const seen = new Set();
candidates = candidates.filter(item => {
  if (!allowedDomain(item.link)) return false;
  if (Number.isFinite(item.data) && Date.now() - item.data > Number(config.janelaHoras || 24) * 3600000) return false;
  const key = normalize(item.titulo) + '|' + item.link;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).map(item => {
  const text = normalize(item.titulo + ' ' + item.trecho);
  const score = keywords.reduce((total, word) => total + (text.includes(normalize(word)) ? 1 : 0), 0);
  return { ...item, score };
});
const scored = candidates.sort((a, b) => b.score - a.score || b.data - a.data);
const withScore = scored.filter(item => item.score > 0);
candidates = (withScore.length ? withScore : scored).slice(0, Math.max(12, Number(config.maxNoticias || 3) * 4));
if (candidates.length) {
  try {
    const response = await http({ method: 'POST', url: baseHistorico + '/verifica', body: { escopo: escopoHistorico, links: candidates.map(item => item.link) }, json: true });
    const allowed = new Set(response.links || []);
    candidates = candidates.filter(item => allowed.has(item.link));
  } catch (error) {
    console.log('Historico indisponivel em /verifica: ' + error.message);
  }
}
const cleanArticleHtml = value => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');
const cleanArticleText = value => strip(value)
  .replace(/@\s*property\s+--[\s\S]*?(?=\s[A-Za-z0-9]|$)/gi, ' ')
  .replace(/--tw-[a-z0-9-]+/gi, ' ')
  .replace(/\b(initial-value|inherits|syntax|rgba?|var|calc|transform|transition|font-face)\b\s*[:;{][^.!?]{0,300}/gi, ' ')
  .replace(/[{}[\];]{2,}/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const looksLikeNoise = value => {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  if (!text || text.length < 80) return true;
  if (lower.includes('@property') || lower.includes('--tw-') || lower.includes('initial-value') || lower.includes('inherits:false') || lower.includes('syntax:"*')) return true;
  if (/^(function|var |let |const |window[.]|document[.]|[.]|#)/i.test(text)) return true;
  const letters = (text.match(/[a-z]/gi) || []).length;
  const symbols = (text.match(/[{};:=<>]/g) || []).length;
  if (letters && symbols / letters > 0.12) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 18) return true;
  return false;
};
const noticias = [];
for (const item of candidates) {
  try {
    const rawHtml = await http({ method: 'GET', url: item.link, timeout: 20000 });
    const html = cleanArticleHtml(rawHtml);
    const image = attr(String(rawHtml), /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || attr(String(rawHtml), /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) || item.imagemUrl;
    const textBlocks = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => cleanArticleText(match[1]))
      .filter(text => text.length > 45 && !looksLikeNoise(text) && !/todos os direitos reservados|^compartilh|^assine|^leia tamb[e?]m|^veja tamb[e?]m|newsletter|privacy policy|cookie/i.test(text));
    const texto = [...new Set(textBlocks)].join('\n').slice(0, 5000);
    if (texto.length >= 120 && !looksLikeNoise(texto)) noticias.push({ id: item.link, link: item.link, titulo: item.titulo, texto, imagemUrl: /^https?:\/\//i.test(image) ? image : '' });
  } catch (error) {
    console.log('Falha ao buscar materia ' + item.link + ': ' + error.message);
  }
}
return noticias.length ? [{ json: { plano, config, noticias } }] : [{ json: { semNoticias: true, motivo: 'Sem noticias novas com texto suficiente', plano, config } }];`.trim();

const promptCode = `
const input = $input.first().json;
const configLeve = cfg => ({
  cliente: cfg.cliente,
  numero: cfg.numero,
  instancia: cfg.instancia,
  evolutionUrl: cfg.evolutionUrl,
  evolutionApiKey: cfg.evolutionApiKey || cfg.apikey || '',
  apikey: cfg.apikey || '',
  geminiApiKey: cfg.geminiApiKey,
  modeloGemini: cfg.modeloGemini,
  historicoUrl: cfg.historicoUrl,
  enviar: cfg.enviar,
  enviarLinksFontes: cfg.enviarLinksFontes,
  usarImagem: cfg.usarImagem,
  numeroNoticias: cfg.numeroNoticias,
  numeroResumao: cfg.numeroResumao,
  numeroHistorico: cfg.numeroHistorico,
  assinaturaMensagem: cfg.assinaturaMensagem || '',
});
if (input.semNoticias || input.historico) return [{ json: { semNoticias: input.semNoticias === true, motivo: input.motivo || '', plano: input.plano, config: configLeve(input.config || {}), noticias: input.noticias || [], historico: input.historico === true } }];
const diario = input.plano.acao === 'resumao';
const fontes = input.noticias.map(item => ({
  id: item.id,
  titulo: item.titulo,
  texto: String(item.texto || '').slice(0, diario ? 1000 : 2500),
}));
const basePrompt = diario ? String(input.config.promptResumao || '').trim() : String(input.config.promptNoticias || '').trim();
const outputInstruction = diario
  ? ' Retorne apenas JSON no formato {"tipo":"resumao","itens":[{"titulo":"Resumo de hoje","resumo":"texto corrido"}]}. FONTES: '
  : ' Retorne apenas JSON no formato {"tipo":"noticias","itens":[{"id":"copie o id exatamente","emoji":"emoji","titulo":"TITULO CURTO","resumo":"texto"}]}. Se nada for relevante, retorne itens vazio. FONTES: ';
const prompt = (basePrompt || (diario ? 'Escreva um unico resumao do dia em portugues brasileiro.' : 'Selecione noticias relevantes e explique em linguagem simples.')) + outputInstruction + JSON.stringify(fontes);
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
const noticiasLeves = input.noticias.map(item => ({
  id: item.id,
  link: item.link,
  titulo: item.titulo,
  imagemUrl: item.imagemUrl || '',
}));
return [{ json: { plano: input.plano, config: configLeve(input.config || {}), noticias: noticiasLeves, geminiBody: { contents: [{ parts: [{ text: prompt }] }] }, generationConfig: { responseMimeType: 'application/json', responseSchema: schema }, debug: { fontes: fontes.length, promptChars: prompt.length } } }];
`.trim();

const geminiCode = `
const input = $input.first().json;
if (input.semNoticias || input.historico) return [{ json: { semNoticias: input.semNoticias === true, motivo: input.motivo || '', plano: input.plano, config: input.config, noticias: input.noticias || [], historico: input.historico === true } }];
const model = input.config.modeloGemini || 'gemini-2.0-flash';
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
const key = input.config.geminiApiKey;
if (!key) throw new Error('geminiApiKey nao configurada');
let lastError;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const response = await http({ method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), headers: { 'Content-Type': 'application/json' }, body: input.geminiBody, json: true, timeout: 120000 });
    const candidate = response?.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) throw new Error('Gemini nao concluiu');
    const raw = candidate.content.parts.filter(part => !part.thought).map(part => part.text || '').join('');
    const parseGeminiJson = value => {
      const text = String(value || '').trim();
      try { return JSON.parse(text); } catch {}
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
      throw new Error('Resposta da IA nao veio em JSON valido');
    };
    const result = parseGeminiJson(raw);
    return [{ json: { plano: input.plano, config: input.config, noticias: input.noticias, ia: result, debug: { modelo: model, itensIA: Array.isArray(result.itens) ? result.itens.length : 0 } } }];
  } catch (error) {
    lastError = error;
    if (!/timeout|ETIMEDOUT|ECONNRESET|429|50\\d|network/i.test(error.message || '') || attempt === 3) break;
    await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
  }
}
throw new Error('Gemini falhou: ' + (lastError?.message || 'erro desconhecido')); // erro simples para identificar o problema
`.trim();

const prepareMessagesCode = `
const input = $input.first().json;
const configEnvio = cfg => ({
  cliente: cfg.cliente,
  numero: cfg.numero,
  instancia: cfg.instancia,
  evolutionUrl: cfg.evolutionUrl,
  evolutionApiKey: cfg.evolutionApiKey || cfg.apikey || '',
  apikey: cfg.apikey || '',
  historicoUrl: cfg.historicoUrl,
  enviar: cfg.enviar,
  enviarLinksFontes: cfg.enviarLinksFontes,
  usarImagem: cfg.usarImagem,
  numeroNoticias: cfg.numeroNoticias,
  numeroResumao: cfg.numeroResumao,
  numeroHistorico: cfg.numeroHistorico,
  assinaturaMensagem: cfg.assinaturaMensagem || '',
});
const comAssinatura = (texto, cfg) => {
  const assinatura = String(cfg?.assinaturaMensagem || '').trim();
  const base = String(texto || '').trimEnd();
  if (!assinatura) return base;
  const resumo = base.split(assinatura).join('').trimEnd();
  return (resumo ? resumo + String.fromCharCode(10) + String.fromCharCode(10) : '') + assinatura;
};
if (input.semNoticias) return [{ json: input }];
if (input.historico) {
  const limpar = v => String(v || '')
    .replaceAll(String.fromCharCode(10), ' ')
    .replaceAll(String.fromCharCode(13), ' ')
    .replaceAll(String.fromCharCode(9), ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .join(' ');
  const horaFmt = valor => {
    const s = String(valor || '').trim();
    if (s.length >= 5 && s[2] === ':') return s.slice(0, 5);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  };
  const linhas = input.noticias.map((n, i) => String(i + 1) + '. ' + horaFmt(n.hora) + ' - ' + limpar(n.titulo || n.link || 'Sem titulo')).join(String.fromCharCode(10));
  const dataBr = String(input.plano.dia || '').replace(/^(\\d{4})-(\\d{2})-(\\d{2})$/, '$3/$2/$1');
  return [{ json: { tipo: 'historico', titulo: 'HISTORICO DO DIA', resumo: linhas, texto: comAssinatura(String.fromCodePoint(0x1F5C2) + String.fromCharCode(0xFE0F) + ' *HISTORICO DE NOTICIAS - ' + dataBr + '*' + String.fromCharCode(10) + String.fromCharCode(10) + linhas, input.config), link: '', imagemUrl: '', config: configEnvio(input.config), plano: input.plano, numeroDestino: input.config.numeroHistorico || input.config.numero } }];
}
const result = input.ia;
if (!result || !Array.isArray(result.itens) || !result.itens.length) return [{ json: { semNoticias: true, motivo: 'IA nao selecionou noticias', plano: input.plano } }];
if (input.plano.acao === 'resumao') {
  const resumoDiario = String(result.itens[0].resumo || '').replace(/\\*/g, '').trim();
  if (resumoDiario.length < 80 || /https?:\\/\\//i.test(resumoDiario)) throw new Error('Resumao invalido');
  return [{ json: { tipo: 'resumao', titulo: 'Resumo de hoje', resumo: resumoDiario, texto: comAssinatura(String.fromCodePoint(0x1F6A8) + ' *Resumo de hoje*' + String.fromCharCode(10) + String.fromCharCode(10) + resumoDiario, input.config), link: '', imagemUrl: '', config: configEnvio(input.config), plano: input.plano, numeroDestino: input.config.numeroResumao || input.config.numero } }];
}
const sources = new Map(input.noticias.map(item => [item.id, item]));
const messages = [];
for (const item of result.itens) {
  const source = sources.get(item.id);
  if (!source) continue;
  const titulo = String(item.titulo || '').replace(/\\*/g, '').trim().toLocaleUpperCase('pt-BR');
  const resumoItem = String(item.resumo || '').trim();
  if (!titulo || resumoItem.length < 80 || /https?:\\/\\//i.test(resumoItem)) continue;
  const link = source.link || source.id;
  const texto = comAssinatura((item.emoji || String.fromCodePoint(0x1F4F0)) + ' *' + titulo + '*' + String.fromCharCode(10) + String.fromCharCode(10) + resumoItem + (input.config.enviarLinksFontes !== false ? String.fromCharCode(10) + String.fromCharCode(10) + link : ''), input.config);
  messages.push({ json: { tipo: 'noticia', titulo, resumo: resumoItem, texto, link, imagemUrl: input.config.usarImagem !== false ? source.imagemUrl || '' : '', config: configEnvio(input.config), plano: input.plano, numeroDestino: input.config.numeroNoticias || input.config.numero } });
}
return messages.length ? messages : [{ json: { semNoticias: true, motivo: 'Nenhuma mensagem valida', plano: input.plano } }];
`.trim();

const sendCode = `
const item = $input.first().json;
if (item.semNoticias) return [{ json: item }];
const config = { ...item.config };
const escopoHistorico = [config.cliente || 'cliente', config.instancia || 'instancia'].map(v => String(v).trim()).join('|');
if (config.enviar !== true) return [{ json: { preview: true, titulo: item.titulo, texto: item.texto } }];
const rawNumber = String(item.numeroDestino || config.numero || '').trim();
let destino;
if (/^[0-9]+(?:-[0-9]+)?@g\\.us$/.test(rawNumber)) destino = rawNumber;
else {
  destino = rawNumber.replace(/\\D/g, '');
  if (!/^[1-9][0-9]{7,14}$/.test(destino)) throw new Error('Numero invalido');
}
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
const path = item.imagemUrl ? '/message/sendMedia/' : '/message/sendText/';
const body = item.imagemUrl
  ? { number: destino, mediatype: 'image', media: item.imagemUrl, caption: item.texto }
  : { number: destino, text: item.texto, linkPreview: false };
const response = await http({ method: 'POST', url: base + path + encodeURIComponent(config.instancia), headers: { apikey: config.evolutionApiKey || config.apikey || '' }, body, json: true, timeout: 30000 });
if (response?.status === 'ERROR') throw new Error('Evolution retornou erro');
if (item.link || item.tipo === 'resumao' || item.tipo === 'historico') {
  try {
    await http({ method: 'POST', url: String(config.historicoUrl || 'http://historico:8090').replace(/\\/$/, '') + '/registrar', body: { escopo: escopoHistorico, link: item.link || (item.tipo + ':' + item.plano?.dia + ':' + item.plano?.jobId), titulo: item.titulo, resumo: item.resumo || item.texto, tipo: item.tipo, dia: item.plano?.dia, jobId: item.plano?.jobId, messageId: response?.key?.id || response?.messageId || '' }, json: true });
  } catch (error) {
    console.log('Falha ao registrar historico: ' + error.message);
  }
}
return [{ json: { enviado: true, titulo: item.titulo, link: item.link, messageId: response?.key?.id || '' } }];
`.trim();

const idsPrepCode = `
const form = $input.first().json;
const config = $('Configurar Cliente').first().json;
const choice = String(form.opcao ?? form['O que voc???? quer consultar?'] ?? '').trim();
const filter = String(form.filtro ?? form['Filtrar por nome (opcional)'] ?? '').trim();
const map = { 'Todos os grupos e comunidades': 'todos', 'Grupos comuns': 'grupos', 'Comunidades': 'comunidades', 'Grupos de avisos': 'avisos', 'Broadcasts / listas de transmissao': 'broadcasts', 'Inst????ncia e conex????o': 'instancia' };
const tipo = map[choice] || 'todos';
const base = String(config.evolutionUrl || 'http://evolution-api:8080').replace(/\\/$/, '');
const instancia = String(config.instancia || '').trim();
const consultas = tipo === 'instancia'
  ? [{ nome: 'instancia', method: 'GET', url: base + '/instance/connectionState/' + encodeURIComponent(instancia) }]
  : [
      { nome: 'grupos', method: 'GET', url: base + '/group/fetchAllGroups/' + encodeURIComponent(instancia) + '?getParticipants=false' },
      { nome: 'chats', method: 'POST', url: base + '/chat/findChats/' + encodeURIComponent(instancia), body: {} },
      { nome: 'contatos', method: 'POST', url: base + '/chat/findContacts/' + encodeURIComponent(instancia), body: {} },
    ];
return [{ json: { tipo, filtro: filter, url: consultas[0]?.url || '', consultas, config } }];
`.trim();

const idsFetchCode = `
const q = $input.first().json;
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
// ids helper inserted
const headers = { apikey: q.config.evolutionApiKey || q.config.apikey || '' };
const consultas = Array.isArray(q.consultas) && q.consultas.length ? q.consultas : [{ nome: 'principal', method: 'GET', url: q.url }];
const resultados = {};
const erros = [];
for (const consulta of consultas) {
  try {
    resultados[consulta.nome] = await http({ method: consulta.method || 'GET', url: consulta.url, headers, body: consulta.body, json: true, timeout: 30000 });
  } catch (error) {
    erros.push({ consulta: consulta.nome, erro: error.message });
    resultados[consulta.nome] = [];
  }
}
const rows = resultados.grupos ?? resultados.instancia ?? resultados.principal ?? [];
return [{ json: { ...q, rows, resultados, erros } }];
`.trim();

const idsFormatCode = `
const data = $input.first().json;
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const listFrom = value => Array.isArray(value) ? value : Array.isArray(value?.groups) ? value.groups : Array.isArray(value?.contacts) ? value.contacts : Array.isArray(value?.chats) ? value.chats : value ? [value] : [];
if (data.tipo === 'instancia') {
  const info = data.rows?.instance || data.rows || {};
  return [{ json: { total: 1, tabela: 'INSTANCIA | ' + (info.instanceName || 'Instancia') + ' | estado: ' + (info.state || ''), registros: [{ nome: info.instanceName || 'Instancia', id: info.instanceName || '', tipo: 'Instancia', estado: info.state || '' }], erros: data.erros || [] } }];
}
const groupSource = listFrom(data.resultados?.grupos ?? data.rows);
const groups = groupSource.filter(group => String(group?.id || group?.jid || '').endsWith('@g.us'));
const rawBroadcasts = [...listFrom(data.resultados?.chats), ...listFrom(data.resultados?.contatos)];
const broadcastMap = new Map();
const jidOf = item => String(item?.id || item?.remoteJid || item?.jid || item?.chatId || item?.key?.remoteJid || '').trim();
for (const item of rawBroadcasts) {
  const jid = jidOf(item);
  if (!jid || (!jid.endsWith('@broadcast') && jid !== 'status@broadcast')) continue;
  if (!broadcastMap.has(jid)) {
    broadcastMap.set(jid, {
      nome: item.name || item.pushName || item.subject || (jid === 'status@broadcast' ? 'Status do WhatsApp' : 'Lista de transmissao'),
      id: jid,
      tipo: jid === 'status@broadcast' ? 'Status/Broadcast' : 'Broadcast',
      detalhes: item.unreadCount != null ? 'unread=' + item.unreadCount : '',
    });
  }
}
const linhas = [];
for (const group of groups) {
  linhas.push({
    nome: group.subject || group.name || 'Sem nome',
    id: group.id || group.jid || '',
    tipo: group.isCommunity ? 'Comunidade' : group.isCommunityAnnounce ? 'Grupo de avisos' : group.announce ? 'Grupo comum (somente admins)' : 'Grupo comum',
    participantes: group.size ?? '',
  });
}
for (const broadcast of broadcastMap.values()) linhas.push(broadcast);
const filtered = linhas.filter(row => {
  if (data.tipo === 'grupos' && row.tipo !== 'Grupo comum' && row.tipo !== 'Grupo comum (somente admins)') return false;
  if (data.tipo === 'comunidades' && row.tipo !== 'Comunidade') return false;
  if (data.tipo === 'avisos' && row.tipo !== 'Grupo de avisos' && row.tipo !== 'Grupo comum (somente admins)') return false;
  if (data.tipo === 'broadcasts' && row.tipo !== 'Broadcast' && row.tipo !== 'Status/Broadcast') return false;
  return !data.filtro || normalize(row.nome).includes(normalize(data.filtro));
});
filtered.sort((a, b) => String(a.tipo).localeCompare(String(b.tipo), 'pt-BR') || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
const header = '# | Tipo | Nome | ID | Participantes/Detalhes';
const body = filtered.map((row, index) => [
  String(index + 1).padStart(2, '0'),
  row.tipo || '',
  String(row.nome || '').replace(/\s+/g, ' ').trim(),
  row.id || '',
  row.participantes || row.detalhes || '',
].join(' | ')).join(String.fromCharCode(10));
const avisoBroadcast = broadcastMap.size ? '' : String.fromCharCode(10) + String.fromCharCode(10) + 'Obs.: nenhum @broadcast foi retornado pelos endpoints de chats/contatos da Evolution. Broadcasts so aparecem aqui quando a API expoe esses IDs.';
const tabela = filtered.length ? header + String.fromCharCode(10) + body + avisoBroadcast : 'Nenhum resultado para o filtro selecionado.' + avisoBroadcast;
return [{ json: { total: filtered.length, tipoConsulta: data.tipo, filtro: data.filtro || '', tabela, registros: filtered, erros: data.erros || [] } }];
`.trim();

const trigger = add('Agenda - Verificar a cada minuto', 'n8n-nodes-base.scheduleTrigger', 1.2, [-1600, 120], { rule: { interval: [{ field: 'cronExpression', expression: '* * * * *' }] } });
const manual = add('Noticias - Rodar Manualmente', 'n8n-nodes-base.manualTrigger', 1, [-1600, 300], {});
const manualFlag = add('Marcar Envio Manual', 'n8n-nodes-base.set', 3.4, [-1460, 360], {
  assignments: { assignments: [{ id: id('field'), name: 'forcarAgora', value: true, type: 'boolean' }] },
  options: {},
});
const webhookNoticias = add('Webhook - Noticias Agora', 'n8n-nodes-base.webhook', 2, [-1600, 440], { httpMethod: 'GET', path: 'noticias-agora', responseMode: 'onReceived', options: {} }, { webhookId: 'noticias-agora-v3' });
const resumaoManual = add('Resumao - Rodar Manualmente', 'n8n-nodes-base.manualTrigger', 1, [-1600, 560], {});
const resumaoFlag = add('Marcar Resumao Manual', 'n8n-nodes-base.set', 3.4, [-1460, 560], { assignments: { assignments: [{ id: id('field'), name: 'forcarResumao', value: true, type: 'boolean' }] }, options: {} });
const webhookResumao = add('Webhook - Resumao Agora', 'n8n-nodes-base.webhook', 2, [-1600, 680], { httpMethod: 'GET', path: 'resumao-agora', responseMode: 'onReceived', options: {} }, { webhookId: 'resumao-agora-v3' });
const historicoManual = add('Historico - Enviar Manualmente', 'n8n-nodes-base.manualTrigger', 1, [-1600, 800], {});
const historicoFlag = add('Marcar Historico Manual', 'n8n-nodes-base.set', 3.4, [-1460, 800], { assignments: { assignments: [{ id: id('field'), name: 'forcarHistorico', value: true, type: 'boolean' }] }, options: {} });
const webhookHistorico = add('Webhook - Historico Agora', 'n8n-nodes-base.webhook', 2, [-1600, 920], { httpMethod: 'GET', path: 'historico-agora', responseMode: 'onReceived', options: {} }, { webhookId: 'historico-agora-v3' });
const config = add('Configurar Cliente', 'n8n-nodes-base.set', 3.4, [-1320, 200], {
  assignments: { assignments: configFields.map(([name, value, type]) => ({ id: id('field'), name, value, type })) },
  options: {},
});
const routeIds = add('Rota - Consulta IDs?', 'n8n-nodes-base.if', 2.2, [-1160, 200], {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: id('cond'), leftValue: '={{ $json.fluxo }}', rightValue: 'ids', operator: { type: 'string', operation: 'equals' } }],
    combinator: 'and',
  },
  options: {},
});
const decide = code('Decidir Acao', [-920, 120], decideCode);
const collect = code('Coletar Fontes e Historico', [-760, 200], collectCode);
const prompt = code('Montar Prompt', [-480, 200], promptCode);
const gemini = code('Gemini com Retry', [-200, 200], geminiCode);
const prepare = code('Preparar Mensagens', [80, 200], prepareMessagesCode);
const split = add('Uma mensagem por vez', 'n8n-nodes-base.splitInBatches', 3, [360, 200], { batchSize: 1, options: {} });
const send = code('Enviar e Registrar', [640, 200], sendCode);
const wait = add('Aguardar 8-10s', 'n8n-nodes-base.wait', 1.1, [920, 200], { amount: '={{ Math.floor(Math.random() * 3) + 8 }}' });
const end = add('Fim', 'n8n-nodes-base.noOp', 1, [640, 420], {});

const idsManual = add('IDs - Iniciar Consulta', 'n8n-nodes-base.manualTrigger', 1, [-1600, 760], {});
const idsFlag = add('Marcar Consulta IDs', 'n8n-nodes-base.set', 3.4, [-1460, 760], {
  assignments: { assignments: [{ id: id('field'), name: 'fluxo', value: 'ids', type: 'string' }] },
  options: {},
});
const idsForm = add('IDs - O que Consultar?', 'n8n-nodes-base.wait', 1.1, [-1040, 760], {
  resume: 'form',
  formTitle: 'Consultar IDs do WhatsApp',
  formFields: { values: [
    { fieldLabel: 'O que vocÃƒÆ’Ã‚Âª quer consultar?', fieldType: 'dropdown', defaultValue: 'Todos os grupos e comunidades', fieldOptions: { values: ['Todos os grupos e comunidades', 'Grupos comuns', 'Comunidades', 'Grupos de avisos', 'InstÃƒÆ’Ã‚Â¢ncia e conexÃƒÆ’Ã‚Â£o'].map(option => ({ option })) }, requiredField: true },
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
sticky('V3 - Como usar', [-1600, -260], 'V3 compacta multitenant. Configure numeroNoticias, numeroResumao e numeroHistorico para separar destinatarios; se vazio, usa numero. Para escalar para outro nicho, normalmente basta editar rssFeeds, palavrasChave, promptNoticias e promptResumao. dominiosPermitidos e opcional: vazio usa automaticamente os dominios dos RSS; preencha apenas se quiser restringir mais. Webhooks: noticias-agora, resumao-agora e historico-agora.');

link(trigger, config);
link(manual, manualFlag);
link(webhookNoticias, manualFlag);
link(manualFlag, config);
link(resumaoManual, resumaoFlag);
link(webhookResumao, resumaoFlag);
link(resumaoFlag, config);
link(historicoManual, historicoFlag);
link(webhookHistorico, historicoFlag);
link(historicoFlag, config);
link(config, routeIds);
link(routeIds, idsForm, 0);
link(routeIds, decide, 1);
link(decide, collect);
link(collect, prompt);
link(prompt, gemini);
link(gemini, prepare);
link(prepare, split);
link(split, end, 0);
link(split, send, 1);
link(send, wait);
link(wait, split);
link(idsManual, idsFlag);
link(idsFlag, config);
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

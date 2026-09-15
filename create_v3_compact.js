const fs = require('node:fs');
const crypto = require('node:crypto');

const nodes = [];
const connections = {};
const idCounters = {};
const stableUuid = value => {
  const hex = crypto.createHash('sha1').update(value).digest('hex').slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), '4' + hex.slice(13, 16), ((parseInt(hex[16], 16) & 3) | 8).toString(16) + hex.slice(17, 20), hex.slice(20, 32)].join('-');
};
const id = prefix => {
  idCounters[prefix] = (idCounters[prefix] || 0) + 1;
  return stableUuid(prefix + ':' + idCounters[prefix]);
};

const rssFeedsDefault = "https://www.infomoney.com.br/feed/\nhttps://www.moneytimes.com.br/feed/\nhttps://braziljournal.com/feed/\nhttps://veja.abril.com.br/feed/";
const dominiosPermitidosDefault = "";
const palavrasChaveDefault = "banco, bancos, itau, bradesco, santander, btg, nubank, inter, caixa, banco do brasil, xp, goldman sachs, jpmorgan, morgan stanley, blackrock, fed, banco central, copom, cmn, open finance, pix, credito, emprestimos, financiamento, inadimplencia, provisoes, basileia, fintech, seguradora, previdencia, cvm, anbima, susep, previc, bacen, empresas, companhia, acoes, b3, ibovespa, ipo, follow-on, oferta secundaria, opa, dividendos, jcp, resultados, balanco, lucro, lucro liquido, receita, receita liquida, ebitda, margem, guidance, ceo, m&a, aquisicao, fusao, venda de participacao, recompra de acoes, fato relevante, comunicado ao mercado, aviso aos acionistas, ri, conselho, capex, divida, endividamento, fluxo de caixa, geracao de caixa, consenso, estimativa, revisao de projecao, recuperacao judicial, falencia, desinvestimento, venda de ativos, mudanca de controle, reestruturacao, bolsa, small caps, blue chips, valuation, recomendacao, upgrade, downgrade, preco-alvo, volatilidade, insider, ifix, idiv, ibovespa futuro, fluxo estrangeiro, renda fixa, cdb, lci, lca, cdi, debentures, credito privado, cra, cri, fidc, tesouro direto, tesouro ipca, tesouro prefixado, ltn, ntn-b, ntn-f, ipca, igp-m, spread de credito, rating, default, emissao, resgate antecipado, duration, marcacao a mercado, covenant, curva de juros, di futuro, ima-b, ima-geral, fundos de investimento, fundos imobiliarios, fiis, etfs, bdrs, asset, gestora, corretora, fundos de credito, fundos de acoes, fundos multimercado, selic, juros, ipca-15, inflacao, taxa real, pib, desemprego, fiscal, politica fiscal, politica monetaria, deficit, superavit, divida publica, arrecadacao, impostos, reforma tributaria, arcabouco fiscal, gastos publicos, contingenciamento, orcamento, meta fiscal, fazenda, privatizacao, concessao, leilao, desoneracao, subsidios, risco-pais, cds, embi, ibc-br, boletim focus, producao industrial, varejo, balanca comercial, atividade economica, stf, stj, congresso, camara, senado, governo, planalto, presidente, ministro, pec, projeto de lei, medida provisoria, julgamento, decisao, liminar, marco regulatorio, eleicoes, bce, china, eua, estados unidos, europa, japao, hong kong, taiwan, russia, ucrania, oriente medio, guerra, sancoes, tarifas, comercio exterior, recessao, payroll, cpi, pce, emprego, juros americanos, treasuries, treasury, yield, s&p 500, nasdaq, dow jones, dax, ftse, nikkei, hang seng, msci, otan, israel, ira, palestina, coreia do norte, guerra comercial, tarifaco, conflitos, cessar-fogo, petroleo, brent, wti, gas natural, minerio de ferro, ouro, cobre, aluminio, litio, niquel, fertilizantes, soja, milho, trigo, cafe, acucar, etanol, celulose, carne, boi gordo, opep, commodities, dolar, dolar comercial, dolar futuro, euro, cambio, real, moeda, fluxo cambial, reservas internacionais, petroleo e gas, energia eletrica, saneamento, utilities, construcao civil, shoppings, agronegocio, mineracao, siderurgia, papel e celulose, telecomunicacoes, tecnologia, saude, educacao, transporte, aviacao, infraestrutura, liquidez, volatilidade implicita, aversao ao risco, apetite ao risco, alta, queda, disparada, colapso, crise, risco, alerta, surpresa, emergencia, intervencao, mudanca, corte, alta de juros, corte de juros, suspensao, investigacao, operacao, fraude, escandalo, rebaixamento, surpresa positiva, surpresa negativa, acima das expectativas, abaixo das expectativas, circuit breaker, estresse financeiro";
const promptNoticiasDefault = "Voce e editor de noticias financeiras para leitores leigos no WhatsApp. TAREFA: selecionar apenas noticias relevantes e ineditas para investidores. Ignore propaganda, educacao generica, opiniao sem fato e conteudo sem impacto economico, mesmo que tenha palavra-chave. Priorize fatos das ultimas 24 horas com impacto em mercados, investimentos, empresas, juros, inflacao, cambio, bolsa ou decisoes de investidores. Use apenas as fontes, nao invente numeros, causas, cotacoes, recomendacoes ou previsoes. Cada resumo deve ter 75 a 130 palavras, em linguagem simples, explicando quem fez o que, contexto e possivel impacto.";
const promptResumaoDefault = `Voce e editor financeiro para WhatsApp. TAREFA: escrever UM resumao do periodo, baseado SOMENTE nas noticias individuais enviadas no periodo informado nas fontes.

As noticias possuem campo dia. Se duas ou mais noticias forem sobre o mesmo tema, empresa ou evento ? mesmo em dias diferentes do periodo ? UNIFIQUE em um so bloco, combinando as informacoes que se complementam entre elas, em vez de repetir o assunto separadamente.

Organize o resumao em blocos por categoria/assunto relevante, do mais para o menos importante. Para cada bloco, use um titulo curto de categoria/assunto e escreva um resumo corrido curto, mas completo o suficiente para o leitor entender de fato o que aconteceu e por que importa ? nao sacrifique clareza so para ser breve. Diga primeiro quem fez o que, depois o contexto, e por fim explique o possivel impacto para mercado, empresas, juros, inflacao, cambio, bolsa ou investidores.

Sempre que a noticia trouxer nomes de pessoas, empresas, orgaos ou detalhes especificos (como declaracoes, decisoes ou numeros exatos), inclua-os no resumo para dar mais precisao e contexto ao leitor. Se um fato, numero, nome, data ou causa nao estiver explicitamente nas noticias fornecidas agora, NAO cite ? mesmo que pareca relacionado, familiar ou tenha aparecido em resumos anteriores. Use apenas as noticias fornecidas nesta tarefa como fonte de verdade, ignorando qualquer conhecimento previo sobre os mesmos assuntos.

Quando uma noticia tiver apenas titulo ou texto insuficiente, cite somente o que estiver no titulo, sem completar contexto, numeros ou causas.

Considere todas as noticias fornecidas. Se alguma for menos importante, inclua em bloco mais curto ou junto de outra categoria relacionada. Omita apenas noticias claramente repetidas, irrelevantes para investidores ou sem informacao suficiente.

Escreva em portugues brasileiro, didatico e natural. Sem links, sem markdown, sem lista numerada e sem emojis. Retorne apenas conteudo relevante para investidores.`;

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
  ['resumaoPeriodoDias', 6, 'number'],
  ['diasEnvio', '', 'string'],
  ['diaResumao', 'dom', 'string'],
  ['usarImagem', true, 'boolean'],
  ['enviar', true, 'boolean'],
  ['enviarLinksFontes', false, 'boolean'],
  ['numeroNoticias', '', 'string'],
  ['numeroResumao', '', 'string'],
  ['numeroHistorico', '', 'string'],
  ['numeroErros', '5516997760515', 'string'],
  ['forcarAgora', '={{ Boolean($json.forcarAgora) }}', 'boolean'],
  ['forcarResumao', '={{ Boolean($json.forcarResumao) }}', 'boolean'],
  ['forcarHistorico', '={{ Boolean($json.forcarHistorico) }}', 'boolean'],
  ['fluxo', '={{ $json.fluxo || \"noticias\" }}', 'string'],
];

const decideCode = `const config = $input.first().json;
const fuso = 'America/Sao_Paulo';
const agora = new Date();
const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
const pega = tipo => Number(partes.find(p => p.type === tipo)?.value ?? 0);
const diaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
const semAcento = value => String(value || '').toLowerCase().replaceAll(String.fromCharCode(225), 'a').replaceAll(String.fromCharCode(233), 'e').replaceAll(String.fromCharCode(237), 'i').replaceAll(String.fromCharCode(243), 'o').replaceAll(String.fromCharCode(250), 'u').replaceAll(String.fromCharCode(226), 'a').replaceAll(String.fromCharCode(234), 'e').replaceAll(String.fromCharCode(244), 'o').replaceAll(String.fromCharCode(227), 'a').replaceAll(String.fromCharCode(231), 'c');
const diaSemana = semAcento(new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'short' }).format(agora)).replaceAll('.', '');
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
const somaDia = (base, dias) => {
  const [y, m, d] = String(base).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};
const parseDias = raw => {
  const texto = semAcento(raw).replaceAll(',', ' ').replaceAll(';', ' ').split(' ').filter(Boolean).join(' ').trim();
  if (!texto || texto === 'todos') return null;
  const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const mapa = { seg: 0, segunda: 0, segundas: 0, ter: 1, terca: 1, tercas: 1, qua: 2, quarta: 2, quartas: 2, qui: 3, quinta: 3, quintas: 3, sex: 4, sexta: 4, sextas: 4, sab: 5, sabado: 5, sabados: 5, dom: 6, domingo: 6, domingos: 6 };
  const toks = texto.split(' ').filter(Boolean);
  const set = new Set();
  for (let i = 0; i < toks.length; i++) {
    const a = mapa[toks[i]]; if (a === undefined) continue;
    const b = mapa[toks[i + 2]];
    if (b !== undefined && (toks[i + 1] === 'a' || toks[i + 1] === 'ate')) { for (let d = Math.min(a, b); d <= Math.max(a, b); d++) set.add(ordem[d]); i += 2; } else { set.add(ordem[a]); }
  }
  return set.size ? set : null;
};
const diasEnvio = parseDias(config.diasEnvio);
const diasResumao = parseDias(config.diaResumao);
const periodoDias = Math.max(1, Number(config.resumaoPeriodoDias || 6));
const diaInicio = somaDia(diaLocal, -periodoDias);
const diaFim = diaLocal;
let acao = 'nada';
if (config.forcarHistorico === true) acao = 'historico';
else if (config.forcarResumao === true) acao = 'resumao';
else if (manualNoticias) acao = 'noticias';
else if (config.resumaoAtivo !== false && (!diasResumao || diasResumao.has(diaSemana)) && current === digestAt) acao = 'resumao';
else if ((!diasEnvio || diasEnvio.has(diaSemana)) && current >= start && current <= end && current < digestAt) {
  if (config.periodicidade === 'diario') acao = current === dailyAt ? 'noticias' : 'nada';
  else acao = ((current - start) % interval) === 0 ? 'noticias' : 'nada';
}
return [{ json: { acao, config, manual: manualNoticias || config.forcarResumao === true || config.forcarHistorico === true, jobId: $execution.id, dia: diaLocal, diaInicio, diaFim, periodoDias, diaSemana, rotuloPeriodo: String(config.diaResumao || '') } }];`.trim();

const collectCode = String.raw`
const plano = $('Decidir Acao').first().json;
const config = plano.config;
const baseHistorico = String(config.historicoUrl || 'http://historico:8090').replace(/\\/$/, '');
const escopoHistorico = [config.cliente || 'cliente', config.instancia || 'instancia'].map(v => String(v).trim()).join('|');
const strip = value => String(value || '').replace(/<!\\[CDATA\\[|\\]\\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
const tag = (xml, name) => strip((String(xml || '').match(new RegExp('<' + name + '[^>]*>([\\\\s\\\\S]*?)</' + name + '>', 'i')) || [])[1] || '');
const tagRaw = (xml, name) => (String(xml || '').match(new RegExp('<' + name + '[^>]*>([\\\\s\\\\S]*?)</' + name + '>', 'i')) || [])[1] || '';
const attr = (html, pattern) => (String(html || '').match(pattern) || [])[1] || '';
const first = (...values) => values.map(v => String(v || '').trim()).find(Boolean) || '';
const linkFromBlock = block => {
  const linkText = tag(block, 'link');
  if (/^https?:\\/\\//i.test(linkText)) return linkText;
  return attr(block, /<link[^>]+href=["']([^"']+)["'][^>]*>/i) || tag(block, 'guid') || linkText;
};
const imageFromBlock = block => attr(block, /<(?:media:content|media:thumbnail|enclosure)[^>]+url=["']([^"']+)["'][^>]*>/i);
const dateFromBlock = block => Date.parse(first(tag(block, 'pubDate'), tag(block, 'dc:date'), tag(block, 'published'), tag(block, 'updated')));
const textFromBlock = block => first(tag(block, 'description'), strip(tagRaw(block, 'content:encoded')), tag(block, 'summary'), tag(block, 'content'));
const jsonFeedItems = value => {
  try {
    const feed = JSON.parse(String(value || ''));
    const items = Array.isArray(feed.items) ? feed.items : [];
    return items.map(item => ({
      titulo: item.title || '',
      link: item.url || item.external_url || item.id || '',
      trecho: item.summary || item.content_text || strip(item.content_html || ''),
      data: Date.parse(item.date_published || item.date_modified || ''),
      imagemUrl: urlImagem(item.image || item.banner_image),
    }));
  } catch {
    return [];
  }
};
const normalize = value => strip(value).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
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
// collect helper inserted
if (plano.acao === 'nada') return [{ json: { semNoticias: true, motivo: 'Nada a executar agora', plano, config } }];
if (plano.acao === 'resumao' || plano.acao === 'historico') {
  const diaSoma = (base, dias) => { const [y, m, d] = String(base).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10); };
  const de = plano.diaInicio || plano.dia;
  const ate = (plano.diaFim || plano.dia) >= de ? (plano.diaFim || plano.dia) : de;
  let rows = [];
  try {
    rows = await http({ method: 'GET', url: baseHistorico + '/periodo?de=' + de + '&ate=' + ate + '&escopo=' + encodeURIComponent(escopoHistorico), json: true });
  } catch (error) {
    console.log('Historico /periodo indisponivel, usando fallback /dia: ' + error.message);
    for (let dia = de; dia <= ate; dia = diaSoma(dia, 1)) {
      try {
        const parte = await http({ method: 'GET', url: baseHistorico + '/dia/' + dia + '?escopo=' + encodeURIComponent(escopoHistorico), json: true });
        if (Array.isArray(parte)) rows.push(...parte.map(row => ({ ...row, dia: row.dia || dia })));
      } catch (fallbackError) {
        console.log('Falha no fallback /dia/' + dia + ': ' + fallbackError.message);
      }
    }
  }
  const bruta = (Array.isArray(rows) ? rows : []).filter(row => row.link && row.tipo !== 'resumao' && row.tipo !== 'historico');
  const vistos = new Set();
  const noticias = [];
  for (const row of bruta) { if (!vistos.has(row.link)) { vistos.add(row.link); noticias.push({ id: row.link, link: row.link, titulo: row.titulo || row.link, texto: row.resumo || row.titulo || row.link, resumo: row.resumo || '', hora: row.hora || '', dia: row.dia || de, imagemUrl: '' }); } }
  if (plano.acao === 'historico') return noticias.length ? [{ json: { plano, config, noticias, historico: true } }] : [{ json: { semNoticias: true, motivo: 'Sem noticias enviadas no periodo no historico', plano, config } }];
  return noticias.length ? [{ json: { plano, config, noticias } }] : [{ json: { semNoticias: true, motivo: 'Nenhuma noticia enviada no periodo', plano, config } }];
}
const parseList = value => String(value || '').split(String.fromCharCode(10)).flatMap(line => line.split(/[;,]+/)).map(v => { const text = strip(v); const close = text.indexOf(']('); return text.startsWith('[') && close > 1 && text.endsWith(')') ? text.slice(1, close) : text; }).filter(Boolean);
const feeds = parseList(config.rssFeeds);
if (!feeds.length) throw new Error('Configure pelo menos um RSS no campo rssFeeds.');
let candidates = [];
let feedErrors = [];
for (const feed of feeds) {
  try {
    const xml = await http({ method: 'GET', url: feed, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/atom+xml, application/feed+json, application/json, application/xml, text/xml, */*' }, timeout: 20000 });
    const jsonItems = jsonFeedItems(xml);
    if (jsonItems.length) {
      candidates.push(...jsonItems);
      continue;
    }
    const blocks = String(xml).match(/<item\\b[\\s\\S]*?<\\/item>/gi) || String(xml).match(/<entry\\b[\\s\\S]*?<\\/entry>/gi) || [];
    for (const block of blocks) {
      const link = linkFromBlock(block);
      const date = dateFromBlock(block);
      candidates.push({ titulo: tag(block, 'title'), link, trecho: textFromBlock(block), data: date, imagemUrl: imageFromBlock(block) });
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
candidates = (withScore.length ? withScore : scored).slice(0, 80); // teto tecnico p/ caber no prompt: a IA valida tudo (janelaHoras + palavras-chave) e maxNoticias vale apenas no envio
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
  .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
  .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
  .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, ' ')
  .replace(/<!--[\\s\\S]*?-->/g, ' ');
const cleanArticleText = value => strip(value)
  .replace(/@\\s*property\\s+--[\\s\\S]*?(?=\\s[A-Za-z0-9]|$)/gi, ' ')
  .replace(/--tw-[a-z0-9-]+/gi, ' ')
  .replace(/\\b(initial-value|inherits|syntax|rgba?|var|calc|transform|transition|font-face)\\b\\s*[:;{][^.!?]{0,300}/gi, ' ')
  .replace(/[{}[\\];]{2,}/g, ' ')
  .replace(/\\s+/g, ' ')
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
  const words = text.split(/\\s+/).filter(Boolean);
  if (words.length < 18) return true;
  return false;
};
const noticias = [];
for (const item of candidates) {
  try {
    const rawHtml = await http({ method: 'GET', url: item.link, timeout: 20000 });
    const html = cleanArticleHtml(rawHtml);
    const image = attr(String(rawHtml), /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || attr(String(rawHtml), /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) || item.imagemUrl;
    const textBlocks = [...html.matchAll(/<p[^>]*>([\\s\\S]*?)<\\/p>/gi)]
      .map(match => cleanArticleText(match[1]))
      .filter(text => text.length > 45 && !looksLikeNoise(text) && !/todos os direitos reservados|^compartilh|^assine|^leia tamb[e?]m|^veja tamb[e?]m|newsletter|privacy policy|cookie/i.test(text));
    const texto = [...new Set(textBlocks)].join('\\n').slice(0, 5000);
    if (texto.length >= 120 && !looksLikeNoise(texto)) noticias.push({ id: item.link, link: item.link, titulo: item.titulo, texto, imagemUrl: /^https?:\\/\\//i.test(image) ? urlImagem(image) : '' });
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
  maxNoticias: cfg.maxNoticias,
});
if (input.semNoticias || input.historico) return [{ json: { semNoticias: input.semNoticias === true, motivo: input.motivo || '', plano: input.plano, config: configLeve(input.config || {}), noticias: input.noticias || [], historico: input.historico === true } }];
const diario = input.plano.acao === 'resumao';
const maxNoticiasIA = Math.max(1, Number(input.config.maxNoticias || 3));
const fontes = input.noticias.map(item => ({
  id: item.id,
  link: item.link,
  titulo: item.titulo,
  dia: item.dia || input.plano.dia || '',
  texto: String(item.texto || '').slice(0, diario ? 1200 : 1000),
}));
const basePrompt = diario ? String(input.config.promptResumao || '').trim() : String(input.config.promptNoticias || '').trim();
const outputInstruction = diario
  ? ' Retorne apenas JSON no formato {"tipo":"resumao","itens":[{"titulo":"titulo do bloco ou categoria","resumo":"texto corrido"}]}. Siga exatamente as regras do promptResumao configurado pelo cliente. Use apenas as FONTES a seguir: '
  : ' Retorne apenas JSON no formato {"tipo":"noticias","itens":[{"id":"copie o id exatamente","emoji":"emoji","titulo":"TITULO CURTO","resumo":"texto"}]}. As FONTES ja foram pre-filtradas por RSS, dominio, janela de tempo, historico e palavras-chave. Retorne o maior numero possivel de noticias relevantes ate o limite dinamico de ' + maxNoticiasIA + ' itens. O limite vem de config.maxNoticias; nao e numero fixo. Nao escolha apenas uma noticia por padrao. Para cada fonte com fato economico, de mercado, empresas ou investimento, crie um item separado. Exclua somente fonte claramente irrelevante, propaganda ou sem fato novo. Se nada for relevante, retorne itens vazio. FONTES: ';
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
return [{ json: { plano: input.plano, config: configLeve(input.config || {}), noticias: noticiasLeves, geminiBody: { contents: [{ parts: [{ text: prompt }] }] }, generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: diario ? 8192 : Math.min(6144, 1024 + maxNoticiasIA * 300) }, debug: { fontes: fontes.length, promptChars: prompt.length } } }];
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
  if (!response.ok) {
    const err = new Error(method + ' ' + url.replace(/key=[^&]+/, 'key=***') + ' -> HTTP ' + response.status + ': ' + text.slice(0, 600));
    err.status = response.status;
    err.responseText = text;
    throw err;
  }
  if (json) return text ? JSON.parse(text) : null;
  return text;
};
const describeError = error => {
  const status = error?.status || error?.response?.status || error?.cause?.status || '';
  const data = error?.response?.data || error?.cause?.response?.data || error?.responseText || '';
  const body = typeof data === 'string' ? data : JSON.stringify(data || '');
  return {
    status,
    mensagem: error?.message || 'erro desconhecido',
    corpo: String(body || '').replace(/key=[^&\s]+/g, 'key=***').slice(0, 700),
  };
};
const key = input.config.geminiApiKey;
if (!key) throw new Error('geminiApiKey nao configurada no Configurar Cliente');
const requestBody = { ...(input.geminiBody || {}) };
if (input.generationConfig) requestBody.generationConfig = input.generationConfig;
const promptChars = input.debug?.promptChars || JSON.stringify(input.geminiBody || {}).length;
const fontes = input.debug?.fontes ?? (Array.isArray(input.noticias) ? input.noticias.length : 0);
const contexto = {
  provedor: 'Gemini',
  modelo: model,
  cliente: input.config?.cliente || '',
  acao: input.plano?.acao || '',
  dia: input.plano?.dia || '',
  fontes,
  promptChars,
};
const transient = message => /timeout|ETIMEDOUT|ECONNRESET|ECONNABORTED|429|503|502|504|500|status code 5\d\d|HTTP 5\d\d|network|unavailable|overloaded/i.test(String(message || ''));
const parseGeminiJson = value => {
  const text = String(value || '').trim();
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('Resposta da IA nao veio em JSON valido. Inicio da resposta: ' + text.slice(0, 300));
};
let lastError;
let lastInfo = {};
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const response = await http({ method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), headers: { 'Content-Type': 'application/json' }, body: requestBody, json: true, timeout: 75000 });
    const candidate = response?.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) throw new Error('Gemini nao concluiu: ' + (candidate?.finishReason || 'sem candidato'));
    const raw = (candidate.content?.parts || []).filter(part => !part.thought).map(part => part.text || '').join('');
    const result = parseGeminiJson(raw);
    return [{ json: { plano: input.plano, config: input.config, noticias: input.noticias, ia: result, debug: { ...contexto, itensIA: Array.isArray(result.itens) ? result.itens.length : 0, tentativasGemini: attempt } } }];
  } catch (error) {
    lastError = error;
    lastInfo = describeError(error);
    console.log('[NOTICIAS_V3_GEMINI_TENTATIVA_FALHOU] ' + JSON.stringify({ ...contexto, tentativa: attempt, erro: lastInfo }));
    if (!transient(lastInfo.mensagem + ' ' + lastInfo.status) || attempt === 3) break;
    const waits = [0, 3000, 8000];
    await new Promise(resolve => setTimeout(resolve, waits[attempt] || 8000));
  }
}
const notificarErroManualGemini = async (mensagem) => {
  if ($execution.mode !== 'manual') return { enviado: false, motivo: 'nao_manual' };
  const destinos = String(input.config?.numeroErros || '').split(/[\n,;]+/).map(v => v.trim()).filter(Boolean);
  if (!destinos.length) return { enviado: false, motivo: 'numeroErros vazio' };
  const base = String(input.config?.evolutionUrl || '').replace(/\/$/, '');
  const instancia = String(input.config?.instancia || '').trim();
  const apikey = String(input.config?.evolutionApiKey || input.config?.apikey || '').trim();
  if (!base || !instancia || !apikey) return { enviado: false, motivo: 'configuracao Evolution incompleta' };
  const texto = String.fromCodePoint(0x1F6A8) + ' *ALERTA*' + String.fromCharCode(10) +
    'Ola Willyan, o sistema falhou.' + String.fromCharCode(10) + String.fromCharCode(10) +
    '*Workflow:* ' + (input.config?.cliente || 'Noticias v3') + String.fromCharCode(10) +
    '*Execucao:* ' + ($execution.id || '') + String.fromCharCode(10) +
    '*Node:* Gemini com Retry' + String.fromCharCode(10) +
    '*Falha:* ' + mensagem.slice(0, 1800);
  const resultados = [];
  for (const raw of destinos) {
    const number = /^[0-9]+(?:-[0-9]+)?@g\.us$/.test(raw) ? raw : raw.replace(/\D/g, '');
    if (!number) { resultados.push({ destino: raw, enviado: false, erro: 'destino invalido' }); continue; }
    try {
      const resp = await http({ method: 'POST', url: base + '/message/sendText/' + encodeURIComponent(instancia), headers: { apikey }, body: { number, text: texto, linkPreview: false }, json: true, timeout: 30000 });
      resultados.push({ destino: raw, enviado: true, messageId: resp?.key?.id || resp?.messageId || '' });
    } catch (e) {
      resultados.push({ destino: raw, enviado: false, erro: e.message });
    }
  }
  console.log('[NOTICIAS_V3_ALERTA_MANUAL_GEMINI] ' + JSON.stringify(resultados));
  return { enviado: resultados.some(r => r.enviado), resultados };
};
const statusTxt = lastInfo.status ? 'status=' + lastInfo.status + ' | ' : '';
const corpoTxt = lastInfo.corpo ? ' | corpo=' + lastInfo.corpo : '';
const mensagemFinal = 'Gemini falhou apos 3 tentativas | ' + statusTxt + 'modelo=' + model + ' | cliente=' + (contexto.cliente || '-') + ' | acao=' + (contexto.acao || '-') + ' | fontes=' + fontes + ' | promptChars=' + promptChars + ' | causa=' + (lastInfo.mensagem || lastError?.message || 'erro desconhecido') + corpoTxt + ' | acao sugerida: se for 503/UNAVAILABLE, o problema e instabilidade/sobrecarga da API Gemini; tente novamente depois ou troque modelo/chave.';
try { await notificarErroManualGemini(mensagemFinal); } catch (alertError) { console.log('[NOTICIAS_V3_ALERTA_MANUAL_GEMINI_FALHOU] ' + alertError.message); }
throw new Error(mensagemFinal);
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
  const blocos = [];
  for (const it of result.itens) {
    const resumoItem = String(it.resumo || '').replaceAll('*', '').trim();
    const categoria = String(it.titulo || '').replaceAll('*', '').trim().toLocaleUpperCase('pt-BR');
    if (resumoItem.length < 80 || resumoItem.indexOf('http:') !== -1 || resumoItem.indexOf('https:') !== -1) continue;
    const rotulo = categoria || 'RESUMO DA SEMANA';
    blocos.push('*' + rotulo + '*' + String.fromCharCode(10) + resumoItem);
  }
  if (!blocos.length) return [{ json: { semNoticias: true, motivo: 'Nenhum resumo valido', plano: input.plano } }];
  const periodo = input.plano.diaInicio && input.plano.diaFim ? ' (' + String(input.plano.diaInicio).replace(/^(\\d{4})-(\\d{2})-(\\d{2})$/, '$3/$2') + ' a ' + String(input.plano.diaFim).replace(/^(\\d{4})-(\\d{2})-(\\d{2})$/, '$3/$2') + ')' : '';
  const resumoUnico = blocos.join(String.fromCharCode(10) + String.fromCharCode(10));
  return [{ json: { tipo: 'resumao', titulo: 'RESUMO DA SEMANA', resumo: resumoUnico, texto: comAssinatura(String.fromCodePoint(0x1F4CA) + ' *RESUMO DA SEMANA*' + periodo + String.fromCharCode(10) + String.fromCharCode(10) + resumoUnico, input.config), link: '', imagemUrl: '', config: configEnvio(input.config), plano: input.plano, numeroDestino: input.config.numeroResumao || input.config.numero } }];
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
const limiteEnvio = Math.max(1, Number(input.config.maxNoticias || 3));
const finalMessages = messages.slice(0, limiteEnvio);
return finalMessages.length ? finalMessages : [{ json: { semNoticias: true, motivo: 'Nenhuma mensagem valida', plano: input.plano } }];
`.trim();

const sendCode = `const item = $input.first().json;
if (item.semNoticias) {
  const diag = {
    evento: 'SEM_ENVIO',
    acao: item.plano?.acao || '',
    manual: item.plano?.manual === true,
    motivo: item.motivo || 'Sem motivo detalhado',
    dia: item.plano?.dia || '',
    diaInicio: item.plano?.diaInicio || '',
    diaFim: item.plano?.diaFim || '',
    jobId: item.plano?.jobId || '',
    tipo: item.tipo || '',
    noticias: Array.isArray(item.noticias) ? item.noticias.length : undefined,
    debug: item.debug || undefined,
    dica: 'Abra o output do no anterior para ver fontes, resposta da IA e motivo detalhado. Se acao=nada em execucao agendada, era apenas fora do horario exato.'
  };
  if (diag.manual || diag.acao !== 'nada') console.log('[NOTICIAS_V3_DIAGNOSTICO] ' + JSON.stringify(diag));
  return [{ json: { ...item, diagnostico: diag } }];
}
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
const imagem = urlImagem(item.imagemUrl);
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

const resumoHistorico = String(item.resumo || '').trim();
const podeRegistrarHistorico = item.tipo === 'noticia'
  ? Boolean(item.link) && resumoHistorico.length >= 80
  : Boolean(item.link || item.tipo === 'resumao' || item.tipo === 'historico');
if (!podeRegistrarHistorico && item.tipo === 'noticia') {
  console.log('[NOTICIAS_V3_HISTORICO_IGNORADO_SEM_RESUMO] ' + JSON.stringify({ tipo: item.tipo, titulo: item.titulo, link: item.link }));
}
if (podeRegistrarHistorico) {
  try {
    await http({ method: 'POST', url: String(config.historicoUrl || 'http://historico:8090').replace(/\/$/, '') + '/registrar', body: { escopo: escopoHistorico, link: item.link || (item.tipo + ':' + item.plano?.dia + ':' + item.plano?.jobId), titulo: item.titulo, resumo: resumoHistorico || item.texto, tipo: item.tipo, dia: item.plano?.dia, jobId: item.plano?.jobId, messageId: resultados.filter(r => r.enviado).map(r => r.messageId).filter(Boolean).join(',') }, json: true });
  } catch (error) {
    console.log('Falha ao registrar historico: ' + error.message);
  }
}
const resumoEnvio = { enviado: true, titulo: item.titulo, link: item.link, totalDestinos: destinosUnicos.length, enviados: resultados.filter(r => r.enviado).length, falhas: resultados.filter(r => !r.enviado).length, resultados };
console.log('[NOTICIAS_V3_ENVIADO] ' + JSON.stringify({ tipo: item.tipo, titulo: item.titulo, link: item.link, totalDestinos: resumoEnvio.totalDestinos, enviados: resumoEnvio.enviados, falhas: resumoEnvio.falhas }));
return [{ json: resumoEnvio }];`.trim();

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
  settings: { executionOrder: 'v1', binaryMode: 'separate', timezone: 'America/Sao_Paulo', errorWorkflow: 'noticias_v3_error_handler' },
  pinData: {},
  tags: [],
};

console.error('Gerador antigo desativado. Use noticias_v3.json como arquivo unico canonico e funcional.');
process.exit(1);

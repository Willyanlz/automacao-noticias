const resposta = $input.first().json;
const tentativa = $('Gemini · Preparar tentativa').first(0, -1).json.tentativaGemini;
let body = resposta.body;
let status = Number(resposta.statusCode || 0);
if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch { body = null; }
}
if (!status && resposta.error && typeof resposta.error === 'object') {
  status = Number(resposta.error.httpCode || resposta.error.statusCode || 0);
}
const erro = resposta.error;
const textoErro = typeof erro === 'string' ? erro : [erro?.message, erro?.description, erro?.code, erro?.cause?.code].filter(Boolean).join(' ');
const transitorioHttp = status === 408 || status === 429 || (status >= 500 && status <= 599);
const transitorioRede = !status && /timeout|timed.?out|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket|connection.*(?:closed|reset|aborted)|offline|network|temporar/i.test(textoErro);
if (status >= 200 && status < 300 && body && !body.error) {
  // O resultado segue apenas uma vez para a validação editorial e os envios.
  return [{json: {...body, geminiConcluido: true, tentativaGemini: tentativa}}];
}
if (!transitorioHttp && !transitorioRede) {
  const codigo = status || 'configuração';
  throw new Error(`Gemini: erro ${codigo} não temporário. Confira a credencial, o modelo, os parâmetros e as permissões. Nenhuma notícia foi enviada por esta execução.`);
}
const headers = resposta.headers || {};
const retryHeader = headers['retry-after'] || headers['Retry-After'];
let pedidoServidor = 0;
if (retryHeader) {
  pedidoServidor = /^\d+(?:\.\d+)?$/.test(String(retryHeader))
    ? Number(retryHeader)
    : Math.max(0, (Date.parse(retryHeader) - Date.now()) / 1000);
}
for (const detalhe of body?.error?.details || []) {
  const segundos = /^([0-9]+(?:\.[0-9]+)?)s$/.exec(detalhe.retryDelay || '');
  if (segundos) pedidoServidor = Math.max(pedidoServidor || 0, Number(segundos[1]));
}
const progressivo = Math.min(600, 90 * 2 ** Math.min(tentativa - 1, 4));
const esperaSegundos = Math.ceil(Math.max(progressivo, Number.isFinite(pedidoServidor) ? pedidoServidor : 0)) + Math.floor(Math.random() * 16);
return [{json: {
  geminiConcluido: false,
  tentativaGemini: tentativa,
  esperaSegundos,
  motivo: status ? `Gemini HTTP ${status}` : 'Timeout ou falha temporária de rede',
  proximaTentativa: new Date(Date.now() + esperaSegundos * 1000).toISOString(),
}}];

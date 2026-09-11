const fs = require('node:fs');
const assert = require('node:assert/strict');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const workflow = JSON.parse(fs.readFileSync('noticias_v3.json', 'utf8'));
const names = new Set(workflow.nodes.map(node => node.name));

assert.equal(names.size, workflow.nodes.length, 'nomes de nodes devem ser unicos');
assert.ok(workflow.nodes.length <= 30, 'V3 deve continuar compacta mesmo com webhooks manuais');

for (const [source, routes] of Object.entries(workflow.connections)) {
  assert.ok(names.has(source), `conexao sai de node inexistente: ${source}`);
  for (const output of routes.main || []) {
    for (const edge of output) {
      assert.ok(names.has(edge.node), `conexao aponta para node inexistente: ${edge.node}`);
    }
  }
}

for (const node of workflow.nodes.filter(node => node.type === 'n8n-nodes-base.code')) {
  new AsyncFunction(node.parameters.jsCode);
}

for (const required of [
  'Agenda - Verificar a cada minuto',
  'Noticias - Rodar Manualmente',
  'Webhook - Noticias Agora',
  'Resumao - Rodar Manualmente',
  'Webhook - Resumao Agora',
  'Historico - Enviar Manualmente',
  'Webhook - Historico Agora',
  'Coletar Fontes e Historico',
  'Gemini com Retry',
  'Enviar e Registrar',
  'IDs - Iniciar Consulta',
  'IDs - Resultados',
]) {
  assert.ok(names.has(required), `node obrigatorio ausente: ${required}`);
}

const config = workflow.nodes
  .find(node => node.name === 'Configurar Cliente')
  .parameters.assignments.assignments;
const configNames = new Set(config.map(field => field.name));
for (const requiredField of [
  'rssFeeds',
  'dominiosPermitidos',
  'palavrasChave',
  'promptNoticias',
  'promptResumao',
  'numeroNoticias',
  'numeroResumao',
  'numeroHistorico',
]) {
  assert.ok(configNames.has(requiredField), `campo dinamico ausente: ${requiredField}`);
}

const collectCode = workflow.nodes.find(node => node.name === 'Coletar Fontes e Historico').parameters.jsCode;
assert.ok(collectCode.includes('config.rssFeeds'), 'RSS deve vir do card Configurar Cliente');
assert.ok(collectCode.includes('config.palavrasChave'), 'palavras-chave devem vir do card Configurar Cliente');

const promptCode = workflow.nodes.find(node => node.name === 'Montar Prompt').parameters.jsCode;
assert.ok(promptCode.includes('config.promptNoticias'), 'prompt de noticias deve vir do card Configurar Cliente');
assert.ok(promptCode.includes('config.promptResumao'), 'prompt de resumao deve vir do card Configurar Cliente');

console.log(`PASS V3 compacta importavel com ${workflow.nodes.length} nodes.`);

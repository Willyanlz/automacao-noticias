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

console.log(`PASS V3 compacta importavel com ${workflow.nodes.length} nodes.`);

const fs = require('node:fs');
const assert = require('node:assert/strict');

const workflow = JSON.parse(fs.readFileSync('noticias_investimento_whatsapp.json', 'utf8'));
const nodes = Array.isArray(workflow) ? workflow[0].nodes : workflow.nodes;
const connections = Array.isArray(workflow) ? workflow[0].connections : workflow.connections;
const names = new Set(nodes.map(node => node.name));

for (const node of nodes) {
  assert(!names.has(node.name) || [...names].filter(name => name === node.name).length === 1, `Nome duplicado: ${node.name}`);
}

for (const [source, routes] of Object.entries(connections)) {
  assert(names.has(source), `Conexão sai de nó inexistente: ${source}`);
  for (const channel of routes.main || []) {
    for (const edge of channel) {
      assert(names.has(edge.node), `Conexão aponta para nó inexistente: ${edge.node}`);
    }
  }
}

for (const name of [
  'RSS InfoMoney',
  'RSS Money Times',
  'RSS BrazilJournal',
  'RSS Veja',
  'Agenda · Coletar notícias?',
  'IA · Há conteúdo para enviar?',
  'Histórico · Pode enviar?',
]) {
  const node = nodes.find(item => item.name === name);
  assert(node, `Nó obrigatório ausente: ${name}`);
  assert.notEqual(node.disabled, true, `Nó obrigatório desativado: ${name}`);
}

console.log('PASS workflow importável: conexões válidas e gates críticos ativos.');

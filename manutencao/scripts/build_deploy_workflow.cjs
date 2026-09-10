// Monta o arquivo de import para o n8n do servidor a partir do workflow local,
// preservando o id, as credenciais reais do servidor e a configuração real do cliente.
// Uso: node manutencao/scripts/build_deploy_workflow.cjs <local> <servidor-export> <saida>
const fs = require('node:fs');
const input = process.argv[2] || 'noticias_investimento_whatsapp.json';
const remoteFile = process.argv[3] || 'manutencao/wf-export-server.json';
const output = process.argv[4] || 'manutencao/deploy-temp.json';

const localRaw = JSON.parse(fs.readFileSync(input, 'utf8'));
const w = Array.isArray(localRaw) ? localRaw[0] : localRaw;

const remoteRaw = JSON.parse(fs.readFileSync(remoteFile, 'utf8'));
const remote = Array.isArray(remoteRaw) ? remoteRaw[0] : remoteRaw;

// Mescla a configuração REAL de produção do card antigo do servidor
// (a duplicação guardava placeholders no novo). Mantém os campos de agenda novos.
const oldConfig = remote.nodes.find(n => n.name === 'Configurar Cliente');
const localConfig = w.nodes.find(n => n.name === 'Configurar Cliente');
if (oldConfig) {
  const remoteFields = Object.fromEntries(oldConfig.parameters.assignments.assignments.map(a => [a.name, a.value]));
  const nowFields = Object.fromEntries(localConfig.parameters.assignments.assignments.map(a => [a.name, a.value]));
  const merged = { ...remoteFields, ...nowFields }; // campos novos ganham as configurações novas quando inexistentes no antigo
  // Campos de produção devem vir do antigo quando existem com valor real:
  for (const key of ['numero', 'cliente', 'instancia', 'evolutionUrl', 'modeloGemini', 'maxNoticias', 'janelaHoras', 'enviar', 'usarImagem']) {
    if (key in remoteFields) merged[key] = remoteFields[key];
  }
  localConfig.parameters.assignments.assignments = Object.entries(merged).map(([name, value]) => ({
    id: 'field-' + name, name, value, type: typeof value,
  }));
  console.log('Configuração de produção mesclada:', JSON.stringify({ numero: merged.numero, cliente: merged.cliente, instancia: merged.instancia, enviar: merged.enviar, maxNoticias: merged.maxNoticias, periodicidade: merged.periodicidade, horarioResumao: merged.horarioResumao }));
}

// Credenciais reais do n8n do servidor (lidas do export).
const CRED = {
  gemini: remote.nodes.find(n => n.name === 'Gemini (JSON estruturado)')?.credentials?.httpHeaderAuth || { id: 'b8GES68HoOoPdF3i', name: 'gemini apiKey' },
  evolution: remote.nodes.find(n => n.name === 'Enviar WhatsApp (Evolution API)')?.credentials?.httpHeaderAuth || { id: 'nxbFl2VUNeoyjjdg', name: 'evolution - iguera' },
  news: remote.nodes.find(n => n.name === 'Histórico · Filtrar inéditas')?.credentials?.httpHeaderAuth || { id: 'news-state-ledger', name: 'Histórico de notícias' },
};
const assignCred = (n, cred) => { n.credentials = { httpHeaderAuth: cred }; };
for (const n of w.nodes) {
  delete n.credentials;
  if (n.name === 'Gemini (JSON estruturado)') assignCred(n, CRED.gemini);
  if (['Enviar WhatsApp (Evolution API)', 'Enviar imagem (Evolution API)', 'IDs · Consultar Evolution'].includes(n.name)) assignCred(n, CRED.evolution);
  // Todos os nós que falam com o serviço de histórico usam a credencial "Histórico de notícias".
  if (/^(Agenda · Decidir execução|Histórico ·|Agenda · Manter execução|Agenda · Concluir execução)/.test(n.name)) assignCred(n, CRED.news);
}

// Mantém o mesmo id do workflow instalado e o estado ativo atual.
w.id = remote.id;
w.active = remote.active;
w.name = remote.name || w.name;

fs.writeFileSync(output, JSON.stringify([w], null, 2) + '\n');
console.log('Workflow de deploy gerado:', output);
console.log('id:', w.id, '| ativo:', w.active, '| nós:', w.nodes.length);
const withCred = w.nodes.filter(n => n.credentials).map(n => n.name + ' -> ' + n.credentials.httpHeaderAuth.name);
console.log('credenciais aplicadas (' + withCred.length + '):\n  ' + withCred.join('\n  '));
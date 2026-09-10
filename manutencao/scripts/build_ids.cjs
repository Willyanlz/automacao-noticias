// Gera o bloco independente de consulta de IDs, em português brasileiro.
// Preserva todos os nós, conexões e configurações fora do bloco IDs.
// Pode ser executado novamente sem duplicar o bloco.
//
// Uso:
//   node manutencao/scripts/build_ids.cjs <entrada.json> <saida.json>
//
// Os textos do formulário e dos resultados ficam centralizados em:
//   install_ids.cjs, ids_query.js e ids_format.js.
// Assim, a geração local usa exatamente o mesmo bloco instalado no servidor.

if (process.argv.length !== 4) {
  console.error('Uso: node manutencao/scripts/build_ids.cjs <entrada.json> <saida.json>');
  process.exit(1);
}

require('./install_ids.cjs');

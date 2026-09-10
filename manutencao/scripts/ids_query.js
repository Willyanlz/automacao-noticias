const formulario = $input.first().json;
const instancia = 'SEU_CLIENTE';
const baseUrl = 'http://evolution-api:8080';
const escolha = String(formulario.opcao ?? formulario['O que você quer consultar?'] ?? '').trim();
const filtro = String(formulario.filtro ?? formulario['Filtrar por nome (opcional)'] ?? '').trim().slice(0, 120);
const opcoes = {
  'Todos os grupos e comunidades': 'todos',
  'Grupos comuns': 'grupos',
  'Comunidades': 'comunidades',
  'Grupos de avisos': 'avisos',
  'Instância e conexão': 'instancia',
  'Canais de voz (disponibilidade)': 'voz',
};
const tipo = opcoes[escolha];
if (!tipo) throw new Error('Escolha uma das opções do formulário de consulta.');
const consultarAPI = tipo !== 'voz';
const url = tipo === 'instancia'
  ? `${baseUrl}/instance/connectionState/${instancia}`
  : `${baseUrl}/group/fetchAllGroups/${instancia}?getParticipants=false`;
return [{json: {tipo, filtro, instancia, consultarAPI, url}}];

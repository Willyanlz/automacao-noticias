const consulta = $('IDs · Preparar consulta').first().json;
const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
if (consulta.tipo === 'voz') return [{json: {
  nome: 'Canais de voz', id: '', tipo: 'Indisponível nesta consulta',
  observacao: 'A Evolution API 2.3.7 não oferece uma rota para listar IDs de canais de voz. Comunidades e grupos de avisos do WhatsApp são categorias diferentes. Nenhuma chamada é iniciada por este bloco.',
}}];
const entradas = $input.all().flatMap(item => Array.isArray(item.json) ? item.json : [item.json]);
if (consulta.tipo === 'instancia') {
  const info = entradas[0]?.instance;
  if (!info || typeof info.state !== 'string') throw new Error('A Evolution não retornou o estado esperado da instância.');
  return [{json:{nome:info.instanceName || consulta.instancia, id:info.instanceName || consulta.instancia, tipo:'Instância', estado:info.state, observacao:'Este é o nome da conexão. Para enviar, use um telefone ou ID de grupo como destinatário.'}}];
}
const grupos = entradas.flatMap(item=>Array.isArray(item.groups) ? item.groups : [item]);
const vistos = new Set();
const filas = grupos.filter(g=>{
  if (!g || typeof g.id !== 'string' || !g.id.endsWith('@g.us') || vistos.has(g.id)) return false;
  vistos.add(g.id);
  if (consulta.tipo === 'grupos' && (g.isCommunity || g.isCommunityAnnounce)) return false;
  if (consulta.tipo === 'comunidades' && !g.isCommunity) return false;
  if (consulta.tipo === 'avisos' && !g.isCommunityAnnounce && !g.announce) return false;
  return !consulta.filtro || normalizar(g.subject).includes(normalizar(consulta.filtro));
}).map(g=>({json:{
  nome:String(g.subject || 'Sem nome').trim(), id:g.id,
  tipo:g.isCommunity ? 'Comunidade (estrutura principal)' : g.isCommunityAnnounce ? 'Grupo de avisos da comunidade' : g.announce ? 'Grupo somente administradores' : 'Grupo comum',
  participantes:g.size ?? null,
  comunidade:g.linkedParent || '',
  observacao:g.isCommunity ? 'Para publicar avisos, procure o grupo de avisos vinculado a esta comunidade.' : 'Copie o ID para o destinatário quando desejar. Esta consulta não altera o destino do workflow.',
}})).sort((a,b)=>a.json.nome.localeCompare(b.json.nome,'pt-BR'));
return filas.length ? filas : [{json:{nome:'Nenhum resultado',id:'',tipo:consulta.tipo,observacao:'Tente outra categoria ou remova o filtro por nome.'}}];

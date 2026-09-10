const config = $('Configurar Cliente').first().json;
const limpar = v => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const normalizar = v => limpar(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const RAW = [
  // 🏦 BANCOS E INSTITUIÇÕES
  'Banco','Bancos','Itaú','Bradesco','Santander','BTG','Nubank','Inter','Caixa','Banco do Brasil','XP','Goldman Sachs','JPMorgan','Morgan Stanley','BlackRock','Fed','Banco Central','Copom','CMN','Open Finance','Pix','crédito','empréstimos','financiamento','inadimplência','provisões','Basileia','fintech','seguradora','previdência','CVM','ANBIMA','SUSEP','PREVIC','Bacen',
  // 🏢 EMPRESAS E BOLSA
  'Empresas','Companhia','ações','B3','Ibovespa','IPO','Follow-on','oferta secundária','OPA','dividendos','JCP','resultados','balanço','lucro','lucro líquido','receita','receita líquida','EBITDA','margem','guidance','CEO','mudança de CEO','M&A','aquisição','fusão','venda de participação','recompra de ações','fato relevante','comunicado ao mercado','aviso aos acionistas','RI','conselho','CAPEX','dívida','endividamento','fluxo de caixa','geração de caixa','consenso','estimativa','revisão de projeção','recuperação judicial','falência','desinvestimento','venda de ativos','aquisição de ativos','mudança de controle','mudança de gestão','reestruturação',
  // 📈 RENDA VARIÁVEL
  'Ações','Bolsa','Ibovespa','Small Caps','Blue Chips','Valuation','recomendação','upgrade','downgrade','preço-alvo','consenso','estimativa','volatilidade','insider','insider trading','recompra de ações','oferta pública','oferta secundária','resultado','dividendos','JCP','IFIX','IDIV','Ibovespa Futuro','fluxo estrangeiro','investidor estrangeiro',
  // 💰 RENDA FIXA E CRÉDITO
  'Renda fixa','CDB','LCI','LCA','CDI','debêntures','debênture incentivada','crédito privado','CRA','CRI','FIDC','Tesouro Direto','Tesouro IPCA+','Tesouro Prefixado','LTN','NTN-B','NTN-F','IPCA','IGP-M','spread de crédito','rating','agência de rating','default','inadimplência','emissão','resgate antecipado','duration','marcação a mercado','covenant','recuperação de crédito','curva de juros','DI futuro','IMA-B','IMA-Geral',
  // 🏦 FUNDOS E INVESTIMENTOS
  'Fundos de investimento','fundos imobiliários','FIIs','ETFs','BDRs','previdência privada','asset','gestora','corretora','fundos de crédito','fundos de ações','fundos multimercado','fundos internacionais',
  // 🇧🇷 ECONOMIA BRASILEIRA
  'Selic','juros','Copom','Banco Central','IPCA','IPCA-15','inflação','taxa real','PIB','desemprego','mercado de trabalho','fiscal','política fiscal','política monetária','déficit','superávit','dívida pública','dívida/PIB','arrecadação','impostos','reforma tributária','arcabouço fiscal','gastos públicos','contingenciamento','orçamento','meta fiscal','Fazenda','Ministério da Fazenda','privatização','concessão','leilão','desoneração','subsídios','risco-país','CDS','EMBI','IBC-Br','Boletim Focus','produção industrial','vendas no varejo','balança comercial','atividade econômica',
  // 🏛️ POLÍTICA E JUDICIÁRIO
  'STF','Supremo Tribunal Federal','STJ','Congresso','Câmara','Senado','Governo','Planalto','Presidente','Ministro','Deputado','Senador','PEC','projeto de lei','medida provisória','julgamento','decisão','liminar','marco regulatório','eleições','eleição presidencial',
  // 🌎 EXTERIOR
  'Fed','Fed Funds','BCE','Banco Central Europeu','China','EUA','Estados Unidos','Trump','Europa','Japão','Hong Kong','Taiwan','Rússia','Ucrânia','Oriente Médio','guerra','sanções','tarifas','comércio exterior','recessão','Payroll','CPI','PCE','inflação americana','emprego','mercado de trabalho','juros americanos','juros globais','Treasuries','Treasury','yield','S&P 500','Nasdaq','Dow Jones','DAX','FTSE','Nikkei','Hang Seng','MSCI',
  // 🌍 GEOPOLÍTICA
  'OTAN','Israel','Irã','Palestina','Rússia','Ucrânia','Oriente Médio','China','Taiwan','Coreia do Norte','sanções econômicas','guerra comercial','tarifas de importação','tarifaço','eleições','conflitos','ataques','cessar-fogo',
  // 🛢️ COMMODITIES
  'Petróleo','Brent','WTI','gás natural','minério de ferro','ouro','cobre','alumínio','lítio','níquel','fertilizantes','soja','milho','trigo','café','açúcar','etanol','celulose','carne','boi gordo','OPEP','commodities',
  // 💵 CÂMBIO
  'Dólar','dólar comercial','dólar futuro','euro','câmbio','real','moeda','fluxo cambial','reservas internacionais','dólar forte','dólar fraco',
  // 🏭 SETORES DA BOLSA
  'Petróleo e gás','bancos','seguradoras','energia elétrica','saneamento','utilities','varejo','construção civil','shoppings','agronegócio','mineração','siderurgia','papel e celulose','telecomunicações','tecnologia','saúde','educação','transporte','aviação','concessões','infraestrutura',
  // 📊 MERCADO E FLUXO
  'IMA-B','IMA-Geral','IFIX','IDIV','Ibovespa Futuro','DI Futuro','curva de juros','term structure','prêmio de risco','risco-país','CDS','EMBI','fluxo estrangeiro','fluxo de capital','investidor estrangeiro','liquidez','volatilidade implícita','aversão ao risco','apetite ao risco',
  // 🚨 EVENTOS RELEVANTES
  'Alta','queda','disparada','colapso','crise','risco','alerta','surpresa','emergência','intervenção','mudança','corte','alta de juros','corte de juros','suspensão','investigação','operação','fraude','escândalo','rebaixamento','default','inadimplência','recuperação judicial','falência','aquisição','OPA','dividendos','resultado','guidance','fato relevante','comunicado ao mercado','aviso aos acionistas','mudança de guidance','revisão de projeção','surpresa positiva','surpresa negativa','acima das expectativas','abaixo das expectativas','consenso','recomendação','preço-alvo','volatilidade','circuit breaker','suspensão de negociação','oferta pública','insider trading','estresse financeiro','problemas de liquidez','mudança de controle','mudança de gestão','reestruturação','venda de ativos','aquisição de ativos','desinvestimento','pedido de falência','rebaixamento de rating'
];
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termos = [...new Set(RAW.map(normalizar).filter(Boolean).map(escapar))];
const relevantes = new RegExp('(?:^|[^a-z0-9])(' + termos.join('|') + ')(?=$|[^a-z0-9])');
const vistos = new Set();
return $input.all().map(({json:n}) => ({
  titulo: limpar(n.title), link: limpar(n.link).replace(/^\[([^\]]+)\]\([^)]*\)$/, '$1'),
  trecho: limpar(n.contentSnippet || n['content:encodedSnippet'] || n.description || n.content || n['content:encoded']).slice(0, 5000),
  imagemRss: n.enclosure?.url || '', data: Date.parse(n.isoDate || n.pubDate || ''),
})).filter(n => /^https:\/\/(?:www\.)?(?:infomoney\.com\.br|moneytimes\.com\.br|braziljournal\.com|veja\.abril\.com\.br)\//.test(n.link)
  && Number.isFinite(n.data) && n.data <= Date.now() && Date.now()-n.data <= config.janelaHoras*3600000 && relevantes.test(normalizar(n.titulo)))
  .sort((a,b)=>b.data-a.data).filter(n=> {
    const t=normalizar(n.titulo); if(vistos.has(t)||vistos.has(n.link))return false;
    vistos.add(t);vistos.add(n.link);return true;
  }).slice(0,config.maxNoticias).map(n=>({json:n}));

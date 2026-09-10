const origem = $('Montar Prompt').first(0, 0).json;
const anterior = $input.first().json;
const tentativa = Number(anterior.tentativaGemini || 0) + 1;
return [{json: {...origem, tentativaGemini: tentativa}}];

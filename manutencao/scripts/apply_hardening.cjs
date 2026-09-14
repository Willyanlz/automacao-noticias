#!/usr/bin/env node
// apply_hardening.cjs <workflow.json> [saida.json]
//
// Aplica o hardening de URL de imagem em workflows n8n exportados do repositorio v3:
//   - "Enviar e Registrar": sanitiza imagemUrl (decodifica entidades HTML como &#039; e
//     re-encoda os segmentos) e, se o sendMedia falhar, reenvia como texto (sendText).
//   - "Coletar Fontes e Historico": sanitiza imagemUrl na origem (RSS e og:image/twitter:image).
//
// Suporta o template v3 compacta (odonto/investimento/base) e a variante antiga multi-destino (PET).
// Nao altera nenhum outro node (Configurar Cliente etc.).
//
// Uso: node apply_hardening.cjs noticias_v3.json saida.json

const fs = require('fs');

const INPUT = process.argv[2];
const OUTPUT = process.argv[3];
if (!INPUT) {
  console.error('uso: node apply_hardening.cjs <workflow.json> [saida.json]');
  process.exit(1);
}

const NOME_COLETOR = 'Coletar Fontes e Historico';
const NOME_SEND = 'Enviar e Registrar';

const HELPERS = `const decodificar = value => String(value || '').replace(/&#0?39;|&#x27;/gi, "'").replace(/&quot;/gi, '"').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&');
const encUri = str => String(str).split(/(%[0-9A-Fa-f]{2})/g).map(p => /^%[0-9A-Fa-f]{2}$/.test(p) ? p : encodeURI(p)).join('');
const urlImagem = raw => {
  const limpa = decodificar(raw);
  if (!/^https?:\\/\\//i.test(limpa)) return '';
  try {
    const u = new URL(limpa);
    u.pathname = u.pathname.split('/').map(seg => encUri(seg).replace(/'/g, '%27').replace(/&/g, '%26')).join('/');
    if (u.search) u.search = encUri(u.search).replace(/'/g, '%27');
    return u.href;
  } catch {
    return limpa;
  }
};
`;

// ---------------- Template v3 compacta ----------------

function patchSendCompact(jsCode) {
  const OLD = `// send helper inserted
if (!base) throw new Error('evolutionUrl nao configurada');
const path = item.imagemUrl ? '/message/sendMedia/' : '/message/sendText/';
const body = item.imagemUrl
  ? { number: destino, mediatype: 'image', media: item.imagemUrl, caption: item.texto }
  : { number: destino, text: item.texto, linkPreview: false };
const response = await http({ method: 'POST', url: base + path + encodeURIComponent(config.instancia), headers: { apikey: config.evolutionApiKey || config.apikey || '' }, body, json: true, timeout: 30000 });
if (response?.status === 'ERROR') throw new Error('Evolution retornou erro');`;
  if (!jsCode.includes(OLD)) return null;
  const NEW = `// send helper inserted
if (!base) throw new Error('evolutionUrl nao configurada');
${HELPERS}const imagem = urlImagem(item.imagemUrl);
const path = imagem ? '/message/sendMedia/' : '/message/sendText/';
let tentativa = null;
if (imagem) {
  try {
    tentativa = await http({ method: 'POST', url: base + path + encodeURIComponent(config.instancia), headers: { apikey: config.evolutionApiKey || config.apikey || '' }, body: { number: destino, mediatype: 'image', media: imagem, caption: item.texto }, json: true, timeout: 30000 });
    if (tentativa?.status === 'ERROR') throw new Error('Evolution retornou erro no sendMedia');
  } catch (error) {
    console.log('sendMedia falhou (' + error.message + '), reenviando como texto');
    tentativa = null;
  }
}
if (!tentativa) {
  tentativa = await http({ method: 'POST', url: base + '/message/sendText/' + encodeURIComponent(config.instancia), headers: { apikey: config.evolutionApiKey || config.apikey || '' }, body: { number: destino, text: item.texto, linkPreview: false }, json: true, timeout: 30000 });
  if (tentativa?.status === 'ERROR') throw new Error('Evolution retornou erro');
}
const response = tentativa;`;
  return jsCode.replace(OLD, NEW);
}

function patchCollectCompact(jsCode) {
  let cod = jsCode;
  const foiPatchado = () => cod.includes('urlImagem(') && cod.includes('const urlImagem = raw => {');
  if (cod.includes('// collect helper inserted') && !cod.includes('const urlImagem = raw => {')) {
    cod = cod.replace('// collect helper inserted', HELPERS.trimEnd() + '\n// collect helper inserted');
  }
  cod = cod.replace("imagemUrl: item.image || item.banner_image || '',", 'imagemUrl: urlImagem(item.image || item.banner_image),');
  cod = cod.replace("imagemUrl: /^https?:\\/\\//i.test(image) ? image : ''", "imagemUrl: /^https?:\\/\\//i.test(image) ? urlImagem(image) : ''");
  return foiPatchado() ? cod : null;
}

// ---------------- Variante antiga multi-destino (PET) ----------------

function patchSendPet(jsCode) {
  let cod = jsCode;
  const baseAnchor = `const base = String(config.evolutionUrl || '').replace(/\\/$/, '');`;
  if (!cod.includes(baseAnchor)) return null;

  if (!cod.includes('const urlImagem = raw => {')) {
    cod = cod.replace(baseAnchor, baseAnchor + '\n\n' + HELPERS.trimEnd() + '\n\nconst imagem = urlImagem(item.imagemUrl);');
  }

  const pathOld = `const path = item.imagemUrl
  ? '/message/sendMedia/'
  : '/message/sendText/';`;
  const pathNew = `const path = imagem
  ? '/message/sendMedia/'
  : '/message/sendText/';`;
  if (cod.includes(pathOld)) cod = cod.replace(pathOld, pathNew);

  const bodyOld = `const body = item.imagemUrl
    ? {
        number: destino,
        mediatype: 'image',
        media: item.imagemUrl,
        caption: item.texto
      }`;
  const bodyNew = `const body = imagem
    ? {
        number: destino,
        mediatype: 'image',
        media: imagem,
        caption: item.texto
      }`;
  if (cod.includes(bodyOld)) cod = cod.replace(bodyOld, bodyNew);

  const catchOld = `  } catch (error) {

    resultados.push({
      destino,
      enviado: false,
      erro: error.message
    });

  }`;
  const catchNew = `  } catch (error) {

    let responseFallback = null;

    if (imagem) {
      try {
        responseFallback = await http({
          method: 'POST',
          url: base + '/message/sendText/' + encodeURIComponent(config.instancia),
          headers: {
            apikey:
              config.evolutionApiKey ||
              config.apikey ||
              ''
          },
          body: {
            number: destino,
            text: item.texto,
            linkPreview: false
          },
          json: true,
          timeout: 30000
        });
      } catch (erroTexto) {
        responseFallback = null;
      }

      if (responseFallback?.status === 'ERROR') responseFallback = null;
    }

    resultados.push({
      destino,
      enviado: !!responseFallback,
      messageId: responseFallback?.key?.id || responseFallback?.messageId || '',
      erro: responseFallback
        ? 'Falha ao enviar imagem, reenviado como texto: ' + error.message
        : error.message
    });

  }`;
  if (cod.includes(catchOld)) cod = cod.replace(catchOld, catchNew);

  if (!cod.includes('const urlImagem = raw => {') || !cod.includes('const imagem = urlImagem')) return null;
  return cod;
}

function patchCollectPet(jsCode) {
  let cod = jsCode;
  if (!cod.includes('const urlImagem = raw => {')) {
    const anchor = `const normalize = value => strip(value).normalize('NFD')`;
    const anchorAlt = `const strip = value => String(value || '').replace`;
    if (cod.includes(anchor)) {
      cod = cod.replace(anchor, HELPERS.trimEnd() + '\n' + anchor);
    } else if (cod.includes(anchorAlt)) {
      cod = cod.replace(anchorAlt, HELPERS.trimEnd() + '\n' + anchorAlt);
    } else {
      return null;
    }
  }
  let changed = false;
  const a = `imagemUrl:
        item.image ||
        item.banner_image ||
        ''`;
  const aNew = `imagemUrl:
        urlImagem(
          item.image ||
          item.banner_image ||
          ''
        )`;
  if (cod.includes(a)) { cod = cod.replace(a, aNew); changed = true; }
  const b = `imagemUrl: imageFromBlock(block)`;
  const bNew = `imagemUrl: urlImagem(imageFromBlock(block))`;
  if (cod.includes(b)) { cod = cod.replace(b, bNew); changed = true; }
  const c = `imagemUrl: image
    });`;
  const cNew = `imagemUrl: urlImagem(image)
    });`;
  if (cod.includes(c)) { cod = cod.replace(c, cNew); changed = true; }
  return changed ? cod : null;
}

// ---------------- Main ----------------

function load(input) {
  const raw = fs.readFileSync(input, 'utf8');
  return JSON.parse(raw);
}

function patchWorkflow(wf) {
  const nodes = wf.nodes;
  if (!Array.isArray(nodes)) throw new Error('workflow sem nodes');

  const col = nodes.find(n => n.name === NOME_COLETOR);
  const sen = nodes.find(n => n.name === NOME_SEND);

  if (col && col.type === 'n8n-nodes-base.code' && typeof col.parameters.jsCode === 'string') {
    let novo = null;
    if (col.parameters.jsCode.includes('// collect helper inserted')) {
      novo = patchCollectCompact(col.parameters.jsCode);
    } else {
      novo = patchCollectPet(col.parameters.jsCode);
    }
    if (novo) {
      col.parameters.jsCode = novo;
      console.log('PATCHED coletor [Coletar Fontes e Historico]');
    } else {
      console.log('SKIP coletor (nao reconhecido)');
    }
  } else {
    console.log('SKIP coletor (node ausente)');
  }

  if (sen && sen.type === 'n8n-nodes-base.code' && typeof sen.parameters.jsCode === 'string') {
    let novo = null;
    if (sen.parameters.jsCode.includes('// send helper inserted')) {
      novo = patchSendCompact(sen.parameters.jsCode);
    } else {
      novo = patchSendPet(sen.parameters.jsCode);
    }
    if (novo) {
      sen.parameters.jsCode = novo;
      console.log('PATCHED send [Enviar e Registrar]');
    } else {
      console.log('SKIP send (nao reconhecido)');
    }
  } else {
    console.log('SKIP send (node ausente)');
  }

  return wf;
}

const data = load(INPUT);
const isArray = Array.isArray(data);
const list = isArray ? data : [data];

for (const wf of list) {
  console.log('== ' + (wf.id || wf.name || '?') + ' :: ' + (wf.name || '') + ' ==');
  patchWorkflow(wf);
}

if (OUTPUT) {
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  console.log('gravado: ' + OUTPUT);
} else if (!isArray) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}
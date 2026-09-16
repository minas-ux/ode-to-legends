// parser.js — Convierte assets/manuscrito.txt en story.js
// Uso: node parser.js
//
// Formato esperado en manuscrito.txt (ver GUIA-MARCADORES.md para el detalle completo):
//   ### CAPÍTULO 01: Título del capítulo
//   [tipo: secreto]                                     <- opcional, marca el capítulo entero como secreto
//   [acertijo: ¿Qué animal nunca duerme?]                <- opcional, activa la puerta con contraseña
//   [clave: dragón]                                      <- opcional, la respuesta correcta al acertijo
//   [audio-acertijo: assets/audio/puerta.mp3]             <- opcional, suena al abrir la puerta
//   [audio-exito: assets/audio/acceso.mp3]                <- opcional, suena al acertar la clave
//   Párrafo uno...
//
//   [audio:assets/audio/tema-bosque.mp3|Tema del bosque] <- marcador de música, en su propio párrafo
//
//   Párrafo con un secreto [secret:id-del-secreto|Palabra Clave] dentro del texto,
//   o un enlace a un capítulo secreto [chapter:07|Palabra Clave].

const fs = require('fs');
const path = require('path');

const RUTA_MANUSCRITO = path.join(__dirname, 'assets', 'manuscrito.txt');
const RUTA_STORY = path.join(__dirname, 'story.js');
const TITULO_NOVELA = '传奇之歌';

const REGEX_CAPITULO = /^###\s*CAP[IÍ]TULO\s+(\d+)\s*:?\s*(.*)$/i;
const REGEX_TIPO = /^\[tipo:\s*([a-zA-Z0-9_-]+)\]$/i;
const REGEX_ACERTIJO = /^\[acertijo:\s*([^\]]+)\]$/i;
const REGEX_CLAVE = /^\[clave:\s*([^\]]+)\]$/i;
const REGEX_AUDIO_ACERTIJO = /^\[audio-acertijo:\s*([^\]]+)\]$/i;
const REGEX_AUDIO_EXITO = /^\[audio-exito:\s*([^\]]+)\]$/i;
const REGEX_SECRETO = /\[secret:([a-zA-Z0-9_-]+)\|([^\]]+)\]/g;

function cargarSecretosExistentes() {
  if (!fs.existsSync(RUTA_STORY)) return {};
  try {
    delete require.cache[require.resolve(RUTA_STORY)];
    const previo = require(RUTA_STORY);
    return previo && previo.secretos ? previo.secretos : {};
  } catch (err) {
    console.warn('No se pudo leer el story.js previo, se generarán los secretos desde cero.');
    return {};
  }
}

function leerManuscrito() {
  if (!fs.existsSync(RUTA_MANUSCRITO)) {
    throw new Error(`No se encontró el manuscrito en: ${RUTA_MANUSCRITO}`);
  }
  return fs.readFileSync(RUTA_MANUSCRITO, 'utf8').replace(/\r\n/g, '\n');
}

// Une líneas sueltas de un mismo párrafo (por si Google Docs corta a lo ancho de página)
// y usa las líneas en blanco como separador real entre párrafos.
function dividirEnParrafos(bloqueTexto) {
  return bloqueTexto
    .split(/\n\s*\n/)
    .map(p => p.split('\n').map(l => l.trim()).filter(Boolean).join(' ').trim())
    .filter(p => p.length > 0);
}

function parsear(textoCompleto) {
  const lineas = textoCompleto.split('\n');
  const capitulos = [];
  const mapaSecretos = new Map(); // id -> palabra clave (primera ocurrencia)
  let capituloActual = null;
  let bufferLineas = [];

  function cerrarCapitulo() {
    if (!capituloActual) return;
    capituloActual.parrafos = dividirEnParrafos(bufferLineas.join('\n'));
    capitulos.push(capituloActual);
    bufferLineas = [];
  }

  for (const linea of lineas) {
    const matchCap = linea.match(REGEX_CAPITULO);
    if (matchCap) {
      cerrarCapitulo();
      const numero = matchCap[1].padStart(2, '0');
      const tituloCap = matchCap[2].trim() || `Capítulo ${numero}`;
      capituloActual = {
        id: parseInt(matchCap[1], 10),
        numero,
        titulo: tituloCap,
        tipo: 'normal',
        acertijo: null,
        clave: null,
        audioAcertijo: null,
        audioExito: null,
        parrafos: []
      };
      continue;
    }

    const matchTipo = linea.match(REGEX_TIPO);
    if (matchTipo && capituloActual) {
      capituloActual.tipo = matchTipo[1].trim().toLowerCase();
      continue;
    }

    const matchAcertijo = linea.match(REGEX_ACERTIJO);
    if (matchAcertijo && capituloActual) {
      capituloActual.acertijo = matchAcertijo[1].trim();
      continue;
    }

    const matchClave = linea.match(REGEX_CLAVE);
    if (matchClave && capituloActual) {
      capituloActual.clave = matchClave[1].trim();
      continue;
    }

    const matchAudioAcertijo = linea.match(REGEX_AUDIO_ACERTIJO);
    if (matchAudioAcertijo && capituloActual) {
      capituloActual.audioAcertijo = matchAudioAcertijo[1].trim();
      continue;
    }

    const matchAudioExito = linea.match(REGEX_AUDIO_EXITO);
    if (matchAudioExito && capituloActual) {
      capituloActual.audioExito = matchAudioExito[1].trim();
      continue;
    }

    bufferLineas.push(linea);
  }
  cerrarCapitulo();

  for (const cap of capitulos) {
    for (const parrafo of cap.parrafos) {
      REGEX_SECRETO.lastIndex = 0;
      let m;
      while ((m = REGEX_SECRETO.exec(parrafo)) !== null) {
        if (!mapaSecretos.has(m[1])) mapaSecretos.set(m[1], m[2]);
      }
    }
  }

  return { capitulos, mapaSecretos };
}

function main() {
  console.log('Leyendo manuscrito...');
  const texto = leerManuscrito();

  const secretosPrevios = cargarSecretosExistentes();
  const { capitulos, mapaSecretos } = parsear(texto);

  const secretosFinales = { ...secretosPrevios };
  let nuevos = 0;
  for (const [id, palabra] of mapaSecretos) {
    if (!secretosFinales[id]) {
      secretosFinales[id] = {
        tipo: 'imagen',
        titulo: palabra,
        contenido: 'assets/dibujo-placeholder-1.jpg',
        caption: ''
      };
      nuevos++;
    }
  }

  const idsReferenciados = new Set(mapaSecretos.keys());
  const huerfanos = Object.keys(secretosFinales).filter(id => !idsReferenciados.has(id));

  if (capitulos.length === 0) {
    throw new Error('No se detectó ningún "### CAPÍTULO" en el manuscrito. Revisa el formato de las marcas.');
  }

  for (const cap of capitulos) {
    if (cap.acertijo && !cap.clave) {
      console.log(`Aviso: el capítulo ${cap.numero} tiene [acertijo:...] pero no [clave:...] — no se mostrará la puerta.`);
    }
    if (cap.clave && !cap.acertijo) {
      console.log(`Aviso: el capítulo ${cap.numero} tiene [clave:...] pero no [acertijo:...] — se mostrará la puerta sin pista.`);
    }
  }

  const salida = `// Archivo generado automáticamente por parser.js — no edites "capitulos" a mano, se sobreescribe.
// "secretos" sí se conserva entre corridas: edita libremente tipo/contenido/caption de cada uno.
const CONFIG_NOVELA = ${JSON.stringify({ titulo: TITULO_NOVELA, capitulos, secretos: secretosFinales }, null, 2)};

if (typeof module !== 'undefined') module.exports = CONFIG_NOVELA;
`;

  fs.writeFileSync(RUTA_STORY, salida, 'utf8');

  console.log(`story.js actualizado: ${capitulos.length} capitulo(s), ${Object.keys(secretosFinales).length} secreto(s) (${nuevos} nuevo(s)).`);
  if (huerfanos.length) {
    console.log(`Secretos definidos en story.js pero ya no referenciados en el texto: ${huerfanos.join(', ')}`);
  }
}

main();

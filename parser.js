// parser.js — Convierte assets/manuscrito.txt en story.js
// Uso: node parser.js
//
// Formato esperado en manuscrito.txt (ver GUIA-MARCADORES.md para el detalle completo):
//   ### CAPÍTULO 01: Título del capítulo
//   [tipo: secreto]                                     <- opcional, marca el capítulo entero como secreto
//   [acertijo: ¿Qué animal nunca duerme?]                <- opcional, activa la puerta con contraseña
//   [clave: dragón]                                      <- opcional, la respuesta correcta al acertijo
//   [audio-acertijo: assets/audio/puerta.mp3]             <- opcional, suena al abrir la puerta
//   [audio-exito: assets/audio/acceso.mp3]                <- opcional, música de fondo del capítulo secreto al entrar
//   [sonido-acierto: assets/audio/access-granted.wav]     <- opcional, efecto corto al acertar la clave
//   [sonido-error: assets/audio/access-denied.wav]        <- opcional, efecto corto con cada clave incorrecta
//   [portada: assets/portadas/cap-01.jpg]                 <- opcional, la ilustración de su sala en el menú de museo
//   Párrafo uno...
//
//   [audio:assets/audio/tema-bosque.mp3|Tema del bosque] <- marcador de música, en su propio párrafo
//
//   Párrafo con un secreto [secret:id-del-secreto|Palabra Clave] dentro del texto,
//   o un enlace a un capítulo secreto [chapter:07|Palabra Clave],
//   o un "bug" reportable de El Sistema [bug:id-del-bug|palabra],
//   o una pista para el tablero de evidencias [pista:id|palabra] (definida en tablero.js).
//
//   EN PROCESO DE ESCRITURA                              <- opcional, en su propia línea: marca el capítulo como borrador
//   [notas]                                              <- notas de autora: todo hasta [/notas] se descarta
//   Ideas, KEY POINTS, pendientes...                        y nunca llega a story.js (quien lee no puede verlas)
//   [/notas]
//
//   [telefono: Jian Lin | contacto: LQG, color: #5172c4] <- conversación en un teléfono (una línea por mensaje)
//   LQG: ¿Sigues despierto?                              <- "Nombre: texto"; si Nombre es el dueño, va a la derecha
//   ~ Leído 02:14                                        <- "~ texto": línea del sistema del teléfono
//   [/telefono]                                             opciones: notificaciones, roto, hora: hh:mm, contacto: X, color: #hex

const fs = require('fs');
const path = require('path');

const RUTA_MANUSCRITO = path.join(__dirname, 'assets', 'manuscrito.txt');
const RUTA_STORY = path.join(__dirname, 'story.js');
const RUTA_INDEX = path.join(__dirname, 'index.html');
const TITULO_NOVELA = '传奇之歌';

const REGEX_CAPITULO = /^###\s*CAP[IÍ]TULO\s+(\d+)\s*:?\s*(.*)$/i;
const REGEX_TIPO = /^\[tipo:\s*([a-zA-Z0-9_-]+)\]$/i;
const REGEX_ACERTIJO = /^\[acertijo:\s*([^\]]+)\]$/i;
const REGEX_CLAVE = /^\[clave:\s*([^\]]+)\]$/i;
const REGEX_AUDIO_ACERTIJO = /^\[audio-acertijo:\s*([^\]]+)\]$/i;
const REGEX_AUDIO_EXITO = /^\[audio-exito:\s*([^\]]+)\]$/i;
const REGEX_SONIDO_ACIERTO = /^\[sonido-acierto:\s*([^\]]+)\]$/i;
const REGEX_SONIDO_ERROR = /^\[sonido-error:\s*([^\]]+)\]$/i;
const REGEX_PORTADA = /^\[portada:\s*([^\]]+)\]$/i;
const REGEX_SECRETO = /\[secret:([a-zA-Z0-9_-]+)\|([^\]]+)\]/g;
const REGEX_BUG = /\[bug:([a-zA-Z0-9_-]+)\|([^\]]+)\]/g;
const REGEX_PISTA = /\[pista:([a-zA-Z0-9_-]+)\|([^\]]+)\]/g;
const REGEX_EN_PROCESO = /^EN PROCESO DE ESCRITURA\.?$/i;
const REGEX_NOTAS_INICIO = /^\[notas\]$/i;
const REGEX_NOTAS_FIN = /^\[\/notas\]$/i;
const REGEX_AUDIO = /^\[audio:([^\]|]+)/i;
const REGEX_COLOR = /^\[color:\s*([^\]]+)\]$/i;
const REGEX_HEX_VALIDO = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const REGEX_NOTA_SUELTA = /^KEY POINTS\b/i; // notas que se quedaron fuera de [notas]...[/notas]
const REGEX_TELEFONO_INICIO = /^\[telefono:\s*([^\]|]+?)\s*(?:\|\s*([^\]]*))?\]$/i;
const REGEX_TELEFONO_FIN = /^\[\/telefono\]$/i;
const REGEX_MENSAJE = /^([^:]{1,40}?):\s+(.+)$/;
// Un teléfono se guarda como un solo "párrafo": este prefijo + JSON con sus mensajes.
const PREFIJO_TELEFONO = '[[telefono]]';

// "notificaciones, roto, hora: 02:14, contacto: LQG, color: #5172c4" → opciones
function parsearOpcionesTelefono(texto) {
  const opciones = { modo: 'chat', roto: false, hora: null, contacto: null, color: null };
  String(texto || '').split(',').map(t => t.trim()).filter(Boolean).forEach(token => {
    const clave = token.match(/^(hora|contacto|color)\s*:\s*(.+)$/i);
    if (clave) opciones[clave[1].toLowerCase()] = clave[2].trim();
    else if (/^notificaciones$/i.test(token)) opciones.modo = 'notificaciones';
    else if (/^roto$/i.test(token)) opciones.roto = true;
  });
  if (opciones.color && !REGEX_HEX_VALIDO.test(opciones.color)) opciones.color = null;
  return opciones;
}

// Devuelve las secciones editables a mano del story.js previo ("secretos",
// "bugs" y "extras"), para que sobrevivan al regenerar "capitulos".
function cargarSeccionesExistentes() {
  if (!fs.existsSync(RUTA_STORY)) return { secretos: {}, bugs: {}, extras: null };
  try {
    delete require.cache[require.resolve(RUTA_STORY)];
    const previo = require(RUTA_STORY) || {};
    return { secretos: previo.secretos || {}, bugs: previo.bugs || {}, extras: previo.extras || null };
  } catch (err) {
    console.warn('No se pudo leer el story.js previo, se generarán los secretos desde cero.');
    return { secretos: {}, bugs: {}, extras: null };
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
  const mapaBugs = new Map();     // id -> palabra (primera ocurrencia)
  let capituloActual = null;
  let bufferLineas = [];
  let enNotas = false; // dentro de un bloque [notas]...[/notas]
  let telefono = null; // bloque [telefono]...[/telefono] en curso
  const avisos = [];

  // El teléfono va como párrafo propio (líneas en blanco alrededor).
  function cerrarTelefono() {
    if (!telefono) return;
    if (!telefono.mensajes.length) {
      avisos.push(`Capítulo ${capituloActual ? capituloActual.numero : '?'}: un [telefono] sin mensajes; no se mostrará.`);
    } else {
      bufferLineas.push('', PREFIJO_TELEFONO + JSON.stringify(telefono), '');
    }
    telefono = null;
  }

  function cerrarCapitulo() {
    if (!capituloActual) return;
    capituloActual.parrafos = dividirEnParrafos(bufferLineas.join('\n'));
    capitulos.push(capituloActual);
    bufferLineas = [];
  }

  for (const linea of lineas) {
    const lineaLimpia = linea.trim();
    const matchCap = linea.match(REGEX_CAPITULO);

    // Notas de autora: se descartan por completo. Un [notas] sin cerrar termina
    // en el siguiente "### CAPÍTULO" para no tragarse el resto del manuscrito.
    if (enNotas) {
      if (REGEX_NOTAS_FIN.test(lineaLimpia)) {
        enNotas = false;
        continue;
      }
      if (!matchCap) continue;
      avisos.push(`El capítulo ${capituloActual ? capituloActual.numero : '?'} tiene un [notas] sin su [/notas]; se cerró al llegar al siguiente capítulo.`);
      enNotas = false;
    }
    if (REGEX_NOTAS_INICIO.test(lineaLimpia)) {
      enNotas = true;
      continue;
    }
    if (REGEX_NOTAS_FIN.test(lineaLimpia)) continue; // [/notas] suelto: no se muestra

    // Teléfono: cada línea no vacía es un mensaje ("Nombre: texto") o una línea
    // del sistema ("~ texto"). Sin cerrar, termina en el siguiente capítulo.
    if (telefono) {
      if (REGEX_TELEFONO_FIN.test(lineaLimpia)) {
        cerrarTelefono();
        continue;
      }
      if (!matchCap) {
        if (!lineaLimpia) continue;
        if (lineaLimpia.startsWith('~')) {
          telefono.mensajes.push({ tipo: 'sistema', texto: lineaLimpia.slice(1).trim() });
          continue;
        }
        const m = lineaLimpia.match(REGEX_MENSAJE);
        if (m) {
          const de = m[1].trim();
          const propio = de.toLowerCase() === telefono.dueno.toLowerCase() || de.toLowerCase() === 'yo';
          telefono.mensajes.push({ tipo: propio ? 'enviado' : 'recibido', de, texto: m[2].trim() });
        } else {
          avisos.push(`Capítulo ${capituloActual ? capituloActual.numero : '?'}, teléfono de ${telefono.dueno}: "${lineaLimpia.slice(0, 50)}" no tiene "Nombre: texto" ni "~"; se mostró como línea del sistema.`);
          telefono.mensajes.push({ tipo: 'sistema', texto: lineaLimpia });
        }
        continue;
      }
      avisos.push(`Capítulo ${capituloActual ? capituloActual.numero : '?'}: un [telefono] sin su [/telefono]; se cerró al llegar al siguiente capítulo.`);
      cerrarTelefono();
    }
    const matchTelefono = lineaLimpia.match(REGEX_TELEFONO_INICIO);
    if (matchTelefono && capituloActual) {
      telefono = Object.assign({ dueno: matchTelefono[1].trim(), mensajes: [] }, parsearOpcionesTelefono(matchTelefono[2]));
      continue;
    }
    if (REGEX_TELEFONO_FIN.test(lineaLimpia)) continue; // [/telefono] suelto

    if (REGEX_EN_PROCESO.test(lineaLimpia) && capituloActual) {
      capituloActual.enProceso = true;
      continue;
    }

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
        sonidoAcierto: null,
        sonidoError: null,
        portada: null,
        enProceso: false,
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

    const matchSonidoAcierto = linea.match(REGEX_SONIDO_ACIERTO);
    if (matchSonidoAcierto && capituloActual) {
      capituloActual.sonidoAcierto = matchSonidoAcierto[1].trim();
      continue;
    }

    const matchSonidoError = linea.match(REGEX_SONIDO_ERROR);
    if (matchSonidoError && capituloActual) {
      capituloActual.sonidoError = matchSonidoError[1].trim();
      continue;
    }

    const matchPortada = linea.match(REGEX_PORTADA);
    if (matchPortada && capituloActual) {
      capituloActual.portada = matchPortada[1].trim();
      continue;
    }

    const matchAudioExito = linea.match(REGEX_AUDIO_EXITO);
    if (matchAudioExito && capituloActual) {
      capituloActual.audioExito = matchAudioExito[1].trim();
      continue;
    }

    bufferLineas.push(linea);
  }
  if (telefono) {
    avisos.push('El manuscrito termina dentro de un [telefono] sin su [/telefono].');
    cerrarTelefono();
  }
  cerrarCapitulo();
  if (enNotas) avisos.push('El manuscrito termina dentro de un [notas] sin su [/notas].');

  for (const cap of capitulos) {
    for (const parrafo of cap.parrafos) {
      REGEX_SECRETO.lastIndex = 0;
      let m;
      while ((m = REGEX_SECRETO.exec(parrafo)) !== null) {
        if (!mapaSecretos.has(m[1])) mapaSecretos.set(m[1], m[2]);
      }
      REGEX_BUG.lastIndex = 0;
      while ((m = REGEX_BUG.exec(parrafo)) !== null) {
        if (!mapaBugs.has(m[1])) mapaBugs.set(m[1], m[2]);
      }
    }
  }

  return { capitulos, mapaSecretos, mapaBugs, avisos };
}

// --- Revisiones automáticas: se avisan en consola, no detienen la generación ---

// Comprueba que la ruta exista con las MISMAS mayúsculas, carpeta por carpeta.
// En Windows "Foto.png" y "foto.png" son el mismo archivo, pero en un hosting
// web (GitHub Pages, Netlify...) no: ahí la imagen o el audio no cargarían.
function rutaExisteExacta(rutaRelativa) {
  let actual = __dirname;
  for (const parte of rutaRelativa.split('/')) {
    let entradas;
    try {
      entradas = fs.readdirSync(actual);
    } catch (err) {
      return false;
    }
    if (!entradas.includes(parte)) return false;
    actual = path.join(actual, parte);
  }
  return true;
}

function revisarManuscrito(capitulos) {
  const avisos = [];
  for (const cap of capitulos) {
    cap.parrafos.forEach(parrafo => {
      const texto = parrafo.trim();
      if (REGEX_NOTA_SUELTA.test(texto)) {
        avisos.push(`Capítulo ${cap.numero}: hay un "KEY POINTS" fuera de [notas]...[/notas]; quien lee lo verá.`);
      }
      const matchColor = texto.match(REGEX_COLOR);
      if (matchColor) {
        matchColor[1].split(',').map(c => c.trim()).filter(c => !REGEX_HEX_VALIDO.test(c)).forEach(c => {
          avisos.push(`Capítulo ${cap.numero}: el color "${c}" no es válido (se ignora); usa #rrggbb.`);
        });
      }
    });
  }
  return avisos;
}

// Pistas del tablero: cada [pista:id|...] del texto debe existir en tablero.js.
function revisarPistas(capitulos) {
  let tablero;
  try {
    tablero = require('./tablero.js');
  } catch (err) {
    return [];
  }
  const definidas = new Set(Object.keys(tablero.pistas || {}));
  const enTexto = new Set();
  capitulos.forEach(cap => cap.parrafos.forEach(p => {
    REGEX_PISTA.lastIndex = 0;
    let m;
    while ((m = REGEX_PISTA.exec(p)) !== null) enTexto.add(m[1]);
  }));
  const avisos = [];
  enTexto.forEach(id => {
    if (!definidas.has(id)) avisos.push(`La pista "${id}" está en el texto pero no en tablero.js; no aparecerá en el tablero.`);
  });
  definidas.forEach(id => {
    if (!enTexto.has(id)) avisos.push(`La pista "${id}" está en tablero.js pero ningún [pista:${id}|...] del texto la marca.`);
  });
  (tablero.conexiones || []).forEach(c => (c.pistas || []).forEach(id => {
    if (!definidas.has(id)) avisos.push(`Una conexión de tablero.js usa la pista "${id}", que no existe.`);
  }));
  console.log(`Pistas del tablero: ${enTexto.size} en el texto, ${(tablero.conexiones || []).length} conexión(es).`);
  return avisos;
}

// GitHub Pages guarda los archivos en caché unos minutos y no deja cambiarlo:
// tras publicar, un navegador podría mezclar un story.js nuevo con un app.js
// viejo. Cada corrida pone una versión nueva (?v=fecha) a los .js y .css
// propios en index.html, así el navegador pide todo de nuevo y junto.
function versionarArchivos() {
  if (!fs.existsSync(RUTA_INDEX)) return null;
  const ahora = new Date();
  const dos = n => String(n).padStart(2, '0');
  const version = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  const html = fs.readFileSync(RUTA_INDEX, 'utf8');
  // Solo archivos locales (sin "http" ni "//"), con o sin una versión anterior.
  const nuevo = html.replace(/((?:src|href)=")(?!https?:|\/\/)([^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g, `$1$2?v=${version}$3`);
  if (nuevo !== html) fs.writeFileSync(RUTA_INDEX, nuevo, 'utf8');
  return version;
}

function revisarRutas(capitulos, secretos, extras) {
  const rutas = []; // [ruta, de dónde viene]
  for (const cap of capitulos) {
    cap.parrafos.forEach(p => {
      const m = p.trim().match(REGEX_AUDIO);
      if (m) rutas.push([m[1].trim(), `capítulo ${cap.numero}`]);
    });
    if (cap.audioAcertijo) rutas.push([cap.audioAcertijo, `capítulo ${cap.numero} (audio-acertijo)`]);
    if (cap.audioExito) rutas.push([cap.audioExito, `capítulo ${cap.numero} (audio-exito)`]);
    if (cap.sonidoAcierto) rutas.push([cap.sonidoAcierto, `capítulo ${cap.numero} (sonido-acierto)`]);
    if (cap.sonidoError) rutas.push([cap.sonidoError, `capítulo ${cap.numero} (sonido-error)`]);
    if (cap.portada) rutas.push([cap.portada, `capítulo ${cap.numero} (portada)`]);
  }
  Object.entries(secretos).forEach(([id, s]) => {
    if (s.tipo === 'imagen' && s.contenido) rutas.push([s.contenido, `secreto "${id}"`]);
  });
  if (extras && extras.galeria) {
    (extras.galeria.ilustraciones || []).forEach(i => rutas.push([i.archivo, 'extras (ilustración)']));
    (extras.galeria.pistas || []).forEach(p => rutas.push([p.archivo, 'extras (pista)']));
  }
  try {
    const CONFIG_ESCRITORIO = require('./escritorio-secreto.js');
    Object.entries(CONFIG_ESCRITORIO.escritorios || {}).forEach(([num, esc]) => {
      (esc.items || []).forEach(item => {
        rutas.push([CONFIG_ESCRITORIO.carpeta + item.archivo, `escritorio ${num}`]);
        if (item.audio) rutas.push([item.audio, `escritorio ${num}`]);
      });
    });
  } catch (err) {
    // sin escritorio-secreto.js no hay nada que revisar ahí
  }

  return rutas
    .filter(([ruta]) => !rutaExisteExacta(ruta))
    .map(([ruta, origen]) => `${origen}: "${ruta}" no existe con esas mayúsculas/minúsculas exactas.`);
}

function main() {
  console.log('Leyendo manuscrito...');
  const texto = leerManuscrito();

  const { secretos: secretosPrevios, bugs: bugsPrevios, extras } = cargarSeccionesExistentes();
  const { capitulos, mapaSecretos, mapaBugs, avisos: avisosLectura } = parsear(texto);

  // Bugs: cada [bug:id|palabra] nuevo recibe una entrada para su mensaje opcional
  // (lo que El Sistema "deja escapar" al reportarlo). Se conservan entre corridas.
  const bugsFinales = { ...bugsPrevios };
  let bugsNuevos = 0;
  for (const [id] of mapaBugs) {
    if (!bugsFinales[id]) {
      bugsFinales[id] = { mensaje: '' };
      bugsNuevos++;
    }
  }
  const bugsHuerfanos = Object.keys(bugsFinales).filter(id => !mapaBugs.has(id));

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
// "secretos", "bugs" y "extras" sí se conservan entre corridas: edítalos libremente.
const CONFIG_NOVELA = ${JSON.stringify({ titulo: TITULO_NOVELA, capitulos, secretos: secretosFinales, bugs: bugsFinales, ...(extras ? { extras } : {}) }, null, 2)};

if (typeof module !== 'undefined') module.exports = CONFIG_NOVELA;
`;

  fs.writeFileSync(RUTA_STORY, salida, 'utf8');

  console.log(`story.js actualizado: ${capitulos.length} capitulo(s), ${Object.keys(secretosFinales).length} secreto(s) (${nuevos} nuevo(s)).`);
  if (huerfanos.length) {
    console.log(`Secretos definidos en story.js pero ya no referenciados en el texto: ${huerfanos.join(', ')}`);
  }
  console.log(`Bugs reportables: ${mapaBugs.size} (${bugsNuevos} nuevo(s)).`);
  if (bugsHuerfanos.length) {
    console.log(`Bugs definidos en story.js pero ya no referenciados en el texto: ${bugsHuerfanos.join(', ')}`);
  }

  const version = versionarArchivos();
  if (version) console.log(`index.html: scripts y estilos marcados con la versión ${version}.`);

  const enProceso = capitulos.filter(c => c.enProceso).map(c => c.numero);
  if (enProceso.length) console.log(`Capítulos en proceso de escritura: ${enProceso.join(', ')}`);

  const avisos = [
    ...avisosLectura,
    ...revisarManuscrito(capitulos),
    ...revisarPistas(capitulos),
    ...revisarRutas(capitulos, secretosFinales, extras)
  ];
  if (avisos.length) {
    console.log(`\n⚠ ${avisos.length} aviso(s) — story.js se generó igual, pero conviene revisarlos:`);
    avisos.forEach(a => console.log(`  - ${a}`));
  } else {
    console.log('Revisión: sin notas visibles, colores válidos y todas las rutas coinciden.');
  }
}

main();

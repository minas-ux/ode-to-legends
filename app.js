// app.js — Motor del lector de 传奇之歌
// Lee CONFIG_NOVELA (definido en story.js) y controla renderizado, paginación
// por bloques de párrafos (una sola columna, flujo normal del navegador),
// triggers, easter eggs, música de fondo y comentarios.

(function () {
  'use strict';

  // Un solo escaneo por párrafo: etiquetas [secret|chapter:...], negrita **texto** y cursiva *texto*.
  // El orden de las alternativas importa (** antes que *) para que la negrita no se lea como dos cursivas.
  // Nota: se descartó _texto_ para cursiva porque un guion bajo suelto en cualquier parte del párrafo
  // (ej. dentro de un ID o palabra suelta) lo empareja con el siguiente guion bajo que aparezca,
  // convirtiendo en cursiva todo lo que quede en medio.
  const REGEX_INLINE = /\[(secret|chapter):([a-zA-Z0-9_-]+)\|([^\]]+)\]|\*\*(.+?)\*\*|\*(.+?)\*/g;
  const REGEX_MARCADOR_AUDIO = /^\[audio:([^\]|]+)(?:\|([^\]]*))?\]$/i;
  const REGEX_MARCADOR_COLOR = /^\[color:\s*([^\]]+)\]$/i;
  const REGEX_HEX_VALIDO = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const COLOR_DEFAULT = ['#b3c9d6', '#98aa9d', '#d3ddca']; // paleta original (mist, eucalyptus, verde pálido)
  const PARRAFOS_POR_BLOQUE = 6; // párrafos por bloque/página al hacer clic en "Continuar"

  const capitulos = CONFIG_NOVELA.capitulos;
  const secretos = CONFIG_NOVELA.secretos || {};
  const escritorios = (typeof CONFIG_ESCRITORIO !== 'undefined' && CONFIG_ESCRITORIO.escritorios) || {};
  const carpetaEscritorio = (typeof CONFIG_ESCRITORIO !== 'undefined' && CONFIG_ESCRITORIO.carpeta) || '';

  const elChapterNum = document.getElementById('chapter-num');
  const elChapterTitle = document.getElementById('chapter-title');
  const elBtnPrev = document.getElementById('btn-prev');
  const elBtnNext = document.getElementById('btn-next');
  const elPageIndicator = document.getElementById('page-indicator');
  const elOverlay = document.getElementById('secret-overlay');
  const elSecretContent = document.getElementById('secret-content');
  const elCloseSecret = document.getElementById('close-secret');
  const elReaderContainer = document.querySelector('.reader-container');

  const elGateOverlay = document.getElementById('gate-overlay');
  const elGateCard = document.getElementById('gate-card');
  const elGateRiddle = document.getElementById('gate-riddle');
  const elGateForm = document.getElementById('gate-form');
  const elGateInput = document.getElementById('gate-input');
  const elGateFeedback = document.getElementById('gate-feedback');
  const elCloseGate = document.getElementById('close-gate');

  const elDeskOverlay = document.getElementById('desk-overlay');
  const elDeskSurface = document.getElementById('desk-surface');
  const elCloseDesk = document.getElementById('close-desk');
  const elDeskFocusOverlay = document.getElementById('desk-focus-overlay');
  const elDeskFocusStage = document.getElementById('desk-focus-stage');
  const elDeskFocusImage = document.getElementById('desk-focus-image');
  const elDeskFocusNote = document.getElementById('desk-focus-note');
  const elDeskFocusText = document.getElementById('desk-focus-text');
  const elCloseDeskFocus = document.getElementById('close-desk-focus');
  const elBtnVolverEscritorio = document.getElementById('btn-volver-escritorio');

  const elBookFlow = document.getElementById('book-flow');

  const elChapterMenuToggle = document.getElementById('btn-chapter-menu');
  const elChapterMenuCurrent = document.getElementById('chapter-menu-current');
  const elChapterMenuPanel = document.getElementById('chapter-menu-panel');

  const elMiniPlayer = document.getElementById('mini-player');
  const elMiniPlayerLabel = document.getElementById('mini-player-label');
  const elMiniPlayerToggle = document.getElementById('mini-player-toggle');
  const elMiniPlayerStop = document.getElementById('mini-player-stop');

  const elBgLayers = [document.getElementById('bg-layer-a'), document.getElementById('bg-layer-b')];

  const elHighlightToolbar = document.getElementById('highlight-toolbar');
  const elBtnComentarSeleccion = document.getElementById('btn-comentar-seleccion');
  const elCommentFormOverlay = document.getElementById('comment-form-overlay');
  const elCommentFormExcerpt = document.getElementById('comment-form-excerpt');
  const elCommentFormTextarea = document.getElementById('comment-form-textarea');
  const elCloseCommentForm = document.getElementById('close-comment-form');
  const elBtnGuardarComentario = document.getElementById('btn-guardar-comentario');
  const elBtnDescartarComentario = document.getElementById('btn-descartar-comentario');

  const elBtnCommentsToggle = document.getElementById('btn-comments-toggle');
  const elCommentsToggleCount = document.getElementById('comments-toggle-count');
  const elCommentsPanelOverlay = document.getElementById('comments-panel-overlay');
  const elCommentsPanelList = document.getElementById('comments-panel-list');
  const elCloseCommentsPanel = document.getElementById('close-comments-panel');

  const state = {
    chapterIndex: indiceInicial(),
    blockIndex: 0,
    pilaRetorno: [] // [{ chapterIndex, blockIndex }, ...] — permite capítulos secretos anidados
  };

  function indiceInicial() {
    const i = capitulos.findIndex(c => c.tipo !== 'secreto');
    return i === -1 ? 0 : i;
  }

  function escapeHtml(texto) {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Convierte [secret:id|Palabra] / [chapter:numero|Palabra] en <span> interactivos,
  // **texto** en <strong> y *texto* en <em>, escapando el resto para que no rompa el HTML.
  function procesarParrafo(texto) {
    let resultado = '';
    let ultimoIndex = 0;
    let match;
    REGEX_INLINE.lastIndex = 0;
    while ((match = REGEX_INLINE.exec(texto)) !== null) {
      resultado += escapeHtml(texto.slice(ultimoIndex, match.index));
      const [, tipo, id, palabra, negrita, cursiva] = match;

      if (tipo) {
        const claseExtra = tipo === 'chapter' ? ' interactive-chapter' : '';
        resultado += `<span class="interactive-keyword${claseExtra}" data-type="${tipo}" data-id="${escapeHtml(id)}">${escapeHtml(palabra)}</span>`;
      } else if (negrita !== undefined) {
        resultado += `<strong>${escapeHtml(negrita)}</strong>`;
      } else {
        resultado += `<em>${escapeHtml(cursiva)}</em>`;
      }

      ultimoIndex = REGEX_INLINE.lastIndex;
    }
    resultado += escapeHtml(texto.slice(ultimoIndex));
    return resultado;
  }

  // [color:...] es una directiva silenciosa (no se muestra, solo afecta el fondo);
  // [audio:...] en un marcador clicleable; cualquier otro párrafo, en texto normal.
  function renderizarParrafo(parrafo) {
    const textoPlano = parrafo.trim();

    if (REGEX_MARCADOR_COLOR.test(textoPlano)) return '';

    const matchAudio = textoPlano.match(REGEX_MARCADOR_AUDIO);
    if (matchAudio) {
      const ruta = matchAudio[1].trim();
      const etiqueta = (matchAudio[2] || '').trim();
      return `<div class="audio-marker" data-ruta="${escapeHtml(ruta)}" data-etiqueta="${escapeHtml(etiqueta)}">
        <button class="audio-marker-btn" aria-label="Reproducir ${escapeHtml(etiqueta || 'música')}">
          <span class="music-wave"></span>
        </button>
        ${etiqueta ? `<span class="audio-marker-label">${escapeHtml(etiqueta)}</span>` : ''}
      </div>`;
    }

    return `<p>${procesarParrafo(parrafo)}</p>`;
  }

  // ============================================================
  // PAGINACIÓN POR BLOQUES DE PÁRRAFOS — una sola columna, flujo normal.
  // Sin columnas CSS, sin transform, sin medir el DOM: el navegador solo
  // fluye texto como cualquier página web, así que no hay forma de que
  // termine cortado a la mitad al redimensionar.
  // ============================================================

  function totalBloques(capitulo) {
    return Math.max(1, Math.ceil(capitulo.parrafos.length / PARRAFOS_POR_BLOQUE));
  }

  function renderizarCapitulo(capitulo) {
    const esSecreto = capitulo.tipo === 'secreto';
    document.body.classList.toggle('modo-secreto', esSecreto);
    elChapterNum.textContent = capitulo.numero;
    elChapterTitle.textContent = capitulo.titulo;

    const inicio = state.blockIndex * PARRAFOS_POR_BLOQUE;
    const bloque = capitulo.parrafos.slice(inicio, inicio + PARRAFOS_POR_BLOQUE);

    elBookFlow.innerHTML = bloque.map(renderizarParrafo).join('');
    reaplicarComentarios(capitulo);
    actualizarUIAudio();

    if (esSecreto) {
      ocultarCapasFondo();
    } else {
      aplicarColorFondo(colorActivoHasta(capitulo, inicio + bloque.length - 1));
    }

    elBtnVolverEscritorio.classList.toggle('hidden', !(esSecreto && escritorioDeCapitulo(capitulo)));

    actualizarBotones(capitulo);
  }

  function mostrarCapitulo(indiceCapitulo, bloqueDeseado) {
    state.chapterIndex = indiceCapitulo;
    const capitulo = capitulos[indiceCapitulo];
    const total = totalBloques(capitulo);
    state.blockIndex = bloqueDeseado === 'ULTIMA' ? total - 1 : Math.max(0, Math.min(bloqueDeseado, total - 1));
    renderizarCapitulo(capitulo);
    actualizarMenuCapitulos(capitulo);
    elReaderContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function actualizarBotones(capitulo) {
    const total = totalBloques(capitulo);
    const esUltimo = state.blockIndex >= total - 1;
    const esPrimero = state.blockIndex === 0;

    if (!esPrimero) {
      elBtnPrev.disabled = false;
    } else if (capitulo.tipo === 'secreto') {
      elBtnPrev.disabled = true;
    } else {
      elBtnPrev.disabled = anteriorCapituloNormal(state.chapterIndex) === -1;
    }

    if (!esUltimo) {
      elBtnNext.textContent = 'Continuar';
      elBtnNext.disabled = false;
    } else if (capitulo.tipo === 'secreto') {
      elBtnNext.textContent = 'Volver a la historia';
      elBtnNext.disabled = false;
    } else {
      const hayMas = siguienteCapituloNormal(state.chapterIndex) !== -1;
      elBtnNext.textContent = hayMas ? 'Continuar' : 'Fin';
      elBtnNext.disabled = !hayMas;
    }

    elPageIndicator.textContent = `${state.blockIndex + 1} / ${total}`;
  }

  function siguienteCapituloNormal(desdeIndex) {
    for (let i = desdeIndex + 1; i < capitulos.length; i++) {
      if (capitulos[i].tipo !== 'secreto') return i;
    }
    return -1;
  }

  function anteriorCapituloNormal(desdeIndex) {
    for (let i = desdeIndex - 1; i >= 0; i--) {
      if (capitulos[i].tipo !== 'secreto') return i;
    }
    return -1;
  }

  function avanzarPagina() {
    const capitulo = capitulos[state.chapterIndex];
    const total = totalBloques(capitulo);

    if (state.blockIndex < total - 1) {
      state.blockIndex++;
      renderizarCapitulo(capitulo);
      return;
    }

    if (capitulo.tipo === 'secreto' && state.pilaRetorno.length) {
      const destino = state.pilaRetorno.pop();
      mostrarCapitulo(destino.chapterIndex, destino.blockIndex);
      return;
    }

    const siguiente = siguienteCapituloNormal(state.chapterIndex);
    if (siguiente !== -1) mostrarCapitulo(siguiente, 0);
  }

  function retrocederPagina() {
    const capitulo = capitulos[state.chapterIndex];

    if (state.blockIndex > 0) {
      state.blockIndex--;
      renderizarCapitulo(capitulo);
      return;
    }

    if (capitulo.tipo === 'secreto') return; // sin salto entre capítulos desde aquí

    const anterior = anteriorCapituloNormal(state.chapterIndex);
    if (anterior !== -1) mostrarCapitulo(anterior, 'ULTIMA');
  }

  // Punto de entrada del trigger [chapter:...]: si ese capítulo tiene una
  // [clave:...] definida, primero hay que pasar la puerta con acertijo;
  // si no tiene clave, entra directo (comportamiento original).
  function manejarClicCapituloSecreto(numero) {
    const destino = capitulos.findIndex(c => c.numero === numero || String(c.id) === numero);
    if (destino === -1) {
      console.warn(`Capítulo secreto no encontrado: ${numero}`);
      return;
    }
    const capituloDestino = capitulos[destino];
    if (capituloDestino.clave) {
      abrirPuertaSecreta(destino);
    } else {
      entrarACapituloSecreto(destino);
    }
  }

  // "opciones.reproducirAudio" (por defecto true) controla si suena el audioExito
  // del capítulo al entrar — el escritorio lo pone en false al entrar por "flower",
  // porque ahí el audio queda a cargo exclusivamente del floppy disk.
  function entrarACapituloSecreto(destino, opciones) {
    const reproducirAudio = !opciones || opciones.reproducirAudio !== false;
    if (reproducirAudio) manejarAudioAlDesbloquear(capitulos[destino]);
    state.pilaRetorno.push({ chapterIndex: state.chapterIndex, blockIndex: state.blockIndex });
    mostrarCapitulo(destino, 0);
  }

  function irACapitulo(numero) {
    const destino = capitulos.findIndex(c => c.numero === numero);
    if (destino === -1) return;
    state.pilaRetorno = []; // saltar por el menú rompe la cadena de "volver" de capítulos secretos
    mostrarCapitulo(destino, 0);
  }

  // --- Fondo dinámico: [color: #hex1, #hex2, #hex3] ---
  // El color activo es el del último marcador [color:...] encontrado desde el
  // inicio del capítulo hasta el párrafo visible más reciente — se recalcula
  // en cada render, así que siempre coincide con ese punto de la historia.

  function colorActivoHasta(capitulo, indiceParrafoInclusive) {
    for (let i = indiceParrafoInclusive; i >= 0; i--) {
      const match = capitulo.parrafos[i].trim().match(REGEX_MARCADOR_COLOR);
      if (!match) continue;
      const colores = match[1].split(',').map(c => c.trim()).filter(c => REGEX_HEX_VALIDO.test(c));
      if (colores.length) return colores;
    }
    return COLOR_DEFAULT;
  }

  function hexConAlpha(hex, alpha) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function construirGradiente(colores) {
    const c1 = colores[0];
    const c2 = colores[1] || colores[0];
    const c3 = colores[2] || colores[1] || colores[0];
    return [
      `radial-gradient(circle at 12% 8%, ${hexConAlpha(c1, 0.5)} 0%, transparent 45%)`,
      `radial-gradient(circle at 88% 18%, ${hexConAlpha(c2, 0.42)} 0%, transparent 50%)`,
      `radial-gradient(circle at 50% 100%, ${hexConAlpha(c3, 0.45)} 0%, transparent 55%)`
    ].join(', ');
  }

  let capaFondoActivaIndex = 0;
  let colorFondoActualClave = null;

  function construirClaveColor(colores) {
    return colores.join(',');
  }

  function aplicarColorFondo(colores) {
    const clave = construirClaveColor(colores);
    if (clave === colorFondoActualClave) return;
    colorFondoActualClave = clave;

    const siguienteIndex = 1 - capaFondoActivaIndex;
    const capaSiguiente = elBgLayers[siguienteIndex];
    const capaActual = elBgLayers[capaFondoActivaIndex];

    capaSiguiente.style.backgroundImage = construirGradiente(colores);
    void capaSiguiente.offsetWidth; // fuerza reflow para que la transición se dispare
    capaSiguiente.classList.add('activa');
    capaActual.classList.remove('activa');

    capaFondoActivaIndex = siguienteIndex;
  }

  function ocultarCapasFondo() {
    elBgLayers.forEach(l => l.classList.remove('activa'));
    colorFondoActualClave = null; // fuerza reaplicar el color correcto al volver
  }

  // --- Menú de capítulos (esquina superior) ---

  function poblarMenuCapitulos() {
    elChapterMenuPanel.innerHTML = capitulos
      .filter(c => c.tipo !== 'secreto')
      .map(c => `<button class="chapter-menu-item" data-numero="${escapeHtml(c.numero)}">
        <span class="chapter-menu-item-num">${escapeHtml(c.numero)}</span>
        <span class="chapter-menu-item-title">${escapeHtml(c.titulo)}</span>
      </button>`)
      .join('');
  }

  function actualizarMenuCapitulos(capitulo) {
    elChapterMenuCurrent.textContent = capitulo.numero;
    elChapterMenuPanel.querySelectorAll('.chapter-menu-item').forEach(el => {
      el.classList.toggle('activo', el.dataset.numero === capitulo.numero);
    });
  }

  function abrirMenuCapitulos() {
    elChapterMenuPanel.classList.remove('hidden');
    elChapterMenuToggle.setAttribute('aria-expanded', 'true');
  }

  function cerrarMenuCapitulos() {
    elChapterMenuPanel.classList.add('hidden');
    elChapterMenuToggle.setAttribute('aria-expanded', 'false');
  }

  elChapterMenuToggle.addEventListener('click', () => {
    const abierto = elChapterMenuToggle.getAttribute('aria-expanded') === 'true';
    if (abierto) cerrarMenuCapitulos();
    else abrirMenuCapitulos();
  });

  elChapterMenuPanel.addEventListener('click', (evento) => {
    const item = evento.target.closest('.chapter-menu-item');
    if (!item) return;
    irACapitulo(item.dataset.numero);
    cerrarMenuCapitulos();
  });

  document.addEventListener('click', (evento) => {
    if (!elChapterMenuToggle.closest('.chapter-menu').contains(evento.target)) {
      cerrarMenuCapitulos();
    }
  });

  // --- Easter eggs (popup scrapbook) ---

  function abrirSecreto(id) {
    const secreto = secretos[id];
    if (!secreto) {
      console.warn(`Secreto no encontrado: ${id}`);
      return;
    }

    elSecretContent.innerHTML = '';

    if (secreto.titulo) {
      const h3 = document.createElement('h3');
      h3.className = 'secret-title';
      h3.textContent = secreto.titulo;
      elSecretContent.appendChild(h3);
    }

    if (secreto.tipo === 'imagen') {
      const img = document.createElement('img');
      img.className = 'secret-image';
      img.src = secreto.contenido;
      img.alt = secreto.titulo || 'Ilustración secreta';
      elSecretContent.appendChild(img);
    } else {
      const p = document.createElement('p');
      p.className = 'secret-text';
      p.textContent = secreto.contenido;
      elSecretContent.appendChild(p);
    }

    if (secreto.caption) {
      const caption = document.createElement('p');
      caption.className = 'secret-caption';
      caption.textContent = secreto.caption;
      elSecretContent.appendChild(caption);
    }

    elOverlay.classList.remove('hidden');
  }

  function cerrarSecreto() {
    elOverlay.classList.add('hidden');
  }

  // --- Puerta secreta: acertijo + contraseña antes de un capítulo secreto ---

  let puertaDestinoIndex = null;
  let puertaProcesando = false; // evita doble envío mientras corre una animación

  // Sonido corto de un solo disparo (no usa el motor de fade del mini-reproductor,
  // que es para música de fondo continua, no para efectos breves).
  function reproducirSFX(ruta) {
    if (!ruta) return;
    const sfx = new Audio(ruta);
    sfx.volume = 0.7;
    sfx.play().catch(err => console.warn('No se pudo reproducir el efecto de sonido:', err));
  }

  function abrirPuertaSecreta(destinoIndex) {
    const capitulo = capitulos[destinoIndex];
    puertaDestinoIndex = destinoIndex;
    puertaProcesando = false;

    elGateCard.classList.remove('apagon', 'exito');
    elGateRiddle.textContent = capitulo.acertijo || '¿Cuál es la contraseña?';
    elGateInput.value = '';
    elGateFeedback.textContent = '';
    elGateFeedback.className = 'gate-feedback hidden';

    elGateOverlay.classList.remove('hidden');
    reproducirSFX(capitulo.audioAcertijo);
    setTimeout(() => elGateInput.focus(), 50);
  }

  function cerrarPuertaSecreta() {
    elGateOverlay.classList.add('hidden');
    elGateCard.classList.remove('apagon', 'exito');
    puertaDestinoIndex = null;
    puertaProcesando = false;
  }

  // --- Escritorio mix-media: pantalla "escritorio desordenado" tras acertar la contraseña ---
  // Ver escritorio-secreto.js para el contenido (qué imagen va dónde, cuáles son decorativas).

  let escritorioDestinoIndex = null; // capítulo secreto al que pertenece el escritorio abierto

  function escritorioDeCapitulo(capitulo) {
    return escritorios[capitulo.numero] || null;
  }

  function rutaAssetEscritorio(archivo) {
    return encodeURI(carpetaEscritorio + archivo);
  }

  function renderizarEscritorio(escritorio) {
    elDeskSurface.innerHTML = '';
    escritorio.items.forEach((item, indice) => {
      const img = document.createElement('img');
      img.className = 'desk-item ' + (item.deco ? 'deco' : 'interactivo');
      img.src = rutaAssetEscritorio(item.archivo);
      img.alt = item.deco ? '' : (item.tooltip || item.archivo);
      img.style.top = item.top || '50%';
      img.style.left = item.left || '50%';
      img.style.width = item.width || '12%';
      img.style.zIndex = String(item.zIndex || 1);
      img.style.setProperty('--rot', (item.rotate || 0) + 'deg');
      if (item.deco) {
        img.setAttribute('aria-hidden', 'true');
      } else {
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.dataset.indice = String(indice);
      }
      elDeskSurface.appendChild(img);
    });
  }

  // Punto de entrada tras acertar la contraseña: si ese capítulo tiene un
  // escritorio configurado, lo muestra; si no, conserva el comportamiento
  // original y entra directo al capítulo.
  function abrirEscritorioSecreto(destinoIndex) {
    const capitulo = capitulos[destinoIndex];
    const escritorio = escritorioDeCapitulo(capitulo);
    if (!escritorio) {
      entrarACapituloSecreto(destinoIndex);
      return;
    }
    escritorioDestinoIndex = destinoIndex;
    renderizarEscritorio(escritorio);
    cerrarEnfoqueEscritorio(true);
    elDeskOverlay.classList.remove('hidden');
  }

  function cerrarEscritorioSecreto() {
    elDeskOverlay.classList.add('hidden');
    cerrarEnfoqueEscritorio(true);
  }

  // --- Modo "enfoque": fundido a negro + acercamiento a un objeto del escritorio,
  // con su nota a la derecha (estilo inspección de inventario). ---

  function abrirEnfoqueEscritorio(elItem, item) {
    elDeskFocusImage.src = elItem.src;
    elDeskFocusImage.alt = item.tooltip || item.archivo;
    elDeskFocusText.textContent = item.tooltip || '';
    elDeskFocusNote.classList.toggle('hidden', !item.tooltip);

    elDeskFocusOverlay.classList.remove('hidden');
    void elDeskFocusOverlay.offsetWidth; // fuerza reflow para que la transición se dispare
    elDeskFocusOverlay.classList.add('activo');
  }

  // "instantaneo" se usa al abrir/cerrar el escritorio completo, para resetear
  // el enfoque sin animación (ya no hay nada visible que necesite un fundido).
  function cerrarEnfoqueEscritorio(instantaneo) {
    elDeskFocusOverlay.classList.remove('activo');
    if (instantaneo) {
      elDeskFocusOverlay.classList.add('hidden');
    } else {
      setTimeout(() => elDeskFocusOverlay.classList.add('hidden'), 350);
    }
  }

  // Sincroniza qué imagen del escritorio se ve "encendida" según lo que suena
  // en el mini-reproductor (se llama desde actualizarUIAudio, más abajo).
  function actualizarUIAudioEscritorio() {
    if (elDeskOverlay.classList.contains('hidden') || escritorioDestinoIndex === null) return;
    const escritorio = escritorioDeCapitulo(capitulos[escritorioDestinoIndex]);
    if (!escritorio) return;

    elDeskSurface.querySelectorAll('.desk-item[data-indice]').forEach(el => {
      const item = escritorio.items[Number(el.dataset.indice)];
      const activo = item && item.accion === 'audio' && marcadorActivo && marcadorActivo.ruta === item.audio && reproduciendo;
      el.classList.toggle('audio-activo', Boolean(activo));
    });
  }

  function manejarClicItemEscritorio(elItem) {
    if (escritorioDestinoIndex === null) return;
    const escritorio = escritorioDeCapitulo(capitulos[escritorioDestinoIndex]);
    if (!escritorio) return;
    const item = escritorio.items[Number(elItem.dataset.indice)];
    if (!item) return;

    if (item.accion === 'desbloquear') {
      // "flower" ya no dispara audio: eso quedó exclusivamente a cargo del floppy disk.
      const destino = escritorioDestinoIndex;
      cerrarEscritorioSecreto();
      entrarACapituloSecreto(destino, { reproducirAudio: false });
      return;
    }

    if (item.accion === 'audio' && item.audio) {
      toggleAudioPista(item.audio, item.etiqueta || '');
    }

    abrirEnfoqueEscritorio(elItem, item);
  }

  elDeskSurface.addEventListener('click', (evento) => {
    const item = evento.target.closest('.desk-item.interactivo');
    if (!item) return;
    manejarClicItemEscritorio(item);
  });

  elDeskSurface.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const item = evento.target.closest('.desk-item.interactivo');
    if (!item) return;
    evento.preventDefault();
    manejarClicItemEscritorio(item);
  });

  elCloseDeskFocus.addEventListener('click', () => cerrarEnfoqueEscritorio(false));
  elDeskFocusOverlay.addEventListener('click', (evento) => {
    if (evento.target === elDeskFocusOverlay || evento.target === elDeskFocusStage) {
      cerrarEnfoqueEscritorio(false);
    }
  });

  elCloseDesk.addEventListener('click', cerrarEscritorioSecreto);
  elDeskOverlay.addEventListener('click', (evento) => {
    if (evento.target === elDeskOverlay) cerrarEscritorioSecreto();
  });

  elBtnVolverEscritorio.addEventListener('click', () => {
    reproducirSFX('assets/audio/Click.mp3');
    abrirEscritorioSecreto(state.chapterIndex);
  });

  elGateForm.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (puertaProcesando || puertaDestinoIndex === null) return;

    const capitulo = capitulos[puertaDestinoIndex];
    const intento = elGateInput.value.trim().toLowerCase();
    const claveCorrecta = (capitulo.clave || '').trim().toLowerCase();

    if (intento && intento === claveCorrecta) {
      puertaProcesando = true;
      elGateFeedback.textContent = 'Acceso concedido.';
      elGateFeedback.className = 'gate-feedback success';
      elGateCard.classList.add('exito');
      const destino = puertaDestinoIndex;
      setTimeout(() => {
        cerrarPuertaSecreta();
        abrirEscritorioSecreto(destino);
      }, 850);
      return;
    }

    // Clave incorrecta: la "pantalla" se apaga y vuelve, invitando a reintentar.
    elGateFeedback.textContent = 'Clave incorrecta. Inténtalo de nuevo.';
    elGateFeedback.className = 'gate-feedback error';
    elGateInput.value = '';
    elGateCard.classList.remove('apagon');
    void elGateCard.offsetWidth; // fuerza reiniciar la animación si se repite el error
    elGateCard.classList.add('apagon');
    elGateInput.focus();
  });

  elCloseGate.addEventListener('click', cerrarPuertaSecreta);
  elGateOverlay.addEventListener('click', (evento) => {
    if (evento.target === elGateOverlay) cerrarPuertaSecreta();
  });

  elBookFlow.addEventListener('click', (evento) => {
    const marcador = evento.target.closest('.audio-marker');
    if (marcador) {
      toggleMarcadorAudio(marcador);
      return;
    }

    const mark = evento.target.closest('mark');
    if (mark) {
      abrirPanelComentarios(mark.dataset.comentarioId);
      return;
    }

    const span = evento.target.closest('.interactive-keyword');
    if (!span) return;
    const tipo = span.dataset.type;
    const id = span.dataset.id;
    if (tipo === 'secret') abrirSecreto(id);
    else if (tipo === 'chapter') manejarClicCapituloSecreto(id);
  });

  elCloseSecret.addEventListener('click', cerrarSecreto);
  elOverlay.addEventListener('click', (evento) => {
    if (evento.target === elOverlay) cerrarSecreto();
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      if (!elOverlay.classList.contains('hidden')) cerrarSecreto();
      if (!elGateOverlay.classList.contains('hidden')) cerrarPuertaSecreta();
      if (!elDeskFocusOverlay.classList.contains('hidden')) {
        cerrarEnfoqueEscritorio(false);
      } else if (!elDeskOverlay.classList.contains('hidden')) {
        cerrarEscritorioSecreto();
      }
      if (!elCommentFormOverlay.classList.contains('hidden')) cerrarFormularioComentario();
      if (!elCommentsPanelOverlay.classList.contains('hidden')) cerrarPanelComentarios();
      if (elChapterMenuToggle.getAttribute('aria-expanded') === 'true') cerrarMenuCapitulos();
      return;
    }

    const enCampoTexto = document.activeElement && ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName);
    if (enCampoTexto) return;
    if (evento.key === 'ArrowRight') avanzarPagina();
    if (evento.key === 'ArrowLeft') retrocederPagina();
  });

  elBtnPrev.addEventListener('click', () => {
    reproducirSFX('assets/audio/Click.mp3');
    retrocederPagina();
  });
  elBtnNext.addEventListener('click', () => {
    reproducirSFX('assets/audio/Click.mp3');
    avanzarPagina();
  });

  // --- Marcadores de música inline, con fade-in / fade-out ---
  // Cada [audio:ruta|Etiqueta] en el texto es un marcador independiente.
  // Solo suena una pista a la vez: activar uno apaga el anterior con fundido.
  // El mini-reproductor (esquina inferior) persiste aunque el lector avance,
  // retroceda o salte de capítulo, para poder pausar/detener desde cualquier parte.

  const audio = new Audio();
  audio.volume = 0;
  audio.loop = true;

  let marcadorActivo = null; // { ruta, etiqueta } o null si no hay nada cargado
  let reproduciendo = false; // true = sonando, false = pausado (solo aplica si hay marcadorActivo)
  let fadeIntervalId = null;

  function fadeVolumen(destino, duracionMs, alTerminar) {
    clearInterval(fadeIntervalId);
    const inicioVol = audio.volume;
    const pasos = 20;
    const tiempoPorPaso = duracionMs / pasos;
    let paso = 0;
    fadeIntervalId = setInterval(() => {
      paso++;
      audio.volume = Math.max(0, Math.min(1, inicioVol + (destino - inicioVol) * (paso / pasos)));
      if (paso >= pasos) {
        clearInterval(fadeIntervalId);
        audio.volume = destino;
        if (alTerminar) alTerminar();
      }
    }, tiempoPorPaso);
  }

  function actualizarUIAudio() {
    document.querySelectorAll('.audio-marker').forEach(el => {
      const esActivo = marcadorActivo && el.dataset.ruta === marcadorActivo.ruta;
      el.classList.toggle('playing', Boolean(esActivo && reproduciendo));
      el.classList.toggle('paused', Boolean(esActivo && !reproduciendo));
    });

    if (marcadorActivo) {
      elMiniPlayer.classList.remove('hidden');
      elMiniPlayer.classList.toggle('playing', reproduciendo);
      elMiniPlayerLabel.textContent = marcadorActivo.etiqueta || 'Música';
      elMiniPlayerToggle.textContent = reproduciendo ? '❚❚' : '►';
      elMiniPlayerToggle.setAttribute('aria-label', reproduciendo ? 'Pausar' : 'Reanudar');
      elMiniPlayerToggle.disabled = false;
      elMiniPlayerStop.disabled = false;
    } else {
      elMiniPlayer.classList.add('hidden');
      elMiniPlayerToggle.disabled = true;
      elMiniPlayerStop.disabled = true;
    }

    actualizarUIAudioEscritorio();
  }

  function reproducirDesde(ruta, etiqueta) {
    marcadorActivo = { ruta, etiqueta };
    reproduciendo = true;
    audio.src = ruta;
    audio.currentTime = 0;
    audio.play().catch(err => console.warn('No se pudo reproducir la música:', err));
    fadeVolumen(0.6, 900);
    actualizarUIAudio();
  }

  function pausarMusica() {
    if (!marcadorActivo) return;
    reproduciendo = false;
    actualizarUIAudio();
    fadeVolumen(0, 500, () => audio.pause());
  }

  function reanudarMusica() {
    if (!marcadorActivo) return;
    reproduciendo = true;
    actualizarUIAudio();
    audio.play().catch(err => console.warn('No se pudo reanudar la música:', err));
    fadeVolumen(0.6, 500);
  }

  function detenerMusica() {
    reproduciendo = false;
    marcadorActivo = null;
    actualizarUIAudio();
    fadeVolumen(0, 600, () => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  // Al desbloquear un capítulo secreto: si ya hay un audio sonando, se detiene;
  // si ese capítulo trae su propio audio (capitulo.audioExito), se reproduce a
  // través del mismo mini-reproductor, así queda con opción de pausar/detener.
  function manejarAudioAlDesbloquear(capitulo) {
    const rutaNueva = capitulo.audioExito;

    if (marcadorActivo) {
      if (rutaNueva) {
        fadeVolumen(0, 400, () => reproducirDesde(rutaNueva, capitulo.titulo || 'Tema secreto'));
      } else {
        detenerMusica();
      }
      return;
    }

    if (rutaNueva) reproducirDesde(rutaNueva, capitulo.titulo || 'Tema secreto');
  }

  function toggleAudioPista(ruta, etiqueta) {
    if (marcadorActivo && marcadorActivo.ruta === ruta) {
      reproduciendo ? pausarMusica() : reanudarMusica();
      return;
    }

    if (marcadorActivo) {
      fadeVolumen(0, 400, () => reproducirDesde(ruta, etiqueta));
    } else {
      reproducirDesde(ruta, etiqueta);
    }
  }

  function toggleMarcadorAudio(elMarcador) {
    toggleAudioPista(elMarcador.dataset.ruta, elMarcador.dataset.etiqueta || '');
  }

  elMiniPlayerToggle.addEventListener('click', () => {
    if (!marcadorActivo) return;
    reproduciendo ? pausarMusica() : reanudarMusica();
  });

  elMiniPlayerStop.addEventListener('click', detenerMusica);

  // ============================================================
  // RESALTAR TEXTO + COMENTARIOS
  // Capa de almacenamiento aislada (ComentariosStorage): hoy usa localStorage,
  // privado a este navegador. El día que tengas un proyecto Firebase, solo hay
  // que reemplazar las 3 funciones internas de ese objeto — el resto del
  // código (UI, resaltado, panel) no cambia. Ver GUIA-MARCADORES.md.
  // ============================================================

  const ComentariosStorage = (function () {
    const CLAVE = 'novela-interactiva-comentarios-v1';

    function cargar() {
      try {
        const crudo = localStorage.getItem(CLAVE);
        return crudo ? JSON.parse(crudo) : [];
      } catch (err) {
        console.warn('No se pudieron leer los comentarios guardados:', err);
        return [];
      }
    }

    function guardarTodos(lista) {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(lista));
      } catch (err) {
        console.warn('No se pudo guardar el comentario (¿localStorage lleno o bloqueado?):', err);
      }
    }

    return {
      listar: cargar,
      agregar(comentario) {
        const lista = cargar();
        lista.push(comentario);
        guardarTodos(lista);
        return lista;
      },
      eliminar(id) {
        const lista = cargar().filter(c => c.id !== id);
        guardarTodos(lista);
        return lista;
      }
    };
  })();

  let seleccionActual = null; // { range, texto } mientras el toolbar "Comentar" está visible

  function manejarSeleccion(evento) {
    if (elHighlightToolbar.contains(evento.target)) return;

    const seleccion = window.getSelection();
    if (!seleccion || seleccion.isCollapsed || seleccion.rangeCount === 0) {
      ocultarToolbarResaltado();
      return;
    }

    const texto = seleccion.toString().trim();
    const range = seleccion.getRangeAt(0);
    if (!texto || !elBookFlow.contains(range.commonAncestorContainer)) {
      ocultarToolbarResaltado();
      return;
    }

    seleccionActual = { range: range.cloneRange(), texto };
    mostrarToolbarResaltado(range);
  }

  function mostrarToolbarResaltado(range) {
    const rect = range.getBoundingClientRect();
    elHighlightToolbar.style.left = (rect.left + rect.width / 2) + 'px';
    elHighlightToolbar.style.top = (rect.top - 12) + 'px';
    elHighlightToolbar.classList.remove('hidden');
  }

  function ocultarToolbarResaltado() {
    elHighlightToolbar.classList.add('hidden');
  }

  document.addEventListener('mouseup', manejarSeleccion);
  document.addEventListener('touchend', manejarSeleccion);

  elBtnComentarSeleccion.addEventListener('click', () => {
    if (!seleccionActual) return;
    ocultarToolbarResaltado();
    elCommentFormExcerpt.textContent = `"${seleccionActual.texto}"`;
    elCommentFormTextarea.value = '';
    elCommentFormOverlay.classList.remove('hidden');
    elCommentFormTextarea.focus();
  });

  function cerrarFormularioComentario() {
    elCommentFormOverlay.classList.add('hidden');
    seleccionActual = null;
    window.getSelection().removeAllRanges();
  }

  elCloseCommentForm.addEventListener('click', cerrarFormularioComentario);
  elBtnDescartarComentario.addEventListener('click', cerrarFormularioComentario);
  elCommentFormOverlay.addEventListener('click', (evento) => {
    if (evento.target === elCommentFormOverlay) cerrarFormularioComentario();
  });

  elBtnGuardarComentario.addEventListener('click', () => {
    if (!seleccionActual) {
      cerrarFormularioComentario();
      return;
    }

    const capitulo = capitulos[state.chapterIndex];
    const comentario = {
      id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      capituloNumero: capitulo.numero,
      capituloTitulo: capitulo.titulo,
      textoResaltado: seleccionActual.texto,
      comentario: elCommentFormTextarea.value.trim(),
      creado: new Date().toISOString()
    };

    ComentariosStorage.agregar(comentario);
    aplicarResaltadoEnRango(seleccionActual.range, comentario.id);
    actualizarContadorComentarios();
    cerrarFormularioComentario();
  });

  // Envuelve una selección EN VIVO (viene directo del usuario) en un <mark>.
  function aplicarResaltadoEnRango(range, comentarioId) {
    const mark = document.createElement('mark');
    mark.dataset.comentarioId = comentarioId;
    try {
      range.surroundContents(mark);
    } catch (err) {
      console.warn('No se pudo resaltar visualmente esta selección (cruza varios elementos con formato); el comentario igual se guardó.', err);
    }
  }

  // Tras reconstruir el HTML del capítulo (cambio de página/capítulo), los <mark>
  // manuales se pierden — se buscan de nuevo por texto y se vuelven a envolver.
  function reaplicarComentarios(capitulo) {
    const comentarios = ComentariosStorage.listar().filter(c => c.capituloNumero === capitulo.numero);
    comentarios.forEach(c => marcarTextoEnFlujo(c.textoResaltado, c.id));
  }

  function marcarTextoEnFlujo(textoBuscado, comentarioId) {
    if (!textoBuscado) return;
    const parrafos = elBookFlow.querySelectorAll('p');
    for (const p of parrafos) {
      if (envolverTextoEnNodo(p, textoBuscado, comentarioId)) return;
    }
  }

  // Busca "textoBuscado" dentro del texto visible de "contenedor" (que puede tener
  // <strong>/<em>/<span> anidados) y envuelve esa selección en un <mark>.
  function envolverTextoEnNodo(contenedor, textoBuscado, comentarioId) {
    const textoCompleto = contenedor.textContent;
    const indiceInicio = textoCompleto.indexOf(textoBuscado);
    if (indiceInicio === -1) return false;
    const indiceFin = indiceInicio + textoBuscado.length;

    const walker = document.createTreeWalker(contenedor, NodeFilter.SHOW_TEXT, null);
    let nodoInicio = null, offsetInicio = 0;
    let nodoFin = null, offsetFin = 0;
    let acumulado = 0;
    let nodo;

    while ((nodo = walker.nextNode())) {
      const longitud = nodo.textContent.length;
      if (nodoInicio === null && acumulado + longitud > indiceInicio) {
        nodoInicio = nodo;
        offsetInicio = indiceInicio - acumulado;
      }
      if (nodoFin === null && acumulado + longitud >= indiceFin) {
        nodoFin = nodo;
        offsetFin = indiceFin - acumulado;
        break;
      }
      acumulado += longitud;
    }

    if (!nodoInicio || !nodoFin) return false;

    const range = document.createRange();
    range.setStart(nodoInicio, offsetInicio);
    range.setEnd(nodoFin, offsetFin);

    const mark = document.createElement('mark');
    mark.dataset.comentarioId = comentarioId;
    try {
      range.surroundContents(mark);
      return true;
    } catch (err) {
      return false; // selección compleja que cruza elementos parciales; se omite el resaltado visual
    }
  }

  // --- Panel de comentarios guardados ---

  function actualizarContadorComentarios() {
    const n = ComentariosStorage.listar().length;
    elCommentsToggleCount.textContent = String(n);
    elCommentsToggleCount.classList.toggle('hidden', n === 0);
  }

  function poblarPanelComentarios() {
    const lista = ComentariosStorage.listar();

    if (!lista.length) {
      elCommentsPanelList.innerHTML = '<p class="comments-panel-empty">Todavía no has guardado ningún comentario. Selecciona texto en la lectura y elige "Comentar".</p>';
      return;
    }

    elCommentsPanelList.innerHTML = lista
      .slice()
      .reverse()
      .map(c => `<div class="comment-card" data-id="${escapeHtml(c.id)}" data-numero="${escapeHtml(c.capituloNumero)}">
        <div class="comment-card-chapter">Cap. ${escapeHtml(c.capituloNumero)} — ${escapeHtml(c.capituloTitulo)}</div>
        <div class="comment-card-excerpt">"${escapeHtml(c.textoResaltado)}"</div>
        <div class="comment-card-text">${escapeHtml(c.comentario || '(sin texto)')}</div>
        <div class="comment-card-actions">
          <button class="comment-card-delete" data-id="${escapeHtml(c.id)}">Eliminar</button>
        </div>
      </div>`)
      .join('');
  }

  function abrirPanelComentarios(idParaResaltar) {
    poblarPanelComentarios();
    elCommentsPanelOverlay.classList.remove('hidden');
    elBtnCommentsToggle.setAttribute('aria-expanded', 'true');
    if (idParaResaltar) {
      const tarjeta = elCommentsPanelList.querySelector(`.comment-card[data-id="${idParaResaltar}"]`);
      if (tarjeta) tarjeta.scrollIntoView({ block: 'center' });
    }
  }

  function cerrarPanelComentarios() {
    elCommentsPanelOverlay.classList.add('hidden');
    elBtnCommentsToggle.setAttribute('aria-expanded', 'false');
  }

  elBtnCommentsToggle.addEventListener('click', () => {
    const abierto = elBtnCommentsToggle.getAttribute('aria-expanded') === 'true';
    abierto ? cerrarPanelComentarios() : abrirPanelComentarios();
  });

  elCloseCommentsPanel.addEventListener('click', cerrarPanelComentarios);
  elCommentsPanelOverlay.addEventListener('click', (evento) => {
    if (evento.target === elCommentsPanelOverlay) cerrarPanelComentarios();
  });

  elCommentsPanelList.addEventListener('click', (evento) => {
    const btnEliminar = evento.target.closest('.comment-card-delete');
    if (btnEliminar) {
      ComentariosStorage.eliminar(btnEliminar.dataset.id);
      poblarPanelComentarios();
      actualizarContadorComentarios();

      const markVisible = elBookFlow.querySelector(`mark[data-comentario-id="${btnEliminar.dataset.id}"]`);
      if (markVisible) {
        const padre = markVisible.parentNode;
        while (markVisible.firstChild) padre.insertBefore(markVisible.firstChild, markVisible);
        padre.removeChild(markVisible);
      }
      return;
    }

    const tarjeta = evento.target.closest('.comment-card');
    if (tarjeta) {
      irACapitulo(tarjeta.dataset.numero);
      cerrarPanelComentarios();
    }
  });

  // --- Arranque ---
  elBgLayers[capaFondoActivaIndex].style.backgroundImage = construirGradiente(COLOR_DEFAULT);
  poblarMenuCapitulos();
  actualizarContadorComentarios();
  mostrarCapitulo(state.chapterIndex, state.blockIndex);
})();

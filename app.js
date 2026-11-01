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
  const REGEX_INLINE = /\[(secret|chapter|bug|pista):([a-zA-Z0-9_-]+)\|([^\]]+)\]|\*\*(.+?)\*\*|\*(.+?)\*/g;
  const REGEX_MARCADOR_AUDIO = /^\[audio:([^\]|]+)(?:\|([^\]]*))?\]$/i;
  const REGEX_MARCADOR_COLOR = /^\[color:\s*([^\]]+)\]$/i;
  const REGEX_HEX_VALIDO = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const COLOR_DEFAULT = ['#b3c9d6', '#98aa9d', '#d3ddca']; // paleta original (mist, eucalyptus, verde pálido)
  const PARRAFOS_POR_BLOQUE = 6; // párrafos por bloque/página al hacer clic en "Continuar"
  const PREFIJO_TELEFONO = '[[telefono]]'; // así guarda parser.js un bloque [telefono]...[/telefono]

  // Un capítulo normal sin ningún párrafo legible (p. ej. uno "EN PROCESO DE
  // ESCRITURA" que solo tiene [notas]) no se muestra: ni en el menú ni al
  // avanzar. Aparece solo en cuanto el manuscrito le agregue texto.
  // Los secretos se conservan siempre, porque se llega a ellos por su enlace.
  const capitulos = CONFIG_NOVELA.capitulos.filter(c =>
    c.tipo === 'secreto' || c.parrafos.some(p => !REGEX_MARCADOR_COLOR.test(p.trim()))
  );
  const secretos = CONFIG_NOVELA.secretos || {};
  const escritorios = (typeof CONFIG_ESCRITORIO !== 'undefined' && CONFIG_ESCRITORIO.escritorios) || {};
  const carpetaEscritorio = (typeof CONFIG_ESCRITORIO !== 'undefined' && CONFIG_ESCRITORIO.carpeta) || '';

  const elChapterNum = document.getElementById('chapter-num');
  const elChapterTitle = document.getElementById('chapter-title');
  const elChapterEstado = document.getElementById('chapter-estado');
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
  const elChapterMenuPanel = document.getElementById('chapter-menu-panel'); // salas del museo
  const elMuseo = document.getElementById('museo');
  const elMuseoEspeciales = document.getElementById('museo-especiales');
  const elCerrarMuseo = document.getElementById('cerrar-museo');

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
  // La negrita y la cursiva se procesan por dentro, así **"[pista:mitad|Mitad]"** funciona.
  function procesarParrafo(texto) {
    // Copia local de la expresión: la función se llama a sí misma y una
    // expresión /g compartida perdería su posición (lastIndex) al anidarse.
    const regex = new RegExp(REGEX_INLINE.source, 'g');
    let resultado = '';
    let ultimoIndex = 0;
    let match;
    while ((match = regex.exec(texto)) !== null) {
      resultado += escapeHtml(texto.slice(ultimoIndex, match.index));
      const [, tipo, id, palabra, negrita, cursiva] = match;

      if (tipo === 'pista') {
        // Pista del tablero de evidencias: al tocarla se "clava" en la Sala de evidencias.
        const encontrada = Descubrimientos.tiene(`pista:${id}`);
        resultado += `<span class="pista-texto${encontrada ? ' encontrada' : ''}" data-pista="${escapeHtml(id)}" role="button" tabindex="0"
          aria-label="${escapeHtml(encontrada ? `${palabra}: pista en el tablero. Abrir la Sala de evidencias` : palabra)}">${escapeHtml(palabra)}</span>`;
      } else if (tipo === 'bug') {
        // Bug de El Sistema: palabra con glitch sutil; ya reportado, se ve normal.
        const reportado = Descubrimientos.tiene(`bug:${id}`);
        resultado += `<span class="bug-texto${reportado ? ' reportado' : ''}" data-bug="${escapeHtml(id)}" data-texto="${escapeHtml(palabra)}"${reportado ? '' : ' role="button" tabindex="0" aria-label="' + escapeHtml(palabra) + '"'}>${escapeHtml(palabra)}</span>`;
      } else if (tipo) {
        const claseExtra = tipo === 'chapter' ? ' interactive-chapter' : '';
        resultado += `<span class="interactive-keyword${claseExtra}" data-type="${tipo}" data-id="${escapeHtml(id)}">${escapeHtml(palabra)}</span>`;
      } else if (negrita !== undefined) {
        resultado += `<strong>${procesarParrafo(negrita)}</strong>`;
      } else {
        resultado += `<em>${procesarParrafo(cursiva)}</em>`;
      }

      ultimoIndex = regex.lastIndex;
    }
    resultado += escapeHtml(texto.slice(ultimoIndex));
    return resultado;
  }

  // [color:...] es una directiva silenciosa (no se muestra, solo afecta el fondo);
  // [audio:...] en un marcador clicleable; cualquier otro párrafo, en texto normal.
  // "indice" = posición del párrafo en el capítulo (identifica cada teléfono).
  function renderizarParrafo(parrafo, indice) {
    const textoPlano = parrafo.trim();

    if (REGEX_MARCADOR_COLOR.test(textoPlano)) return '';

    if (textoPlano.startsWith(PREFIJO_TELEFONO)) {
      try {
        return renderizarTelefono(JSON.parse(textoPlano.slice(PREFIJO_TELEFONO.length)), indice);
      } catch (err) {
        console.warn('Teléfono con datos inválidos en story.js:', err);
        return '';
      }
    }

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
  // TELÉFONO DENTRO DE LA HISTORIA — [telefono: Dueño | opciones] ... [/telefono]
  // Vidrio esmerilado; los mensajes emergen uno a uno cuando el teléfono entra
  // en pantalla, con "escribiendo..." antes de cada mensaje recibido, como si
  // la conversación ocurriera en ese momento. Tocar la pantalla muestra todo;
  // al terminar se puede repetir. Ver GUIA-MARCADORES.md, sección 11.
  // ============================================================

  const conversacionesVistas = new Set(); // teléfonos ya reproducidos en esta visita
  let observadorTelefonos = null;

  function horaTelefono(tel) {
    if (tel.hora) return escapeHtml(tel.hora);
    return tel.roto ? '<span class="telefono-hora-rota">--:--</span>' : '';
  }

  function renderizarTelefono(tel, indice) {
    const capitulo = capitulos[state.chapterIndex];
    const clave = `${capitulo ? capitulo.numero : ''}:${indice}`;
    const notificaciones = tel.modo === 'notificaciones';
    const recibidos = tel.mensajes.filter(m => m.tipo === 'recibido');
    const remitentes = new Set(recibidos.map(m => m.de));
    const contacto = tel.contacto || (remitentes.size === 1 ? [...remitentes][0] : 'Mensajes');
    // En un chat de grupo (varios remitentes) cada mensaje recibido lleva su nombre.
    const mostrarNombres = remitentes.size > 1;

    const items = tel.mensajes.map(m => {
      if (notificaciones) {
        const esLlamada = m.tipo === 'sistema';
        return `<div class="tel-item tel-notif${esLlamada ? ' llamada' : ''}">
          <div class="tel-notif-cabeza">
            <span class="tel-notif-app">${esLlamada ? 'Teléfono' : 'Mensajes'}</span>
            <span class="tel-notif-tiempo">ahora</span>
          </div>
          ${esLlamada ? '' : `<p class="tel-notif-de">${escapeHtml(m.de || '')}</p>`}
          <p class="tel-notif-texto">${procesarParrafo(m.texto)}</p>
        </div>`;
      }
      if (m.tipo === 'sistema') return `<p class="tel-item tel-sistema">${procesarParrafo(m.texto)}</p>`;
      return `<div class="tel-item tel-msg ${m.tipo}">
        ${m.tipo === 'recibido' && mostrarNombres ? `<span class="tel-msg-de">${escapeHtml(m.de)}</span>` : ''}
        <p class="tel-burbuja">${procesarParrafo(m.texto)}</p>
      </div>`;
    }).join('');

    const estilo = tel.color ? ` style="--tel-color: ${escapeHtml(tel.color)}"` : '';
    const cabecera = notificaciones
      ? `<div class="telefono-bloqueo">
          <span class="telefono-bloqueo-hora">${horaTelefono(tel)}</span>
          <span class="telefono-bloqueo-texto">Bloqueado</span>
        </div>`
      : `<div class="telefono-cabecera">
          <span class="telefono-avatar" aria-hidden="true">${escapeHtml(contacto.charAt(0).toUpperCase())}</span>
          <span class="telefono-contacto">${escapeHtml(contacto)}</span>
        </div>`;

    // Grietas: trazos que salen de un punto de impacto (arriba a la derecha).
    const grietas = tel.roto ? `<svg class="telefono-grietas" viewBox="0 0 300 520" preserveAspectRatio="none" aria-hidden="true">
        <g fill="none" stroke-linecap="round">
          <path d="M228 96 L300 60 M228 96 L292 150 M228 96 L270 230 L300 262 M228 96 L196 182 L150 250 L120 340 M228 96 L160 120 L90 100 L0 128 M228 96 L210 20 L218 0 M196 182 L120 196 L40 260 M150 250 L210 300 L250 420 L236 520 M120 340 L60 420 L30 520 M160 120 L130 60 L150 0" />
          <path class="grieta-fina" d="M228 96 L248 118 L262 112 M228 96 L214 110 L222 128 M270 230 L232 244 M90 100 L70 60 M210 300 L170 330 M60 420 L100 470" />
        </g>
        <circle cx="228" cy="96" r="7" />
      </svg>` : '';

    return `<figure class="telefono modo-${notificaciones ? 'notificaciones' : 'chat'}${tel.roto ? ' roto' : ''}" data-clave="${escapeHtml(clave)}"${estilo}
        aria-label="${escapeHtml(`Teléfono de ${tel.dueno}`)}">
      <div class="telefono-cuerpo">
        <div class="telefono-pantalla">
          <div class="telefono-estado">
            <span class="telefono-hora">${notificaciones ? '' : horaTelefono(tel)}</span>
            <span class="telefono-iconos" aria-hidden="true"><span class="tel-senal"></span><span class="tel-bateria"></span></span>
          </div>
          ${cabecera}
          <div class="telefono-mensajes" role="log" aria-label="${escapeHtml(notificaciones ? 'Notificaciones' : `Conversación con ${contacto}`)}">
            ${items}
            <div class="tel-escribiendo oculto" aria-hidden="true"><span></span><span></span><span></span></div>
          </div>
          ${grietas}
          <button class="telefono-repetir oculto" aria-label="Repetir la conversación">↻</button>
        </div>
      </div>
      <figcaption class="telefono-pie">Toca la pantalla para ver todo</figcaption>
    </figure>`;
  }

  // Tras dibujar una página: cada teléfono empieza a "recibir" mensajes al
  // entrar en pantalla. Ya visto en esta visita, o con animaciones reducidas,
  // aparece completo.
  function prepararTelefonos() {
    if (observadorTelefonos) observadorTelefonos.disconnect();
    const telefonos = elBookFlow.querySelectorAll('.telefono');
    if (!telefonos.length) return;
    observadorTelefonos = new IntersectionObserver(entradas => {
      entradas.forEach(entrada => {
        if (!entrada.isIntersecting) return;
        observadorTelefonos.unobserve(entrada.target);
        reproducirConversacion(entrada.target);
      });
    }, { threshold: 0.35 });
    telefonos.forEach(tel => {
      if (Preferencias.reducirMovimiento() || conversacionesVistas.has(tel.dataset.clave)) {
        mostrarConversacionCompleta(tel);
      } else {
        tel.querySelectorAll('.tel-item').forEach(item => item.classList.add('oculto'));
        observadorTelefonos.observe(tel);
      }
    });
  }

  // Pausa antes de cada elemento: los mensajes largos "se escriben" más tiempo.
  function pausaAntesDe(item, tel) {
    const largo = item.textContent.trim().length;
    const limitar = (ms, min, max) => Math.max(min, Math.min(max, ms));
    if (tel.classList.contains('modo-notificaciones')) return limitar(700 + largo * 6, 900, 1700);
    if (item.classList.contains('tel-sistema')) return 650;
    if (item.classList.contains('enviado')) return limitar(400 + largo * 12, 600, 1400);
    return limitar(500 + largo * 26, 900, 2300);
  }

  function reproducirConversacion(tel) {
    const items = Array.from(tel.querySelectorAll('.tel-item'));
    const corrida = {};
    tel._corrida = corrida;
    clearTimeout(tel._timeout);
    items.forEach(item => item.classList.remove('visible'));
    items.forEach(item => item.classList.add('oculto'));
    tel.classList.remove('terminado');
    tel.classList.add('reproduciendo');
    tel.querySelector('.telefono-repetir').classList.add('oculto');
    const escribiendo = tel.querySelector('.tel-escribiendo');
    const contenedor = tel.querySelector('.telefono-mensajes');
    contenedor.scrollTop = 0;

    let i = 0;
    const siguiente = () => {
      if (tel._corrida !== corrida || !tel.isConnected) return;
      if (i >= items.length) {
        terminarConversacion(tel);
        return;
      }
      const item = items[i++];
      const conEscribiendo = item.classList.contains('recibido');
      if (conEscribiendo) {
        escribiendo.classList.remove('oculto');
        contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: 'smooth' });
      }
      tel._timeout = setTimeout(() => {
        if (tel._corrida !== corrida) return;
        escribiendo.classList.add('oculto');
        item.classList.remove('oculto');
        item.classList.add('visible');
        if (tel.classList.contains('modo-notificaciones')) {
          tel.classList.remove('vibra');
          void tel.offsetWidth;
          tel.classList.add('vibra');
        }
        contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: 'smooth' });
        tel._timeout = setTimeout(siguiente, 250);
      }, pausaAntesDe(item, tel));
    };
    tel._timeout = setTimeout(siguiente, 450);
  }

  function mostrarConversacionCompleta(tel) {
    tel._corrida = null;
    clearTimeout(tel._timeout);
    tel.querySelector('.tel-escribiendo').classList.add('oculto');
    tel.querySelectorAll('.tel-item').forEach(item => {
      item.classList.remove('oculto', 'visible');
    });
    const contenedor = tel.querySelector('.telefono-mensajes');
    contenedor.scrollTop = contenedor.scrollHeight;
    terminarConversacion(tel);
  }

  function terminarConversacion(tel) {
    tel.classList.remove('reproduciendo');
    tel.classList.add('terminado');
    tel.querySelector('.telefono-repetir').classList.remove('oculto');
    conversacionesVistas.add(tel.dataset.clave);
  }

  // Devuelve true si el clic era para el teléfono (repetir o saltar al final).
  function manejarClicTelefono(evento) {
    const tel = evento.target.closest('.telefono');
    if (!tel) return false;
    if (evento.target.closest('.telefono-repetir')) {
      reproducirConversacion(tel);
      return true;
    }
    // Las palabras secretas o bugs dentro de un mensaje siguen funcionando.
    if (evento.target.closest('.interactive-keyword, .bug-texto, .pista-texto')) return false;
    if (tel.classList.contains('reproduciendo')) {
      mostrarConversacionCompleta(tel);
      return true;
    }
    return false;
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
    elChapterEstado.classList.toggle('hidden', !capitulo.enProceso);

    const inicio = state.blockIndex * PARRAFOS_POR_BLOQUE;
    const bloque = capitulo.parrafos.slice(inicio, inicio + PARRAFOS_POR_BLOQUE);

    elBookFlow.innerHTML = bloque.map((parrafo, i) => renderizarParrafo(parrafo, inicio + i)).join('');
    prepararTelefonos();
    reaplicarComentarios(capitulo);
    aplicarLetraCapital(); // después de los comentarios, para no partirles el texto
    prepararEmersion();
    actualizarUIAudio();

    if (esSecreto) {
      ocultarCapasFondo();
    } else {
      aplicarColorFondo(colorActivoHasta(capitulo, inicio + bloque.length - 1));
    }

    elBtnVolverEscritorio.classList.toggle('hidden', !(esSecreto && escritorioDeCapitulo(capitulo)));

    actualizarBotones(capitulo);
    actualizarProgreso(capitulo);
    guardarPosicion();

    // Llegar a la última página cuenta como capítulo terminado (una sola vez),
    // y puede desclasificar fichas del Archivo de personajes.
    if (state.blockIndex >= totalBloques(capitulo) - 1) {
      const clave = `capitulo:${capitulo.numero}`;
      const esNuevo = !Descubrimientos.tiene(clave);
      descubrir(clave);
      if (esNuevo) avisarNovedadesExpediente(capitulo.numero);
    }
  }

  function mostrarCapitulo(indiceCapitulo, bloqueDeseado) {
    // Al arrancar (posición restaurada) no se anuncia la sala: solo al moverse.
    const cambiaDeCapitulo = lectorIniciado && indiceCapitulo !== state.chapterIndex;
    state.chapterIndex = indiceCapitulo;
    const capitulo = capitulos[indiceCapitulo];
    const total = totalBloques(capitulo);
    state.blockIndex = bloqueDeseado === 'ULTIMA' ? total - 1 : Math.max(0, Math.min(bloqueDeseado, total - 1));
    renderizarCapitulo(capitulo);
    actualizarMenuCapitulos(capitulo);
    elReaderContainer.scrollIntoView({ behavior: Preferencias.reducirMovimiento() ? 'auto' : 'smooth', block: 'start' });
    if (cambiaDeCapitulo) anunciarSala(capitulo);
  }

  // --- Entrar a un capítulo es entrar a una sala ---
  // Un instante de "Sala 03 · Sándalo" (o "Archivo 15" en el capítulo secreto)
  // que se revela de izquierda a derecha y se disuelve mientras entran los
  // párrafos. No bloquea nada: los clics pasan a través.

  let lectorIniciado = false; // true al terminar el arranque
  const elSalaIntro = document.getElementById('sala-intro');
  const elSalaIntroNum = document.getElementById('sala-intro-num');
  const elSalaIntroTitulo = document.getElementById('sala-intro-titulo');
  const DURACION_SALA_INTRO_MS = 1700; // igual que la animación sala-intro-velo en style.css
  let salaIntroTimeoutId = null;

  function anunciarSala(capitulo) {
    if (Preferencias.reducirMovimiento()) return;
    const secreto = capitulo.tipo === 'secreto';
    elSalaIntroNum.textContent = `${secreto ? 'Archivo' : 'Sala'} ${capitulo.numero}`;
    elSalaIntroTitulo.textContent = capitulo.titulo;
    elSalaIntro.classList.toggle('secreta', secreto);
    clearTimeout(salaIntroTimeoutId);
    elSalaIntro.classList.remove('hidden', 'activa');
    void elSalaIntro.offsetWidth; // reinicia la animación si se cambia de capítulo muy seguido
    elSalaIntro.classList.add('activa');
    salaIntroTimeoutId = setTimeout(() => {
      elSalaIntro.classList.remove('activa');
      elSalaIntro.classList.add('hidden');
    }, DURACION_SALA_INTRO_MS);
  }

  // --- Letra capital: la primera letra del capítulo, grande, se "dibuja" ---
  // Solo en la primera página y si el capítulo empieza con un párrafo de
  // texto cuya primera letra es una letra (no un guion de diálogo ni comillas).
  function aplicarLetraCapital() {
    if (state.blockIndex !== 0) return;
    const parrafo = elBookFlow.firstElementChild;
    if (!parrafo || parrafo.tagName !== 'P') return;
    const recorrido = document.createTreeWalker(parrafo, NodeFilter.SHOW_TEXT);
    let nodo = recorrido.nextNode();
    while (nodo && !nodo.textContent.trim()) nodo = recorrido.nextNode();
    if (!nodo) return;
    // Dentro de una palabra secreta/pista/bug no: rompería su subrayado.
    if (nodo.parentElement !== parrafo && !['EM', 'STRONG', 'MARK'].includes(nodo.parentElement.tagName)) return;
    const inicio = nodo.textContent.search(/\S/);
    if (!/\p{L}/u.test(nodo.textContent.charAt(inicio))) return;
    const letra = nodo.splitText(inicio);
    letra.splitText(1);
    const span = document.createElement('span');
    span.className = 'letra-capital';
    letra.parentNode.replaceChild(span, letra);
    span.appendChild(letra);
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
      // En el último capítulo, "Fin" abre el modal de contenido adicional (si hay extras).
      const hayMas = siguienteCapituloNormal(state.chapterIndex) !== -1;
      elBtnNext.textContent = hayMas ? 'Continuar' : (extras ? 'Fin ✦' : 'Fin');
      elBtnNext.disabled = !hayMas && !extras;
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

  // --- Transición entre páginas ---
  // Salida breve del texto actual (170 ms) → cambio de contenido → la vista
  // sube al inicio de la página si quedó fuera de pantalla → los párrafos
  // nuevos entran escalonados desde la dirección del movimiento.
  // Solo anima opacity/transform (lo más barato para el navegador).

  const DURACION_SALIDA_PAGINA = 170;
  const DURACION_ENTRADA_PAGINA = 900; // 0,5 s de animación + escalonado de hasta 7 párrafos
  let transicionPendiente = null;      // { cambio, timeoutId } mientras sale la página actual
  let entradaTimeoutId = null;

  // Un clic rápido mientras sale la página anterior la completa al instante,
  // así nunca se pierde un "Continuar" ni se calcula con un estado viejo.
  function completarTransicionPendiente() {
    if (!transicionPendiente) return;
    const { cambio, timeoutId } = transicionPendiente;
    clearTimeout(timeoutId);
    transicionPendiente = null;
    elBookFlow.classList.remove('pagina-sale');
    cambio();
  }

  // direccion: 'adelante' | 'atras'.  opciones.subirVista: false cuando el
  // cambio ya desplaza solo (mostrarCapitulo lleva el lector a su inicio).
  function cambiarPaginaConTransicion(direccion, cambio, opciones) {
    const subirVista = !opciones || opciones.subirVista !== false;
    const reducir = Preferencias.reducirMovimiento();
    const ejecutar = () => {
      transicionPendiente = null;
      elBookFlow.classList.remove('pagina-sale');
      cambio();
      if (subirVista) llevarAlInicioDeLaPagina();
      if (!reducir) animarEntradaDeParrafos(direccion);
    };
    if (reducir) {
      // Sin animación: también se quita la entrada de una página anterior,
      // para que los párrafos nuevos no la hereden.
      clearTimeout(entradaTimeoutId);
      elBookFlow.classList.remove('pagina-entra');
      ejecutar();
      return;
    }
    elBookFlow.dataset.direccion = direccion;
    elBookFlow.classList.remove('pagina-entra');
    elBookFlow.classList.add('pagina-sale');
    transicionPendiente = { cambio: ejecutar, timeoutId: setTimeout(ejecutar, DURACION_SALIDA_PAGINA) };
  }

  function animarEntradaDeParrafos(direccion) {
    clearTimeout(entradaTimeoutId);
    Array.from(elBookFlow.children).forEach((el, i) => el.style.setProperty('--n', String(i)));
    elBookFlow.dataset.direccion = direccion;
    elBookFlow.classList.remove('pagina-entra');
    void elBookFlow.offsetWidth; // reinicia la animación si se pasa de página muy seguido
    elBookFlow.classList.add('pagina-entra');
    entradaTimeoutId = setTimeout(() => elBookFlow.classList.remove('pagina-entra'), DURACION_ENTRADA_PAGINA);
  }

  // Los párrafos que quedan debajo de la pantalla emergen al llegar con el
  // scroll. La primera respuesta del observador (ya con el scroll final de la
  // página) dice cuáles están fuera: solo esos se ocultan, así lo visible
  // nunca parpadea.
  let observadorEmersion = null;

  function prepararEmersion() {
    if (observadorEmersion) observadorEmersion.disconnect();
    if (Preferencias.reducirMovimiento() || !('IntersectionObserver' in window)) return;
    const vistos = new WeakSet();
    observadorEmersion = new IntersectionObserver(entradas => {
      entradas.forEach(entrada => {
        const el = entrada.target;
        if (entrada.isIntersecting) {
          el.classList.remove('por-emerger');
          observadorEmersion.unobserve(el);
        } else if (!vistos.has(el)) {
          el.classList.add('por-emerger');
        }
        vistos.add(el);
      });
    });
    Array.from(elBookFlow.children).forEach(el => observadorEmersion.observe(el));
  }

  // Si el inicio de la página nueva quedó por encima de la vista (se pulsó
  // "Continuar" desde abajo), la pantalla sube hasta la barra de progreso.
  // El salto es instantáneo a propósito: ocurre justo entre la salida del
  // texto viejo y la entrada del nuevo, así que se percibe como una sola
  // transición (sin desplazamientos que mareen ni que se puedan interrumpir).
  function llevarAlInicioDeLaPagina() {
    const ancla = document.querySelector('.progreso') || elBookFlow;
    const arriba = ancla.getBoundingClientRect().top;
    if (arriba >= 0) return;
    window.scrollTo({ top: Math.max(0, window.scrollY + arriba - 90), behavior: 'auto' });
  }

  function avanzarPagina() {
    completarTransicionPendiente();
    const capitulo = capitulos[state.chapterIndex];
    const total = totalBloques(capitulo);

    if (state.blockIndex < total - 1) {
      cambiarPaginaConTransicion('adelante', () => {
        state.blockIndex++;
        renderizarCapitulo(capitulo);
      });
      return;
    }

    if (capitulo.tipo === 'secreto' && state.pilaRetorno.length) {
      const destino = state.pilaRetorno.pop();
      cambiarPaginaConTransicion('atras', () => mostrarCapitulo(destino.chapterIndex, destino.blockIndex), { subirVista: false });
      return;
    }

    const siguiente = siguienteCapituloNormal(state.chapterIndex);
    if (siguiente !== -1) cambiarPaginaConTransicion('adelante', () => mostrarCapitulo(siguiente, 0), { subirVista: false });
    else if (capitulo.tipo !== 'secreto') abrirModalFin();
  }

  function retrocederPagina() {
    completarTransicionPendiente();
    const capitulo = capitulos[state.chapterIndex];

    if (state.blockIndex > 0) {
      cambiarPaginaConTransicion('atras', () => {
        state.blockIndex--;
        renderizarCapitulo(capitulo);
      });
      return;
    }

    if (capitulo.tipo === 'secreto') return; // sin salto entre capítulos desde aquí

    const anterior = anteriorCapituloNormal(state.chapterIndex);
    if (anterior !== -1) cambiarPaginaConTransicion('atras', () => mostrarCapitulo(anterior, 'ULTIMA'), { subirVista: false });
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
    // Fondo vivo (fondo.js, WebGL). Las capas CSS siguen actualizándose como
    // respaldo, pero solo se ven si el navegador no tiene WebGL.
    if (window.FondoVivo) window.FondoVivo.colores(colores);

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
    if (window.FondoVivo) window.FondoVivo.ocultar();
    colorFondoActualClave = null; // fuerza reaplicar el color correcto al volver
  }

  // --- Menú de capítulos: recorrido de museo ---
  // Cada capítulo es una sala con su cuadro (la [portada: ...] del manuscrito,
  // o una imagen provisional) y su placa. Al final, las salas especiales: la
  // Sala de evidencias (tablero) y el Archivo de personajes (expediente).

  const PORTADAS_PROVISIONALES = ['assets/menu-cap-placeholder-1.webp', 'assets/menu-cap-placeholder-2.webp'];

  function portadaDe(capitulo, posicion) {
    return capitulo.portada || PORTADAS_PROVISIONALES[posicion % PORTADAS_PROVISIONALES.length];
  }

  function poblarMenuCapitulos() {
    const actual = capitulos[state.chapterIndex];
    elChapterMenuPanel.innerHTML = capitulos
      .filter(c => c.tipo !== 'secreto')
      .map((c, i) => {
        const recorrida = Descubrimientos.tiene(`capitulo:${c.numero}`);
        const esActual = Boolean(actual) && actual.numero === c.numero;
        const estado = esActual ? 'Estás aquí' : c.enProceso ? 'En montaje' : recorrida ? 'Recorrida ✓' : 'Sin visitar';
        return `<button class="chapter-menu-item museo-sala${esActual ? ' activo' : ''}${recorrida ? ' recorrida' : ''}${c.enProceso ? ' en-montaje' : ''}"
            data-numero="${escapeHtml(c.numero)}" style="--i: ${i}"
            aria-label="${escapeHtml(`Sala ${c.numero}: ${c.titulo}. ${estado}`)}">
          <span class="museo-marco"><img src="${escapeHtml(portadaDe(c, i))}" alt="" loading="lazy" decoding="async" /></span>
          <span class="museo-placa">
            <span class="museo-placa-num">Sala ${escapeHtml(c.numero)}</span>
            <span class="museo-placa-titulo">${escapeHtml(c.titulo)}</span>
            <span class="museo-placa-estado">${estado}</span>
          </span>
        </button>`;
      })
      .join('');
    elMuseoEspeciales.innerHTML = renderizarSalasEspeciales();
  }

  function renderizarSalasEspeciales() {
    const pistasEncontradas = Descubrimientos.contar('pista');
    const totalPistas = Object.keys(pistasTablero).length;
    const fichas = personajesVisibles().length;
    const sala = (id, icono, titulo, detalle, abierta) => `<button class="museo-especial${abierta ? '' : ' cerrada'}" data-sala="${id}" ${abierta ? '' : 'aria-disabled="true"'}>
        <span class="museo-especial-icono" aria-hidden="true">${icono}</span>
        <span class="museo-especial-textos">
          <span class="museo-especial-titulo">${titulo}</span>
          <span class="museo-especial-detalle">${detalle}</span>
        </span>
      </button>`;
    return [
      totalPistas ? sala('evidencias', '◎', 'Sala de evidencias',
        pistasEncontradas ? `${pistasEncontradas} de ${totalPistas} pistas en el tablero` : 'Cerrada · encuentra la primera pista en la historia',
        pistasEncontradas > 0) : '',
      sala('personajes', '▤', 'Archivo de personajes',
        fichas ? `${fichas} ficha${fichas === 1 ? '' : 's'} disponible${fichas === 1 ? '' : 's'}` : 'Cerrado · termina el primer capítulo',
        fichas > 0)
    ].join('');
  }

  function actualizarMenuCapitulos(capitulo) {
    elChapterMenuCurrent.textContent = capitulo.numero;
    if (!elMuseo.classList.contains('hidden')) poblarMenuCapitulos();
  }

  function abrirMenuCapitulos() {
    poblarMenuCapitulos();
    elMuseo.classList.remove('hidden');
    elMuseo.scrollTop = 0;
    void elMuseo.offsetWidth;
    elMuseo.classList.add('visible');
    elChapterMenuToggle.setAttribute('aria-expanded', 'true');
    const actual = elChapterMenuPanel.querySelector('.museo-sala.activo');
    (actual || elCerrarMuseo).focus({ preventScroll: true });
  }

  function cerrarMenuCapitulos() {
    if (elMuseo.classList.contains('hidden')) return;
    elMuseo.classList.remove('visible');
    elMuseo.classList.add('hidden');
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
    reproducirSFX('assets/audio/click.mp3');
    irACapitulo(item.dataset.numero);
    cerrarMenuCapitulos();
  });

  elMuseoEspeciales.addEventListener('click', (evento) => {
    const sala = evento.target.closest('.museo-especial:not(.cerrada)');
    if (!sala) return;
    reproducirSFX('assets/audio/click.mp3');
    cerrarMenuCapitulos();
    if (sala.dataset.sala === 'evidencias') abrirTablero();
    else abrirExpediente();
  });

  elCerrarMuseo.addEventListener('click', cerrarMenuCapitulos);
  elMuseo.addEventListener('click', (evento) => {
    if (evento.target === elMuseo) cerrarMenuCapitulos();
  });

  // --- Easter eggs (popup scrapbook) ---

  // "origen" (opcional): la palabra tocada, desde donde crece la tarjeta.
  function abrirSecreto(id, origen) {
    const secreto = secretos[id];
    if (!secreto) {
      console.warn(`Secreto no encontrado: ${id}`);
      return;
    }
    descubrir(`secreto:${id}`);

    elSecretContent.innerHTML = '';

    if (secreto.titulo) {
      const h3 = document.createElement('h3');
      h3.className = 'secret-title';
      h3.textContent = secreto.titulo;
      elSecretContent.appendChild(h3);
    }

    if (secreto.tipo === 'imagen') {
      const img = document.createElement('img');
      img.decoding = 'async';
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

    cierreSecretoToken++; // si se estaba cerrando otro, ese cierre ya no aplica
    elOverlay.getAnimations({ subtree: true }).forEach(a => a.cancel());
    elOverlay.classList.remove('hidden');
    origenSecreto = origen || null;
    animarTarjetaSecreta(true);
  }

  // --- La tarjeta del secreto crece desde la palabra tocada (y vuelve a ella) ---
  // Técnica FLIP con la Web Animations API: se mide dónde está la palabra y
  // dónde queda la tarjeta, y se anima solo transform/opacity entre ambos.

  let origenSecreto = null;
  let cierreSecretoToken = 0;

  function transformacionDesdeOrigen(tarjeta, origen) {
    const a = origen.getBoundingClientRect();
    const b = tarjeta.getBoundingClientRect();
    if (!a.width || !b.width) return null;
    const dx = (a.left + a.width / 2) - (b.left + b.width / 2);
    const dy = (a.top + a.height / 2) - (b.top + b.height / 2);
    const escala = Math.max(0.08, Math.min(0.4, a.width / b.width));
    return `translate(${dx}px, ${dy}px) scale(${escala})`;
  }

  function animarTarjetaSecreta(abriendo, alTerminar) {
    const tarjeta = elOverlay.querySelector('.scrapbook-card');
    const desde = origenSecreto && origenSecreto.isConnected && !Preferencias.reducirMovimiento() && tarjeta.animate
      ? transformacionDesdeOrigen(tarjeta, origenSecreto)
      : null;
    if (!desde) {
      if (alTerminar) alTerminar();
      return;
    }
    const cuadros = [{ transform: desde, opacity: 0 }, { transform: 'none', opacity: 1 }];
    const anim = tarjeta.animate(abriendo ? cuadros : cuadros.slice().reverse(), {
      duration: abriendo ? 480 : 280,
      easing: abriendo ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'cubic-bezier(0.4, 0, 0.8, 0.4)',
      fill: 'both'
    });
    const velo = elOverlay.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: abriendo ? 260 : 280,
      direction: abriendo ? 'normal' : 'reverse',
      fill: 'both'
    });
    // Respaldo: en una pestaña en segundo plano el navegador frena las
    // animaciones; el cierre se completa igual a tiempo.
    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      clearTimeout(respaldoId);
      if (alTerminar) alTerminar();
      anim.cancel();
      velo.cancel();
    };
    const respaldoId = setTimeout(terminar, (abriendo ? 480 : 280) + 120);
    anim.onfinish = terminar;
  }

  function cerrarSecreto() {
    if (elOverlay.classList.contains('hidden')) return;
    const token = ++cierreSecretoToken;
    animarTarjetaSecreta(false, () => {
      if (token !== cierreSecretoToken) return; // se abrió otro secreto mientras tanto
      elOverlay.classList.add('hidden');
      origenSecreto = null;
    });
  }

  // --- Puerta secreta: acertijo + contraseña antes de un capítulo secreto ---

  let puertaDestinoIndex = null;
  let puertaProcesando = false; // evita doble envío mientras corre una animación

  // Sonido corto de un solo disparo (no usa el motor de fade del mini-reproductor,
  // que es para música de fondo continua, no para efectos breves).
  function reproducirSFX(ruta) {
    if (!ruta) return;
    const sfx = new Audio(ruta);
    sfx.volume = 0.7 * Preferencias.volumen();
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
      img.decoding = 'async';
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
    cerrarReproductor();
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

    if (item.accion === 'reproductor' && item.reproductor) {
      abrirReproductor(item.reproductor);
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
    reproducirSFX('assets/audio/click.mp3');
    abrirEscritorioSecreto(state.chapterIndex);
  });

  // --- Cinemática de transición: video a pantalla completa entre la puerta
  // (contraseña correcta) y el escritorio del capítulo secreto. Al terminar el
  // video hay un glitch tipo "apagado de CRT" que revela el escritorio debajo. ---

  const RUTA_CINEMATICA = 'assets/capitulo-secreto/video/cinematic.mp4';
  const DURACION_GLITCH_MS = 900; // igual que la animación cinematic-glitch-* en style.css
  const DURACION_FUNDIDO_MS = 500;

  const elCinematica = document.createElement('div');
  elCinematica.id = 'cinematic-container';
  elCinematica.className = 'cinematic-container hidden';
  elCinematica.setAttribute('role', 'dialog');
  elCinematica.setAttribute('aria-label', 'Cinemática');
  elCinematica.innerHTML = `
    <video class="cinematic-video" playsinline preload="auto"></video>
    <button type="button" class="cinematic-skip">Saltar cinemática ▸▸</button>`;
  document.body.appendChild(elCinematica);
  const elCinematicaVideo = elCinematica.querySelector('.cinematic-video');
  const elCinematicaSkip = elCinematica.querySelector('.cinematic-skip');

  let cinematicaAlTerminar = null; // callback pendiente; null = no hay cinemática en curso
  let musicaPausadaPorCinematica = false;

  function reproducirCinematica(alTerminar) {
    cinematicaAlTerminar = alTerminar;
    musicaPausadaPorCinematica = reproduciendo;
    if (reproduciendo) pausarMusica(); // que la música no tape el audio del video

    elCinematica.classList.remove('glitch', 'saliendo');
    elCinematica.classList.remove('hidden');
    void elCinematica.offsetWidth; // fuerza reflow para que el fundido de entrada se dispare
    elCinematica.classList.add('activo');

    elCinematicaVideo.src = RUTA_CINEMATICA;
    elCinematicaVideo.muted = false;
    elCinematicaVideo.volume = Preferencias.volumen();
    elCinematicaVideo.play()
      .catch(() => {
        // Si el navegador bloquea el autoplay con sonido, reintenta en silencio.
        if (!cinematicaAlTerminar) return;
        elCinematicaVideo.muted = true;
        return elCinematicaVideo.play();
      })
      .catch(err => {
        console.warn('No se pudo reproducir la cinemática:', err);
        terminarCinematica(false);
      });
    elCinematicaSkip.focus({ preventScroll: true });
  }

  // conGlitch: true al terminar el video de forma natural; false al saltarla
  // (o si falla), que usa un fundido corto para no hacer esperar a la lectora.
  function terminarCinematica(conGlitch) {
    if (!cinematicaAlTerminar) return;
    const alTerminar = cinematicaAlTerminar;
    cinematicaAlTerminar = null;

    const usarGlitch = conGlitch && !Preferencias.reducirMovimiento();
    if (!usarGlitch) elCinematicaVideo.pause(); // al saltar, el sonido se corta ya
    elCinematica.classList.add(usarGlitch ? 'glitch' : 'saliendo');

    // El escritorio se abre debajo mientras la cinemática se desvanece encima.
    alTerminar();

    setTimeout(() => {
      elCinematicaVideo.pause();
      elCinematicaVideo.removeAttribute('src');
      elCinematicaVideo.load(); // libera el video de memoria
      elCinematica.classList.remove('activo', 'glitch', 'saliendo');
      elCinematica.classList.add('hidden');
      if (musicaPausadaPorCinematica && !reproduciendo) reanudarMusica();
      musicaPausadaPorCinematica = false;
    }, usarGlitch ? DURACION_GLITCH_MS : DURACION_FUNDIDO_MS);
  }

  elCinematicaVideo.addEventListener('ended', () => terminarCinematica(true));
  elCinematicaVideo.addEventListener('error', () => terminarCinematica(false));
  elCinematicaSkip.addEventListener('click', () => {
    reproducirSFX('assets/audio/click.mp3');
    terminarCinematica(false);
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
      descubrir(`puerta:${capitulo.numero}`);
      setTimeout(() => {
        cerrarPuertaSecreta();
        // La cinemática solo acompaña a los capítulos que tienen escritorio.
        if (escritorioDeCapitulo(capitulos[destino])) {
          reproducirCinematica(() => abrirEscritorioSecreto(destino));
        } else {
          abrirEscritorioSecreto(destino);
        }
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
    if (manejarClicTelefono(evento)) return;

    const marcador = evento.target.closest('.audio-marker');
    if (marcador) {
      toggleMarcadorAudio(marcador);
      return;
    }

    const bug = evento.target.closest('.bug-texto:not(.reportado)');
    if (bug) {
      reportarBug(bug);
      return;
    }

    const pista = evento.target.closest('.pista-texto');
    if (pista) {
      tocarPista(pista);
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
    if (tipo === 'secret') abrirSecreto(id, span);
    else if (tipo === 'chapter') manejarClicCapituloSecreto(id);
  });

  // Bugs y pistas también funcionan con teclado (Enter o espacio).
  elBookFlow.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const bug = evento.target.closest('.bug-texto:not(.reportado)');
    const pista = evento.target.closest('.pista-texto');
    if (!bug && !pista) return;
    evento.preventDefault();
    if (bug) reportarBug(bug);
    else tocarPista(pista);
  });

  elCloseSecret.addEventListener('click', cerrarSecreto);
  elOverlay.addEventListener('click', (evento) => {
    if (evento.target === elOverlay) cerrarSecreto();
  });

  document.addEventListener('keydown', (evento) => {
    // Durante la cinemática, Escape la salta y el resto de teclas no pasan páginas por detrás.
    if (cinematicaAlTerminar) {
      if (evento.key === 'Escape') terminarCinematica(false);
      return;
    }

    if (manejarTeclaExtras(evento)) return;
    if (manejarTeclaSalas(evento)) return;
    if (manejarTeclaLectura(evento)) return;

    if (evento.key === 'Escape') {
      if (!elOverlay.classList.contains('hidden')) cerrarSecreto();
      if (!elGateOverlay.classList.contains('hidden')) cerrarPuertaSecreta();
      if (!elMp3Overlay.classList.contains('hidden')) {
        cerrarReproductor();
      } else if (!elDeskFocusOverlay.classList.contains('hidden')) {
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
    reproducirSFX('assets/audio/click.mp3');
    retrocederPagina();
  });
  elBtnNext.addEventListener('click', () => {
    reproducirSFX('assets/audio/click.mp3');
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
    actualizarUIAudioExtras();
  }

  function reproducirDesde(ruta, etiqueta) {
    marcadorActivo = { ruta, etiqueta };
    reproduciendo = true;
    audio.src = ruta;
    audio.currentTime = 0;
    audio.play().catch(err => console.warn('No se pudo reproducir la música:', err));
    fadeVolumen(volumenMusica(), 900);
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
    fadeVolumen(volumenMusica(), 500);
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

  // ============================================================
  // FIN DE LA ACTUALIZACIÓN + TIENDA DE CONTENIDO ADICIONAL
  // Al pulsar "Fin" en el último capítulo: modal de El Sistema con el saldo;
  // "Aceptar" abre el hub, donde cada fragmento, ilustración o pista se compra
  // por separado con los puntos ganados (doble toque para confirmar).
  // Contenido y precios en story.js → "extras"; precios por defecto y puntos
  // en recompensas.js.
  // ============================================================

  const extras = CONFIG_NOVELA.extras || null;
  const recompensas = (typeof CONFIG_RECOMPENSAS !== 'undefined' && CONFIG_RECOMPENSAS) || {};
  const DURACION_SALIDA_FIN_MS = 450; // igual que la transición de .fin-box.saliendo en style.css
  const MENSAJE_FIN = '¡El usuario ha llegado al final de esta actualización! Si así lo desea, puede utilizar sus puntos para desbloquear contenido adicional.';

  const elFinOverlay = document.getElementById('fin-overlay');
  const elFinBox = document.getElementById('fin-box');
  const elFinMensaje = document.getElementById('fin-mensaje');
  const elFinPuntosValor = document.getElementById('fin-puntos-valor');
  const elFinPuntosDelta = document.getElementById('fin-puntos-delta');
  const elFinAceptar = document.getElementById('fin-aceptar');
  const elFinInicio = document.getElementById('fin-inicio');
  const elFinCerrar = document.getElementById('fin-cerrar');

  const elExtrasHub = document.getElementById('extras-hub');
  const elExtrasFragmentos = document.getElementById('extras-fragmentos');
  const elBtnExtrasVolver = document.getElementById('btn-extras-volver');
  const elBtnAbrirGaleria = document.getElementById('btn-abrir-galeria');

  const elGaleriaOverlay = document.getElementById('galeria-overlay');
  const elGaleriaIlustraciones = document.getElementById('galeria-ilustraciones');
  const elGaleriaPistas = document.getElementById('galeria-pistas');
  const elGaleriaVisor = document.getElementById('galeria-visor');
  const elGaleriaVisorImg = document.getElementById('galeria-visor-img');
  const elGaleriaVisorCaption = document.getElementById('galeria-visor-caption');
  const elCloseGaleria = document.getElementById('close-galeria');
  const elCloseGaleriaVisor = document.getElementById('close-galeria-visor');

  // --- Modal de fin de actualización ---

  let finProcesando = false; // bloquea botones mientras el modal se desvanece

  function abrirModalFin() {
    if (!extras) return;
    elFinMensaje.textContent = MENSAJE_FIN;
    elFinPuntosValor.textContent = formatearPuntos(puntosActuales());
    elFinPuntosDelta.className = 'fin-puntos-delta';
    elFinPuntosDelta.textContent = '';
    elFinBox.classList.remove('deduciendo', 'saliendo');
    elFinOverlay.classList.remove('hidden');
    void elFinOverlay.offsetWidth; // fuerza reflow para que la entrada se anime
    elFinOverlay.classList.add('visible');
    elFinAceptar.focus({ preventScroll: true });
  }

  function cerrarModalFin() {
    if (finProcesando) return;
    elFinOverlay.classList.remove('visible');
    elFinOverlay.classList.add('hidden');
  }

  function aceptarModalFin() {
    if (finProcesando) return;
    finProcesando = true;
    reproducirSFX('assets/audio/click.mp3');
    elFinBox.classList.add('saliendo');
    setTimeout(() => {
      finProcesando = false;
      cerrarModalFin();
      abrirHubExtras();
    }, DURACION_SALIDA_FIN_MS);
  }

  function regresarAlInicio() {
    if (finProcesando) return;
    cerrarModalFin();
    state.pilaRetorno = [];
    mostrarCapitulo(indiceInicial(), 0);
  }

  elFinAceptar.addEventListener('click', aceptarModalFin);
  elFinInicio.addEventListener('click', () => {
    reproducirSFX('assets/audio/click.mp3');
    regresarAlInicio();
  });
  elFinCerrar.addEventListener('click', cerrarModalFin);
  elFinOverlay.addEventListener('click', (evento) => {
    if (evento.target === elFinOverlay) cerrarModalFin();
  });

  // --- Tienda: precios, compras y confirmación con doble toque ---
  // Cada objeto se identifica por su tipo y algo estable (id del fragmento,
  // ruta del archivo), así una compra sobrevive a reordenar story.js.

  function precioDe(objeto, tipo) {
    if (objeto && typeof objeto.precio === 'number') return Math.max(0, objeto.precio);
    return Math.max(0, Number((recompensas.precios || {})[tipo]) || 0);
  }

  function idDeCompra(objeto, tipo, indice) {
    if (tipo === 'fragmento') return `fragmento:${objeto.id || indice}`;
    return `${tipo}:${objeto.archivo}`;
  }

  function estaDisponible(objeto, tipo, indice) {
    return precioDe(objeto, tipo) === 0 || compraHecha(idDeCompra(objeto, tipo, indice));
  }

  let compraPendiente = null; // { id, el, textoOriginal, timeoutId }

  function cancelarCompraPendiente() {
    if (!compraPendiente) return;
    clearTimeout(compraPendiente.timeoutId);
    const etiqueta = compraPendiente.el.querySelector('.tienda-etiqueta');
    if (etiqueta) etiqueta.textContent = compraPendiente.textoOriginal;
    compraPendiente.el.classList.remove('confirmando');
    compraPendiente = null;
  }

  // Primer toque: pide confirmación (4 s). Segundo toque: compra.
  function intentarCompra(el, compra) {
    if (compraPendiente && compraPendiente.id === compra.id) {
      cancelarCompraPendiente();
      ejecutarCompra(compra);
      return;
    }
    cancelarCompraPendiente();

    const faltan = compra.precio - puntosActuales();
    if (faltan > 0) {
      el.classList.remove('sin-saldo');
      void el.offsetWidth;
      el.classList.add('sin-saldo');
      avisarSistema(`Puntos insuficientes: faltan ${formatearPuntos(faltan)}. Sigue explorando la historia para ganar más.`, { duracionMs: 4500 });
      return;
    }

    const etiqueta = el.querySelector('.tienda-etiqueta');
    compraPendiente = {
      id: compra.id,
      el,
      textoOriginal: etiqueta ? etiqueta.textContent : '',
      timeoutId: setTimeout(cancelarCompraPendiente, 4000)
    };
    if (etiqueta) etiqueta.textContent = `¿Confirmar? ◈ ${formatearPuntos(compra.precio)}`;
    el.classList.add('confirmando');
  }

  function ejecutarCompra(compra) {
    if (!gastarPuntos(compra.precio, `Compra: ${compra.titulo}`)) return;
    registrarCompra(compra.id);
    reproducirSFX('assets/audio/points.mp3');
    avisarSistema(`Contenido desbloqueado: «${compra.titulo}». −${formatearPuntos(compra.precio)} puntos.`, { duracionMs: 4000 });
    renderizarFragmentos();
    renderizarGaleria();
    if (compra.alComprar) compra.alComprar();
  }

  // --- Hub de contenido adicional ---
  // Es una capa fija sobre el lector: el estado de lectura (capítulo, página,
  // scroll) no se toca, así que "Volver" lo deja exactamente donde estaba.

  let hubRenderizado = false;

  function abrirHubExtras() {
    if (!extras) return;
    renderizarFragmentos();
    renderizarGaleria();
    hubRenderizado = true;
    document.body.classList.add('extras-activo');
    elExtrasHub.classList.remove('hidden');
    elExtrasHub.scrollTop = 0;
    void elExtrasHub.offsetWidth;
    elExtrasHub.classList.add('visible');
    elBtnExtrasVolver.focus({ preventScroll: true });
  }

  function cerrarHubExtras() {
    cancelarCompraPendiente();
    cerrarGaleria();
    elExtrasHub.classList.remove('visible');
    document.body.classList.remove('extras-activo');
    setTimeout(() => {
      if (!elExtrasHub.classList.contains('visible')) elExtrasHub.classList.add('hidden');
    }, 400);
  }

  function renderizarFragmentos() {
    const fragmentos = extras.fragmentos || [];
    if (!fragmentos.length) {
      elExtrasFragmentos.innerHTML = '<p class="comments-panel-empty">Aún no hay fragmentos disponibles.</p>';
      return;
    }
    // Conserva cuál estaba abierto al volver a dibujar (p. ej. tras una compra).
    const abierto = elExtrasFragmentos.querySelector('.fragmento.abierto');
    const indiceAbierto = abierto ? Number(abierto.dataset.indice) : -1;

    elExtrasFragmentos.innerHTML = fragmentos.map((f, i) => {
      const idCuerpo = `fragmento-cuerpo-${i}`;
      const disponible = estaDisponible(f, 'fragmento', i);
      const precio = precioDe(f, 'fragmento');
      const titulo = f.titulo || `Fragmento ${i + 1}`;
      const cuerpo = disponible
        ? (f.parrafos || []).map(p => `<p>${procesarParrafo(p)}</p>`).join('')
        : `<p class="tienda-aviso">Fragmento bloqueado. Puedes desbloquearlo con los puntos que ganaste explorando la historia.</p>
           <button class="tienda-comprar" data-indice="${i}">
             <span class="tienda-etiqueta">Desbloquear · ◈ ${formatearPuntos(precio)}</span>
           </button>`;
      return `<div class="fragmento${disponible ? '' : ' bloqueado'}${i === indiceAbierto ? ' abierto' : ''}" data-indice="${i}">
        <button class="fragmento-toggle" aria-expanded="${i === indiceAbierto}" aria-controls="${idCuerpo}">
          <span class="fragmento-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="fragmento-textos">
            <span class="fragmento-titulo">${escapeHtml(titulo)}</span>
            ${f.descripcion ? `<span class="fragmento-desc">${escapeHtml(f.descripcion)}</span>` : ''}
          </span>
          ${disponible ? '' : `<span class="fragmento-precio">◈ ${formatearPuntos(precio)}</span>`}
          <span class="fragmento-chevron" aria-hidden="true"></span>
        </button>
        <div class="fragmento-cuerpo" id="${idCuerpo}" role="region">
          <div class="fragmento-cuerpo-interior">${cuerpo}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Acordeón: solo un fragmento abierto a la vez.
  function alternarFragmento(elToggle) {
    const elFragmento = elToggle.closest('.fragmento');
    const abrir = !elFragmento.classList.contains('abierto');
    elExtrasFragmentos.querySelectorAll('.fragmento.abierto').forEach(el => {
      el.classList.remove('abierto');
      el.querySelector('.fragmento-toggle').setAttribute('aria-expanded', 'false');
    });
    if (abrir) {
      elFragmento.classList.add('abierto');
      elToggle.setAttribute('aria-expanded', 'true');
    }
  }

  elExtrasFragmentos.addEventListener('click', (evento) => {
    const comprar = evento.target.closest('.tienda-comprar');
    if (comprar) {
      const i = Number(comprar.dataset.indice);
      const f = extras.fragmentos[i];
      intentarCompra(comprar, {
        id: idDeCompra(f, 'fragmento', i),
        precio: precioDe(f, 'fragmento'),
        titulo: f.titulo || `Fragmento ${i + 1}`
      });
      return;
    }
    const toggle = evento.target.closest('.fragmento-toggle');
    if (toggle) alternarFragmento(toggle);
  });

  elBtnExtrasVolver.addEventListener('click', () => {
    reproducirSFX('assets/audio/click.mp3');
    cerrarHubExtras();
  });

  // --- Galería multimedia (modal sobre el hub) ---

  function renderizarGaleria() {
    const galeria = extras.galeria || {};
    const ilustraciones = galeria.ilustraciones || [];
    const pistas = galeria.pistas || [];

    elGaleriaIlustraciones.innerHTML = ilustraciones.length
      ? ilustraciones.map((il, i) => {
          const disponible = estaDisponible(il, 'ilustracion', i);
          const precio = precioDe(il, 'ilustracion');
          return `<button class="galeria-item${disponible ? '' : ' bloqueado'}" data-indice="${i}"
              aria-label="${escapeHtml(disponible ? (il.titulo || 'Ilustración') : `${il.titulo || 'Ilustración'}: bloqueada, ${precio} puntos`)}">
            <img src="${escapeHtml(il.archivo)}" alt="" loading="lazy" decoding="async" />
            ${disponible ? '' : `<span class="galeria-candado"><span class="tienda-etiqueta">◈ ${formatearPuntos(precio)}</span></span>`}
            <span class="galeria-item-titulo">${escapeHtml(il.titulo || '')}</span>
          </button>`;
        }).join('')
      : '<p class="comments-panel-empty">Aún no hay ilustraciones.</p>';

    // Las pistas usan el mismo mini-reproductor que los marcadores del texto.
    elGaleriaPistas.innerHTML = pistas.length
      ? pistas.map((p, i) => {
          const disponible = estaDisponible(p, 'pista', i);
          const precio = precioDe(p, 'pista');
          return `<button class="galeria-pista${disponible ? '' : ' bloqueado'}" data-indice="${i}" data-ruta="${escapeHtml(p.archivo)}" data-etiqueta="${escapeHtml(p.titulo || '')}">
            <span class="audio-marker-btn" aria-hidden="true"><span class="music-wave"></span></span>
            <span class="galeria-pista-titulo">${escapeHtml(p.titulo || p.archivo)}</span>
            <span class="galeria-pista-estado">${disponible ? '' : `<span class="tienda-etiqueta">◈ ${formatearPuntos(precio)}</span>`}</span>
          </button>`;
        }).join('')
      : '<p class="comments-panel-empty">Aún no hay pistas de audio.</p>';

    actualizarUIAudioExtras();
  }

  function actualizarUIAudioExtras() {
    if (!hubRenderizado) return;
    elGaleriaPistas.querySelectorAll('.galeria-pista:not(.bloqueado)').forEach(el => {
      const esActiva = marcadorActivo && marcadorActivo.ruta === el.dataset.ruta;
      el.classList.toggle('playing', Boolean(esActiva && reproduciendo));
      el.classList.toggle('paused', Boolean(esActiva && !reproduciendo));
      el.querySelector('.galeria-pista-estado').textContent = esActiva ? (reproduciendo ? 'Sonando' : 'En pausa') : '';
    });
  }

  function mostrarPestanaGaleria(nombre) {
    cancelarCompraPendiente();
    elGaleriaOverlay.querySelectorAll('.galeria-tab').forEach(tab => {
      const activa = tab.dataset.tab === nombre;
      tab.classList.toggle('activo', activa);
      tab.setAttribute('aria-selected', String(activa));
    });
    elGaleriaIlustraciones.classList.toggle('hidden', nombre !== 'ilustraciones');
    elGaleriaPistas.classList.toggle('hidden', nombre !== 'pistas');
    cerrarVisorGaleria();
  }

  function abrirGaleria() {
    mostrarPestanaGaleria('ilustraciones');
    elGaleriaOverlay.classList.remove('hidden');
  }

  function cerrarGaleria() {
    cancelarCompraPendiente();
    cerrarVisorGaleria();
    elGaleriaOverlay.classList.add('hidden');
  }

  function abrirVisorGaleria(indice) {
    const il = ((extras.galeria || {}).ilustraciones || [])[indice];
    if (!il) return;
    elGaleriaVisorImg.src = il.archivo;
    elGaleriaVisorImg.alt = il.titulo || 'Ilustración';
    elGaleriaVisorCaption.textContent = [il.titulo, il.caption].filter(Boolean).join(' — ');
    elGaleriaVisor.classList.remove('hidden');
  }

  function cerrarVisorGaleria() {
    elGaleriaVisor.classList.add('hidden');
  }

  elBtnAbrirGaleria.addEventListener('click', () => {
    reproducirSFX('assets/audio/click.mp3');
    abrirGaleria();
  });
  elCloseGaleria.addEventListener('click', cerrarGaleria);
  elCloseGaleriaVisor.addEventListener('click', cerrarVisorGaleria);
  elGaleriaOverlay.addEventListener('click', (evento) => {
    if (evento.target === elGaleriaOverlay) cerrarGaleria();
    const tab = evento.target.closest('.galeria-tab');
    if (tab) mostrarPestanaGaleria(tab.dataset.tab);
  });
  elGaleriaIlustraciones.addEventListener('click', (evento) => {
    const item = evento.target.closest('.galeria-item');
    if (!item) return;
    const i = Number(item.dataset.indice);
    const il = extras.galeria.ilustraciones[i];
    if (item.classList.contains('bloqueado')) {
      intentarCompra(item, {
        id: idDeCompra(il, 'ilustracion', i),
        precio: precioDe(il, 'ilustracion'),
        titulo: il.titulo || 'Ilustración',
        alComprar: () => abrirVisorGaleria(i)
      });
      return;
    }
    abrirVisorGaleria(i);
  });
  elGaleriaPistas.addEventListener('click', (evento) => {
    const pista = evento.target.closest('.galeria-pista');
    if (!pista) return;
    if (pista.classList.contains('bloqueado')) {
      const i = Number(pista.dataset.indice);
      const p = extras.galeria.pistas[i];
      intentarCompra(pista, {
        id: idDeCompra(p, 'pista', i),
        precio: precioDe(p, 'pista'),
        titulo: p.titulo || 'Pista de audio'
      });
      return;
    }
    toggleAudioPista(pista.dataset.ruta, pista.dataset.etiqueta);
  });

  // Escape cierra la capa superior; mientras haya una capa de extras abierta,
  // las flechas no pasan páginas del lector que queda debajo.
  function manejarTeclaExtras(evento) {
    const esEscape = evento.key === 'Escape';
    if (!elFinOverlay.classList.contains('hidden')) {
      if (esEscape) cerrarModalFin();
      return true;
    }
    if (!elGaleriaOverlay.classList.contains('hidden')) {
      if (esEscape) {
        if (!elGaleriaVisor.classList.contains('hidden')) cerrarVisorGaleria();
        else cerrarGaleria();
      }
      return true;
    }
    if (elExtrasHub.classList.contains('visible')) {
      if (esEscape) cerrarHubExtras();
      return true;
    }
    return false;
  }

  // ============================================================
  // DESCUBRIMIENTOS + REPRODUCTOR MP3 DE MIDNIGHT_SUN
  // Descubrimientos: registro de lo que quien lee ya encontró ("secreto:<id>";
  // en la Fase 2 también pistas y bugs). Sirve para desbloquear canciones.
  // Reproductor: playlist de YouTube dentro del escritorio secreto. El video
  // queda visible (YouTube no permite usar solo el audio) y se carga desde
  // youtube-nocookie.com. Config en escritorio-secreto.js → objeto mp3.png.
  // ============================================================

  const Descubrimientos = (function () {
    const CLAVE = 'novela-interactiva-descubrimientos-v1';
    function cargar() {
      try {
        return new Set(JSON.parse(localStorage.getItem(CLAVE)) || []);
      } catch (err) {
        return new Set();
      }
    }
    return {
      // Devuelve true solo la primera vez (para dar puntos una sola vez).
      registrar(clave) {
        const conjunto = cargar();
        if (conjunto.has(clave)) return false;
        conjunto.add(clave);
        try {
          localStorage.setItem(CLAVE, JSON.stringify([...conjunto]));
        } catch (err) {
          // sin almacenamiento: el descubrimiento vale solo en esta visita
        }
        return true;
      },
      tiene(clave) {
        return cargar().has(clave);
      },
      // Cuántos descubrimientos hay de un tipo ("secreto", "bug", "capitulo"...)
      contar(tipo) {
        let n = 0;
        cargar().forEach(clave => { if (clave.startsWith(tipo + ':')) n++; });
        return n;
      }
    };
  })();

  const elMp3Overlay = document.getElementById('mp3-overlay');
  const elMp3Ruta = document.getElementById('mp3-ruta');
  const elMp3Lista = document.getElementById('mp3-lista');
  const elMp3Estado = document.getElementById('mp3-pantalla-estado');
  const elMp3Lcd = document.getElementById('mp3-lcd-texto');
  const elMp3Play = document.getElementById('mp3-play');
  const elMp3Anterior = document.getElementById('mp3-anterior');
  const elMp3Siguiente = document.getElementById('mp3-siguiente');
  const elMp3Nota = document.getElementById('mp3-nota');
  const elCloseMp3 = document.getElementById('close-mp3');
  const elMp3Externo = document.getElementById('mp3-externo');

  // Abierta con doble clic (file://), la página no puede decirle a YouTube desde
  // qué sitio se incrusta el video, y YouTube rechaza todo con el error 153.
  const PAGINA_COMO_ARCHIVO = window.location.protocol === 'file:';
  const MENSAJE_SIN_SITIO = '> error: el reproductor no funciona con la página abierta como archivo. Ábrela desde el sitio publicado o un servidor local_';

  const mp3 = {
    config: null,
    indice: -1,               // pista seleccionada
    player: null,             // YT.Player, creado la primera vez que se reproduce
    listo: false,
    sonando: false,
    musicaPausada: false,     // se pausó la música del mini-reproductor al reproducir
    danadas: new Set(),       // pistas que YouTube no deja reproducir incrustadas
    indiceClave: -1,          // pista protegida cuya contraseña se está pidiendo
    fallaGeneral: false       // YouTube rechazó el reproductor entero (no una pista en particular)
  };

  let promesaYouTube = null;

  // Carga la API de YouTube solo cuando quien lee abre el MP3 (no antes).
  function cargarYouTube() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (promesaYouTube) return promesaYouTube;
    promesaYouTube = new Promise((resolve, reject) => {
      const previo = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previo === 'function') previo();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        promesaYouTube = null;
        reject(new Error('No se pudo conectar con YouTube'));
      };
      document.head.appendChild(script);
    });
    return promesaYouTube;
  }

  // 'clave:<contraseña>' → la contraseña correcta queda registrada como el
  // descubrimiento "mp3:<código del video>", así sigue desbloqueada al volver.
  function claveDePista(pista) {
    const condicion = String(pista.desbloqueo || '').trim();
    return /^clave:/i.test(condicion) ? condicion.slice(6).trim() : null;
  }

  function pistaDesbloqueada(pista) {
    const condicion = String(pista.desbloqueo || 'siempre').trim();
    if (condicion === 'siempre') return true;
    if (claveDePista(pista) !== null) return Descubrimientos.tiene(`mp3:${pista.youtube}`);
    return Descubrimientos.tiene(condicion);
  }

  function pistaDisponible(i) {
    const pista = mp3.config.pistas[i];
    return Boolean(pista) && pistaDesbloqueada(pista) && !mp3.danadas.has(i);
  }

  // "Happy Face" → "happy_face.mp3", como lo guardaría en su carpeta.
  function nombreDeArchivo(pista) {
    const base = String(pista.titulo || 'pista')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (base || 'pista') + '.mp3';
  }

  function renderizarListaMp3() {
    elMp3Lista.innerHTML = mp3.config.pistas.map((pista, i) => {
      const numero = String(i + 1).padStart(2, '0');
      if (!pistaDesbloqueada(pista) && claveDePista(pista) !== null) {
        // Protegida con contraseña: se puede tocar para pedirla.
        return `<li><button class="mp3-archivo cifrado con-clave${i === mp3.indiceClave ? ' actual' : ''}" data-clave="${i}"
          aria-label="Archivo ${numero}, cifrado con contraseña. Introducir la clave">
          <span class="mp3-archivo-num">${numero}</span>
          <span class="mp3-archivo-nombre">▒▒▒▒▒▒▒▒.mp3</span>
          <span class="mp3-archivo-etiqueta">[clave]</span>
        </button></li>`;
      }
      if (!pistaDesbloqueada(pista)) {
        return `<li><button class="mp3-archivo cifrado" disabled aria-label="Archivo ${numero}, cifrado">
          <span class="mp3-archivo-num">${numero}</span>
          <span class="mp3-archivo-nombre">▒▒▒▒▒▒▒▒.mp3</span>
          <span class="mp3-archivo-etiqueta">[cifrado]</span>
        </button></li>`;
      }
      const danada = mp3.danadas.has(i);
      const actual = i === mp3.indice;
      return `<li><button class="mp3-archivo${actual ? ' actual' : ''}${danada ? ' danado' : ''}" data-indice="${i}"
          ${actual ? 'aria-current="true"' : ''} ${danada ? 'disabled' : ''}
          aria-label="${escapeHtml(`${numero}. ${pista.titulo} — ${pista.artista || ''}`)}">
          <span class="mp3-archivo-num">${numero}</span>
          <span class="mp3-archivo-nombre">${escapeHtml(nombreDeArchivo(pista))}</span>
          <span class="mp3-archivo-etiqueta">${danada ? '[dañado]' : actual && mp3.sonando ? '▶' : ''}</span>
        </button></li>`;
    }).join('');
  }

  function actualizarPantallaMp3() {
    const pista = mp3.config && mp3.config.pistas[mp3.indice];
    elMp3Play.textContent = mp3.sonando ? '❚❚' : '▶';
    elMp3Play.setAttribute('aria-label', mp3.sonando ? 'Pausar' : 'Reproducir');
    elMp3Lcd.textContent = pista ? `${mp3.sonando ? '▶' : '❚❚'} ${pista.titulo} — ${pista.artista || ''}` : '— sin reproducir —';
    elMp3Nota.textContent = pista && pista.nota ? `> nota.txt: ${pista.nota}` : '';
    elMp3Nota.classList.toggle('hidden', !(pista && pista.nota));
    renderizarListaMp3();
  }

  // Plan B cuando el reproductor no puede cargar aquí: la misma canción (y la
  // lista, si está configurada) directamente en YouTube, en otra pestaña.
  function mostrarEnlaceExterno() {
    const pista = mp3.config && mp3.config.pistas[mp3.indice];
    const lista = mp3.config && mp3.config.listaYoutube;
    if (!pista && !lista) return;
    const url = new URL('https://www.youtube.com/watch');
    if (pista) url.searchParams.set('v', pista.youtube);
    if (lista) url.searchParams.set('list', lista);
    elMp3Externo.href = pista ? url.toString() : `https://www.youtube.com/playlist?list=${encodeURIComponent(lista)}`;
    elMp3Externo.classList.remove('hidden');
  }

  function avisarFallaGeneral(mensaje) {
    mp3.fallaGeneral = true;
    mp3.sonando = false;
    elMp3Estado.textContent = mensaje;
    mostrarEnlaceExterno();
    actualizarPantallaMp3();
  }

  function abrirReproductor(config) {
    if (!config || !Array.isArray(config.pistas) || !config.pistas.length) return;
    if (mp3.config !== config) {
      mp3.config = config;
      mp3.indice = -1;
    }
    elMp3Ruta.textContent = config.carpeta || '~/';
    if (mp3.indice === -1) mp3.indice = config.pistas.findIndex((_, i) => pistaDisponible(i));
    actualizarPantallaMp3();
    elMp3Overlay.classList.remove('hidden');
    elMp3Play.focus({ preventScroll: true });
    if (PAGINA_COMO_ARCHIVO) {
      avisarFallaGeneral(MENSAJE_SIN_SITIO);
      return;
    }
    // Precarga la API para que el primer "play" responda rápido.
    cargarYouTube().catch(() => {
      avisarFallaGeneral('> error: sin conexión con el servidor de música_');
    });
  }

  function cerrarReproductor() {
    if (elMp3Overlay.classList.contains('hidden')) return;
    ocultarClave();
    if (mp3.player && mp3.listo) mp3.player.pauseVideo();
    mp3.sonando = false;
    elMp3Overlay.classList.add('hidden');
    if (mp3.musicaPausada && !reproduciendo) reanudarMusica();
    mp3.musicaPausada = false;
  }

  function reproducirPista(i) {
    if (!mp3.config || !pistaDisponible(i)) return;
    mp3.indice = i;
    const pista = mp3.config.pistas[i];
    if (PAGINA_COMO_ARCHIVO) {
      avisarFallaGeneral(MENSAJE_SIN_SITIO);
      return;
    }
    mp3.fallaGeneral = false;
    elMp3Externo.classList.add('hidden');
    elMp3Estado.textContent = `> cargando ${nombreDeArchivo(pista)}..._`;
    actualizarPantallaMp3();

    if (mp3.player && mp3.listo) {
      mp3.player.loadVideoById(pista.youtube);
      return;
    }
    if (mp3.player) return; // aún creándose: onReady reproducirá la pista seleccionada

    cargarYouTube().then(YT => {
      mp3.player = new YT.Player('mp3-player', {
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        videoId: mp3.config.pistas[mp3.indice].youtube,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            mp3.listo = true;
            mp3.player.setVolume(Math.round(Preferencias.volumen() * 100));
            mp3.player.playVideo();
          },
          onStateChange: manejarEstadoMp3,
          onError: manejarErrorMp3
        }
      });
    }).catch(() => {
      avisarFallaGeneral('> error: sin conexión con el servidor de música_');
    });
  }

  function manejarEstadoMp3(evento) {
    const YT = window.YT;
    if (evento.data === YT.PlayerState.PLAYING) {
      mp3.sonando = true;
      elMp3Estado.textContent = '';
      // Una sola música a la vez: la del mini-reproductor se pausa y vuelve al cerrar.
      if (reproduciendo) {
        mp3.musicaPausada = true;
        pausarMusica();
      }
    } else if (evento.data === YT.PlayerState.PAUSED) {
      mp3.sonando = false;
    } else if (evento.data === YT.PlayerState.ENDED) {
      mp3.sonando = false;
      const siguiente = indiceVecino(1);
      if (siguiente !== -1 && siguiente !== mp3.indice) {
        reproducirPista(siguiente);
        return;
      }
    }
    actualizarPantallaMp3();
  }

  // Errores de UNA pista (se marca [dañado] y se salta a la siguiente):
  //   2 = código de video inválido · 100 = eliminado o privado ·
  //   101 / 150 = quien lo subió no permite reproducirlo fuera de YouTube.
  // Cualquier otro (5, 152, 153...) es del reproductor entero: marcar las pistas
  // una por una solo las "dañaría" todas, así que se avisa y se ofrece YouTube.
  const ERRORES_DE_PISTA = [2, 100, 101, 150];

  function manejarErrorMp3(evento) {
    if (!ERRORES_DE_PISTA.includes(evento.data)) {
      avisarFallaGeneral(evento.data === 153
        ? '> error 153: YouTube no reconoce desde qué sitio se abre el reproductor. Ábrelo desde el sitio publicado o un servidor local_'
        : `> error ${evento.data}: el reproductor no pudo cargar_`);
      return;
    }
    mp3.danadas.add(mp3.indice);
    mp3.sonando = false;
    elMp3Estado.textContent = '> error: archivo dañado, no se puede reproducir aquí_';
    actualizarPantallaMp3();
    const siguiente = indiceVecino(1);
    if (siguiente !== -1) setTimeout(() => reproducirPista(siguiente), 1500);
  }

  // Siguiente (+1) o anterior (−1) pista disponible, dando la vuelta a la lista.
  function indiceVecino(direccion) {
    const total = mp3.config.pistas.length;
    for (let paso = 1; paso <= total; paso++) {
      const i = (mp3.indice + direccion * paso + total * paso) % total;
      if (pistaDisponible(i)) return i;
    }
    return -1;
  }

  elMp3Lista.addEventListener('click', (evento) => {
    const conClave = evento.target.closest('.mp3-archivo[data-clave]');
    if (conClave) {
      pedirClave(Number(conClave.dataset.clave));
      return;
    }
    const boton = evento.target.closest('.mp3-archivo[data-indice]');
    if (boton && !boton.disabled) {
      ocultarClave();
      reproducirPista(Number(boton.dataset.indice));
    }
  });

  // --- Archivos protegidos con contraseña ---
  const elMp3Clave = document.getElementById('mp3-clave');
  const elMp3ClaveArchivo = document.getElementById('mp3-clave-archivo');
  const elMp3ClavePista = document.getElementById('mp3-clave-pista');
  const elMp3ClaveInput = document.getElementById('mp3-clave-input');
  const elMp3ClaveRespuesta = document.getElementById('mp3-clave-respuesta');
  let descifrando = false;

  function pedirClave(i) {
    const pista = mp3.config.pistas[i];
    mp3.indiceClave = i;
    elMp3ClaveArchivo.textContent = `> el archivo ${String(i + 1).padStart(2, '0')} está cifrado.`;
    elMp3ClavePista.textContent = pista.pistaClave ? `> pista: ${pista.pistaClave}` : '';
    elMp3ClavePista.classList.toggle('hidden', !pista.pistaClave);
    elMp3ClaveRespuesta.textContent = '';
    elMp3ClaveRespuesta.className = 'mp3-clave-linea mp3-clave-respuesta';
    elMp3ClaveInput.value = '';
    elMp3Clave.classList.remove('hidden');
    renderizarListaMp3();
    elMp3ClaveInput.focus();
  }

  function ocultarClave() {
    mp3.indiceClave = -1;
    elMp3Clave.classList.add('hidden');
  }

  elMp3Clave.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (descifrando || mp3.indiceClave === -1) return;
    const i = mp3.indiceClave;
    const pista = mp3.config.pistas[i];
    const intento = elMp3ClaveInput.value.trim().toLowerCase();

    if (intento && intento === claveDePista(pista).toLowerCase()) {
      descifrando = true;
      elMp3ClaveRespuesta.textContent = '> clave aceptada. descifrando..._';
      elMp3ClaveRespuesta.className = 'mp3-clave-linea mp3-clave-respuesta exito';
      reproducirSFX('assets/audio/glitch.mp3');
      descubrir(`mp3:${pista.youtube}`);
      setTimeout(() => {
        descifrando = false;
        ocultarClave();
        reproducirPista(i);
      }, 1100);
      return;
    }

    elMp3ClaveRespuesta.textContent = '> acceso denegado_';
    elMp3ClaveRespuesta.className = 'mp3-clave-linea mp3-clave-respuesta error';
    elMp3ClaveInput.value = '';
    elMp3ClaveInput.focus();
  });

  elMp3Play.addEventListener('click', () => {
    if (mp3.player && mp3.listo && mp3.indice !== -1) {
      mp3.sonando ? mp3.player.pauseVideo() : mp3.player.playVideo();
    } else if (mp3.indice !== -1) {
      reproducirPista(mp3.indice);
    }
  });

  elMp3Anterior.addEventListener('click', () => {
    const i = indiceVecino(-1);
    if (i !== -1) reproducirPista(i);
  });

  elMp3Siguiente.addEventListener('click', () => {
    const i = indiceVecino(1);
    if (i !== -1) reproducirPista(i);
  });

  elCloseMp3.addEventListener('click', cerrarReproductor);

  document.addEventListener('preferencias-cambiadas', () => {
    if (mp3.player && mp3.listo) mp3.player.setVolume(Math.round(Preferencias.volumen() * 100));
  });

  // ============================================================
  // SALAS ESPECIALES (Fase 3): Sala de evidencias (tablero de Jian Lin) y
  // Archivo de personajes (expediente). Se abren desde el menú de museo.
  // Contenido en tablero.js y expediente.js, que se editan a mano.
  // ============================================================

  const configTablero = (typeof CONFIG_TABLERO !== 'undefined' && CONFIG_TABLERO) || {};
  const pistasTablero = configTablero.pistas || {};
  const conexionesTablero = configTablero.conexiones || [];
  const personajesExpediente = ((typeof CONFIG_EXPEDIENTE !== 'undefined' && CONFIG_EXPEDIENTE) || {}).personajes || [];

  // Las salas a pantalla completa suben el contador de puntos y el
  // mini-reproductor por encima, y bloquean el scroll del lector de atrás.
  function marcarSalaActiva(activa) {
    document.body.classList.toggle('sala-activa', activa);
  }

  // --- Sala de evidencias ---

  const elTablero = document.getElementById('tablero');
  const elTableroCorcho = document.getElementById('tablero-corcho');
  const elTableroContador = document.getElementById('tablero-contador');
  const elTableroDetalle = document.getElementById('tablero-detalle');
  const elTableroDeducciones = document.getElementById('tablero-deducciones');
  const elTableroAyuda = document.getElementById('tablero-ayuda');
  const elBitacora = document.getElementById('tablero-bitacora');
  const elCerrarTablero = document.getElementById('cerrar-tablero');
  const CLAVE_BITACORA = 'novela-interactiva-bitacora-v1';

  let pistaElegida = null;   // la tarjeta cuyo detalle se muestra
  let uniendoDesde = null;   // modo "unir con hilo rojo": la primera pista

  function claveConexion(a, b) {
    return `conexion:${[a, b].sort().join('+')}`;
  }

  function conexionEntre(a, b) {
    if (a === b) return null;
    return conexionesTablero.find(c => Array.isArray(c.pistas) && c.pistas.includes(a) && c.pistas.includes(b)) || null;
  }

  function capituloDePista(id) {
    return capitulos.find(c => c.parrafos.some(p => p.includes(`[pista:${id}|`))) || null;
  }

  function tituloDePista(id) {
    return (pistasTablero[id] && pistasTablero[id].titulo) || id;
  }

  // Tocar una pista en el texto: la primera vez se clava en el tablero;
  // después, abre la Sala de evidencias en esa tarjeta.
  function tocarPista(el) {
    const id = el.dataset.pista;
    if (!pistasTablero[id]) {
      console.warn(`Pista sin definir en tablero.js: ${id}`);
      return;
    }
    const clave = `pista:${id}`;
    if (Descubrimientos.tiene(clave)) {
      abrirTablero(id);
      return;
    }
    const puntos = Number((recompensas.puntos || {}).pista) || 0;
    reproducirSFX('assets/audio/click.mp3');
    avisarSistema(`Pista añadida a la Sala de evidencias: «${tituloDePista(id)}».${puntos ? ` +${formatearPuntos(puntos)} puntos.` : ''}`, {
      duracionMs: 5000,
      accion: { etiqueta: 'Ver tablero', alHacerClic: () => abrirTablero(id) }
    });
    descubrir(clave, { silencioso: true });
    el.classList.add('encontrada', 'clavando');
    el.setAttribute('aria-label', `${el.textContent}: pista en el tablero. Abrir la Sala de evidencias`);
    setTimeout(() => el.classList.remove('clavando'), 700);
    volarChincheta(el);
  }

  // Una chincheta "vuela" en arco desde la palabra hasta el botón del
  // recorrido (donde está la Sala de evidencias), que la recibe con un pulso.
  // Así la lectora aprende, sin explicación, dónde quedó guardada la pista.
  function volarChincheta(desde) {
    if (Preferencias.reducirMovimiento()) return;
    const destino = document.getElementById('btn-chapter-menu');
    if (!destino || !document.body.animate) return;
    const dockOculto = elDock.classList.contains('oculto');
    mostrarDock();
    // En celular, si la barra estaba escondida, se espera a que vuelva a su lugar.
    setTimeout(() => {
      const a = desde.getBoundingClientRect();
      const b = destino.getBoundingClientRect();
      if (!b.width) return;
      const x0 = a.left + a.width / 2;
      const y0 = a.top + a.height / 2;
      const dx = b.left + b.width / 2 - x0;
      const dy = b.top + b.height / 2 - y0;
      const alturaArco = Math.min(0, dy) - 90; // sube primero, luego cae sobre el botón
      const chincheta = document.createElement('span');
      chincheta.className = 'chincheta-voladora';
      chincheta.setAttribute('aria-hidden', 'true');
      chincheta.style.left = `${x0}px`;
      chincheta.style.top = `${y0}px`;
      document.body.appendChild(chincheta);
      const vuelo = chincheta.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${alturaArco}px)) scale(1.35)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7)`, opacity: 1, offset: 0.9 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`, opacity: 0 }
      ], { duration: 950, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' });
      vuelo.onfinish = () => {
        chincheta.remove();
        destino.classList.remove('recibe');
        void destino.offsetWidth;
        destino.classList.add('recibe');
        setTimeout(() => destino.classList.remove('recibe'), 650);
      };
    }, dockOculto ? 380 : 0);
  }

  function abrirTablero(idEnfocado) {
    uniendoDesde = null;
    pistaElegida = idEnfocado && Descubrimientos.tiene(`pista:${idEnfocado}`) ? idEnfocado : null;
    renderizarTablero();
    marcarSalaActiva(true);
    elTablero.classList.remove('hidden');
    void elTablero.offsetWidth;
    elTablero.classList.add('visible');
    requestAnimationFrame(dibujarHilos);
    const enfocar = pistaElegida && elTableroCorcho.querySelector(`[data-pista="${pistaElegida}"]`);
    (enfocar || elCerrarTablero).focus({ preventScroll: true });
  }

  function cerrarTablero() {
    if (elTablero.classList.contains('hidden')) return;
    uniendoDesde = null;
    elTablero.classList.remove('visible');
    elTablero.classList.add('hidden');
    marcarSalaActiva(false);
  }

  function renderizarTablero() {
    const ids = Object.keys(pistasTablero);
    const encontradas = ids.filter(id => Descubrimientos.tiene(`pista:${id}`));
    elTableroContador.textContent = `${encontradas.length}/${ids.length}`;

    elTableroCorcho.innerHTML = ids.map((id, i) => {
      if (!Descubrimientos.tiene(`pista:${id}`)) {
        return `<div class="tablero-tarjeta oculta" style="--i: ${i}" aria-hidden="true">
          <span class="tablero-chincheta"></span><span class="tablero-incognita">?</span>
        </div>`;
      }
      const pista = pistasTablero[id];
      const cap = capituloDePista(id);
      const clases = [
        'tablero-tarjeta',
        pista.imagen ? 'con-imagen' : '',
        id === pistaElegida ? 'elegida' : '',
        id === uniendoDesde ? 'origen' : '',
        uniendoDesde && id !== uniendoDesde ? 'destino-posible' : ''
      ].filter(Boolean).join(' ');
      return `<button class="${clases}" data-pista="${escapeHtml(id)}" style="--i: ${i}" aria-pressed="${id === pistaElegida}">
        <span class="tablero-chincheta" aria-hidden="true"></span>
        ${pista.imagen ? `<img src="${escapeHtml(pista.imagen)}" alt="" loading="lazy" decoding="async" />` : ''}
        <span class="tablero-tarjeta-titulo">${escapeHtml(tituloDePista(id))}</span>
        ${cap ? `<span class="tablero-tarjeta-cap">Cap. ${escapeHtml(cap.numero)}</span>` : ''}
      </button>`;
    }).join('') + '<svg class="tablero-hilos" aria-hidden="true"></svg>';

    elTableroAyuda.textContent = uniendoDesde
      ? `Elige la pista que quieres unir con «${tituloDePista(uniendoDesde)}». Escape para cancelar.`
      : encontradas.length > 1 ? 'Elige una pista para ver la nota de Jian o unirla con otra.' : 'Elige la pista para ver la nota de Jian.';

    renderizarDetallePista();
    renderizarDeducciones();
    try {
      elBitacora.value = localStorage.getItem(CLAVE_BITACORA) || '';
    } catch (err) {
      // sin almacenamiento: la bitácora vale solo en esta visita
    }
  }

  function renderizarDetallePista() {
    if (!pistaElegida) {
      elTableroDetalle.innerHTML = '<p class="tablero-detalle-vacio">Ninguna pista seleccionada.</p>';
      return;
    }
    const pista = pistasTablero[pistaElegida];
    const cap = capituloDePista(pistaElegida);
    const encontradas = Object.keys(pistasTablero).filter(id => Descubrimientos.tiene(`pista:${id}`));
    elTableroDetalle.innerHTML = `
      <h3 class="tablero-detalle-titulo">${escapeHtml(tituloDePista(pistaElegida))}</h3>
      ${cap ? `<p class="tablero-detalle-cap">Encontrada en el capítulo ${escapeHtml(cap.numero)}, «${escapeHtml(cap.titulo)}»</p>` : ''}
      <p class="tablero-detalle-nota">${escapeHtml(pista.nota || '')}</p>
      ${encontradas.length > 1 ? `<button class="tablero-unir" data-desde="${escapeHtml(pistaElegida)}">Unir con otra pista</button>` : ''}`;
  }

  function renderizarDeducciones() {
    const halladas = conexionesTablero.filter(c => Array.isArray(c.pistas) && c.pistas.length === 2 &&
      Descubrimientos.tiene(claveConexion(c.pistas[0], c.pistas[1])));
    elTableroDeducciones.innerHTML = halladas.length
      ? halladas.map(c => `<li class="tablero-deduccion">
          <span class="tablero-deduccion-pistas">${escapeHtml(tituloDePista(c.pistas[0]))} + ${escapeHtml(tituloDePista(c.pistas[1]))}</span>
          <span class="tablero-deduccion-titulo">${escapeHtml(c.titulo || 'Deducción')}</span>
          <span class="tablero-deduccion-texto">${escapeHtml(c.deduccion || '')}</span>
        </li>`).join('')
      : '<li class="tablero-detalle-vacio">Todavía no hay deducciones. Une dos pistas con hilo rojo.</li>';
  }

  // Hilo rojo entre las chinchetas de cada pareja conectada, con una leve caída.
  function dibujarHilos() {
    const svg = elTableroCorcho.querySelector('.tablero-hilos');
    if (!svg) return;
    const caja = elTableroCorcho.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${caja.width} ${caja.height}`);
    const chincheta = id => {
      const tarjeta = elTableroCorcho.querySelector(`[data-pista="${id}"] .tablero-chincheta`);
      if (!tarjeta) return null;
      const r = tarjeta.getBoundingClientRect();
      return { x: r.left + r.width / 2 - caja.left, y: r.top + r.height / 2 - caja.top };
    };
    svg.innerHTML = conexionesTablero
      .filter(c => Array.isArray(c.pistas) && c.pistas.length === 2 && Descubrimientos.tiene(claveConexion(c.pistas[0], c.pistas[1])))
      .map(c => {
        const a = chincheta(c.pistas[0]);
        const b = chincheta(c.pistas[1]);
        if (!a || !b) return '';
        const caida = Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.15);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2 + caida;
        const nuevo = c === ultimaConexion ? ' nuevo' : '';
        return `<path class="tablero-hilo${nuevo}" d="M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}" />`;
      }).join('');
    ultimaConexion = null;
  }

  let ultimaConexion = null; // para animar solo el hilo recién tendido

  function intentarConexion(a, b) {
    const conexion = conexionEntre(a, b);
    if (!conexion) {
      avisarSistema(`No parece haber relación entre «${tituloDePista(a)}» y «${tituloDePista(b)}»… por ahora. Puedes anotar tu teoría en la bitácora.`, {
        duracionMs: 6000,
        accion: { etiqueta: 'Anotar teoría', alHacerClic: () => anotarTeoria(a, b) }
      });
      return;
    }
    const clave = claveConexion(a, b);
    if (Descubrimientos.tiene(clave)) {
      avisarSistema(`«${tituloDePista(a)}» y «${tituloDePista(b)}» ya están unidas.`, { duracionMs: 3000 });
      return;
    }
    const puntos = Number((recompensas.puntos || {}).conexion) || 0;
    reproducirSFX('assets/audio/points.mp3');
    avisarSistema(`Deducción: «${conexion.titulo || 'Nueva conexión'}».${puntos ? ` +${formatearPuntos(puntos)} puntos.` : ''}`, { duracionMs: 5000, destacado: true });
    descubrir(clave, { silencioso: true });
    ultimaConexion = conexion;
  }

  function anotarTeoria(a, b) {
    const linea = `[${tituloDePista(a)} + ${tituloDePista(b)}] `;
    elBitacora.value = (elBitacora.value.trim() ? elBitacora.value.trimEnd() + '\n\n' : '') + linea;
    guardarBitacora();
    elBitacora.focus();
    elBitacora.setSelectionRange(elBitacora.value.length, elBitacora.value.length);
  }

  let bitacoraTimeoutId = null;
  function guardarBitacora() {
    try {
      localStorage.setItem(CLAVE_BITACORA, elBitacora.value);
    } catch (err) {
      // sin almacenamiento: la bitácora vale solo en esta visita
    }
  }

  elBitacora.addEventListener('input', () => {
    clearTimeout(bitacoraTimeoutId);
    bitacoraTimeoutId = setTimeout(guardarBitacora, 400);
  });

  elTableroCorcho.addEventListener('click', (evento) => {
    const tarjeta = evento.target.closest('.tablero-tarjeta[data-pista]');
    if (!tarjeta) return;
    const id = tarjeta.dataset.pista;
    if (uniendoDesde && id !== uniendoDesde) {
      const desde = uniendoDesde;
      uniendoDesde = null;
      intentarConexion(desde, id);
      pistaElegida = id;
    } else {
      uniendoDesde = null;
      pistaElegida = id;
    }
    renderizarTablero();
    requestAnimationFrame(dibujarHilos);
    const enfocar = elTableroCorcho.querySelector(`[data-pista="${id}"]`);
    if (enfocar) enfocar.focus({ preventScroll: true });
  });

  elTableroDetalle.addEventListener('click', (evento) => {
    const unir = evento.target.closest('.tablero-unir');
    if (!unir) return;
    uniendoDesde = unir.dataset.desde;
    renderizarTablero();
    requestAnimationFrame(dibujarHilos);
    const primera = elTableroCorcho.querySelector('.destino-posible');
    if (primera) primera.focus({ preventScroll: true });
  });

  elCerrarTablero.addEventListener('click', cerrarTablero);
  window.addEventListener('resize', () => {
    if (!elTablero.classList.contains('hidden')) dibujarHilos();
  });

  // --- Archivo de personajes ---

  const elExpediente = document.getElementById('expediente');
  const elExpedienteLista = document.getElementById('expediente-lista');
  const elExpedienteFicha = document.getElementById('expediente-ficha');
  const elCerrarExpediente = document.getElementById('cerrar-expediente');
  let personajeElegido = null;

  function capituloTerminado(numero) {
    return Descubrimientos.tiene(`capitulo:${String(numero || '').padStart(2, '0')}`);
  }

  function personajesVisibles() {
    return personajesExpediente.filter(p => capituloTerminado(p.desde));
  }

  function abrirExpediente(idPersonaje) {
    const visibles = personajesVisibles();
    if (!visibles.length) return;
    // El pedido, o el último que se vio, o el primero.
    const elegido = visibles.find(p => p.id === idPersonaje) || visibles.find(p => p.id === personajeElegido) || visibles[0];
    personajeElegido = elegido.id;
    renderizarExpediente();
    marcarSalaActiva(true);
    elExpediente.classList.remove('hidden');
    void elExpediente.offsetWidth;
    elExpediente.classList.add('visible');
    const actual = elExpedienteLista.querySelector('[aria-current="true"]');
    (actual || elCerrarExpediente).focus({ preventScroll: true });
  }

  function cerrarExpediente() {
    if (elExpediente.classList.contains('hidden')) return;
    elExpediente.classList.remove('visible');
    elExpediente.classList.add('hidden');
    marcarSalaActiva(false);
  }

  function renderizarExpediente() {
    const visibles = personajesVisibles();
    const clasificadas = personajesExpediente.length - visibles.length;
    elExpedienteLista.innerHTML = visibles.map(p => `<li>
        <button class="expediente-pestana" data-personaje="${escapeHtml(p.id)}" ${p.id === personajeElegido ? 'aria-current="true"' : ''}>
          ${escapeHtml(p.nombre)}
        </button>
      </li>`).join('') +
      (clasificadas > 0 ? `<li class="expediente-pendientes">${clasificadas} expediente${clasificadas === 1 ? '' : 's'} más, clasificado${clasificadas === 1 ? '' : 's'}</li>` : '');

    const indice = personajesExpediente.findIndex(p => p.id === personajeElegido);
    const p = personajesExpediente[indice];
    if (!p) {
      elExpedienteFicha.innerHTML = '';
      return;
    }
    const datos = p.datos || [];
    const ocultos = datos.filter(d => !capituloTerminado(d.desde)).length;
    const iniciales = p.nombre.split(/\s+/).map(s => s.charAt(0)).join('').slice(0, 2).toUpperCase();
    elExpedienteFicha.innerHTML = `
      <p class="ficha-encabezado">Expediente n.º ${String(indice + 1).padStart(3, '0')} · ${ocultos ? 'Información parcial' : 'Al día'}</p>
      <div class="ficha-cuerpo">
        <div class="ficha-foto">${p.imagen ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}" loading="lazy" decoding="async" />` : `<span aria-hidden="true">${escapeHtml(iniciales)}</span>`}</div>
        <div class="ficha-identidad">
          <h3 class="ficha-nombre">${escapeHtml(p.nombre)}</h3>
          ${p.alias ? `<p class="ficha-alias">Alias: ${escapeHtml(p.alias)}</p>` : ''}
        </div>
      </div>
      <dl class="ficha-datos">
        ${datos.map(d => capituloTerminado(d.desde)
          ? `<div class="ficha-dato"><dt>${escapeHtml(d.etiqueta)}</dt><dd>${escapeHtml(d.valor)}</dd></div>`
          : `<div class="ficha-dato clasificado"><dt>${escapeHtml(d.etiqueta)}</dt><dd><span class="ficha-tachado" aria-hidden="true">████████</span> [clasificado]</dd></div>`
        ).join('')}
      </dl>
      ${ocultos ? '<span class="ficha-sello" aria-hidden="true">Clasificado</span>' : ''}`;
  }

  // Al terminar un capítulo: si con eso se abre una ficha o un dato, se avisa.
  function avisarNovedadesExpediente(numero) {
    const nuevasFichas = personajesExpediente.filter(p => p.desde === numero).length;
    const nuevosDatos = personajesExpediente
      .filter(p => p.desde !== numero && capituloTerminado(p.desde))
      .reduce((suma, p) => suma + (p.datos || []).filter(d => d.desde === numero).length, 0);
    if (!nuevasFichas && !nuevosDatos) return;
    const partes = [];
    if (nuevasFichas) partes.push(`${nuevasFichas} ficha${nuevasFichas === 1 ? '' : 's'} nueva${nuevasFichas === 1 ? '' : 's'}`);
    if (nuevosDatos) partes.push(`${nuevosDatos} dato${nuevosDatos === 1 ? '' : 's'} desclasificado${nuevosDatos === 1 ? '' : 's'}`);
    avisarSistema(`Archivo de personajes actualizado: ${partes.join(' y ')}.`, {
      duracionMs: 5000,
      accion: { etiqueta: 'Abrir archivo', alHacerClic: () => abrirExpediente() }
    });
  }

  elExpedienteLista.addEventListener('click', (evento) => {
    const pestana = evento.target.closest('.expediente-pestana');
    if (!pestana) return;
    personajeElegido = pestana.dataset.personaje;
    renderizarExpediente();
    const actual = elExpedienteLista.querySelector('[aria-current="true"]');
    if (actual) actual.focus({ preventScroll: true });
  });

  elCerrarExpediente.addEventListener('click', cerrarExpediente);

  // Escape y flechas con una sala abierta (las flechas no pasan páginas por detrás).
  function manejarTeclaSalas(evento) {
    const esEscape = evento.key === 'Escape';
    if (!elMuseo.classList.contains('hidden')) {
      if (esEscape) cerrarMenuCapitulos();
      return true;
    }
    if (!elTablero.classList.contains('hidden')) {
      if (esEscape) {
        if (uniendoDesde) {
          uniendoDesde = null;
          renderizarTablero();
          requestAnimationFrame(dibujarHilos);
        } else {
          cerrarTablero();
        }
      }
      return true;
    }
    if (!elExpediente.classList.contains('hidden')) {
      if (esEscape) cerrarExpediente();
      return true;
    }
    return false;
  }

  // ============================================================
  // EL SISTEMA VIVO (Fase 2): puntos, descubrimientos que suman, logros,
  // bugs reportables, contador en pantalla y "Registro del Sistema".
  // Valores y logros en recompensas.js; todo se guarda en este navegador.
  // ============================================================

  const SistemaStorage = (function () {
    const CLAVE = 'novela-interactiva-sistema-v1';
    function inicial() {
      return { puntos: Number(recompensas.puntosIniciales) || 0, logros: [], compras: [], historial: [] };
    }
    return {
      cargar() {
        try {
          const estado = JSON.parse(localStorage.getItem(CLAVE));
          if (estado && typeof estado.puntos === 'number') return Object.assign(inicial(), estado);
        } catch (err) {
          // dato corrupto o sin almacenamiento: se empieza de cero
        }
        return inicial();
      },
      guardar(estado) {
        try {
          localStorage.setItem(CLAVE, JSON.stringify(estado));
        } catch (err) {
          // sin almacenamiento: los puntos valen solo en esta visita
        }
      }
    };
  })();

  const NOMBRE_DESCUBRIMIENTO = {
    secreto: 'Secreto encontrado',
    bug: 'Error reportado',
    capitulo: 'Capítulo completado',
    puerta: 'Archivo clasificado desbloqueado',
    mp3: 'Archivo descifrado',
    pista: 'Pista encontrada',
    conexion: 'Deducción'
  };

  // "3000" → "3 000"
  function formatearPuntos(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function puntosActuales() {
    return SistemaStorage.cargar().puntos;
  }

  function compraHecha(id) {
    return SistemaStorage.cargar().compras.includes(id);
  }

  function registrarCompra(id) {
    const estado = SistemaStorage.cargar();
    if (!estado.compras.includes(id)) estado.compras.push(id);
    SistemaStorage.guardar(estado);
  }

  function cambiarPuntos(delta, motivo) {
    const estado = SistemaStorage.cargar();
    const antes = estado.puntos;
    estado.puntos = Math.max(0, estado.puntos + delta);
    estado.historial.unshift({ fecha: new Date().toISOString(), motivo, delta });
    estado.historial = estado.historial.slice(0, 30);
    SistemaStorage.guardar(estado);
    animarHud(antes, estado.puntos, delta);
    if (!elRegistroPanel.classList.contains('hidden')) renderizarRegistro();
  }

  function gastarPuntos(cantidad, motivo) {
    if (puntosActuales() < cantidad) return false;
    if (cantidad > 0) cambiarPuntos(-cantidad, motivo);
    return true;
  }

  // Registra un descubrimiento ("tipo:id"). Solo la primera vez: suma los puntos
  // de su tipo, avisa (salvo { silencioso: true }) y revisa los logros.
  // Devuelve los puntos ganados (0 si ya estaba descubierto o no da puntos).
  // Un [secret:] solo da puntos si está dentro de un capítulo secreto: los de
  // capítulos normales son contenido a la vista (como las ilustraciones) y
  // abrirlos no se premia. Un secreto puede fijar sus propios puntos con
  // "puntos" en story.js → secretos (0 = nunca, N = siempre N).
  function secretoEnCapituloSecreto(id) {
    return capitulos.some(c => c.tipo === 'secreto' && c.parrafos.some(p => p.includes(`[secret:${id}|`)));
  }

  function puntosDeSecreto(id) {
    const secreto = secretos[id];
    if (secreto && typeof secreto.puntos === 'number') return Math.max(0, secreto.puntos);
    return secretoEnCapituloSecreto(id) ? Number((recompensas.puntos || {}).secreto) || 0 : 0;
  }

  function puntosDeDescubrimiento(clave) {
    const [tipo, id] = clave.split(':');
    if (tipo === 'secreto') return puntosDeSecreto(id);
    return Number((recompensas.puntos || {})[tipo]) || 0;
  }

  // Descubiertos de un tipo, para logros y Registro. Los secretos solo cuentan
  // si dan puntos, así los logros de secretos premian lo escondido de verdad.
  function contarDescubiertos(tipo) {
    if (tipo !== 'secreto') return Descubrimientos.contar(tipo);
    return idsEnTexto('secret').filter(id => puntosDeSecreto(id) > 0 && Descubrimientos.tiene(`secreto:${id}`)).length;
  }

  function descubrir(clave, opciones) {
    if (!Descubrimientos.registrar(clave)) return 0;
    const tipo = clave.split(':')[0];
    const puntos = puntosDeDescubrimiento(clave);
    if (puntos) {
      cambiarPuntos(puntos, NOMBRE_DESCUBRIMIENTO[tipo] || 'Descubrimiento');
      if (!(opciones && opciones.silencioso)) {
        avisarSistema(`${NOMBRE_DESCUBRIMIENTO[tipo] || 'Descubrimiento registrado'}. +${formatearPuntos(puntos)} puntos.`, { duracionMs: 3500 });
      }
    }
    revisarLogros();
    return puntos;
  }

  // Ids distintos de un tipo de marca ([secret:], [bug:], [pista:]) en la novela.
  function idsEnTexto(tipo) {
    const regex = new RegExp(`\\[${tipo}:([a-zA-Z0-9_-]+)\\|`, 'g');
    const ids = new Set();
    capitulos.forEach(c => c.parrafos.forEach(p => {
      let m;
      regex.lastIndex = 0;
      while ((m = regex.exec(p)) !== null) ids.add(m[1]);
    }));
    return [...ids];
  }

  // Cuántos hay en total de cada tipo en la novela tal como está ahora.
  function totalDe(tipo) {
    if (tipo === 'secreto') return idsEnTexto('secret').filter(id => puntosDeSecreto(id) > 0).length;
    if (tipo === 'bug') return idsEnTexto('bug').length;
    if (tipo === 'capitulo') return capitulos.length;
    if (tipo === 'puerta') return capitulos.filter(c => c.clave).length;
    if (tipo === 'pista') return idsEnTexto('pista').length;
    if (tipo === 'conexion') return conexionesTablero.length;
    if (tipo === 'mp3') {
      let n = 0;
      Object.values(escritorios).forEach(e => (e.items || []).forEach(item => {
        if (item.reproductor) n += (item.reproductor.pistas || []).filter(p => claveDePista(p) !== null).length;
      }));
      return n;
    }
    return 0;
  }

  // 0 = el logro no aplica todavía (no hay nada de ese tipo en la novela):
  // no se muestra ni se puede obtener, así nunca hay logros imposibles.
  function metaDeLogro(logro) {
    const total = totalDe(logro.tipo);
    if (total === 0) return 0;
    return logro.cantidad === 'todos' ? total : Math.min(total, Math.max(1, Number(logro.cantidad) || 1));
  }

  function revisarLogros() {
    (recompensas.logros || []).forEach(logro => {
      const estado = SistemaStorage.cargar();
      if (estado.logros.includes(logro.id)) return;
      const meta = metaDeLogro(logro);
      if (meta < 1 || contarDescubiertos(logro.tipo) < meta) return;
      estado.logros.push(logro.id);
      SistemaStorage.guardar(estado);
      const puntos = Number(logro.puntos) || 0;
      if (puntos) cambiarPuntos(puntos, `Logro: ${logro.titulo}`);
      reproducirSFX('assets/audio/points.mp3');
      avisarSistema(`Logro desbloqueado: «${logro.titulo}».${puntos ? ` +${formatearPuntos(puntos)} puntos.` : ''}`, { duracionMs: 5000, destacado: true });
    });
  }

  // --- Bugs reportables: [bug:id|palabra] en el manuscrito ---
  // El mensaje opcional de cada uno vive en story.js → "bugs".
  function reportarBug(el) {
    const id = el.dataset.bug;
    const clave = `bug:${id}`;
    if (Descubrimientos.tiene(clave)) return;
    const puntos = Number((recompensas.puntos || {}).bug) || 0;
    const mensaje = ((CONFIG_NOVELA.bugs || {})[id] || {}).mensaje || '';

    // El aviso va antes que el descubrimiento para que salga antes que un posible logro.
    reproducirSFX('assets/audio/glitch.mp3');
    avisarSistema(
      `Error #${id.toUpperCase()} reportado. Gracias por su colaboración.${puntos ? ` +${formatearPuntos(puntos)} puntos.` : ''}`,
      { glitch: mensaje, duracionMs: mensaje ? 8000 : 4500 }
    );
    descubrir(clave, { silencioso: true });

    el.classList.add('reportado', 'reportando');
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
    el.removeAttribute('aria-label');
    setTimeout(() => el.classList.remove('reportando'), 700);
  }

  // --- Contador de puntos (HUD) y Registro del Sistema ---
  const elHudPuntos = document.getElementById('hud-puntos');
  const elHudValor = document.getElementById('hud-valor');
  const elHudDelta = document.getElementById('hud-delta');
  const elRegistroPanel = document.getElementById('registro-panel');
  let animacionHudId = null;

  function mostrarPuntosEnHud(valor) {
    elHudValor.textContent = formatearPuntos(valor);
    elHudPuntos.setAttribute('aria-label', `Puntos: ${formatearPuntos(valor)}. Abrir el registro del Sistema`);
  }

  function animarHud(desde, hasta, delta) {
    cancelAnimationFrame(animacionHudId);
    if (Preferencias.reducirMovimiento()) {
      mostrarPuntosEnHud(hasta);
    } else {
      const inicio = performance.now();
      const duracion = 700;
      const paso = (ahora) => {
        const t = Math.min(1, (ahora - inicio) / duracion);
        mostrarPuntosEnHud(desde + (hasta - desde) * (1 - Math.pow(1 - t, 3)));
        if (t < 1) animacionHudId = requestAnimationFrame(paso);
      };
      animacionHudId = requestAnimationFrame(paso);
      setTimeout(() => mostrarPuntosEnHud(hasta), duracion + 50); // por si rAF se pausó en segundo plano
    }

    elHudDelta.textContent = `${delta > 0 ? '+' : '−'}${formatearPuntos(Math.abs(delta))}`;
    elHudDelta.className = 'hud-delta';
    void elHudDelta.offsetWidth;
    elHudDelta.classList.add('activo', delta > 0 ? 'positivo' : 'negativo');
    elHudPuntos.classList.remove('cambio');
    void elHudPuntos.offsetWidth;
    elHudPuntos.classList.add('cambio');
  }

  function renderizarRegistro() {
    const estado = SistemaStorage.cargar();
    const tipos = [
      ['secreto', 'Secretos ocultos'], ['bug', 'Errores reportados'], ['capitulo', 'Capítulos terminados'],
      ['puerta', 'Archivos clasificados'], ['mp3', 'Archivos descifrados'],
      ['pista', 'Pistas en el tablero'], ['conexion', 'Deducciones']
    ];
    const progreso = tipos
      .filter(([tipo]) => totalDe(tipo) > 0)
      .map(([tipo, nombre]) => {
        const total = totalDe(tipo);
        const hechos = Math.min(contarDescubiertos(tipo), total);
        return `<li class="registro-progreso-item${hechos >= total ? ' completo' : ''}">
          <span>${nombre}</span><span class="registro-cifra">${hechos}/${total}</span></li>`;
      }).join('');

    const logros = (recompensas.logros || []).filter(l => metaDeLogro(l) > 0);
    const obtenidos = logros.filter(l => estado.logros.includes(l.id)).length;
    const listaLogros = logros.map(l => {
      const ok = estado.logros.includes(l.id);
      return `<li class="registro-logro${ok ? ' obtenido' : ''}">
        <span class="registro-logro-icono" aria-hidden="true">${ok ? '✓' : '◇'}</span>
        <span class="registro-logro-textos">
          <span class="registro-logro-titulo">${ok ? escapeHtml(l.titulo) : '???'}</span>
          <span class="registro-logro-desc">${escapeHtml(l.descripcion || '')}</span>
        </span>
        <span class="registro-cifra">+${formatearPuntos(Number(l.puntos) || 0)}</span>
      </li>`;
    }).join('');

    const eventos = estado.historial.slice(0, 6).map(h => `<li class="registro-evento">
        <span class="registro-evento-delta ${h.delta > 0 ? 'positivo' : 'negativo'}">${h.delta > 0 ? '+' : '−'}${formatearPuntos(Math.abs(h.delta))}</span>
        <span>${escapeHtml(h.motivo)}</span>
      </li>`).join('');

    elRegistroPanel.innerHTML = `
      <p class="registro-etiqueta">[ Registro del Sistema ]</p>
      <p class="registro-saldo">◈ ${formatearPuntos(estado.puntos)} <span>puntos</span></p>
      ${progreso ? `<ul class="registro-lista">${progreso}</ul>` : ''}
      <p class="registro-subtitulo">Logros · ${obtenidos}/${logros.length}</p>
      <ul class="registro-lista">${listaLogros}</ul>
      ${eventos ? `<p class="registro-subtitulo">Últimos eventos</p><ul class="registro-lista">${eventos}</ul>` : ''}`;
  }

  function abrirRegistro() {
    renderizarRegistro();
    elRegistroPanel.classList.remove('hidden');
    elHudPuntos.setAttribute('aria-expanded', 'true');
  }

  function cerrarRegistro(devolverFoco) {
    if (elRegistroPanel.classList.contains('hidden')) return;
    elRegistroPanel.classList.add('hidden');
    elHudPuntos.setAttribute('aria-expanded', 'false');
    if (devolverFoco) elHudPuntos.focus();
  }

  elHudPuntos.addEventListener('click', () => {
    elRegistroPanel.classList.contains('hidden') ? abrirRegistro() : cerrarRegistro(false);
  });

  document.addEventListener('click', (evento) => {
    if (!evento.target.closest('.registro')) cerrarRegistro(false);
  });

  // ============================================================
  // BASE DE LECTURA (Fase 1): posición guardada, avisos de El Sistema,
  // ajustes, progreso del capítulo, deslizar en pantallas táctiles y
  // foco del teclado dentro de la ventana abierta.
  // ============================================================

  // --- Posición de lectura ---
  // Se guarda por número de capítulo y de PÁRRAFO (no por índice ni página):
  // así sobrevive a capítulos nuevos en el manuscrito o a cambiar cuántos
  // párrafos caben por página.
  const LecturaStorage = (function () {
    const CLAVE = 'novela-interactiva-lectura-v1';
    return {
      cargar() {
        try {
          return JSON.parse(localStorage.getItem(CLAVE));
        } catch (err) {
          return null;
        }
      },
      guardar(posicion) {
        try {
          localStorage.setItem(CLAVE, JSON.stringify(posicion));
        } catch (err) {
          // sin almacenamiento: la lectura sigue, solo no se recuerda
        }
      }
    };
  })();

  function guardarPosicion() {
    const capitulo = capitulos[state.chapterIndex];
    LecturaStorage.guardar({
      capitulo: capitulo.numero,
      parrafo: state.blockIndex * PARRAFOS_POR_BLOQUE,
      retorno: state.pilaRetorno.map(p => ({
        capitulo: capitulos[p.chapterIndex].numero,
        parrafo: p.blockIndex * PARRAFOS_POR_BLOQUE
      })),
      fecha: new Date().toISOString()
    });
  }

  function bloqueDeParrafo(capitulo, parrafo) {
    return Math.min(Math.floor((Number(parrafo) || 0) / PARRAFOS_POR_BLOQUE), totalBloques(capitulo) - 1);
  }

  // Devuelve { chapterIndex, blockIndex, pilaRetorno } o null si no hay nada
  // guardado (o si ese capítulo ya no existe en el manuscrito).
  function posicionGuardada() {
    const guardada = LecturaStorage.cargar();
    if (!guardada) return null;
    const indice = capitulos.findIndex(c => c.numero === guardada.capitulo);
    if (indice === -1) return null;

    const pilaRetorno = (guardada.retorno || []).map(p => {
      const i = capitulos.findIndex(c => c.numero === p.capitulo);
      return i === -1 ? null : { chapterIndex: i, blockIndex: bloqueDeParrafo(capitulos[i], p.parrafo) };
    }).filter(Boolean);

    // Un capítulo secreto sin camino de vuelta dejaría a quien lee sin salida.
    if (capitulos[indice].tipo === 'secreto' && !pilaRetorno.length) return null;

    return { chapterIndex: indice, blockIndex: bloqueDeParrafo(capitulos[indice], guardada.parrafo), pilaRetorno };
  }

  // --- Avisos de El Sistema ---
  // Notificación breve y reutilizable (la Fase 2 la usará para logros y puntos).
  // opciones: { accion: { etiqueta, alHacerClic }, duracionMs }
  const elSistemaAviso = document.getElementById('sistema-aviso');
  const elSistemaAvisoTexto = document.getElementById('sistema-aviso-texto');
  const elSistemaAvisoAccion = document.getElementById('sistema-aviso-accion');
  const elSistemaAvisoCerrar = document.getElementById('sistema-aviso-cerrar');
  const elSistemaAvisoGlitch = document.getElementById('sistema-aviso-glitch');
  let avisoTimeoutId = null;
  let avisoAccion = null;
  let avisoVisible = false;
  const colaAvisos = []; // los avisos que llegan juntos se muestran uno tras otro

  // opciones: { accion: { etiqueta, alHacerClic }, duracionMs, glitch: 'texto', destacado: true }
  function avisarSistema(texto, opciones) {
    colaAvisos.push({ texto, opciones: opciones || {} });
    if (!avisoVisible) mostrarSiguienteAviso();
  }

  function mostrarSiguienteAviso() {
    const siguiente = colaAvisos.shift();
    if (!siguiente) return;
    const { accion = null, duracionMs = 7000, glitch = '', destacado = false } = siguiente.opciones;
    avisoVisible = true;
    clearTimeout(avisoTimeoutId);
    avisoAccion = accion ? accion.alHacerClic : null;
    elSistemaAvisoAccion.textContent = accion ? accion.etiqueta : '';
    elSistemaAvisoAccion.classList.toggle('hidden', !accion);
    elSistemaAviso.classList.toggle('destacado', destacado);

    elSistemaAviso.classList.remove('hidden');
    void elSistemaAviso.offsetWidth; // fuerza reflow para que la entrada se anime
    elSistemaAviso.classList.add('visible');
    // Los textos van después de mostrarlo, para que el lector de pantalla los anuncie.
    descifrarTexto(elSistemaAvisoTexto, siguiente.texto);
    elSistemaAvisoGlitch.textContent = glitch;
    elSistemaAvisoGlitch.setAttribute('data-texto', glitch);
    elSistemaAvisoGlitch.classList.toggle('hidden', !glitch);
    avisoTimeoutId = setTimeout(cerrarAvisoSistema, duracionMs);
  }

  // El aviso se "descifra": los caracteres se fijan de izquierda a derecha y,
  // por delante, una franja corta de símbolos cambiantes. El resto del texto ya
  // ocupa su lugar (transparente) para que las líneas no salten. El lector de
  // pantalla recibe el texto real de una vez, en un span aparte.
  const GLIFOS_DESCIFRADO = '█▓▒░<>/\\|=+*#%01';
  const ANCHO_RUIDO = 6;
  let descifradoRaf = 0;

  function descifrarTexto(el, texto) {
    cancelAnimationFrame(descifradoRaf);
    if (Preferencias.reducirMovimiento() || !texto) {
      el.textContent = texto;
      return;
    }
    const real = document.createElement('span');
    real.className = 'solo-lector';
    real.textContent = texto;
    const visible = document.createElement('span');
    visible.setAttribute('aria-hidden', 'true');
    const fijo = document.createElement('span');
    const ruido = document.createElement('span');
    ruido.className = 'descifrando-ruido';
    const pendiente = document.createElement('span');
    pendiente.className = 'descifrando-pendiente';
    pendiente.textContent = texto; // reserva el espacio desde el primer cuadro
    visible.append(fijo, ruido, pendiente);
    el.replaceChildren(real, visible);

    const caracteres = Array.from(texto); // respeta emojis y caracteres compuestos
    const duracion = Math.min(1100, 350 + caracteres.length * 14);
    const inicio = performance.now();
    let ultimoCuadro = 0;

    const paso = ahora => {
      const avance = Math.min(1, (ahora - inicio) / duracion);
      if (avance < 1 && ahora - ultimoCuadro < 45) { // ~22 cambios por segundo, aire de terminal
        descifradoRaf = requestAnimationFrame(paso);
        return;
      }
      ultimoCuadro = ahora;
      const fijos = Math.floor(avance * caracteres.length);
      const finRuido = Math.min(caracteres.length, fijos + ANCHO_RUIDO);
      fijo.textContent = caracteres.slice(0, fijos).join('');
      ruido.textContent = caracteres.slice(fijos, finRuido)
        .map(c => (/\s/.test(c) ? c : GLIFOS_DESCIFRADO[Math.floor(Math.random() * GLIFOS_DESCIFRADO.length)]))
        .join('');
      pendiente.textContent = caracteres.slice(finRuido).join('');
      if (avance < 1) descifradoRaf = requestAnimationFrame(paso);
    };
    descifradoRaf = requestAnimationFrame(paso);
  }

  function cerrarAvisoSistema() {
    clearTimeout(avisoTimeoutId);
    elSistemaAviso.classList.remove('visible');
    setTimeout(() => {
      if (elSistemaAviso.classList.contains('visible')) return;
      elSistemaAviso.classList.add('hidden');
      avisoVisible = false;
      mostrarSiguienteAviso();
    }, 350);
  }

  elSistemaAvisoCerrar.addEventListener('click', cerrarAvisoSistema);
  elSistemaAvisoAccion.addEventListener('click', () => {
    const accion = avisoAccion;
    cerrarAvisoSistema();
    if (accion) accion();
  });

  function avisarSesionRestaurada() {
    const capitulo = capitulos[state.chapterIndex];
    avisarSistema(
      `Bienvenido de nuevo, usuario. Sesión restaurada: Cap. ${capitulo.numero} «${capitulo.titulo}», pág. ${state.blockIndex + 1} de ${totalBloques(capitulo)}.`,
      {
        duracionMs: 9000,
        accion: {
          etiqueta: 'Empezar desde el inicio',
          alHacerClic: () => {
            state.pilaRetorno = [];
            mostrarCapitulo(indiceInicial(), 0);
          }
        }
      }
    );
  }

  // --- Progreso del capítulo ---
  const PALABRAS_POR_MINUTO = 200;
  const elProgresoBarra = document.getElementById('progreso-barra');
  const elProgresoRelleno = document.getElementById('progreso-relleno');
  const elProgresoTiempo = document.getElementById('progreso-tiempo');
  const palabrasPorParrafo = new Map(); // capítulo → [palabras de cada párrafo], calculado una vez

  function contarPalabras(capitulo) {
    if (!palabrasPorParrafo.has(capitulo)) {
      palabrasPorParrafo.set(capitulo, capitulo.parrafos.map(p => {
        const texto = p.trim();
        if (REGEX_MARCADOR_COLOR.test(texto) || REGEX_MARCADOR_AUDIO.test(texto)) return 0;
        if (texto.startsWith(PREFIJO_TELEFONO)) {
          try {
            return JSON.parse(texto.slice(PREFIJO_TELEFONO.length)).mensajes
              .reduce((suma, m) => suma + m.texto.split(/\s+/).filter(Boolean).length, 0);
          } catch (err) {
            return 0;
          }
        }
        return texto.replace(/\[(?:secret|chapter|bug|pista):[^|\]]+\|([^\]]+)\]/g, '$1').split(/\s+/).filter(Boolean).length;
      }));
    }
    return palabrasPorParrafo.get(capitulo);
  }

  function actualizarProgreso(capitulo) {
    const total = totalBloques(capitulo);
    const porcentaje = Math.round(((state.blockIndex + 1) / total) * 100);
    elProgresoRelleno.style.transform = `scaleX(${porcentaje / 100})`;
    elProgresoBarra.setAttribute('aria-valuenow', String(porcentaje));
    elProgresoBarra.setAttribute('aria-valuetext', `Página ${state.blockIndex + 1} de ${total}`);

    const restantes = contarPalabras(capitulo)
      .slice(state.blockIndex * PARRAFOS_POR_BLOQUE)
      .reduce((suma, n) => suma + n, 0);
    const minutos = Math.round(restantes / PALABRAS_POR_MINUTO);
    elProgresoTiempo.textContent = state.blockIndex >= total - 1
      ? 'Última página del capítulo'
      : minutos < 1 ? 'Menos de 1 min para terminar el capítulo' : `≈ ${minutos} min para terminar el capítulo`;
  }

  // --- Ajustes de lectura ---
  const elBtnAjustes = document.getElementById('btn-ajustes');
  const elAjustesPanel = document.getElementById('ajustes-panel');
  const elLetraMenos = document.getElementById('ajustes-letra-menos');
  const elLetraMas = document.getElementById('ajustes-letra-mas');
  const elLetraValor = document.getElementById('ajustes-letra-valor');
  const elVolumen = document.getElementById('ajustes-volumen');
  const elVolumenValor = document.getElementById('ajustes-volumen-valor');
  const elMovimiento = document.getElementById('ajustes-movimiento');
  const elVerIntro = document.getElementById('ajustes-intro');

  function volumenMusica() {
    return 0.6 * Preferencias.volumen();
  }

  function sincronizarAjustes() {
    const ajustes = Preferencias.obtener();
    const posicion = Preferencias.ESCALAS.indexOf(ajustes.escala);
    elLetraValor.textContent = Math.round(ajustes.escala * 100) + ' %';
    elLetraMenos.disabled = posicion <= 0;
    elLetraMas.disabled = posicion >= Preferencias.ESCALAS.length - 1;
    elAjustesPanel.querySelectorAll('[data-interlineado]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.interlineado === ajustes.interlineado));
    });
    elAjustesPanel.querySelectorAll('[data-tema]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.tema === ajustes.tema));
    });
    elVolumen.value = String(Math.round(ajustes.volumen * 100));
    elVolumenValor.textContent = elVolumen.value + ' %';
    elMovimiento.checked = ajustes.menosMovimiento;
  }

  function cambiarEscala(paso) {
    const escalas = Preferencias.ESCALAS;
    const actual = escalas.indexOf(Preferencias.obtener().escala);
    const siguiente = escalas[Math.max(0, Math.min(escalas.length - 1, actual + paso))];
    Preferencias.cambiar({ escala: siguiente });
  }

  function abrirAjustes() {
    sincronizarAjustes();
    elAjustesPanel.classList.remove('hidden');
    elBtnAjustes.setAttribute('aria-expanded', 'true');
  }

  function cerrarAjustes(devolverFoco) {
    if (elAjustesPanel.classList.contains('hidden')) return;
    elAjustesPanel.classList.add('hidden');
    elBtnAjustes.setAttribute('aria-expanded', 'false');
    if (devolverFoco) elBtnAjustes.focus();
  }

  elBtnAjustes.addEventListener('click', () => {
    elAjustesPanel.classList.contains('hidden') ? abrirAjustes() : cerrarAjustes(false);
  });
  elLetraMenos.addEventListener('click', () => cambiarEscala(-1));
  elLetraMas.addEventListener('click', () => cambiarEscala(1));
  elAjustesPanel.addEventListener('click', (evento) => {
    const segmento = evento.target.closest('.ajustes-segmento');
    if (!segmento) return;
    if (segmento.dataset.interlineado) Preferencias.cambiar({ interlineado: segmento.dataset.interlineado });
    if (segmento.dataset.tema) Preferencias.cambiar({ tema: segmento.dataset.tema });
  });
  elVolumen.addEventListener('input', () => {
    Preferencias.cambiar({ volumen: Number(elVolumen.value) / 100 });
  });
  elMovimiento.addEventListener('change', () => {
    Preferencias.cambiar({ menosMovimiento: elMovimiento.checked });
  });
  elVerIntro.addEventListener('click', () => {
    Preferencias.olvidarIntro();
    window.location.reload();
  });

  document.addEventListener('click', (evento) => {
    if (!evento.target.closest('.ajustes')) cerrarAjustes(false);
  });

  document.addEventListener('preferencias-cambiadas', () => {
    sincronizarAjustes();
    // Música sonando: aplica el volumen nuevo al instante, sin esperar un fundido.
    if (marcadorActivo && reproduciendo) {
      clearInterval(fadeIntervalId);
      audio.volume = volumenMusica();
    }
  });

  function manejarTeclaLectura(evento) {
    if (evento.key === 'Escape' && !elAjustesPanel.classList.contains('hidden')) {
      cerrarAjustes(true);
      return true;
    }
    if (evento.key === 'Escape' && !elRegistroPanel.classList.contains('hidden')) {
      cerrarRegistro(true);
      return true;
    }
    return false;
  }

  // --- Barra inferior en celulares (#dock) ---
  // En pantallas de menos de 700 px los controles van en una barra abajo
  // (ver style.css). Se oculta al bajar leyendo y vuelve al subir, al llegar
  // al final o al enfocarla con el teclado; nunca con un panel abierto.
  const elDock = document.getElementById('dock');
  const consultaCelular = window.matchMedia('(max-width: 700px)');
  let ultimoScrollDock = window.scrollY;

  function panelDelDockAbierto() {
    return !elAjustesPanel.classList.contains('hidden') || !elRegistroPanel.classList.contains('hidden');
  }

  function mostrarDock() {
    elDock.classList.remove('oculto');
  }

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const delta = y - ultimoScrollDock;
    ultimoScrollDock = y;
    if (!consultaCelular.matches || panelDelDockAbierto()) {
      mostrarDock();
      return;
    }
    const cercaDelFinal = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
    if (y < 60 || cercaDelFinal || delta < -6) mostrarDock();
    else if (delta > 6) elDock.classList.add('oculto');
  }, { passive: true });

  elDock.addEventListener('focusin', mostrarDock);
  consultaCelular.addEventListener('change', mostrarDock);

  // --- Deslizar para pasar página (pantallas táctiles) ---
  // Horizontal y decidido: más de 60 px, claramente más ancho que alto, en
  // menos de 0,6 s. No interfiere con seleccionar texto para comentar.
  const elBookViewport = document.getElementById('book-viewport');
  let toqueInicio = null;

  elBookViewport.addEventListener('touchstart', (evento) => {
    if (evento.touches.length !== 1) {
      toqueInicio = null;
      return;
    }
    const t = evento.touches[0];
    toqueInicio = { x: t.clientX, y: t.clientY, tiempo: Date.now() };
  }, { passive: true });

  elBookViewport.addEventListener('touchend', (evento) => {
    if (!toqueInicio) return;
    const t = evento.changedTouches[0];
    const dx = t.clientX - toqueInicio.x;
    const dy = t.clientY - toqueInicio.y;
    const rapido = Date.now() - toqueInicio.tiempo < 600;
    toqueInicio = null;

    const seleccion = window.getSelection();
    if (seleccion && !seleccion.isCollapsed) return;
    if (!rapido || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    if (dx < 0 && !elBtnNext.disabled) {
      reproducirSFX('assets/audio/click.mp3');
      avanzarPagina();
    } else if (dx > 0 && !elBtnPrev.disabled) {
      reproducirSFX('assets/audio/click.mp3');
      retrocederPagina();
    }
  });

  // --- Accesibilidad: foco del teclado dentro de la ventana abierta ---
  // Con una ventana abierta, Tab recorre solo sus botones y campos (no el
  // lector de atrás); al cerrarla, el foco vuelve a donde estaba.
  // Orden: de la capa más alta a la más baja.
  const CAPAS_MODALES = [
    elCinematica, elFinOverlay, elGaleriaOverlay, elExtrasHub, elMuseo, elTablero, elExpediente,
    elMp3Overlay, elDeskFocusOverlay, elDeskOverlay,
    elGateOverlay, elOverlay, elCommentFormOverlay, elCommentsPanelOverlay
  ];
  const SELECTOR_ENFOCABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focoPrevio = new Map(); // capa → elemento que tenía el foco antes de abrirla

  function capaVisible(capa) {
    return capa.isConnected && !capa.classList.contains('hidden');
  }

  // Solo lo que se ve: lo que está dentro de algo oculto (p. ej. el modo enfoque
  // cerrado dentro del escritorio) no tiene cajas en pantalla y queda fuera.
  function enfocables(capa) {
    return Array.from(capa.querySelectorAll(SELECTOR_ENFOCABLE)).filter(el => el.getClientRects().length > 0);
  }

  function capaSuperior() {
    return CAPAS_MODALES.find(capaVisible) || null;
  }

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Tab') return;
    const capa = capaSuperior();
    if (!capa) return;
    const lista = enfocables(capa);
    if (!lista.length) {
      evento.preventDefault();
      return;
    }
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const dentro = capa.contains(document.activeElement);
    if (evento.shiftKey && (!dentro || document.activeElement === primero)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (!dentro || document.activeElement === ultimo)) {
      evento.preventDefault();
      primero.focus();
    }
  });

  const observadorCapas = new MutationObserver(registros => {
    registros.forEach(({ target: capa }) => {
      const visible = capaVisible(capa);
      const estabaAbierta = focoPrevio.has(capa);
      if (visible && !estabaAbierta) {
        focoPrevio.set(capa, document.activeElement);
        // Si la propia apertura no movió el foco adentro, se lleva al primer control.
        if (!capa.contains(document.activeElement)) {
          const primero = enfocables(capa)[0];
          if (primero) primero.focus({ preventScroll: true });
        }
      } else if (!visible && estabaAbierta) {
        const previo = focoPrevio.get(capa);
        focoPrevio.delete(capa);
        if (capa.contains(document.activeElement) || document.activeElement === document.body) {
          if (previo && previo.isConnected && previo.getClientRects().length) previo.focus({ preventScroll: true });
        }
      }
    });
  });
  CAPAS_MODALES.forEach(capa => observadorCapas.observe(capa, { attributes: true, attributeFilter: ['class'] }));

  // --- Arranque ---
  elBgLayers[capaFondoActivaIndex].style.backgroundImage = construirGradiente(COLOR_DEFAULT);
  poblarMenuCapitulos();
  actualizarContadorComentarios();
  sincronizarAjustes();
  mostrarPuntosEnHud(puntosActuales());

  // Pide las variantes de Cormorant que usa el capítulo y muestra el texto al
  // tenerlas (preferencias.js lo ocultó y lo libera solo si esto tarda).
  if (document.fonts) {
    Promise.all([
      document.fonts.load('400 1em "Cormorant Garamond"'),
      document.fonts.load('italic 400 1em "Cormorant Garamond"'),
      document.fonts.load('600 1em "Cormorant Garamond"')
    ]).catch(() => {}).then(() => document.documentElement.classList.remove('fuentes-cargando'));
  }

  const restaurada = posicionGuardada();
  if (restaurada) state.pilaRetorno = restaurada.pilaRetorno;
  mostrarCapitulo(restaurada ? restaurada.chapterIndex : state.chapterIndex, restaurada ? restaurada.blockIndex : 0);
  lectorIniciado = true; // desde aquí, cambiar de capítulo anuncia la sala

  // "Bienvenido de nuevo" solo si había algo que retomar (no en el inicio exacto).
  if (restaurada && (restaurada.chapterIndex !== indiceInicial() || restaurada.blockIndex > 0)) {
    // intro.js se carga después de app.js: si la intro va a mostrarse, se espera a que termine.
    if (!Preferencias.introVista()) {
      document.addEventListener('intro-terminada', avisarSesionRestaurada, { once: true });
    } else {
      avisarSesionRestaurada();
    }
  }
})();

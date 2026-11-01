// intro.js — Secuencia de introducción estilo "Sistema" (RPG / SVSSS).
// Módulo independiente: no lee ni modifica CONFIG_NOVELA ni el estado de app.js.
// Se monta sobre toda la interfaz al cargar la página y se desmonta sola al
// terminar la secuencia o al pulsar "Omitir". Se muestra una sola vez por
// navegador (preferencias.js lo recuerda); desde "Ajustes" se puede volver a ver.
// Al terminar avisa con el evento "intro-terminada" en document.

(function () {
  'use strict';

  const preferencias = window.Preferencias;

  const DURACION_CARGA_MS = 4000;

  // Cada paso: 'mensaje' (Continuar), 'notificacion' (aviso destacado),
  // 'glitch' (error visual) o 'eleccion' (varios botones, todos llevan al siguiente paso).
  const SECUENCIA = [
    { tipo: 'mensaje', texto: 'La, la, la ƪ(˘⌣˘)ʃ' },
    { tipo: 'mensaje', texto: 'OH- AHEM. DE VUELTA AL TRABAJ- ¡DIGO! Implementando actualizaciones…' },
    { tipo: 'mensaje', texto: 'Analizando contenido…' },
    { tipo: 'mensaje', texto: 'Autorizando permisos…' },
    { tipo: 'mensaje', texto: '¡El sistema da la bienvenida al usuario a la nueva interfaz! ꒰ঌ( ᴗ͈ˬᴗ͈)໒꒱' },
    { tipo: 'mensaje', texto: 'Optimizada para ofrecer la experiencia más completa posible.ヽ(´▽｀)/' },
    { tipo: 'mensaje', texto: 'Para un mayor disfrute, se recomienda el uso de audífonos.' },
    { tipo: 'mensaje', texto: '^^ Algunos cambios permanecen en proceso, agradecemos su paciencia…' },
    { tipo: 'mensaje', texto: 'Uhm…' },
    { tipo: 'mensaje', texto: '(ㆀ˘･з･˘)' },
    { tipo: 'mensaje', texto: '¡Algunos puntos serán compensados por los inconveniente!' },
    { tipo: 'notificacion', texto: '+1000 puntos han sido abonados' },
    { tipo: 'mensaje', texto: 'A lo largo de la lectura, se ha integrado contenido multimedia, y pueden haber algunas pist- ...' },
    { tipo: 'glitch', texto: 'ALGUNOS ERRORES EN EL CÓDIGO. NO PLANIFICADOS.' },
    { tipo: 'mensaje', texto: 'Se le recomienda al usuario estar pendiente a posibles bugs y contenido oculto. Y REPORTARLOS.' },
    { tipo: 'mensaje', texto: '(● ˃̶͈̀ロ˂̶͈́)੭ꠥ⁾⁾' },
    {
      tipo: 'eleccion',
      texto: '¿El usuario comprende estas condiciones y se compromete a un uso responsable de la interfaz?',
      opciones: ['1. Aceptar condiciones', '2. Bueno…']
    },
    { tipo: 'mensaje', texto: '…' },
    { tipo: 'mensaje', texto: '¡El sistema le desea una placentera estancia!' }
  ];

  const elOverlay = document.getElementById('intro-overlay');
  const elLoading = document.getElementById('intro-loading');
  const elDialogo = document.getElementById('intro-dialogo');
  const elBox = document.getElementById('intro-box');
  const elTexto = document.getElementById('intro-texto');
  const elControles = document.getElementById('intro-controles');
  const elSkip = document.getElementById('intro-skip');
  const elBlackout = document.getElementById('intro-blackout');
  const elInicio = document.getElementById('intro-inicio');

  // Ya vista: se retira sin mostrarse (el CSS ya la ocultaba desde el <head>).
  if (preferencias && preferencias.introVista()) {
    elOverlay.remove();
    elBlackout.remove();
    return;
  }

  let terminando = false;
  let avanzando = false;
  let idCargaTimeout = null;

  // Los navegadores bloquean el audio hasta la primera interacción con la página.
  // Si el paso 0 se mostrara solo al terminar la carga, su sonido fallaría; por
  // eso, si todavía no hubo interacción, la carga termina en un "pulsa para
  // continuar" y el paso 0 arranca con ese gesto, con su sonido a tiempo.
  let esperandoInicio = false;

  // Reproduce el efecto de sonido correspondiente a cada paso de la intro:
  // - El paso de bienvenida (índice 5) usa Mensaje-bienvenida.
  // - El paso de tipo 'glitch' usa Glitch.
  // - Todos los demás pasos usan Mensaje-regular.
  function reproducirSonidoIntro(paso, indice) {
    let ruta;
    if (indice === 4) ruta = 'assets/audio/mensaje-bienvenida.mp3';
    else if (paso.tipo === 'notificacion') ruta = 'assets/audio/points.mp3';
    else if (paso.tipo === 'glitch') ruta = 'assets/audio/glitch.mp3';
    else ruta = 'assets/audio/mensaje-regular.mp3';

    const sfx = new Audio(ruta);
    if (preferencias) sfx.volume = preferencias.volumen();
    sfx.play().catch(err => console.warn('No se pudo reproducir el sonido de la intro:', err));
  }

  function construirControles(paso, indice) {
    elControles.innerHTML = '';

    if (paso.tipo === 'eleccion') {
      elControles.classList.add('eleccion');
      paso.opciones.forEach(opcion => {
        const btn = document.createElement('button');
        btn.className = 'intro-btn';
        btn.textContent = opcion;
        btn.addEventListener('click', () => avanzar(indice));
        elControles.appendChild(btn);
      });
      return;
    }

    elControles.classList.remove('eleccion');
    const btn = document.createElement('button');
    btn.className = 'intro-btn';
    btn.textContent = 'Continuar';
    btn.addEventListener('click', () => avanzar(indice));
    elControles.appendChild(btn);
  }

  function mostrarPaso(indice) {
    if (terminando) return; // evita que un timer viejo (p.ej. el de la carga) reviva la intro tras "Omitir"

    if (indice >= SECUENCIA.length) {
      finalizarIntro();
      return;
    }

    const paso = SECUENCIA[indice];

    elBox.classList.remove('visible');
    setTimeout(() => {
      if (terminando) return;
      elTexto.className = 'intro-texto';
      elTexto.removeAttribute('data-texto');

      if (paso.tipo === 'notificacion') elTexto.classList.add('notificacion');
      else if (paso.tipo === 'glitch') {
        elTexto.classList.add('glitch');
        elTexto.setAttribute('data-texto', paso.texto);
      }

      elTexto.textContent = paso.texto;
      reproducirSonidoIntro(paso, indice);
      construirControles(paso, indice);
      elBox.classList.add('visible');
      avanzando = false;
    }, 220);
  }

  function avanzar(indiceActual) {
    if (avanzando || terminando) return;
    avanzando = true;
    mostrarPaso(indiceActual + 1);
  }

  function finalizarIntro() {
    if (terminando) return;
    terminando = true;
    clearTimeout(idCargaTimeout); // por si "Omitir" llega antes de que termine la carga
    if (preferencias) preferencias.marcarIntroVista();

    elBlackout.classList.add('activo');
    setTimeout(() => {
      elOverlay.remove();
      document.body.classList.remove('intro-activa');
      document.dispatchEvent(new CustomEvent('intro-terminada'));
      requestAnimationFrame(() => {
        elBlackout.classList.remove('activo');
        setTimeout(() => elBlackout.remove(), 750);
      });
    }, 650);
  }

  // Evita que clics/toques dentro de la intro lleguen al lector oculto detrás
  // (event.stopPropagation en la fase de burbuja, antes de llegar a document).
  ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(tipo => {
    elOverlay.addEventListener(tipo, evento => evento.stopPropagation());
  });

  // El teclado no tiene "hit-testing" como el mouse: un keydown puede llegar
  // a document sin pasar por el overlay si nada dentro de él tiene el foco.
  // Por eso se intercepta aparte, en fase de captura, mientras la intro esté activa.
  document.addEventListener('keydown', (evento) => {
    if (!document.body.classList.contains('intro-activa')) return;
    evento.stopPropagation();
    if (esperandoInicio) {
      iniciarDialogo();
      return;
    }
    if (evento.key === 'Enter') {
      const btn = elControles.querySelector('.intro-btn');
      if (btn) btn.click();
    }
  }, true);

  elSkip.addEventListener('click', finalizarIntro);

  function iniciarDialogo() {
    if (terminando) return;
    esperandoInicio = false;
    elLoading.classList.add('hidden');
    elDialogo.classList.remove('hidden');
    mostrarPaso(0);
  }

  // Cualquier clic/toque en la pantalla de espera (salvo "Omitir") arranca el diálogo.
  elOverlay.addEventListener('click', (evento) => {
    if (!esperandoInicio || elSkip.contains(evento.target)) return;
    iniciarDialogo();
  });

  // userActivation.hasBeenActive: true si ya hubo un clic/tecla (p. ej. durante
  // la carga), en cuyo caso el audio ya está permitido y se sigue sin pausa.
  function audioPermitido() {
    return Boolean(navigator.userActivation && navigator.userActivation.hasBeenActive);
  }

  // --- Arranque ---
  document.body.classList.add('intro-activa');
  idCargaTimeout = setTimeout(() => {
    if (audioPermitido()) {
      iniciarDialogo();
      return;
    }
    esperandoInicio = true;
    elLoading.querySelector('.intro-loading-text').classList.add('hidden');
    elInicio.classList.remove('hidden');
  }, DURACION_CARGA_MS);
})();

// intro.js — Secuencia de introducción estilo "Sistema" (RPG / SVSSS).
// Módulo independiente: no lee ni modifica CONFIG_NOVELA ni el estado de app.js.
// Se monta sobre toda la interfaz al cargar la página y se desmonta sola al
// terminar la secuencia o al pulsar "Omitir".

(function () {
  'use strict';

  const DURACION_CARGA_MS = 4000;

  // Cada paso: 'mensaje' (Continuar), 'notificacion' (aviso destacado),
  // 'glitch' (error visual) o 'eleccion' (varios botones, todos llevan al siguiente paso).
  const SECUENCIA = [
    { tipo: 'mensaje', texto: 'La, la, la ƪ(˘⌣˘)ʃ' },
    { tipo: 'mensaje', texto: 'Implementando actualizaciones…' },
    { tipo: 'mensaje', texto: 'Analizando contenido…' },
    { tipo: 'mensaje', texto: 'Autorizando permisos…' },
    { tipo: 'mensaje', texto: '¡Oh!' },
    { tipo: 'mensaje', texto: '¡El sistema da la bienvenida al usuario a la nueva interfaz! Ha sido optimizada para ofrecer la experiencia más completa posible. ヽ(´▽｀)/' },
    { tipo: 'mensaje', texto: 'Algunos cambios permanecen en proceso, agradecemos su paciencia.' },
    { tipo: 'mensaje', texto: '…' },
    { tipo: 'mensaje', texto: 'Uhm…' },
    { tipo: 'mensaje', texto: '(ㆀ˘･з･˘)' },
    { tipo: 'mensaje', texto: '¡Algunos puntos serán compensados por el inconveniente!' },
    { tipo: 'notificacion', texto: '+3000 puntos han sido abonados' },
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

  let terminando = false;
  let avanzando = false;
  let idCargaTimeout = null;

  // El paso 0 se dispara solo, al terminar la carga, sin ningún clic previo del
  // usuario — por eso el navegador bloquea su autoplay (política estándar de
  // audio), mientras que los pasos siguientes sí suenan porque los dispara un
  // clic en "Continuar". Si eso pasa, se guarda aquí y se reintenta una sola
  // vez en cuanto haya la primera interacción real con la página.
  let sfxPendiente = null;

  function reintentarSfxPendiente() {
    if (!sfxPendiente) return;
    sfxPendiente.play().catch(() => {});
    sfxPendiente = null;
  }

  document.addEventListener('pointerdown', reintentarSfxPendiente, { once: true, capture: true });
  document.addEventListener('keydown', reintentarSfxPendiente, { once: true, capture: true });
  document.addEventListener('touchstart', reintentarSfxPendiente, { once: true, capture: true });

  // Reproduce el efecto de sonido correspondiente a cada paso de la intro:
  // - El paso de bienvenida (índice 5) usa Mensaje-bienvenida.
  // - El paso de tipo 'glitch' usa Glitch.
  // - Todos los demás pasos usan Mensaje-regular.
  function reproducirSonidoIntro(paso, indice) {
    let ruta;
    if (indice === 5) ruta = 'assets/audio/Mensaje-bienvenida.mp3';
    else if (paso.tipo === 'notificacion') ruta = 'assets/audio/points.mp3';
    else if (paso.tipo === 'glitch') ruta = 'assets/audio/Glitch.mp3';
    else ruta = 'assets/audio/Mensaje-regular.mp3';

    const sfx = new Audio(ruta);
    sfx.play().catch(() => { sfxPendiente = sfx; });
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

    elBlackout.classList.add('activo');
    setTimeout(() => {
      elOverlay.remove();
      document.body.classList.remove('intro-activa');
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
    if (evento.key === 'Enter') {
      const btn = elControles.querySelector('.intro-btn');
      if (btn) btn.click();
    }
  }, true);

  elSkip.addEventListener('click', finalizarIntro);

  // --- Arranque ---
  document.body.classList.add('intro-activa');
  idCargaTimeout = setTimeout(() => {
    elLoading.classList.add('hidden');
    elDialogo.classList.remove('hidden');
    mostrarPaso(0);
  }, DURACION_CARGA_MS);
})();

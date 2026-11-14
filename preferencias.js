// preferencias.js — Ajustes de lectura y "intro ya vista", guardados en este navegador.
// Se carga en el <head> (antes de pintar la página) para aplicar tema, tamaño de
// letra e interlineado sin parpadeo, y para ocultar la intro si ya se vio.
// app.js e intro.js lo usan a través de window.Preferencias.

window.Preferencias = (function () {
  'use strict';

  const CLAVE_AJUSTES = 'novela-interactiva-ajustes-v1';
  const CLAVE_INTRO = 'novela-interactiva-intro-vista-v1';

  const ESCALAS = [0.9, 1, 1.1, 1.2, 1.35];                     // tamaño de letra (multiplicador)
  const INTERLINEADOS = { compacto: 0.9, normal: 1, amplio: 1.18 }; // multiplicador del interlineado
  const TEMAS = ['claro', 'sepia', 'noche'];

  const PREDETERMINADOS = {
    escala: 1,
    interlineado: 'normal',
    tema: 'claro',
    volumen: 1,              // 0–1, multiplica música, efectos, intro y cinemática
    menosMovimiento: false
  };

  // localStorage puede no existir o lanzar error (modo privado, sitio bloqueado):
  // en ese caso todo funciona igual, solo que nada se recuerda.
  function leer(clave) {
    try {
      return localStorage.getItem(clave);
    } catch (err) {
      return null;
    }
  }

  function escribir(clave, valor) {
    try {
      if (valor === null) localStorage.removeItem(clave);
      else localStorage.setItem(clave, valor);
    } catch (err) {
      // sin almacenamiento: el ajuste aplica solo a esta visita
    }
  }

  function cargar() {
    let guardados = {};
    try {
      guardados = JSON.parse(leer(CLAVE_AJUSTES)) || {};
    } catch (err) {
      guardados = {};
    }
    const ajustes = Object.assign({}, PREDETERMINADOS, guardados);
    if (!ESCALAS.includes(ajustes.escala)) ajustes.escala = PREDETERMINADOS.escala;
    if (!(ajustes.interlineado in INTERLINEADOS)) ajustes.interlineado = PREDETERMINADOS.interlineado;
    if (!TEMAS.includes(ajustes.tema)) ajustes.tema = PREDETERMINADOS.tema;
    ajustes.volumen = Math.min(1, Math.max(0, Number(ajustes.volumen)));
    if (Number.isNaN(ajustes.volumen)) ajustes.volumen = PREDETERMINADOS.volumen;
    return ajustes;
  }

  let ajustes = cargar();

  function aplicar() {
    const raiz = document.documentElement;
    raiz.dataset.tema = ajustes.tema;
    raiz.style.setProperty('--lectura-escala', String(ajustes.escala));
    raiz.style.setProperty('--lectura-interlineado', String(INTERLINEADOS[ajustes.interlineado]));
    raiz.classList.toggle('menos-movimiento', ajustes.menosMovimiento);
  }

  aplicar();
  if (leer(CLAVE_INTRO)) document.documentElement.classList.add('intro-vista');

  // Equipo de pocos recursos (4 GB de RAM o 4 núcleos o menos): el vidrio
  // esmerilado sobre el fondo animado es lo más costoso de dibujar, así que
  // style.css lo cambia por un fondo semitransparente sólido y fondo.js se
  // dibuja más liviano. deviceMemory solo existe en Chrome/Edge/Android.
  const memoria = navigator.deviceMemory;
  const nucleos = navigator.hardwareConcurrency;
  if ((memoria && memoria <= 4) || (nucleos && nucleos <= 4)) {
    document.documentElement.classList.add('equipo-modesto');
  }

  // El texto del libro espera a su tipografía (app.js la pide y quita la clase).
  // Si la red tarda, a los 1,5 s se muestra igual con la letra de respaldo.
  if (document.fonts) {
    document.documentElement.classList.add('fuentes-cargando');
    setTimeout(() => document.documentElement.classList.remove('fuentes-cargando'), 1500);
  }

  return {
    ESCALAS,
    TEMAS,

    obtener() {
      return Object.assign({}, ajustes);
    },

    // Cambia uno o varios ajustes, los guarda, los aplica y avisa con el
    // evento "preferencias-cambiadas" (app.js ajusta el volumen con él).
    cambiar(parcial) {
      ajustes = Object.assign({}, ajustes, parcial);
      escribir(CLAVE_AJUSTES, JSON.stringify(ajustes));
      aplicar();
      document.dispatchEvent(new CustomEvent('preferencias-cambiadas', { detail: Object.assign({}, ajustes) }));
    },

    volumen() {
      return ajustes.volumen;
    },

    // true si quien lee pidió menos animaciones aquí o en su sistema operativo
    reducirMovimiento() {
      return ajustes.menosMovimiento || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    introVista() {
      return Boolean(leer(CLAVE_INTRO));
    },

    marcarIntroVista() {
      escribir(CLAVE_INTRO, '1');
    },

    olvidarIntro() {
      escribir(CLAVE_INTRO, null);
    }
  };
})();

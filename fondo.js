// fondo.js — Fondo vivo: manchas de luz que fluyen como tinta en agua (WebGL).
// Toma los tres colores de cada escena ([color: #a, #b, #c] del manuscrito) y
// los transforma suavemente al cambiar de escena. La luz se inclina hacia el
// cursor y se desplaza al avanzar en la página. Todo se mece con un oleaje
// lento, y caen gotas (solas, al tocar o al pasar el cursor) que abren anillos.
//   - Claro / sepia: pigmento pastel sobre papel.  Noche: luz sobre negro.
//   - "Reducir animaciones": queda quieto (solo cambia de color, sin moverse).
//   - Sin WebGL: no hace nada y siguen las capas de degradado de style.css.
// app.js lo usa con window.FondoVivo.colores([...]) y FondoVivo.ocultar().

(function () {
  'use strict';

  const canvas = document.getElementById('fondo-vivo');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;

  const VERTICES = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FRAGMENTOS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;   // con precisión media el tiempo "tiembla" y se ve granulado
    #else
    precision mediump float;
    #endif
    #define GOTAS 6
    uniform vec2 u_res;
    uniform float u_tiempo;
    uniform vec2 u_cursor;       // 0..1, ya suavizado
    uniform float u_scroll;      // 0..1, cuánto se avanzó en la página
    uniform vec4 u_gotas[GOTAS]; // x, y (0..1), edad en segundos, fuerza (0 = apagada)
    uniform vec3 u_c1;
    uniform vec3 u_c2;
    uniform vec3 u_c3;
    uniform vec3 u_base;         // color del papel (claro/sepia) o del fondo (noche)
    uniform float u_oscuro;      // 0 = pigmento sobre papel, 1 = luz sobre negro

    float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float ruido(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), u.x),
                 mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * ruido(p); p *= 2.03; a *= 0.5; }
      return v;
    }
    float mancha(vec2 p, vec2 centro, float radio) {
      float d = length(p - centro) / radio;
      return exp(-d * d);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      float aspecto = u_res.x / u_res.y;
      vec2 p = vec2(uv.x * aspecto, uv.y);
      float t = u_tiempo;

      // Oleaje: tres trenes de olas largas y lentas, en direcciones distintas,
      // mecen todo el campo de color como la superficie de un estanque.
      float f1 = dot(p, vec2(0.94, 0.34)) * 2.6 - t * 0.32;
      float f2 = dot(p, vec2(-0.55, 0.83)) * 3.4 - t * 0.41 + 1.7;
      float f3 = dot(p, vec2(0.20, -0.98)) * 4.8 - t * 0.53 + 4.2;
      p += vec2(sin(f1) * 0.030 + sin(f3) * 0.012, sin(f2) * 0.026 + sin(f1) * 0.010);
      float relieve = (cos(f1) + cos(f2) * 0.8) * 0.5;

      // Corriente de fondo muy lenta, para que los bordes no sean círculos perfectos.
      float tf = t * 0.03;
      vec2 flujo = vec2(fbm(p * 1.2 + vec2(tf, -tf * 0.7)), fbm(p * 1.2 + vec2(-tf * 0.8, tf) + 4.1)) - 0.5;
      p += flujo * 0.24;

      // Gotas: cada una abre un anillo que se expande, se ensancha y se apaga.
      float brilloGotas = 0.0;
      for (int i = 0; i < GOTAS; i++) {
        vec4 g = u_gotas[i];
        if (g.w <= 0.0) continue;
        vec2 hacia = p - vec2(g.x * aspecto, g.y);
        float d = length(hacia);
        float frente = g.z * 0.14;           // radio del anillo
        float ancho = 0.05 + g.z * 0.035;     // se abre al viajar
        float x = (d - frente) / ancho;
        float envolvente = exp(-x * x) * exp(-g.z * 0.42) * g.w;
        float fase = (d - frente) * 30.0;
        p += (hacia / max(d, 0.001)) * sin(fase) * envolvente * 0.018;
        brilloGotas += cos(fase) * envolvente;
      }

      vec2 cursor = vec2(u_cursor.x * aspecto, u_cursor.y);
      float tm = t * 0.045;
      vec2 a = vec2(aspecto * (0.22 + 0.10 * sin(tm * 1.3)), 0.80 + 0.08 * cos(tm * 1.1) - u_scroll * 0.30);
      vec2 b = vec2(aspecto * (0.80 + 0.09 * cos(tm * 0.9)), 0.62 + 0.12 * sin(tm * 1.6) - u_scroll * 0.18);
      vec2 c = vec2(aspecto * (0.50 + 0.16 * sin(tm * 0.7 + 1.0)), 0.12 + 0.09 * cos(tm * 1.2) + u_scroll * 0.22);
      a = mix(a, cursor, 0.16);   // la luz se inclina hacia el cursor
      b = mix(b, cursor, 0.08);

      float wa = mancha(p, a, 0.34);
      float wb = mancha(p, b, 0.30);
      float wc = mancha(p, c, 0.36);

      // Claro/sepia: el color se mezcla con el papel, como pigmento.
      vec3 papel = u_base;
      papel = mix(papel, u_c1, wa * 0.72);
      papel = mix(papel, u_c2, wb * 0.66);
      papel = mix(papel, u_c3, wc * 0.62);

      // Noche: el color se suma al fondo, como luz. Más saturado, y cada luz
      // pesa menos para que dos superpuestas no terminen en blanco.
      vec3 c1 = mix(vec3(dot(u_c1, vec3(0.299, 0.587, 0.114))), u_c1, 1.45);
      vec3 c2 = mix(vec3(dot(u_c2, vec3(0.299, 0.587, 0.114))), u_c2, 1.45);
      vec3 c3 = mix(vec3(dot(u_c3, vec3(0.299, 0.587, 0.114))), u_c3, 1.45);
      vec3 brillo = c1 * wa * 0.78 + c2 * wb * 0.62 + c3 * wc * 0.5;
      vec3 luz = u_base + brillo / (1.0 + brillo * 0.6);

      vec3 color = mix(papel, luz, u_oscuro);

      // Reflejos: crestas apenas más claras y valles apenas más hondos.
      float reflejo = relieve * 0.018 + brilloGotas * 0.08;
      color += reflejo * mix(vec3(1.0), 0.6 + brillo, u_oscuro);

      // Tramado fijo de 1/255: evita escalones en el degradado sin verse como grano.
      color += (azar(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(color, 1.0);
    }`;

  function compilar(tipo, codigo) {
    const shader = gl.createShader(tipo);
    gl.shaderSource(shader, codigo);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Fondo vivo: no se pudo compilar el shader.', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const vs = compilar(gl.VERTEX_SHADER, VERTICES);
  const fs = compilar(gl.FRAGMENT_SHADER, FRAGMENTOS);
  if (!vs || !fs) return;
  const programa = gl.createProgram();
  gl.attachShader(programa, vs);
  gl.attachShader(programa, fs);
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    console.warn('Fondo vivo: no se pudo enlazar el programa.', gl.getProgramInfoLog(programa));
    return;
  }
  gl.useProgram(programa);

  // Un triángulo que cubre toda la pantalla.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(programa, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['u_res', 'u_tiempo', 'u_cursor', 'u_scroll', 'u_gotas', 'u_c1', 'u_c2', 'u_c3', 'u_base', 'u_oscuro']
    .forEach(nombre => { u[nombre] = gl.getUniformLocation(programa, nombre); });

  // --- Colores y temas ---

  const TEMAS = {
    claro: { base: '#f2efe2', oscuro: 0, calidez: 0 },
    sepia: { base: '#efe4cc', oscuro: 0, calidez: 0.45 },
    noche: { base: '#0d1110', oscuro: 1, calidez: 0 }
  };
  const SEPIA = [0.70, 0.55, 0.38]; // hacia donde se entibian los colores en modo sepia

  function hexARgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return Number.isNaN(n) ? [0.6, 0.6, 0.6] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function temaActual() {
    return TEMAS[document.documentElement.dataset.tema] || TEMAS.claro;
  }

  // Valores actuales (se dibujan) y objetivos (hacia donde se mueven, suavemente).
  const actual = { c: [hexARgb('#b3c9d6'), hexARgb('#98aa9d'), hexARgb('#d3ddca')], base: hexARgb(temaActual().base), oscuro: temaActual().oscuro };
  const objetivo = { c: actual.c.map(c => c.slice()), base: actual.base.slice(), oscuro: actual.oscuro };
  let coloresEscena = ['#b3c9d6', '#98aa9d', '#d3ddca'];

  function recalcularObjetivo() {
    const tema = temaActual();
    objetivo.c = coloresEscena.map(hex => {
      const rgb = hexARgb(hex);
      return rgb.map((v, i) => v + (SEPIA[i] - v) * tema.calidez);
    });
    objetivo.base = hexARgb(tema.base);
    objetivo.oscuro = tema.oscuro;
    despertar();
  }

  // --- Gotas sobre agua quieta ---
  // Caen solas cada pocos segundos; además, un toque o clic deja caer una, y
  // mover el cursor deja una estela muy leve. Máximo 6 a la vez.

  const MAX_GOTAS = 6;
  const VIDA_GOTA_S = 9;
  const gotas = [];                                  // { x, y, edad, fuerza }
  const datosGotas = new Float32Array(MAX_GOTAS * 4);
  let proximaGotaS = 1.5;

  function soltarGota(x, y, fuerza) {
    if (gotas.length >= MAX_GOTAS) gotas.shift();
    gotas.push({ x, y, edad: 0, fuerza });
    despertar();
  }

  function avanzarGotas(dt) {
    proximaGotaS -= dt;
    if (proximaGotaS <= 0) {
      soltarGota(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, 0.55 + Math.random() * 0.35);
      proximaGotaS = 3 + Math.random() * 4;
    }
    for (let i = gotas.length - 1; i >= 0; i--) {
      gotas[i].edad += dt;
      if (gotas[i].edad > VIDA_GOTA_S) gotas.splice(i, 1);
    }
    datosGotas.fill(0);
    gotas.forEach((g, i) => datosGotas.set([g.x, g.y, g.edad, g.fuerza], i * 4));
  }

  // --- Cursor y scroll ---

  const cursor = { x: 0.7, y: 0.7, ox: 0.7, oy: 0.7 };
  let scroll = 0.3;
  let scrollObjetivo = 0.3;

  let estela = { x: -1, y: -1 };
  window.addEventListener('pointermove', (evento) => {
    cursor.ox = evento.clientX / window.innerWidth;
    cursor.oy = 1 - evento.clientY / window.innerHeight;
    // Estela: una onda suave cada vez que el cursor recorre un buen trecho.
    if (evento.pointerType === 'mouse' && Math.hypot(cursor.ox - estela.x, cursor.oy - estela.y) > 0.16) {
      estela = { x: cursor.ox, y: cursor.oy };
      if (!reducido()) soltarGota(cursor.ox, cursor.oy, 0.3);
    }
    despertar();
  }, { passive: true });

  window.addEventListener('pointerdown', (evento) => {
    if (reducido()) return;
    soltarGota(evento.clientX / window.innerWidth, 1 - evento.clientY / window.innerHeight, 1);
  }, { passive: true });

  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollObjetivo = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    despertar();
  }, { passive: true });

  // --- Tamaño: se dibuja a baja resolución (es todo difuminado) y CSS lo estira ---
  // En celulares/pantallas táctiles y en equipos modestos: aún menos resolución
  // y 30 cuadros por segundo. Al ser todo difuso, la diferencia no se nota.

  const LIVIANO = window.matchMedia('(pointer: coarse)').matches ||
    window.innerWidth <= 700 ||
    document.documentElement.classList.contains('equipo-modesto');
  const ESCALA = LIVIANO ? 0.35 : 0.5;
  const INTERVALO_MINIMO_MS = LIVIANO ? 1000 / 30 : 0;
  function redimensionar() {
    const ancho = Math.max(1, Math.round(window.innerWidth * ESCALA));
    const alto = Math.max(1, Math.round(window.innerHeight * ESCALA));
    if (canvas.width !== ancho || canvas.height !== alto) {
      canvas.width = ancho;
      canvas.height = alto;
      gl.viewport(0, 0, ancho, alto);
    }
    despertar();
  }
  window.addEventListener('resize', redimensionar);

  // --- Bucle ---

  let visible = true;           // false en el capítulo secreto
  let animacionId = null;
  let ultimo = performance.now();
  let tiempo = 20;              // arranca avanzado para que no empiece en una pose "simétrica"

  function reducido() {
    return window.Preferencias ? window.Preferencias.reducirMovimiento() : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function acercar(valor, meta, factor) {
    return valor + (meta - valor) * factor;
  }

  function cuadro(ahora) {
    animacionId = null;
    // Modo liviano: se salta cuadros hasta cumplir el intervalo (~30 por segundo).
    if (INTERVALO_MINIMO_MS && ahora - ultimo < INTERVALO_MINIMO_MS - 1) {
      animacionId = requestAnimationFrame(cuadro);
      return;
    }
    const dt = Math.min(0.1, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const quieto = reducido();
    const k = 1 - Math.exp(-dt * 1.6);   // transición de colores (~2 s)
    const kc = 1 - Math.exp(-dt * 2.5);  // cursor y scroll

    let pendiente = false;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        actual.c[i][j] = acercar(actual.c[i][j], objetivo.c[i][j], k);
        if (Math.abs(actual.c[i][j] - objetivo.c[i][j]) > 0.002) pendiente = true;
      }
    }
    for (let j = 0; j < 3; j++) {
      actual.base[j] = acercar(actual.base[j], objetivo.base[j], k);
      if (Math.abs(actual.base[j] - objetivo.base[j]) > 0.002) pendiente = true;
    }
    actual.oscuro = acercar(actual.oscuro, objetivo.oscuro, k);
    if (Math.abs(actual.oscuro - objetivo.oscuro) > 0.002) pendiente = true;

    if (!quieto) {
      tiempo += dt;
      avanzarGotas(dt);
      cursor.x = acercar(cursor.x, cursor.ox, kc);
      cursor.y = acercar(cursor.y, cursor.oy, kc);
      scroll = acercar(scroll, scrollObjetivo, kc);
    }

    gl.uniform2f(u.u_res, canvas.width, canvas.height);
    gl.uniform1f(u.u_tiempo, tiempo);
    gl.uniform2f(u.u_cursor, quieto ? 0.5 : cursor.x, quieto ? 0.5 : cursor.y);
    gl.uniform1f(u.u_scroll, quieto ? 0 : scroll);
    gl.uniform3fv(u.u_c1, actual.c[0]);
    gl.uniform3fv(u.u_c2, actual.c[1]);
    gl.uniform3fv(u.u_c3, actual.c[2]);
    gl.uniform3fv(u.u_base, actual.base);
    gl.uniform1f(u.u_oscuro, actual.oscuro);
    gl.uniform4fv(u.u_gotas, datosGotas);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Animado: sigue mientras se vea. Quieto: solo hasta terminar la transición.
    if (visible && !document.hidden && (!quieto || pendiente)) animacionId = requestAnimationFrame(cuadro);
  }

  function despertar() {
    if (animacionId === null && visible && !document.hidden) {
      ultimo = performance.now();
      animacionId = requestAnimationFrame(cuadro);
    }
  }

  document.addEventListener('visibilitychange', despertar);
  document.addEventListener('preferencias-cambiadas', recalcularObjetivo);

  window.FondoVivo = {
    // Tres colores "#hex" de la escena actual (los de [color: ...]).
    colores(lista) {
      if (Array.isArray(lista) && lista.length) {
        const c1 = lista[0];
        coloresEscena = [c1, lista[1] || c1, lista[2] || lista[1] || c1];
      }
      this.mostrar();
      recalcularObjetivo();
    },
    mostrar() {
      visible = true;
      canvas.classList.remove('oculto');
      despertar();
    },
    // El capítulo secreto usa su propio fondo terminal.
    ocultar() {
      visible = false;
      canvas.classList.add('oculto');
    }
  };

  document.documentElement.classList.add('fondo-webgl');
  redimensionar();
  recalcularObjetivo();

  // Primer cuadro ya mismo (sin esperar a la próxima animación) y recién
  // entonces se muestra el lienzo, para que nunca se vea negro al cargar.
  if (animacionId !== null) cancelAnimationFrame(animacionId);
  ultimo = performance.now() - 1000;
  cuadro(performance.now());
  requestAnimationFrame(() => canvas.classList.add('listo'));
})();

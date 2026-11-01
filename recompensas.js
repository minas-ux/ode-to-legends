// recompensas.js — Economía de puntos de "El Sistema" (Fase 2).
// Solo datos, se edita a mano (parser.js nunca lo toca). Ver GUIA-MARCADORES.md, sección 10.
//
// Cómo funciona:
//   - Cada cosa nueva que encuentra la lectora (un secreto, un bug, un capítulo
//     terminado...) suma los puntos de "puntos", UNA sola vez.
//   - Los "logros" son hitos con nombre: dan un premio extra al cumplirse.
//   - Los puntos se gastan en la tienda de contenido adicional (precios abajo,
//     o el "precio" de cada objeto en story.js → extras).

const CONFIG_RECOMPENSAS = {
  // Los que abona la intro de El Sistema (si cambias este número, cambia también
  // el texto "+1000 puntos han sido abonados" en intro.js).
  puntosIniciales: 1000,

  // Puntos por cada descubrimiento nuevo.
  puntos: {
    secreto: 100,   // abrir un [secret:id|Palabra] que esté DENTRO DE UN CAPÍTULO SECRETO.
                    // Los de capítulos normales (ilustraciones a la vista) no dan puntos
                    // ni cuentan para los logros de secretos. Para premiar uno en particular,
                    // agrégale "puntos": N en story.js → secretos.
    bug: 50,       // reportar un [bug:id|palabra]
    capitulo: 50,   // llegar a la última página de un capítulo
    puerta: 300,    // acertar la contraseña de un capítulo secreto
    mp3: 100,       // descifrar con su clave una canción del MP3 de Midnight_Sun
    pista: 100,     // encontrar una [pista:id|palabra] y clavarla en el tablero
    conexion: 250   // unir dos pistas que tienen una deducción en tablero.js
  },

  // Precio por defecto en la tienda. Cada objeto de story.js → extras puede
  // tener su propio "precio" (0 = gratis).
  precios: {
    fragmento: 500,
    ilustracion: 400,
    pista: 300
  },

  // Logros. "tipo" es el tipo de descubrimiento que cuenta (secreto, bug,
  // capitulo, puerta, mp3, pista, conexion) y "cantidad" cuántos hacen falta: un número o
  // 'todos' (todos los que existen en la novela en ese momento).
  logros: [
    { id: 'primer-secreto', titulo: 'Ojo curioso', descripcion: 'Encontrar un secreto oculto en un archivo clasificado.', tipo: 'secreto', cantidad: 1, puntos: 100 },
    { id: 'todos-los-secretos', titulo: 'Nada se escapa', descripcion: 'Encontrar todos los secretos ocultos.', tipo: 'secreto', cantidad: 'todos', puntos: 500 },
    { id: 'primer-bug', titulo: 'Beta tester', descripcion: 'Reportar un error del Sistema.', tipo: 'bug', cantidad: 1, puntos: 100 },
    { id: 'todos-los-bugs', titulo: 'Control de calidad', descripcion: 'Reportar todos los errores del Sistema.', tipo: 'bug', cantidad: 'todos', puntos: 500 },
    { id: 'tres-capitulos', titulo: 'Lectura constante', descripcion: 'Terminar tres capítulos.', tipo: 'capitulo', cantidad: 3, puntos: 150 },
    { id: 'archivo-clasificado', titulo: 'Acceso concedido', descripcion: 'Entrar a un archivo clasificado.', tipo: 'puerta', cantidad: 1, puntos: 200 },
    { id: 'primer-descifrado', titulo: 'Fuerza bruta', descripcion: 'Descifrar un archivo.', tipo: 'mp3', cantidad: 1, puntos: 100 },
    { id: 'primera-pista', titulo: 'Olfato de sabueso', descripcion: 'Clavar la primera pista en el tablero.', tipo: 'pista', cantidad: 1, puntos: 100 },
    { id: 'todas-las-pistas', titulo: 'Caso abierto', descripcion: 'Encontrar todas las pistas.', tipo: 'pista', cantidad: 'todos', puntos: 400 },
    { id: 'primera-conexion', titulo: 'Hilo rojo', descripcion: 'Conectar dos pistas en el tablero.', tipo: 'conexion', cantidad: 1, puntos: 200 }
  ]
};

if (typeof module !== 'undefined') module.exports = CONFIG_RECOMPENSAS;

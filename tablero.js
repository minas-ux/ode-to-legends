// tablero.js — Sala de evidencias: el tablero de corcho de Jian Lin (Fase 3).
// Solo datos, se edita a mano (parser.js nunca lo toca). Ver GUIA-MARCADORES.md, sección 12.
//
// En el manuscrito, cada pista se marca dentro del texto: [pista:usb|USB].
// Al tocarla, la lectora la "clava" en el tablero (y gana puntos, ver recompensas.js).
// En el tablero puede unir dos pistas: si esa pareja está en "conexiones", se
// revela la deducción; si no, puede anotar su propia teoría en la bitácora.

const CONFIG_TABLERO = {
  // id (el mismo de [pista:id|...]) → lo que se ve en la tarjeta del tablero.
  //   titulo: el nombre en la tarjeta
  //   nota:   lo que Jian anotaría sobre ella (aparece al seleccionarla)
  //   imagen: opcional, ruta a una imagen para la tarjeta (estilo polaroid)
  pistas: {
    usb: {
      titulo: 'USB',
      nota: 'Una memoria pequeña, con letras grabadas a rasguños. No encaja con el departamento limpio y pulcro del señor Guo.',
      imagen: ''
    },
    postal: {
      titulo: 'La postal',
      nota: 'Decorada con el dibujo burdo de una estrella caricaturizada, sonriente. Estaba encima de la primera página de la carpeta, junto a una bolsa de plástico vacía.',
      imagen: ''
    },
    carpeta: {
      titulo: 'Carpeta con manchas',
      nota: 'Demasiado gruesa para ser de trámites personales. Repleta de cientos de manchas de tinta negra, sin un solo atisbo de texto.',
      imagen: ''
    },
    mitad: {
      titulo: '"Mitad"',
      nota: 'Una nota debajo de la alfombra, al lado de la ventila. Apenas un garabato: una sola palabra.',
      imagen: ''
    }
  },

  // Parejas de pistas que se pueden conectar (el orden no importa).
  //   titulo:    nombre corto de la deducción
  //   deduccion: lo que se revela al unirlas (con la voz que prefieras)
  // Ejemplo (bórrale las barras para activarlo y escribe tu deducción):
  // { pistas: ['postal', 'carpeta'], titulo: '...', deduccion: '...' },
  conexiones: []
};

if (typeof module !== 'undefined') module.exports = CONFIG_TABLERO;

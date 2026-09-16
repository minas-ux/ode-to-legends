// escritorio-secreto.js — Configuración del "escritorio mix-media" que aparece
// tras acertar la contraseña de un capítulo secreto (ver GUIA-MARCADORES.md, sección 2.2).
// Solo datos: qué imagen va dónde, cuáles son decorativas y cuáles interactivas.
// A diferencia de "capitulos" en story.js, este archivo NUNCA lo pisa parser.js —
// se edita siempre a mano.

const CONFIG_ESCRITORIO = {
  // Carpeta donde viven las imágenes del escritorio.
  carpeta: 'assets/Capitulo-secreto/',

  // Una entrada por número de capítulo secreto (el mismo "numero" que en story.js).
  // Si un capítulo secreto con [clave:...] no tiene entrada aquí, conserva el
  // comportamiento anterior: al acertar la contraseña entra directo al capítulo,
  // sin pasar por ningún escritorio.
  //
  // Posiciones/tamaños pensados como una vista cenital de escritorio: unas
  // piezas grandes anclan la composición (carpeta, ficha dactilar, dossier) y
  // las pequeñas (curita, pastillas, ticket, recibo) quedan como acentos en
  // las esquinas — como en la referencia de moodboard que usamos para ajustar
  // esto la última vez.
  escritorios: {
    '07': {
      items: [
        // --- Decorativas (prefijo DECO_): solo ambientan, no reaccionan al clic ---
        { archivo: 'DECO_bandaid.png', deco: true, top: '15%', left: '2%', width: '11%', rotate: -8, zIndex: 4 },
        { archivo: 'DECO_plantilla-dactilar.jpg', deco: true, top: '1%', left: '30%', width: '37%', rotate: 2, zIndex: 2 },
        { archivo: 'DECO_Apuntes.png', deco: true, top: '2%', left: '73%', width: '26%', rotate: 3, zIndex: 3 },
        { archivo: 'DECO_file.png', deco: true, top: '22%', left: '20%', width: '28%', rotate: -2, zIndex: 3 },
        { archivo: 'DECO_ticket.png', deco: true, top: '68%', left: '73%', width: '16%', rotate: -9, zIndex: 4 },

        // --- Interactivas: hover con animación sutil; clic según "accion" ---
        // accion: 'info'        -> fundido a negro + acercamiento a la imagen, con la nota a la derecha.
        // accion: 'audio'       -> lo mismo, y además reproduce/pausa "audio" (mismo mini-reproductor de siempre).
        // accion: 'desbloquear' -> sin fundido ni nota: cierra el escritorio y entra directo al capítulo secreto.
        {
          archivo: 'pills_placeholder.png',
          top: '29%', left: '2%', width: '10%', rotate: 6, zIndex: 5,
          accion: 'info',
          tooltip: 'Entiendes que esto no es una cura, ¿cierto?'
        },
        {
          archivo: 'fabric_tear_placeholder.png',
          top: '2%', left: '13%', width: '14%', rotate: -10, zIndex: 5,
          accion: 'info',
          tooltip: 'Un fragmento de tela rasgada y vieja. Parece de buena calidad...'
        },
        {
          archivo: 'floppy disk.png',
          top: '11%', left: '58%', width: '15%', rotate: -6, zIndex: 6,
          accion: 'audio',
          audio: 'assets/audio/the-first-flower.mp3',
          etiqueta: 'Tema secreto',
          tooltip: 'Hay una nota adjunta: "¡Ya que no viniste a verme, como mínimo debes decirme qué piensas de este demo!"'
        },
        {
          archivo: 'criminal file.jpg',
          top: '30%', left: '48%', width: '25%', rotate: 1, zIndex: 5,
          accion: 'info',
          tooltip: 'Es el único documento que prueba que existe.'
        },
        {
          archivo: 'photocard_placeholder.png',
          top: '40%', left: '2%', width: '21%', rotate: -6, zIndex: 5,
          accion: 'info',
          tooltip: 'Bueno, al menos es una funda nueva...'
        },
        {
          archivo: 'flower.png',
          top: '37%', left: '77%', width: '15%', rotate: 5, zIndex: 5,
          accion: 'desbloquear',
          tooltip: 'Be a flower.'
        },
        {
          archivo: 'recibo-placeholder.png',
          top: '62%', left: '83%', width: '16%', rotate: 8, zIndex: 5,
          accion: 'info',
          tooltip: 'Siempre cumple sus promesas.'
        }
      ]
    }
  }
};

if (typeof module !== 'undefined') module.exports = CONFIG_ESCRITORIO;

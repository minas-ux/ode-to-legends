// escritorio-secreto.js — Configuración del "escritorio mix-media" que aparece
// tras acertar la contraseña de un capítulo secreto (ver GUIA-MARCADORES.md, sección 2.2).
// Solo datos: qué imagen va dónde, cuáles son decorativas y cuáles interactivas.
// A diferencia de "capitulos" en story.js, este archivo NUNCA lo pisa parser.js —
// se edita siempre a mano.

const CONFIG_ESCRITORIO = {
  // Carpeta donde viven las imágenes del escritorio.
  carpeta: 'assets/capitulo-secreto/',

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
    // Si el capítulo secreto cambia de número en el manuscrito, cambia también esta clave.
    '15': {
      items: [
        // --- Decorativas (prefijo deco_): solo ambientan, no reaccionan al clic ---
        { archivo: 'deco_bandaid.webp', deco: true, top: '15%', left: '2%', width: '11%', rotate: -8, zIndex: 4 },
        { archivo: 'deco_plantilla-dactilar.webp', deco: true, top: '1%', left: '30%', width: '37%', rotate: 2, zIndex: 2 },
        { archivo: 'deco_apuntes.webp', deco: true, top: '2%', left: '73%', width: '26%', rotate: 3, zIndex: 3 },
        { archivo: 'deco_file.webp', deco: true, top: '22%', left: '20%', width: '28%', rotate: -2, zIndex: 3 },
        { archivo: 'deco_ticket.webp', deco: true, top: '68%', left: '73%', width: '16%', rotate: -9, zIndex: 4 },

        // --- Interactivas: hover con animación sutil; clic según "accion" ---
        // accion: 'info'        -> fundido a negro + acercamiento a la imagen, con la nota a la derecha.
        // accion: 'audio'       -> lo mismo, y además reproduce/pausa "audio" (mismo mini-reproductor de siempre).
        // accion: 'desbloquear' -> sin fundido ni nota: cierra el escritorio y entra directo al capítulo secreto.
        // accion: 'reproductor' -> abre el MP3 con la lista de "reproductor" (ver el objeto mp3.webp, abajo).
        {
          archivo: 'pills_placeholder.webp',
          top: '29%', left: '2%', width: '10%', rotate: 6, zIndex: 5,
          accion: 'info',
          tooltip: 'Entiendes que esto no es una cura, ¿cierto?'
        },
        {
          archivo: 'fabric_tear_placeholder.webp',
          top: '2%', left: '13%', width: '14%', rotate: -10, zIndex: 5,
          accion: 'info',
          tooltip: 'Un fragmento de tela rasgada y vieja. Parece de buena calidad...'
        },
        {
          archivo: 'floppy-disk.webp',
          top: '11%', left: '58%', width: '15%', rotate: -6, zIndex: 6,
          accion: 'audio',
          audio: 'assets/audio/the-first-flower.mp3',
          etiqueta: 'Tema secreto',
          tooltip: '"¡Ya que no viniste a verme, como mínimo debes decirme qué piensas de este demo! ¿Te recuerda a algo? - Un clic para activarlo. Otro para detenerlo."'
        },
        {
          archivo: 'criminal-file.webp',
          top: '30%', left: '48%', width: '25%', rotate: 1, zIndex: 5,
          accion: 'info',
          tooltip: 'Es el único documento que prueba que existe.'
        },
        {
          archivo: 'photocard_placeholder.webp',
          top: '40%', left: '2%', width: '21%', rotate: -6, zIndex: 5,
          accion: 'info',
          tooltip: 'Bueno, al menos es una funda nueva...'
        },
        {
          archivo: 'flower.webp',
          top: '37%', left: '77%', width: '15%', rotate: 5, zIndex: 5,
          accion: 'desbloquear',
          tooltip: 'Be a flower.'
        },
        {
          archivo: 'recibo-placeholder.webp',
          top: '62%', left: '83%', width: '16%', rotate: 8, zIndex: 5,
          accion: 'info',
          tooltip: 'Siempre cumple sus promesas.'
        },
        {
          // El MP3 de Midnight_Sun: su playlist "午夜" (YouTube, lista PLKjmNe5NvDqI).
          archivo: 'mp3.webp',
          top: '66%', left: '30%', width: '22%', rotate: -4, zIndex: 6,
          accion: 'reproductor',
          tooltip: 'Reproductor MP3',
          reproductor: {
            carpeta: '~/midnight_sun/午夜',
            // Código de la lista en YouTube (lo que va después de "list=" en el enlace).
            // Se usa para el botón "abrir en YouTube" si el reproductor no puede cargar aquí.
            listaYoutube: 'PLKjmNe5NvDqI',
            // Cada pista:
            //   youtube:    el código del video (lo que va después de "watch?v=" en el enlace)
            //   titulo, artista
            //   nota:       opcional, un comentario de Midnight_Sun que aparece al reproducirla
            //   desbloqueo: 'siempre' = disponible desde el inicio;
            //               'secreto:<id>' = tras abrir ese secreto del texto (p. ej. 'secreto:noduele');
            //               'clave:<contraseña>' = al tocarla pide la contraseña (sin importar
            //               mayúsculas), p. ej. 'clave:midnight';
            //               'bug:<id>' = tras reportar ese bug del texto (p. ej. 'bug:escalera').
            //               Mientras no se cumpla, la canción aparece como archivo cifrado.
            //   pistaClave: opcional, solo con 'clave:': una pista que se muestra al pedir la contraseña
            pistas: [
              { youtube: 'ejqCY4dGcq0', titulo: 'Intro (Infected)', artista: 'Sickick', nota: '', desbloqueo: 'siempre' },
              { youtube: '7EcF0t_4pyk', titulo: 'Happy Face', artista: 'Jagwar Twin', nota: '', desbloqueo: 'siempre' },
              { youtube: 'CcFgB4faXPY', titulo: 'Gasoline', artista: 'Halsey', nota: 'Da cierta... Nostalgia.', desbloqueo: 'siempre' },
              { youtube: 'ttlXr7hm29w', titulo: 'DISAPPEAR', artista: 'VERTYGO', nota: '', desbloqueo: 'siempre' },
              { youtube: '-PJYcsyIMBc', titulo: 'Dj Got Us Falling in Love', artista: 'Lerion', nota: '¿Recuerdas esa noche?', desbloqueo: 'siempre' },
              { youtube: 'a-LmzX9BSGo', titulo: 'Where have you been?', artista: 'Atlisso', nota: '', desbloqueo: 'siempre' },
              { youtube: 'mp4lB3d9rcQ', titulo: 'Your Idol', artista: 'Ghost Whisper', nota: '¿No es lo de hoy?.', desbloqueo: 'siempre' },
              { youtube: 'I_Tqu1LABGk', titulo: 'headlock', artista: 'ANDREWBATES', nota: '¿Estarás ahí?', desbloqueo: 'siempre' },
              // Ejemplos de canciones cifradas: cámbialos por la condición que prefieras.
              { youtube: 'vL5SpROBdcA', titulo: 'Mask Off', artista: 'Future', nota: 'Un tema secreto', desbloqueo: 'clave:máscara', pistaClave:'Una cara, sin ser una.'  },
              { youtube: 'N5ffKYveSj8', titulo: "They Don't Care About Us", artista: 'Saliva', nota: '¿Y por qué lo harían?', desbloqueo: 'clave:Michael' , pistaClave:'Si pudieras cantar con alguien...' }
            ]
          }
        }
      ]
    }
  }
};

if (typeof module !== 'undefined') module.exports = CONFIG_ESCRITORIO;

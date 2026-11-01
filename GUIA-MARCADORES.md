# Guía de marcadores — 传奇之歌

Todo se escribe dentro de `assets/manuscrito.txt`. Después de editarlo, corre:

```
node parser.js
```

Eso regenera `story.js`. Nunca edites `capitulos` a mano ahí, se sobreescribe. Las secciones `secretos`, `bugs` y `extras` sí se conservan y puedes editarlas directamente.

Al terminar, `parser.js` revisa el manuscrito y avisa en la consola si encuentra:

- un `KEY POINTS` fuera de `[notas]` (quien lee lo vería),
- un color mal escrito (por ejemplo `##efd6bc`),
- una ruta de imagen o audio que no existe **con esas mismas mayúsculas y minúsculas**.

`story.js` se genera igual, pero conviene corregir cada aviso. Si todo está bien, dice: *"Revisión: sin notas visibles, colores válidos y todas las rutas coinciden."*

> **Nombres de archivo:** todo dentro de `assets/` va en **minúsculas** (archivos y carpetas). En Windows `Foto.png` y `foto.png` son el mismo archivo, pero en un hosting web no, y la imagen o el audio no cargarían.

### Antes de publicar en GitHub Pages

Cada vez que agregues ilustraciones, fotos o canciones nuevas, corre en este orden:

```
node herramientas/optimizar.js --simular
node herramientas/optimizar.js
node parser.js
```

- **`optimizar.js`** convierte las imágenes PNG/JPG nuevas a **WebP** (máximo 1400 px por lado, conserva la transparencia) y **actualiza solo sus referencias** en el manuscrito, `story.js`, `escritorio-secreto.js`, `tablero.js`, `expediente.js`, `app.js`, `index.html` y esta guía. También reconvierte a 128 kbps los MP3 que superen 160 kbps. Puedes seguir agregando PNG o JPG con normalidad: el script los convierte después. Con `--simular` muestra qué haría sin tocar nada.
- Los **originales** se mueven a `../respaldo-originales/`, fuera del proyecto (no se publican).
- **`parser.js`** confirma que todas las rutas existen y marca los scripts de `index.html` con una versión nueva (`app.js?v=202610252232`). Así, tras publicar, el navegador de la lectora descarga todo junto y no mezcla archivos viejos de la caché con los nuevos.
- La primera vez en otra computadora, instala las herramientas con `npm install` dentro de `herramientas/`.

---

## 1. Capítulos

```
### CAPÍTULO 01: Hidden Hollow
```

- El número define el orden y el `id`.
- El título después de `:` es opcional (si lo omites, usa "Capítulo NN").
- Los párrafos van debajo, separados por una línea en blanco entre cada uno.

### 1.1 Capítulos en proceso y notas de autora

```
### CAPÍTULO 07: Destino

EN PROCESO DE ESCRITURA

[notas]
KEY POINTS:
Jian habla con LQG...
Zhanshi intenta acceder al USB...
[/notas]

Aquí empieza el texto que sí se lee...
```

- **`EN PROCESO DE ESCRITURA`** (en su propia línea, en cualquier parte del capítulo) marca el capítulo como borrador. Quien lee ve bajo el título: *"[ Sistema ] Capítulo en construcción · el contenido puede cambiar"*. Cuando lo termines, borra esa línea.
- **`[notas]` … `[/notas]`** encierra tus notas internas. Todo lo que quede dentro se descarta al correr `parser.js`: no llega a `story.js`, así que quien lee no puede verlo ni en el código de la página. Puedes usar tantos bloques como quieras, en cualquier capítulo.
- Un capítulo normal que solo tiene notas (ningún párrafo legible) **no aparece** en el menú ni al avanzar. Se muestra solo en cuanto le escribas texto. Los capítulos secretos siempre se conservan, porque se llega a ellos por su enlace.

## 2. Capítulo secreto (contenido completo, no un popup)

Justo debajo del encabezado del capítulo:

```
### CAPÍTULO 07: Archivo Clasificado
[tipo: secreto]
Aquí va el contenido de ese capítulo...
```

Esto activa el tema visual de terminal (VT323 + Hanken Grotesk, fondo oscuro) y **excluye ese capítulo del avance lineal normal** — solo se llega a él mediante un enlace `[chapter:...]` (ver abajo). Al terminarlo, el botón dice "Volver a la historia" y regresa exactamente donde el lector se quedó (aunque hayas entrado a un capítulo secreto desde *dentro* de otro capítulo secreto — "volver" siempre deshace un nivel a la vez).

### 2.1 Puerta con acertijo y contraseña (opcional)

Si además quieres que el lector tenga que resolver un acertijo antes de entrar, agrega estas dos líneas (también justo debajo del encabezado):

```
### CAPÍTULO 07: Archivo Clasificado
[tipo: secreto]
[acertijo: ¿Qué animal nunca duerme y siempre vigila?]
[clave: dragón]
Aquí va el contenido de ese capítulo...
```

- `[acertijo:...]` es la pista que se muestra en la puerta. Si la omites pero sí pones `[clave:...]`, se muestra una puerta genérica sin pista.
- `[clave:...]` es la respuesta correcta — la comparación **ignora mayúsculas/minúsculas y espacios sobrantes**, así que "Dragón", "dragón " o "DRAGÓN" funcionan igual.
- **Si un capítulo secreto no tiene `[clave:...]`, no aparece ninguna puerta** — el enlace `[chapter:...]` sigue funcionando como antes, entra directo. La puerta es opcional, capítulo por capítulo.
- Al fallar, la tarjeta hace un efecto de "apagón" tipo monitor CRT y pide reintentar, sin límite de intentos. Al acertar, hay un pulso de "Acceso concedido" antes de revelar el capítulo.
- Opcionalmente, puedes definir sonidos cortos para cada momento:
  ```
  [audio-acertijo: assets/audio/puerta.mp3]
  [audio-exito: assets/audio/acceso-concedido.mp3]
  ```
  Si los omites, la puerta funciona igual, solo que en silencio.

### 2.2 Escritorio mix-media (tras acertar la contraseña)

Si el capítulo secreto tiene una entrada en `escritorio-secreto.js`, al acertar la contraseña **no** entra directo al capítulo: primero aparece un "escritorio" — vista cenital de un escritorio desordenado con recortes, fotos y objetos, estilo collage sobre fondo negro, con la misma piel terminal/hacker. Si el capítulo no tiene entrada ahí, se conserva el comportamiento anterior (entra directo).

Todo el contenido de este escritorio vive en `escritorio-secreto.js`, **no** en `manuscrito.txt` — `parser.js` nunca lo toca, así que edítalo directamente y recarga la página para ver los cambios (no hace falta correr `node parser.js`).

> ⚠️ **Si renumeras el capítulo secreto** en el manuscrito (por ejemplo, al agregar capítulos antes de él, `### CAPÍTULO 07` pasa a ser `### CAPÍTULO 15`), cambia también la clave en `escritorio-secreto.js` (`'07': {` → `'15': {`). Si no coinciden, la contraseña sigue funcionando pero entra directo al capítulo sin pasar por la cinemática ni el escritorio.

Las imágenes se colocan en `assets/capitulo-secreto/`:

- **Prefijo `deco_`** → decorativas. Solo ambientan, no reaccionan al pasar el mouse ni al clic.
- **Cualquier otro nombre** → interactivas. Al pasar el mouse se agrandan ligeramente; al hacer clic, según el campo `accion`:
  - `'info'` → fundido a negro y acercamiento a esa imagen en particular (como inspeccionar un objeto en el inventario de un videojuego), con una nota estilo terminal a la derecha mostrando el texto de `tooltip` (una pista, un dato curioso). Se cierra con la `×`, con Escape o haciendo clic fuera de la imagen/nota, y regresa al escritorio.
  - `'audio'` → lo mismo que `'info'` (fundido + acercamiento + nota), y además reproduce/pausa la pista en `audio` (mismo mini-reproductor de siempre, esquina inferior). Hoy es la única forma de activar esa música — la imagen `flower.png` ya **no** dispara ningún audio por sí sola.
  - `'desbloquear'` → sin fundido ni nota: cierra el escritorio de inmediato y entra al capítulo secreto (hoy es la imagen `flower.png`). Si había música sonando (por ejemplo, activada desde el floppy disk), sigue sonando igual dentro del capítulo — "flower" no la detiene ni la reinicia, solo desbloquea.

  - `'reproductor'` → abre el MP3 de Midnight_Sun: una ventana terminal con el video de YouTube visible (YouTube no permite usar solo el audio), una pantallita LCD con la canción actual y la playlist como explorador de archivos (`~/midnight_sun/午夜`). Al reproducir, la música del mini-reproductor se pausa y vuelve al cerrar.

Cada objeto se define así:

```js
{
  archivo: 'criminal-file.webp',      // nombre exacto del archivo en assets/capitulo-secreto/
  top: '28%', left: '30%',           // posición dentro del escritorio
  width: '20%',                      // ancho relativo
  rotate: -2,                        // grados de inclinación, look "recortado a mano"
  zIndex: 5,                         // qué tan "encima" queda si se superpone con otro
  accion: 'info',
  tooltip: 'Un archivo cerrado. Alguien no quería que esto se supiera.'
}
```

Para añadir un objeto nuevo: copia el bloque anterior dentro del arreglo `items` del capítulo correspondiente (`escritorios['15'].items`, por ejemplo), cambia `archivo` por el nombre del PNG/JPG ya colocado en la carpeta, y ajusta posición/rotación a ojo hasta que quede bien en el escritorio. Para agregar el escritorio a otro capítulo secreto nuevo, agrega una clave nueva con el número de ese capítulo (`'09': { items: [...] }`, por ejemplo) dentro de `escritorios`.

Una vez dentro del capítulo secreto, un botón fijo arriba a la izquierda ("🗂 Escritorio") deja volver a esta pantalla sin salir de la historia; el botón "Volver a la historia" de siempre sigue regresando al punto exacto de la lectura normal.

### 2.3 Playlist del MP3

Las canciones viven en `escritorio-secreto.js`, dentro del objeto `mp3.png` → `reproductor.pistas`:

```js
{ youtube: 'zRHNi3QfFlE', titulo: 'Gasoline', artista: 'Halsey', nota: '', desbloqueo: 'siempre' },
```

- **`youtube`**: el código del video, lo que va después de `watch?v=` en el enlace (`youtube.com/watch?v=`**`zRHNi3QfFlE`**).
- **`nota`** (opcional): un comentario de Midnight_Sun que aparece debajo al reproducirla (`> nota.txt: …`).
- **`desbloqueo`**:
  - `'siempre'` = disponible desde el inicio.
  - `'secreto:<id>'` = se descifra sola cuando quien lee abre ese secreto del texto (por ejemplo `'secreto:noduele'` para `[secret:noduele|No duele]`). Mientras tanto aparece como `▒▒▒▒▒▒▒▒.mp3 [cifrado]` y no se puede tocar.
  - `'clave:<contraseña>'` = aparece como `▒▒▒▒▒▒▒▒.mp3 [clave]`. Al tocarla, el MP3 pide la contraseña (no importan mayúsculas ni espacios). Con la correcta se descifra, suena y queda desbloqueada para siempre en ese navegador.
  - En la Fase 2 se sumarán pistas y puntos.
- **`pistaClave`** (opcional, solo con `'clave:'`): una pista que aparece al pedir la contraseña (`> pista: …`).

```js
{ youtube: 'yumnkZKCxh8', titulo: 'JDNT', artista: 'Glass Animals', nota: '', desbloqueo: 'clave:midnight', pistaClave: 'Mi alias, sin el sol.' },
```

> La contraseña se escribe tal cual en `escritorio-secreto.js`, igual que la del capítulo secreto en el manuscrito: alguien que revise el código de la página podría encontrarla. Para una lectora que juega, no es un problema; si algún día quieres esconderla de verdad, se puede guardar cifrada.
- El orden de la lista es el orden en que suenan. Cambiar la playlist en YouTube **no** la cambia aquí: agrega o quita la línea correspondiente.
- Si un video no se puede reproducir fuera de YouTube (algunos sellos lo prohíben), aparece como `[dañado]` y salta a la siguiente.

## 3. Palabra clave / easter egg (popup tipo tarjeta scrapbook)

Dentro de cualquier párrafo:

```
[secret:reliquia|El grabado del dragón]
```

- `reliquia` es el ID interno (sin espacios, minúsculas).
- `El grabado del dragón` es el texto que se ve subrayado y es clickeable.

Al correr `parser.js` por primera vez con un ID nuevo, se crea automáticamente en `story.js` → `secretos` con una imagen placeholder. Para personalizarlo, edita ese bloque directamente:

```js
"reliquia": {
  "tipo": "imagen",       // o "texto"
  "titulo": "El grabado del dragón",
  "contenido": "assets/mi-ilustracion.jpg",  // o el texto secreto si tipo es "texto"
  "caption": "Boceto encontrado en el margen del cuaderno de campo."
}
```

Esta edición **sobrevive** a futuras corridas de `parser.js`.

## 4. Enlace a un capítulo secreto

También dentro de un párrafo, con la palabra clave `chapter` en vez de `secret`:

```
En las sombras del archivo abandonado, alguien había dejado [chapter:07|un cuaderno cifrado] esperando ser descubierto.
```

- `07` debe coincidir con el número de un capítulo marcado `[tipo: secreto]`.
- Al hacer clic, el lector salta a ese capítulo completo; al terminarlo, vuelve exactamente a donde iba.

## 5. Marcador de música (semicírculo inline)

En **su propio párrafo** (línea en blanco antes y después), en cualquier punto entre párrafos o entre capítulos:

```
[audio:assets/audio/tema-bosque.mp3|Tema del bosque sagrado]
```

- La ruta apunta a un archivo de audio real (si no existe, el botón simplemente no sonará — revisa la consola del navegador).
- La etiqueta después de `|` es opcional y se muestra como texto junto al botón.
- Se renderiza como un pequeño semicírculo flotante que se completa en círculo al pasar el mouse. Al hacer clic reproduce esa pista con fade-in; un segundo clic la detiene con fade-out. Si activas otro marcador mientras suena uno, el anterior se apaga con fundido y empieza el nuevo — nunca suenan dos a la vez.
- No hay música "de fondo automática" por capítulo: solo suena lo que el lector decide activar en un marcador.

---

## 6. Fondo dinámico (color por capítulo o por momento)

En **su propio párrafo** (línea en blanco antes y después), igual que el marcador de audio:

```
[color: #6B8CAF, #4A6D8C, #2F4A63]
```

- 1 a 3 colores en hexadecimal, separados por comas. Si das solo 1 o 2, el resto se rellena repitiendo el último.
- Es una directiva **silenciosa**: no se ve como texto ni como botón, solo cambia el fondo con un fundido suave (~1.6s) cuando el lector llega a ese punto.
- **Si lo pones como el primer párrafo de un capítulo**, define el tono de fondo para todo ese capítulo (hasta que aparezca otro marcador).
- **Si lo pones en medio del capítulo**, el fondo cambia justo ahí — ideal para vincularlo a un personaje, un giro de la trama, o un cambio de escenario.
- Cada capítulo nuevo empieza en la paleta original del PDF a menos que pongas un `[color:...]` propio — los colores no se heredan de un capítulo a otro.
- El color activo se recalcula según en qué parte de la lectura estés, así que "Atrás", "Continuar" y el menú de capítulos siempre muestran el fondo correcto para ese momento sin que tengas que hacer nada más.
- Dentro de un capítulo secreto, el fondo siempre es el tema oscuro de terminal — los marcadores `[color:...]` no aplican ahí.

**Fondo vivo** (`fondo.js`): los tres colores se dibujan como manchas de luz que fluyen despacio, se inclinan hacia el cursor y se desplazan al avanzar en la página, con un grano suave encima. Al cambiar de escena, los colores se transforman (~2 s) en lugar de hacer un fundido.

- **Tema claro y sepia:** pigmento pastel sobre papel. **Tema noche:** luz saturada sobre negro, así que los colores intensos (`#E80707`, `#2CF2A0`…) lucen mucho; los muy claros (`#DFDFEA`) se ven como un resplandor tenue.
- Funciona mejor con colores **distintos entre sí**: tres tonos parecidos se leen como una sola mancha.
- Con "Reducir animaciones" el fondo queda quieto (solo cambia de color). Si el navegador no tiene WebGL, se usa el degradado de siempre.

## 7. Negrita y cursiva

Como Google Docs no exporta el formato bold/cursiva a texto plano, márcalo tú mismo directamente en `manuscrito.txt`:

```
Esto es **una palabra en negrita** y esto es *una palabra en cursiva*.
```

- `**texto**` → negrita
- `*texto*` → cursiva

**No uses `_texto_`** (guion bajo) para cursiva — si aparece cualquier otro guion bajo suelto en el mismo párrafo, el motor los empareja mal y arruina el bloque completo. Usa siempre asteriscos.

> ¿Por qué no simplemente exportar el Google Doc como Markdown? Porque el conversor automático de Docs escapa (le agrega `\` delante) a caracteres como `#`, `[` y `]` para protegerlos — y esos son exactamente los caracteres que usan tus marcadores de capítulo y tus etiquetas `[secret:...]`, `[chapter:...]`, `[audio:...]`. Eso las rompería. Por eso lo más seguro es seguir pegando texto plano y marcar negrita/cursiva a mano con asteriscos.

## 8. Modo de lectura

No requiere ningún marcador — es automático. Cada capítulo se muestra en bloques de varios párrafos (una sola columna, con el ancho e interlineado de un libro cómodo de leer); "Atrás" / "Continuar" avanzan un bloque a la vez, y también funcionan las flechas ← → del teclado.

- El indicador "X / Y" muestra en qué bloque vas dentro del capítulo actual.
- Los marcadores `[audio:...]` y `[color:...]` funcionan igual — aparecen en el bloque que les toque según su posición en el texto.
- Es flujo normal de navegador (sin columnas ni recortes), así que no hay riesgo de que el texto se corte al cambiar el tamaño de la ventana.

## 9. Resaltar texto y comentarios

Función para el lector (o para ustedes dos mientras revisan el borrador): seleccionar cualquier fragmento de texto con el mouse hace aparecer un botón flotante **"✎ Comentar"**. Al hacer clic:

1. Se abre un mini formulario mostrando el fragmento seleccionado, con un campo para escribir el comentario.
2. **Guardar** resalta el texto de forma permanente y guarda el comentario. **Descartar** cierra sin guardar nada.
3. El botón con el ícono ✎ en la esquina inferior izquierda abre el panel con todos los comentarios guardados (agrupados por capítulo, con la opción de saltar a ese capítulo o eliminarlos).
4. Hacer clic sobre un fragmento ya resaltado en el texto también abre el panel, con ese comentario a la vista.

**Importante — dónde se guardan:** hoy los comentarios se guardan con `localStorage`, es decir, **quedan solo en ese navegador/dispositivo**. Tú y tu coautora no los verán una a la otra a menos que compartan pantalla. Si más adelante quieren que los comentarios se sincronicen entre ambas, hay que conectar un backend gratuito (Firebase). Los pasos, cuando estén listas:

1. Entra a [firebase.google.com](https://firebase.google.com/) → **Ir a la consola** → **Crear un proyecto** (gratis, plan Spark).
2. Dentro del proyecto: **Compilación → Firestore Database → Crear base de datos** (modo producción, elige la región más cercana).
3. En **Reglas** de Firestore, algo simple para empezar (dos autoras, sin login formal) sería permitir lectura/escritura solo en la colección de comentarios — pídeme ayuda para redactarlas con más cuidado cuando llegues a este paso.
4. **Configuración del proyecto → Tus apps → Web (`</>`)** → registra una app, copia el objeto `firebaseConfig` que te da.
5. Pásame ese `firebaseConfig` y yo reemplazo las 3 funciones internas de `ComentariosStorage` en `app.js` (están agrupadas y comentadas ahí mismo) por las llamadas equivalentes a Firestore. El resto del código — resaltado, panel, formulario — no cambia nada.

## 10. El Sistema: puntos, logros, bugs y tienda

La lectora empieza con los **1000 puntos** que abona la intro. Gana más cada vez que encuentra algo nuevo (una sola vez por cosa) y los gasta en la tienda de contenido adicional. El contador está arriba a la izquierda; al tocarlo se abre el **Registro del Sistema** (progreso, logros y últimos eventos).

### 10.1 Bugs reportables

Dentro de un párrafo, igual que un secreto:

```
Miró hacia atrás una última vez, antes de comenzar a subir tan [bug:escalera|silenciosamente] como podía.
```

- La palabra se ve con un glitch muy sutil (un parpadeo de color cada pocos segundos). Al tocarla, El Sistema responde *"Error #ESCALERA reportado. Gracias por su colaboración. +150 puntos."* y la palabra queda "corregida".
- Al correr `node parser.js`, cada bug nuevo recibe una entrada en `story.js` → `bugs`, que se conserva entre corridas. Ahí puedes escribir lo que El Sistema "deja escapar" al reportarlo, que aparece con efecto glitch:

```js
"bugs": {
  "escalera": { "mensaje": "no debiste ver esto. vuelve a la lectura." }
}
```

- Un bug reportado también puede desbloquear una canción del MP3: `desbloqueo: 'bug:escalera'`.

### 10.2 Cuánto vale cada cosa: `recompensas.js`

Se edita a mano (no hace falta correr `parser.js`):

- **`puntosIniciales`**: los de la intro (1000). Si lo cambias, cambia también el texto "+1000 puntos han sido abonados" en `intro.js`.
- **`puntos`**: cuánto suma cada descubrimiento: `secreto`, `bug`, `capitulo` (llegar a la última página), `puerta` (acertar la contraseña de un capítulo secreto), `mp3` (descifrar una canción con clave), `pista` y `conexion` (tablero).
  - **Secretos:** solo dan puntos los `[secret:…]` que están **dentro de un capítulo secreto**. Los de capítulos normales (como *No duele*) son contenido a la vista: se abren igual y siguen sirviendo para desbloquear canciones del MP3, pero no suman puntos ni cuentan para los logros de secretos. Para premiar uno en particular, agrégale `"puntos"` en `story.js` → `secretos`:
    ```js
    "noduele": { "tipo": "imagen", "titulo": "No duele", "contenido": "assets/no_duele.webp", "caption": "", "puntos": 150 }
    ```
  - **Marcadores de música** (`[audio:…]`) en el texto nunca dan puntos.
- **`precios`**: precio por defecto en la tienda de `fragmento`, `ilustracion` y `pista`.
- **`logros`**: hitos con nombre y premio. `tipo` es lo que cuenta y `cantidad` cuántos hacen falta (un número o `'todos'`). Un logro solo aparece si en la novela existe algo de su tipo; por ejemplo, "Control de calidad" aparece en cuanto agregues el primer `[bug:…]`.

### 10.3 Tienda de contenido adicional

Al final de la actualización, "Aceptar" abre el contenido adicional. Cada fragmento, ilustración y pista tiene precio. El primer toque pide confirmar (*"¿Confirmar? ◈ 500"*) y el segundo compra. Si faltan puntos, El Sistema dice cuántos.

Para cambiar el precio de un objeto en particular, agrégale `"precio"` en `story.js` → `extras` (`0` = gratis):

```js
{ "id": "fragmento-1", "titulo": "...", "precio": 800, "parrafos": [ ... ] }
```

## 11. Teléfono dentro de la historia

Una conversación (o una pantalla bloqueada llena de notificaciones) que aparece en medio del texto como un teléfono de vidrio esmerilado. Los mensajes emergen uno a uno cuando el teléfono entra en pantalla, con "escribiendo…" antes de cada mensaje recibido. Tocar la pantalla muestra todo de golpe; al terminar, el botón ↻ lo repite.

```
[telefono: Jian Lin | contacto: LQG, color: #5172c4, hora: 02:14]
~ Hoy 02:11
LQG: ¿Sigues despierto?
Jian Lin: Siempre.
LQG: Necesito que me cuentes **todo** lo que viste esta noche.
~ Leído 02:14
[/telefono]
```

- La primera línea dice **de quién es el teléfono**. Los mensajes de ese nombre (o de `Yo`) van a la derecha, como enviados; los demás, a la izquierda, como recibidos.
- **`Nombre: texto`** = un mensaje (ojo: dos puntos **y un espacio** después del nombre). Dentro del texto funcionan negrita, cursiva, `[secret:…]` y `[bug:…]`.
- **`~ texto`** = una línea del teléfono: fecha, "Leído", llamadas perdidas…
- Si hay varios remitentes (un grupo), cada mensaje recibido muestra su nombre.

Opciones después de `|`, separadas por comas (todas opcionales):

| Opción | Qué hace |
|---|---|
| `notificaciones` | Pantalla bloqueada: los mensajes llegan como notificaciones (y el teléfono vibra). Las líneas `~` se ven como llamadas perdidas. |
| `roto` | Pantalla agrietada que parpadea de vez en cuando. Sin `hora`, la hora se ve rota (`--:--`). |
| `hora: 02:14` | La hora en la barra de estado (o en grande, en la pantalla bloqueada). |
| `contacto: LQG` | El nombre en la cabecera del chat. Sin esta opción usa el nombre de quien escribe. |
| `color: #5172c4` | El tono de ese teléfono (avatar y mensajes enviados), para distinguir el de cada personaje. |

Ejemplo real (capítulo 03):

```
[telefono: Cai Jin | notificaciones, roto]
K.: ¿Tanto te cuesta tener un mínimo de consideración?
~ 12 llamadas perdidas de K.
[/telefono]
```

Si una línea dentro del teléfono no sigue el formato, o falta el `[/telefono]`, `parser.js` lo avisa al regenerar.

## 12. Menú de museo y Sala de evidencias (tablero)

### 12.1 Menú de museo

El botón con el número de capítulo (arriba a la derecha) abre el **recorrido**: cada capítulo es una sala con su cuadro y su placa ("Estás aquí", "Recorrida ✓", "Sin visitar" o "En montaje" si está `EN PROCESO DE ESCRITURA`). Al final están las **salas especiales**: la Sala de evidencias y el Archivo de personajes, que se abren cuando hay algo que mostrar.

Para poner la ilustración de un capítulo, agrega en su encabezado (como `[tipo:]` o `[clave:]`):

```
### CAPÍTULO 01: Tiempo
[portada: assets/portadas/cap-01.jpg]
```

Sin portada, la sala usa las imágenes provisionales (`menu-cap-placeholder-1` y `-2`, alternadas). Formato recomendado: vertical, 4:5.

### 12.2 Pistas y tablero de evidencias

En el texto, cada pista se marca dentro del párrafo:

```
Zhanshi reconoció el [pista:usb|USB] casi de inmediato, pero lo otro…
```

- Se ve con un subrayado punteado rojizo. Al tocarla, El Sistema la "clava" en la Sala de evidencias (+100 puntos). Una vez encontrada queda con una chincheta diminuta, y tocarla de nuevo abre el tablero en esa tarjeta.
- Lo que muestra cada tarjeta se define en **`tablero.js`** (no hace falta correr `parser.js` para editarlo): `titulo`, `nota` (lo que Jian anotaría) e `imagen` opcional, que la convierte en polaroid.
- **Conexiones:** en `tablero.js` → `conexiones`, cada pareja de pistas con su `titulo` y `deduccion`. Al unirlas con "Unir con otra pista", se tiende el hilo rojo, se revela la deducción y suma +250 puntos. Si la pareja no está definida, El Sistema ofrece **anotar la teoría en la bitácora**, que la lectora escribe libremente.

```js
conexiones: [
  { pistas: ['postal', 'carpeta'], titulo: 'Venían juntas', deduccion: 'Lo que Jian concluye al unirlas…' }
]
```

`parser.js` avisa si una `[pista:…]` del texto no está en `tablero.js`, o al revés.

Pistas actuales: `usb` (cap. 02), `postal`, `carpeta` y `mitad` (cap. 04).

## 13. Archivo de personajes (expediente)

Fichas policiales en papel manila que se desclasifican con la lectura. Se editan en **`expediente.js`**:

```js
{
  id: 'zhanshi', nombre: 'Zhanshi', alias: '', imagen: '', desde: '02',
  datos: [
    { etiqueta: 'Primera aparición', valor: 'Capítulo 02, «Tacto»', desde: '02' },
    { etiqueta: 'Ocupación', valor: 'Policía', desde: '02' },
    { etiqueta: 'Naturaleza', valor: '…', desde: '12' }
  ]
}
```

- La **ficha** aparece cuando la lectora **termina** el capítulo de su `desde` (llega a su última página).
- Cada **dato** tiene su propio `desde`. Hasta terminar ese capítulo se ve `████████ [clasificado]` y la ficha lleva el sello rojo "Clasificado". Sirve para insinuar de a poco (por ejemplo, la naturaleza mítica con un `desde` lejano).
- Al terminar un capítulo que abre fichas o datos, El Sistema avisa: *"Archivo de personajes actualizado: 2 fichas nuevas."*
- `imagen` (opcional) es el retrato de la ficha; sin imagen se muestran las iniciales.

Por ahora cada ficha solo trae su primera aparición, calculada del texto. Lo demás lo escriben ustedes.

## Resumen rápido de sintaxis

| Qué quieres | Marcador | Dónde va |
|---|---|---|
| Nuevo capítulo | `### CAPÍTULO NN: Título` | Línea propia |
| Capítulo en borrador | `EN PROCESO DE ESCRITURA` | Línea propia, dentro del capítulo |
| Notas de autora (nunca se muestran) | `[notas]` … `[/notas]` | Cada marca en su propia línea |
| Marcar capítulo como secreto | `[tipo: secreto]` | Línea propia, justo bajo el `###` |
| Acertijo de la puerta secreta | `[acertijo: pista]` | Línea propia, justo bajo el `###` |
| Contraseña de la puerta secreta | `[clave: respuesta]` | Línea propia, justo bajo el `###` |
| Sonido al abrir/acertar la puerta | `[audio-acertijo: ruta.mp3]` / `[audio-exito: ruta.mp3]` | Línea propia, justo bajo el `###` |
| Easter egg con popup | `[secret:id\|Palabra]` | Dentro de un párrafo |
| Enlace a capítulo secreto | `[chapter:NN\|Palabra]` | Dentro de un párrafo |
| Bug reportable de El Sistema | `[bug:id\|palabra]` | Dentro de un párrafo |
| Teléfono (chat o notificaciones) | `[telefono: Dueño \| opciones]` … `[/telefono]` | Bloque propio, un mensaje por línea |
| Pista para el tablero | `[pista:id\|palabra]` | Dentro de un párrafo (y definida en `tablero.js`) |
| Ilustración de la sala en el menú | `[portada: ruta.jpg]` | Línea propia, justo bajo el `###` |
| Marcador de música | `[audio:ruta.mp3\|Etiqueta]` | Párrafo propio, separado por líneas en blanco |
| Fondo dinámico | `[color: #hex1, #hex2, #hex3]` | Párrafo propio, separado por líneas en blanco |
| Negrita | `**texto**` | Dentro de un párrafo |
| Cursiva | `*texto*` | Dentro de un párrafo |

# Guía de marcadores — 传奇之歌

Todo se escribe dentro de `assets/manuscrito.txt`. Después de editarlo, corre:

```
node parser.js
```

Eso regenera `story.js`. Nunca edites `capitulos` a mano ahí, se sobreescribe. La sección `secretos` sí se conserva y puedes editarla directamente.

---

## 1. Capítulos

```
### CAPÍTULO 01: Hidden Hollow
```

- El número define el orden y el `id`.
- El título después de `:` es opcional (si lo omites, usa "Capítulo NN").
- Los párrafos van debajo, separados por una línea en blanco entre cada uno.

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

Las imágenes se colocan en `assets/Capitulo-secreto/`:

- **Prefijo `DECO_`** → decorativas. Solo ambientan, no reaccionan al pasar el mouse ni al clic.
- **Cualquier otro nombre** → interactivas. Al pasar el mouse se agrandan ligeramente; al hacer clic, según el campo `accion`:
  - `'info'` → fundido a negro y acercamiento a esa imagen en particular (como inspeccionar un objeto en el inventario de un videojuego), con una nota estilo terminal a la derecha mostrando el texto de `tooltip` (una pista, un dato curioso). Se cierra con la `×`, con Escape o haciendo clic fuera de la imagen/nota, y regresa al escritorio.
  - `'audio'` → lo mismo que `'info'` (fundido + acercamiento + nota), y además reproduce/pausa la pista en `audio` (mismo mini-reproductor de siempre, esquina inferior). Hoy es la única forma de activar esa música — la imagen `flower.png` ya **no** dispara ningún audio por sí sola.
  - `'desbloquear'` → sin fundido ni nota: cierra el escritorio de inmediato y entra al capítulo secreto (hoy es la imagen `flower.png`). Si había música sonando (por ejemplo, activada desde el floppy disk), sigue sonando igual dentro del capítulo — "flower" no la detiene ni la reinicia, solo desbloquea.

Cada objeto se define así:

```js
{
  archivo: 'criminal file.jpg',      // nombre exacto del archivo en assets/Capitulo-secreto/
  top: '28%', left: '30%',           // posición dentro del escritorio
  width: '20%',                      // ancho relativo
  rotate: -2,                        // grados de inclinación, look "recortado a mano"
  zIndex: 5,                         // qué tan "encima" queda si se superpone con otro
  accion: 'info',
  tooltip: 'Un archivo cerrado. Alguien no quería que esto se supiera.'
}
```

Para añadir un objeto nuevo: copia el bloque anterior dentro del arreglo `items` del capítulo correspondiente (`escritorios['07'].items`, por ejemplo), cambia `archivo` por el nombre del PNG/JPG ya colocado en la carpeta, y ajusta posición/rotación a ojo hasta que quede bien en el escritorio. Para agregar el escritorio a otro capítulo secreto nuevo, agrega una clave nueva con el número de ese capítulo (`'09': { items: [...] }`, por ejemplo) dentro de `escritorios`.

Una vez dentro del capítulo secreto, un botón fijo arriba a la izquierda ("🗂 Escritorio") deja volver a esta pantalla sin salir de la historia; el botón "Volver a la historia" de siempre sigue regresando al punto exacto de la lectura normal.

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

## Resumen rápido de sintaxis

| Qué quieres | Marcador | Dónde va |
|---|---|---|
| Nuevo capítulo | `### CAPÍTULO NN: Título` | Línea propia |
| Marcar capítulo como secreto | `[tipo: secreto]` | Línea propia, justo bajo el `###` |
| Acertijo de la puerta secreta | `[acertijo: pista]` | Línea propia, justo bajo el `###` |
| Contraseña de la puerta secreta | `[clave: respuesta]` | Línea propia, justo bajo el `###` |
| Sonido al abrir/acertar la puerta | `[audio-acertijo: ruta.mp3]` / `[audio-exito: ruta.mp3]` | Línea propia, justo bajo el `###` |
| Easter egg con popup | `[secret:id\|Palabra]` | Dentro de un párrafo |
| Enlace a capítulo secreto | `[chapter:NN\|Palabra]` | Dentro de un párrafo |
| Marcador de música | `[audio:ruta.mp3\|Etiqueta]` | Párrafo propio, separado por líneas en blanco |
| Fondo dinámico | `[color: #hex1, #hex2, #hex3]` | Párrafo propio, separado por líneas en blanco |
| Negrita | `**texto**` | Dentro de un párrafo |
| Cursiva | `*texto*` | Dentro de un párrafo |

# SPEC 09 — Juego Snake en `/juegos/snake` con leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05 (patrón de motor + canvas y marco `.crt`), SPEC 06 (tablas `games`/`scores`, `ScoreSubmit`, `LeaderboardPanel`, `/ranking`), SPEC 07 (entrada compartida `lib/games/input.ts` y `submitScore` en `app/juegos/actions.ts`), SPEC 08 (patrón de espera con Espacio, pausa y enlaces del Inicio y la Biblioteca)
> **Fecha:** 2026-11-18
> **Objetivo:** Crear el clásico Snake en TypeScript, jugarlo en `/juegos/snake` dentro de un marco CRT y conectarlo al ranking existente (envío de puntuación con alias, Top 10 y `/ranking?juego=snake`).

---

## Por qué existe esta spec

A diferencia de Tetris, Arkanoid y Asteroids, Snake **no viene de un proyecto de `references/resources/started-games/`**: se diseña desde cero con el mismo contrato de motor. Las frutas salen de `references/resources/source-assets/snake-assets/`: `fruits.png` (3790×442, fondo transparente, 586 KB) y `sprites.js` (atlas `window.SPRITE_ATLAS` con 22 recortes). La hoja trae tres filas con las mismas 22 frutas (iconos lisos, **pixel art** y fotos); el atlas recorta solo la fila de pixel art (`y=136`, alto 160), que es la que usa el juego. La imagen proviene de The Spriters Resource (Google Snake). **Los nombres del atlas no son fiables** (p. ej. `banana` está sobre una manzana roja y `apple` sobre una frambuesa), así que el motor usa solo las coordenadas y no los nombres. La serpiente y el tablero siguen dibujándose en el canvas con formas vectoriales, porque la hoja no trae cuerpo ni cabeza.

La plataforma de puntuaciones ya es genérica por `gameSlug` y las SPEC 07 y 08 dejaron compartidos `createInput` y `submitScore`. Esta spec solo añade el juego, su fila en `games`, la página y los enlaces.

---

## Alcance

**Dentro:**

- Migración `supabase/migrations/<timestamp>_seed_snake.sql` que siembra la fila `snake` en `games`.
- Motor en `lib/games/snake/` (`constants.ts`, `entities.ts` con la lógica del tablero y `engine.ts`) con el contrato `startSnake(canvas, { onGameOver })`.
- Reglas clásicas:
  - Tablero de 20×15 celdas de 40 px (canvas 800×600, 4:3). Se mueve por casillas, no por píxeles.
  - La serpiente empieza con 3 segmentos en el centro, avanzando hacia la derecha.
  - Una fruta en una casilla libre al azar. Al comerla suma 10 puntos, la serpiente **crece 1 segmento** y aparece otra fruta.
  - **Muerte al chocar** con una pared o con su propio cuerpo.
  - **Aceleración:** cada 5 frutas el paso se acorta 10 ms, desde 140 ms hasta un mínimo de 60 ms.
  - **Victoria** si la serpiente llena el tablero (no queda casilla libre para la fruta).
- Control con **flechas y WASD**. No se puede invertir el sentido en un paso (la serpiente no se da la vuelta sobre sí misma) y se encolan como máximo 2 giros para que los giros rápidos no se pierdan.
- **Inicio con Espacio:** al cargar la página la serpiente espera quieta con el aviso "ESPACIO PARA EMPEZAR". Tras GAME OVER o victoria, Espacio reinicia y arranca directamente.
- Pausa con `P` o `Escape`, con overlay "PAUSA" dibujado en el canvas.
- Overlays "GAME OVER" y "¡Tablero completo!" en el canvas, con la puntuación.
- HUD en el mismo canvas: puntuación y longitud.
- Aspecto dibujado en canvas: tablero en cuadrícula tenue, cuerpo de la serpiente en verde de la paleta de la plataforma con la cabeza destacada y ojos según la dirección, y la fruta como sprite de pixel art recortado de `fruits.png`. Cada fruta nueva toma al azar uno de los 22 sprites (solo cosmético: todas valen lo mismo) y se dibuja escalada a la casilla de 40 px conservando su proporción (los recortes miden entre 110 y 170 px de ancho por 160 de alto), con `imageSmoothingEnabled = false` para mantener el pixel art.
- Assets copiados a `public/games/snake/fruits.png` y atlas portado a `lib/games/snake/sprites.ts` como constante tipada (sin `window`). La imagen se carga dentro del motor, no durante el render; el bucle arranca en `onload` y una bandera `stopped` evita arrancarlo si la limpieza ya se ejecutó, como en Arkanoid.
- `onGameOver(score)` opcional, llamado una sola vez por partida: al morir y al ganar.
- Componente cliente `components/snake-game.tsx` con `<ScoreSubmit gameSlug="snake">` bajo el canvas, igual que `components/arkanoid-game.tsx`.
- Página `app/juegos/snake/page.tsx` con título, marco `.crt`, `<LeaderboardPanel gameSlug="snake" limit={10} title="Top 10" />` dentro de `<Suspense>` y leyenda de controles. `metadata`: "Snake · Arcade Vault".
- Una tarjeta "SERPIENTE" en el Inicio (`app/page.tsx`) y en la Biblioteca (`app/biblioteca/page.tsx`) enlazada a `/juegos/snake`, reutilizando la clase `.cover-snake` que ya existe en `app/globals.css`.

**Fuera de alcance (para otras specs):**

- Las filas de iconos lisos y de fotos de `fruits.png`, sprites para la serpiente y animaciones de fruta.
- Frutas con distinto valor o efectos, power-ups, obstáculos, modo de atravesar paredes y niveles.
- Sonido, silenciar y volumen.
- Pausa automática al perder el foco, controles táctiles y mando.
- Cambios en `lib/scores.ts`, `LeaderboardPanel`, `/ranking`, `nav`, `submitScore` y el esquema de la base.
- Autenticación, mejor puntuación por alias, anti-trampas y paginación (fuera de alcance desde la SPEC 06).
- Tests automatizados.

---

## Modelo de datos

Fila a sembrar en `games` (el esquema ya existe, no se toca):

```sql
insert into public.games (slug, name, description)
values ('snake', 'Snake', 'Come frutas, crece y no choques contigo mismo ni con las paredes.');
```

Contrato público del módulo del juego:

```ts
// lib/games/snake/engine.ts
export const WIDTH = 800;
export const HEIGHT = 600;

export function startSnake(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void; // cancelAnimationFrame + retirada de listeners
```

Estructura interna (estado local a `startSnake`, sin globales de módulo):

```ts
type GameState = "ready" | "playing" | "paused" | "gameover" | "win";
type Dir = { x: number; y: number }; // (1,0) derecha, (-1,0) izquierda, (0,-1) arriba, (0,1) abajo
type Cell = { x: number; y: number }; // coordenadas de casilla, no de píxel

interface Game {
  snake: Cell[]; // snake[0] es la cabeza
  dir: Dir; // sentido aplicado en el último paso
  queue: Dir[]; // giros pendientes, máximo 2
  fruit: Cell;
  score: number;
  eaten: number; // frutas comidas en la partida
  stepMs: number; // duración del paso actual
  acc: number; // ms acumulados desde el último paso
  state: GameState;
}
```

Convenciones:

- Constantes: `COLS = 20`, `ROWS = 15`, `CELL = 40`, `INITIAL_LENGTH = 3`, `START_STEP_MS = 140`, `MIN_STEP_MS = 60`, `STEP_DECREASE_MS = 10`, `FRUITS_PER_SPEEDUP = 5`, `POINTS_PER_FRUIT = 10`.
- El tiempo avanza con un acumulador en milisegundos (`acc += dt * 1000`) y se da un paso cada vez que `acc >= stepMs`. `dt` se limita a 0,05 s, así que un fotograma largo da como mucho 1 o 2 pasos en vez de teletransportar la serpiente.
- Velocidad tras `n` frutas: `stepMs = max(MIN_STEP_MS, START_STEP_MS - floor(n / 5) * 10)`. Se alcanza el mínimo a las 40 frutas.
- Un giro se acepta solo si no es el sentido contrario al último encolado (o a `dir` si la cola está vacía) ni el mismo. Se consume uno por paso.
- Colisión: la cabeza fuera de `0..COLS-1 / 0..ROWS-1` o sobre un segmento. La cola **se libera en el mismo paso** si no se come, así que moverse a la casilla que deja la cola es legal.
- Fruta nueva: casilla elegida al azar entre las libres. Si no hay, estado `win`.
- `score` es la puntuación del HUD: 10 por fruta. El máximo posible es 297 frutas (300 casillas − 3 iniciales), es decir **2 970 puntos**, muy por debajo del tope de 1 000 000 de la base. No hace falta migrar el `check`.
- `Math.random` y `performance.now` solo se usan dentro del motor, que arranca en `useEffect`.
- Teclas: `createInput` ya vacía las teclas en `blur`, ignora `keydown` de `input`/`textarea` y hace `preventDefault()` en Espacio y flechas. WASD y `P`/`Escape` no desplazan la página, así que **no hace falta modificar `lib/games/input.ts`** (el paso 2 lo comprueba).

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` las guías de Client Components y `cacheComponents`, según indica `AGENTS.md`. Para la página y los estilos (paso 3), usar el skill `/frontend-design`, como exige `CLAUDE.md`. Se trabaja en la rama `spec-09-juego-snake` con un commit por paso y pausa para confirmar tras cada uno. Cada paso deja la app ejecutable.

1. **Sembrar el juego.** Crear `supabase/migrations/<timestamp>_seed_snake.sql` con el `insert` anterior, mostrarlo, esperar el visto bueno y aplicarlo con `apply_migration` desde el archivo. Verificación: `execute_sql` devuelve la fila `snake` y `games` tiene 4 filas.
2. **Assets y motor.** Copiar `fruits.png` a `public/games/snake/` y portar el atlas a `lib/games/snake/sprites.ts`. Crear `lib/games/snake/constants.ts`, `entities.ts` (movimiento, giros, colisiones, colocación de la fruta y velocidad, sin tocar el canvas) y `engine.ts` con `startSnake`: bucle `requestAnimationFrame`, acumulador de pasos, estados `ready`/`playing`/`paused`/`gameover`/`win`, entrada con `createInput`, carga de la imagen con bandera `stopped`, render en canvas (cuadrícula, serpiente, fruta con sprite, HUD y overlays) y reinicio con Espacio. Verificación: `npx tsc --noEmit` y `npx eslint lib` sin errores, y Asteroids, Tetris y Arkanoid siguen funcionando.
3. **Componente y página.** Crear `components/snake-game.tsx` (`"use client"`, `useRef`, `useEffect` que arranca el motor y devuelve la limpieza; estado `finished {id, score}`; `<ScoreSubmit gameSlug="snake">`; ocultar el formulario al reiniciar con Espacio) y `app/juegos/snake/page.tsx` con `metadata`, marco `.crt`, panel Top 10 en `<Suspense fallback={<LeaderboardSkeleton />}>` y leyenda de controles (flechas o WASD mover, P o Esc pausa, Espacio empezar y reiniciar). El canvas es 800×600 (4:3): añadir en `app/globals.css` solo `.snake-canvas` si hace falta, sin tocar las reglas de los otros juegos. Verificación: `/juegos/snake` muestra el juego y responde al teclado.
4. **Envío de puntuación.** `submitScore` y su `revalidatePath` por `gameSlug` ya son compartidos: no se cambia código. Verificación: `ScoreSubmit` con `gameSlug="snake"` inserta una fila y una entrada inválida devuelve `{ ok: false, error: "invalid" }`.
5. **Enlaces.** Añadir la tarjeta "SERPIENTE" (`cover-snake`, categoría "ARCADE") a `app/page.tsx` y a `app/biblioteca/page.tsx`, enlazada a `/juegos/snake`. Verificación: ambas pulsaciones abren el juego. Nav y `/ranking` no cambian: el juego aparece en el selector al estar sembrado.
6. **Cierre.** Ejecutar `npx tsc --noEmit`, `npx eslint app components lib`, `npx prettier --check .` y `npm run build`. Luego verificar en el navegador una partida completa: llegar a GAME OVER, ver el formulario, enviar un alias, ver la fila en el Top 10 y en `/ranking?juego=snake`, y repetirlo tras reiniciar. Revisar la consola en busca de errores de hidratación.

---

## Criterios de aceptación

- [ ] `npx eslint app components lib`, `npx tsc --noEmit`, `npx prettier --check .` y `npm run build` terminan sin errores.
- [ ] El build lista `/juegos/snake` como ruta (prerenderizado parcial) y los otros tres juegos siguen funcionando igual.
- [ ] `games` contiene una fila con `slug = 'snake'` y existe su migración en `supabase/migrations/`.
- [ ] `/juegos/snake` muestra el juego en un marco `.crt` con el título de pestaña "Snake · Arcade Vault".
- [ ] Al cargar la página la serpiente (3 segmentos, centro, hacia la derecha) y una fruta están visibles, no se mueven y se ve "ESPACIO PARA EMPEZAR". No se puede morir antes de pulsar Espacio.
- [ ] Las flechas y WASD giran la serpiente; invertir el sentido de golpe se ignora, y dos giros rápidos seguidos (p. ej. arriba y luego izquierda) se ejecutan en pasos consecutivos.
- [ ] Comer una fruta suma 10 puntos, hace crecer la serpiente 1 segmento y coloca una fruta nueva en una casilla libre (nunca sobre la serpiente).
- [ ] Cada 5 frutas el paso se acorta 10 ms, sin bajar de 60 ms.
- [ ] Chocar con una pared o con el propio cuerpo muestra "GAME OVER" con la puntuación; ir a la casilla que deja libre la cola no cuenta como choque.
- [ ] Llenar el tablero muestra "¡Tablero completo!" y envía la puntuación como una partida terminada.
- [ ] `P` y `Escape` pausan y reanudan mostrando "PAUSA" en el canvas; en pausa no avanza la serpiente ni se acumula tiempo.
- [ ] Una partida produce como máximo una fila: `onGameOver` se llama una sola vez, tanto en derrota como en victoria, y no se puede enviar dos veces la misma puntuación; "Omitir" no inserta nada.
- [ ] Escribir el alias (incluida la barra espaciadora y las flechas) no mueve la serpiente ni reinicia el juego.
- [ ] Reiniciar con Espacio oculta el formulario y empieza con 3 segmentos, 0 puntos y el paso de 140 ms.
- [ ] Espacio y las flechas no desplazan la página mientras el juego está en pantalla.
- [ ] Navegar fuera de `/juegos/snake` y volver no duplica la velocidad del juego ni `onGameOver`.
- [ ] Mantener una tecla pulsada y cambiar de ventana no deja giros pendientes al volver.
- [ ] Tras enviar, el Top 10 refleja la puntuación sin recarga manual, y `/ranking?juego=snake` lista el juego respetando el orden (puntuación descendente, más antigua primero).
- [ ] Con Supabase inalcanzable la página no falla y muestra "Sin puntuaciones todavía".
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas conserva la proporción 4:3.
- [ ] Pulsar la tarjeta "SERPIENTE" en `/` y la de `/biblioteca` lleva a `/juegos/snake`.
- [ ] Sin errores ni warnings de hidratación en la consola, ninguna clave `service_role` en el repositorio y ningún asset cargado desde `references/` (la imagen sale de `public/games/snake/`).
- [ ] La fruta se ve como pixel art nítido (sin suavizado), entera dentro de su casilla y sin deformarse, y cada fruta nueva puede ser un sprite distinto.
- [ ] Navegar fuera antes de que cargue la imagen no deja ningún bucle ni listener activo.

---

## Decisiones

- **Sí:** motor propio en `lib/games/snake/` sin React y `startSnake(canvas, options)` devolviendo la limpieza. Es el contrato de la SPEC 05 y evita bucles y listeners duplicados con Strict Mode.
- **Sí:** usar las frutas de `snake-assets`, tal como pidió el usuario. Serpiente y tablero siguen vectoriales porque la hoja no los incluye.
- **Sí:** la fila de pixel art del atlas, y no las de iconos lisos o fotos. Es la que recorta `sprites.js` y la que encaja con un arcade.
- **Sí:** ignorar los nombres del atlas y usar solo coordenadas. Varios no coinciden con el dibujo.
- **Sí:** fruta elegida al azar entre los 22 sprites, solo cosmética.
- **Sí:** muerte al chocar con pared o cuerpo. Es el Snake clásico y decisión del usuario.
- **No:** atravesar paredes. Cambia la dificultad y la lectura del ranking.
- **Sí:** 10 puntos por fruta, crecimiento de 1 segmento por fruta y aceleración cada 5 frutas (140 ms → 60 ms, -10 ms). Decisión del usuario; el tope evita un juego injugable.
- **No:** frutas con distinto valor. Los nombres del atlas no son fiables y complicaría el ranking.
- **Sí:** flechas y WASD, pausa con `P`/`Escape` y Espacio para empezar y reiniciar. Decisión del usuario, alineada con Arkanoid.
- **Sí:** movimiento por casillas con acumulador de milisegundos y `dt` limitado a 0,05 s. Es el ritmo clásico y evita saltos tras volver a la pestaña.
- **Sí:** cola de giros de 2 y prohibición de invertir el sentido. Sin esto, dos pulsaciones rápidas dentro de un mismo paso hacen que la serpiente se coma a sí misma.
- **Sí:** liberar la casilla de la cola en el mismo paso si no se come. Es la regla clásica y evita muertes injustas al seguirse la cola.
- **Sí:** estado de espera al cargar y reinicio con Espacio tras terminar. Es el patrón de Arkanoid: en una página web arrancar sola mata la serpiente antes de que el jugador esté listo.
- **Sí:** `onGameOver(score)` también al ganar. La partida termina igualmente y la puntuación es válida para el ranking.
- **Sí:** HUD y overlays dibujados en el canvas, sin panel React. Mantiene la coherencia con los otros juegos.
- **Sí:** reutilizar `.cover-snake` para las tarjetas. Ya existe en `app/globals.css`.
- **No:** tocar `lib/scores.ts`, `LeaderboardPanel`, `/ranking`, el nav ni `submitScore`. Ya son genéricos por `gameSlug`.
- **No:** copiar código a `public/` ni usar un iframe. No hay forma limpia de leer la puntuación.
- **No:** migrar el `check` de `score`. El máximo posible es 2 970.

---

## Riesgos

| Riesgo                                                                                                   | Mitigación                                                                                         |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Con Strict Mode el `useEffect` corre dos veces y el juego se duplica.                                    | `startSnake` devuelve la limpieza y el `useEffect` la retorna; hay un criterio de aceptación.      |
| `cacheComponents` rompe el prerender si se usa `Math.random` o `performance.now` en render.              | Todo vive dentro del motor, que arranca en `useEffect`.                                            |
| Dos giros rápidos en un mismo paso hacen que la serpiente se invierta y muera.                           | Cola de 2 giros y validación contra el último giro encolado, no contra la posición actual.         |
| Colocar la fruta al azar sobre la serpiente, o bucle infinito con el tablero casi lleno.                 | Se elige entre la lista de casillas libres, no por reintento; si la lista está vacía, victoria.    |
| Una `dt` grande da muchos pasos seguidos tras volver a la pestaña.                                       | `dt` limitado a 0,05 s, como mucho 1 o 2 pasos por fotograma a 60 ms.                              |
| La imagen carga de forma asíncrona y el componente se desmonta antes: el bucle arranca tras la limpieza. | Bandera `stopped` comprobada en `onload`; criterio de aceptación específico.                       |
| Los recortes del atlas tienen anchos distintos y la fruta se ve deformada o cortada.                     | Escalar por la altura manteniendo la proporción y centrar en la casilla; se comprueba visualmente. |
| Los nombres del atlas no coinciden con el dibujo.                                                        | No se usan nombres; solo índices y coordenadas.                                                    |
| WASD o `P` escritos en el campo del alias mueven o pausan el juego.                                      | `createInput` ya ignora `keydown` de `input`/`textarea`; hay un criterio de aceptación.            |
| En móvil no hay teclado, así que no es jugable.                                                          | Aceptado, igual que en las SPEC 05, 07 y 08; los controles táctiles quedan fuera de alcance.       |
| Alguien envía una puntuación falsa.                                                                      | Aceptado desde la SPEC 06; los `check` de la tabla acotan alias y puntuación.                      |

---

## Qué **no** está en esta spec

- Sprites para la serpiente y las filas de iconos lisos y fotos de `fruits.png`.
- Frutas con distinto valor, power-ups, obstáculos, niveles y modo sin paredes.
- Sonido, volumen, pausa automática, controles táctiles y mando.
- Autenticación, mejor puntuación por alias, anti-trampas y paginación.
- Cambios en el esquema, `lib/scores.ts`, `LeaderboardPanel`, `/ranking`, el nav y `submitScore`.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propia spec.

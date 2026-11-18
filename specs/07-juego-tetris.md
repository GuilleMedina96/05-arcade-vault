# SPEC 07 — Juego Tetris en `/juegos/tetris` con leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05 (patrón de motor + canvas y marco `.crt`), SPEC 06 (tablas `games`/`scores`, `ScoreSubmit`, `LeaderboardPanel`, `/ranking`), SPEC 02 (tarjeta "CAÍDA" del Inicio)
> **Fecha:** 2026-11-17
> **Objetivo:** Portar a TypeScript el Tetris de `references/resources/started-games/03-tetris/`, jugarlo en `/juegos/tetris` dentro de un marco CRT y conectarlo al ranking existente (envío de puntuación con alias, Top 10 y `/ranking?juego=tetris`).

---

## Por qué existe esta spec

El juego existe como proyecto independiente: `index.html` + `game.js` (332 líneas, JavaScript con variables globales, `document.getElementById`, un `document.addEventListener('keydown')` que nunca se retira y un toggle de tema propio). Esa forma no encaja en Next.js por las mismas razones que explicó la SPEC 05: el bucle y los listeners se duplicarían con el doble montaje de Strict Mode y con la navegación.

La SPEC 05 dejó el patrón (motor sin React que devuelve su limpieza) y la SPEC 06 dejó la plataforma de puntuaciones genérica por `gameSlug`. Tetris es el segundo juego que las usa. Esta spec sigue ese patrón y solo toca lo que hoy está acoplado a Asteroids: la Server Action `submitScore` y su `revalidatePath`, y la entrada de teclado.

---

## Alcance

**Dentro:**

- Migración `supabase/migrations/<timestamp>_seed_tetris.sql` que siembra la fila `tetris` en `games`.
- Port a TypeScript en `lib/games/tetris/`: constantes, piezas, lógica del tablero y motor.
- Gameplay del original: tablero 10×20, bloque de 30 px, 7 piezas clásicas, rotación horaria con _wall kicks_ `[0, -1, 1, -2, 2]`, pieza fantasma (alfa 0,2), pieza siguiente, caída por gravedad, _soft drop_ (+1 por fila), _hard drop_ (+2 por celda), puntuación por líneas `[0, 100, 300, 500, 800] × nivel`, nivel `floor(líneas / 10) + 1` e intervalo de caída `max(100, 1000 − (nivel − 1) × 90)` ms.
- Pausa con `P` y overlay "PAUSA" y "GAME OVER" dibujados en el canvas. Reinicio con Espacio tras GAME OVER.
- HUD (puntuación, líneas, nivel, pieza siguiente) dibujado en el mismo canvas, en un panel lateral a la derecha del tablero.
- `onGameOver(score)` opcional en el motor, llamado una sola vez por partida al terminar (cuando la pieza que aparece colisiona).
- Entrada de teclado compartida: mover `createInput` de `lib/games/asteroids/input.ts` a `lib/games/input.ts` y actualizar el import de Asteroids en el mismo cambio.
- Componente cliente `components/tetris-game.tsx` con `<ScoreSubmit>` bajo el canvas, igual que `components/asteroids-game.tsx`.
- Página `app/juegos/tetris/page.tsx` con título, marco `.crt`, `<LeaderboardPanel gameSlug="tetris" limit={10} title="Top 10" />` dentro de `<Suspense>` y leyenda de controles. `metadata`: "Tetris · Arcade Vault".
- Generalizar `submitScore`: moverlo a `app/juegos/actions.ts` y hacer que `revalidatePath` use `` `/juegos/${gameSlug}` `` además de `/ranking`. Actualizar el import en `components/score-submit.tsx`.
- La tarjeta "CAÍDA" del Inicio (`app/page.tsx`) enlaza a `/juegos/tetris`.

**Fuera de alcance (para otras specs):**

- La pieza "N" (tuerca 3×3) del original: se decide no portarla (ver Decisiones).
- Hold, _lock delay_, sistema de rotación SRS, "bolsa de 7", T-spins, combos y niveles máximos.
- Pausa automática al perder el foco, controles táctiles, mando y sonido.
- Toggle de tema claro/oscuro del original y los estilos de `style.css`.
- Cambios en `lib/scores.ts`, `LeaderboardPanel`, `/ranking`, `nav` y el esquema de la base.
- Autenticación, mejor puntuación por alias, anti-trampas y paginación (fuera de alcance desde la SPEC 06).
- Port de Arkanoid.
- Tests automatizados.

---

## Modelo de datos

Fila a sembrar en `games` (el esquema ya existe, no se toca):

```sql
insert into public.games (slug, name, description)
values ('tetris', 'Tetris', 'Encaja las piezas, completa líneas y aguanta el mayor tiempo posible.');
```

Contrato público del módulo del juego:

```ts
// lib/games/tetris/engine.ts
export const WIDTH = 450; // 300 de tablero + 150 de panel lateral
export const HEIGHT = 600;

export function startTetris(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void; // cancelAnimationFrame + retirada de listeners
```

Estructura interna (sustituye a los globales de `game.js`):

```ts
type GameState = "playing" | "paused" | "gameover";

interface Piece {
  type: number; // 1..7, índice en COLORS
  shape: number[][];
  x: number;
  y: number;
}

interface Game {
  board: number[][]; // ROWS × COLS; 0 = vacío, 1..7 = color
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  dropInterval: number; // ms
  dropAccum: number; // ms
  state: GameState;
}
```

Convenciones:

- Constantes copiadas tal cual: `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `LINE_SCORES = [0, 100, 300, 500, 800]` y los colores de las 7 piezas (I, O, T, S, Z, J, L). Se descarta el índice 8 (N).
- Unidades: la gravedad usa **milisegundos** (`dropAccum`, `dropInterval`), como el original, no segundos. Para evitar saltos tras volver a la pestaña, el `dt` de un fotograma se limita a 50 ms (ajuste necesario al integrar en una página, equivalente al de la SPEC 05).
- `randomPiece` elige uniformemente entre los 7 tipos (`Math.floor(Math.random() * 7) + 1`), no usa bolsa.
- `score` es la puntuación del HUD: líneas × nivel + puntos de caída. Es el valor que recibe `onGameOver` y el que se envía al ranking. La puntuación realista queda muy por debajo del tope de 1 000 000 de la base, así que no hace falta migrar el `check`.
- Las piezas se dibujan con la misma función `drawBlock` (relleno + franja de brillo superior). El color de la rejilla, que el original leía de una variable CSS del `body`, pasa a una constante del motor.

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` las guías de Client Components, `cacheComponents` y Server Actions, según indica `AGENTS.md`. Para la página y los estilos (paso 3), usar el skill `/frontend-design`, como exige `CLAUDE.md`. Se trabaja en la rama `spec-07-tetris` con un commit por paso y pausa para confirmar tras cada uno. Cada paso deja la app ejecutable.

1. **Sembrar el juego.** Crear `supabase/migrations/<timestamp>_seed_tetris.sql` con el `insert` anterior, mostrarlo, esperar el visto bueno y aplicarlo con `apply_migration` desde el archivo. Verificación: `execute_sql` devuelve la fila `tetris` y `games` tiene 2 filas.
2. **Entrada compartida y motor.** Mover `createInput` a `lib/games/input.ts` (y actualizar el import de `lib/games/asteroids/engine.ts`); ampliar su conjunto de teclas con `ArrowDown` para que no haga scroll. Crear `lib/games/tetris/constants.ts`, `lib/games/tetris/board.ts` (`createBoard`, `collide`, `rotateCW`, `merge`, `clearLines`, `ghostY`) y `lib/games/tetris/engine.ts` con `startTetris`: bucle `requestAnimationFrame`, gravedad en ms, pausa con `P`, GAME OVER, reinicio con Espacio, dibujo del tablero, fantasma, HUD y pieza siguiente. Verificación: `npx tsc --noEmit` y `npx eslint lib` sin errores, y Asteroids sigue funcionando.
3. **Componente y página.** Crear `components/tetris-game.tsx` (`"use client"`, `useRef`, `useEffect` que arranca el motor y devuelve la limpieza; estado `finished {id, score}`; `<ScoreSubmit gameSlug="tetris">`; ocultar el formulario al reiniciar con Espacio) y `app/juegos/tetris/page.tsx` con `metadata`, marco `.crt`, panel Top 10 en `<Suspense fallback={<LeaderboardSkeleton />}>` y leyenda de controles (← → mover, ↑ rotar, ↓ bajar, Espacio caída, P pausa). El canvas es 450×600 (vertical): añadir en `app/globals.css` una clase `.tetris-canvas` y el ajuste de proporción del marco que haga falta, sin tocar las reglas de Asteroids. Verificación: `/juegos/tetris` muestra el juego y responde al teclado.
4. **Envío de puntuación compartido.** Mover `submitScore` de `app/juegos/asteroids/actions.ts` a `app/juegos/actions.ts`, cambiar `revalidatePath("/juegos/asteroids")` por ``revalidatePath(`/juegos/${gameSlug}`)`` (más `/ranking`) y actualizar el import en `components/score-submit.tsx`. Se mantienen las reglas (alias `^[A-Za-z0-9_-]{3,12}$`, `score` entero 0–1 000 000, error genérico). Verificación: `npx tsc --noEmit` sin errores; una entrada inválida devuelve `{ ok: false, error: "invalid" }`.
5. **Enlace desde el Inicio.** Hacer que la tarjeta "CAÍDA" de `app/page.tsx` enlace a `/juegos/tetris`. Verificación: pulsarla abre el juego. Nav y `/ranking` no cambian: el juego aparece en el selector al estar sembrado.
6. **Cierre.** Ejecutar `npx tsc --noEmit`, `npx eslint app components lib`, `npx prettier --check .` y `npm run build`. Luego verificar en el navegador una partida completa: llegar a GAME OVER, ver el formulario, enviar un alias, ver la fila en el Top 10 y en `/ranking?juego=tetris`, y repetirlo tras reiniciar. Revisar la consola en busca de errores de hidratación.

---

## Criterios de aceptación

- [ ] `npx eslint app components lib`, `npx tsc --noEmit`, `npx prettier --check .` y `npm run build` terminan sin errores.
- [x] El build lista `/juegos/tetris` como ruta (prerenderizado parcial) y Asteroids sigue funcionando igual.
- [x] `games` contiene una fila con `slug = 'tetris'` y existe su migración en `supabase/migrations/`.
- [x] `/juegos/tetris` muestra el juego en un marco `.crt` con el título de pestaña "Tetris · Arcade Vault".
- [x] El tablero es de 10×20; aparecen solo las 7 piezas clásicas y se ve la pieza siguiente y la pieza fantasma.
- [x] ← → mueven, ↑ rota con _wall kicks_, ↓ baja una fila (+1 punto) y Espacio hace caída directa (+2 por celda).
- [x] Completar 1, 2, 3 y 4 líneas suma 100, 300, 500 y 800 por el nivel actual; el nivel sube cada 10 líneas y la caída se acelera hasta un mínimo de 100 ms.
- [x] `P` pausa y reanuda la partida mostrando "PAUSA" en el canvas, y no se puede mover mientras está en pausa.
- [x] Al no caber la pieza nueva aparece "GAME OVER" con la puntuación y Espacio reinicia a 0 puntos, 0 líneas y nivel 1.
- [x] Una partida produce como máximo una fila: `onGameOver` se llama una sola vez y no se puede enviar dos veces la misma puntuación; "Omitir" no inserta nada.
- [x] Escribir el alias (incluida la barra espaciadora y las flechas) no mueve, no cae ni reinicia el juego.
- [x] Reiniciar con Espacio oculta el formulario y empieza con 0 puntos.
- [x] Espacio y las flechas (incluida ↓) no desplazan la página mientras el juego está en pantalla.
- [x] Navegar fuera de `/juegos/tetris` y volver no duplica la velocidad del juego ni `onGameOver`.
- [x] Mantener una tecla pulsada y cambiar de ventana no deja la pieza moviéndose al volver.
- [x] Tras enviar, el Top 10 refleja la puntuación sin recarga manual, y `/ranking?juego=tetris` lista el juego respetando el orden (puntuación descendente, más antigua primero).
- [x] Con Supabase inalcanzable la página no falla y muestra "Sin puntuaciones todavía".
- [x] A 375 px de ancho no hay scroll horizontal y el canvas conserva su proporción.
- [x] Pulsar la tarjeta "CAÍDA" en `/` lleva a `/juegos/tetris`.
- [x] Sin errores ni warnings de hidratación en la consola, y ninguna clave `service_role` en el repositorio.

---

## Decisiones

- **Sí:** port a TypeScript con la lógica en `lib/games/tetris/` sin React y `startTetris(canvas, options)` devolviendo la limpieza. Es el contrato de la SPEC 05 y evita bucles y listeners duplicados.
- **Sí:** HUD y pieza siguiente dibujados en el mismo canvas (450×600) en vez de un panel React y un segundo canvas. Mantiene el motor sin callbacks extra, igual que Asteroids, y un único canvas que escalar.
- **No:** panel lateral en React con `onStats`. Aporta accesibilidad y estilos, pero añade más piezas y re-renders por fotograma sin ser necesario para el ranking.
- **Sí:** conservar la pausa con `P`, dibujada en el canvas. La guía de port pide mantener lo que el original ya tiene.
- **No:** pausar al perder el foco. No existe en el original y es otra feature; sí se vacían las teclas pulsadas en `blur`.
- **Sí:** solo las 7 piezas clásicas; se descarta la pieza "N" (tuerca). Es una decisión explícita del usuario y **cambia el balance respecto al original**, que usaba 8 tipos. Se asume a cambio de un Tetris estándar.
- **No:** bolsa de 7, SRS ni _hold_. Alteran las reglas y son specs propias.
- **Sí:** conservar la gravedad en milisegundos con `dropAccum`, como el original, y limitar `dt` a 50 ms. La guía de port dice conservar su unidad; el límite evita caídas masivas al volver a la pestaña.
- **Sí:** mover `createInput` a `lib/games/input.ts` y actualizar Asteroids en el mismo cambio. La guía exige no duplicarlo ni importar de la carpeta de otro juego.
- **Sí:** mover `submitScore` a `app/juegos/actions.ts` y generalizar `revalidatePath`. Hoy está acoplado a `/juegos/asteroids`; sin esto el Top 10 de Tetris no se refrescaría.
- **No:** tocar `lib/scores.ts`, `LeaderboardPanel`, `/ranking` ni el nav. Ya son genéricos por `gameSlug`.
- **No:** copiar `game.js` a `public/` ni usar un iframe. No hay forma limpia de leer la puntuación.
- **No:** migrar el `check` de `score`. Una puntuación de Tetris queda muy por debajo de 1 000 000.
- **Sí:** descartar `style.css` y el toggle de tema; el aspecto lo da `.crt` y los tokens de `globals.css`.

---

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Con Strict Mode el `useEffect` corre dos veces y el juego se duplica.                            | `startTetris` devuelve la limpieza y el `useEffect` la retorna; hay un criterio de aceptación.                                                          |
| `cacheComponents` rompe el prerender si se usa `Math.random` o `performance.now` en el render.   | Solo se usan dentro del motor, que arranca en `useEffect`.                                                                                              |
| El marco `.crt-screen` está pensado para 4:3 y un canvas vertical 450×600 se deforma o recorta.  | El paso 3 ajusta la proporción con una clase específica de Tetris sin tocar las reglas de Asteroids; se comprueba visualmente a 375 px y en escritorio. |
| Mover `createInput` rompe Asteroids.                                                             | Se hace en el mismo cambio que el import y el paso 2 verifica Asteroids. Se añade `ArrowDown` al conjunto de teclas sin alterar el resto.               |
| Mover `submitScore` deja imports rotos o el Top 10 sin refrescar.                                | El paso 4 actualiza todos los imports y se prueba el flujo de envío en ambos juegos.                                                                    |
| `dropAccum` en ms más el límite de `dt` cambia la sensación respecto al original tras una pausa. | Al reanudar se reinicia la marca de tiempo (como hace `togglePause` del original) para no acumular el tiempo en pausa.                                  |
| Quitar la pieza N cambia el balance y las puntuaciones no son comparables con el original.       | Decisión explícita; queda documentada y no afecta al ranking, que solo existe desde esta spec.                                                          |
| En móvil no hay teclado, así que no es jugable.                                                  | Aceptado, igual que en la SPEC 05; los controles táctiles quedan fuera de alcance.                                                                      |
| Alguien envía una puntuación falsa.                                                              | Aceptado desde la SPEC 06; los `check` de la tabla acotan alias y puntuación.                                                                           |

---

## Qué **no** está en esta spec

- La pieza "N" (tuerca) y las 8 piezas del original.
- Hold, SRS, bolsa de 7, _lock delay_, T-spins y combos.
- Pausa automática, controles táctiles, mando y sonido.
- Toggle de tema y estilos propios del original.
- Autenticación, mejor puntuación por alias, anti-trampas y paginación.
- Cambios en el esquema, `lib/scores.ts`, `LeaderboardPanel`, `/ranking` y el nav.
- Port de Arkanoid.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propia spec.

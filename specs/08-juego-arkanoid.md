# SPEC 08 — Juego Arkanoid en `/juegos/arkanoid` con leaderboard

> **Estado:** Implementada
> **Depende de:** SPEC 05 (patrón de motor + canvas y marco `.crt`), SPEC 06 (tablas `games`/`scores`, `ScoreSubmit`, `LeaderboardPanel`, `/ranking`), SPEC 07 (entrada compartida `lib/games/input.ts` y `submitScore` en `app/juegos/actions.ts`), SPEC 02 (tarjeta "BLOQUE BUSTER" del Inicio)
> **Fecha:** 2026-11-18
> **Objetivo:** Portar a TypeScript el Arkanoid de `references/resources/started-games/04-arkanoid/`, jugarlo en `/juegos/arkanoid` dentro de un marco CRT y conectarlo al ranking existente (envío de puntuación con alias, Top 10 y `/ranking?juego=arkanoid`).

---

## Por qué existe esta spec

El juego existe como proyecto independiente: `index.html` + `game.js` (268 líneas) + `levels.js` + `assets/spritesheet.js`, todo con variables globales, `document.getElementById`, listeners de `document` y `canvas` que nunca se retiran y un `requestAnimationFrame` sin handle. Esa forma no encaja en Next.js por las razones de la SPEC 05: el bucle y los listeners se duplicarían con el doble montaje de Strict Mode y con la navegación.

A diferencia de Asteroids y Tetris, Arkanoid **tiene assets** (un spritesheet PNG y dos sonidos). Es nuevo para la plataforma: la carga asíncrona de la imagen obliga a una bandera `stopped` en la limpieza.

La plataforma de puntuaciones ya es genérica por `gameSlug` y la SPEC 07 dejó compartidos `createInput` y `submitScore`. Esta spec solo añade el juego y un cambio deliberado de reglas: retirar el menú de salto de nivel de la pausa.

---

## Alcance

**Dentro:**

- Migración `supabase/migrations/<timestamp>_seed_arkanoid.sql` que siembra la fila `arkanoid` en `games`.
- Port a TypeScript en `lib/games/arkanoid/`: constantes, niveles tipados, spritesheet y motor.
- Gameplay del original: canvas 800×600, pala, pelota, 5 niveles con velocidad creciente, 3 vidas, 10 puntos por bloque, explosión animada de 4 fotogramas (150 ms) al romper un bloque, rebote en paredes, techo y pala, un bloque por fotograma.
- **Bloques grises resistentes** (regla nueva, ausente en el original): aguantan un golpe y se rompen al segundo. Tras el primero se dibujan oscurecidos, la pelota rebota con el sonido de rebote y no suman puntos; al romperse explotan y suman 20. Solo existen en el nivel 2 (2 bloques).
- Control de la pala **solo con las flechas ← →** (400 px/s). El ratón del original se descarta (ver Decisiones).
- Pausa con `P` o `Escape`, con overlay "PAUSA" dibujado en el canvas.
- Overlays "GAME OVER" y "¡Completaste el juego!" en el canvas. **Reinicio con Espacio** tras cualquiera de los dos (nivel 1, 3 vidas, 0 puntos).
- HUD en el mismo canvas: puntuación, nivel y vidas.
- Sonidos de rebote y de rotura de bloque.
- `onGameOver(score)` opcional en el motor, llamado una sola vez por partida: al perder la última vida **y** al completar el nivel 5.
- Assets en `public/games/arkanoid/` (spritesheet y mp3).
- Componente cliente `components/arkanoid-game.tsx` con `<ScoreSubmit gameSlug="arkanoid">` bajo el canvas, igual que `components/tetris-game.tsx`.
- Página `app/juegos/arkanoid/page.tsx` con título, marco `.crt`, `<LeaderboardPanel gameSlug="arkanoid" limit={10} title="Top 10" />` dentro de `<Suspense>` y leyenda de controles. `metadata`: "Arkanoid · Arcade Vault".
- La tarjeta "BLOQUE BUSTER" del Inicio (`app/page.tsx`) enlaza a `/juegos/arkanoid`, y la lista de `/biblioteca` incluye el juego.

**Fuera de alcance (para otras specs):**

- El menú "Saltar al nivel" de la pausa (ver Decisiones).
- Potenciadores, otros bloques resistentes además de los grises, ángulo de rebote según el punto de impacto en la pala y más niveles.
- Silenciar, volumen y pausa automática al perder el foco.
- Controles táctiles y mando.
- Cambios en `lib/scores.ts`, `LeaderboardPanel`, `/ranking`, `nav`, `submitScore` y el esquema de la base.
- Autenticación, mejor puntuación por alias, anti-trampas y paginación (fuera de alcance desde la SPEC 06).
- Tests automatizados.

---

## Modelo de datos

Fila a sembrar en `games` (el esquema ya existe, no se toca):

```sql
insert into public.games (slug, name, description)
values ('arkanoid', 'Arkanoid', 'Rompe todos los bloques con la pelota sin dejarla caer.');
```

Contrato público del módulo del juego:

```ts
// lib/games/arkanoid/engine.ts
export const WIDTH = 800;
export const HEIGHT = 600;

export function startArkanoid(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void; // cancelAnimationFrame + retirada de listeners + parada de la carga
```

Estructura interna (sustituye a los globales de `game.js`):

```ts
type GameState = "playing" | "paused" | "gameover" | "win";

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
  hits: number; // golpes que le faltan; 2 para los grises y 1 para el resto
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms
}

interface Game {
  paddle: { x: number; y: number; w: number; h: number };
  ball: { x: number; y: number; w: number; h: number; vx: number; vy: number };
  blocks: Block[];
  explosions: Explosion[];
  lives: number;
  score: number;
  level: number; // 1..5
  state: GameState;
}
```

```ts
// lib/games/arkanoid/levels.ts
export type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";
export const LEVELS: {
  speed: number;
  blocks: { col: number; row: number; color: BlockColor }[];
}[];
```

Convenciones:

- Constantes copiadas tal cual: `PADDLE_SPEED = 400`, `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`, `BLOCK_W = 64`, `BLOCK_H = 24`, origen de bloques `(80, 80)`, `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`, velocidades por nivel `[1, 1.10, 1.21, 1.33, 1.46]`, `EXPLOSION_DURATION = 150`, pala `y = 560, h = 14` y pelota 16×16. Los cinco diseños de nivel se portan sin cambios.
- **El ancho de la pala es 81, no 162.** `game.js` fija `w: 81` aunque el sprite mide 162×14 y el `CLAUDE.md` del original dice 162. Se mantiene 81, porque es el valor con el que se jugó y se balanceó; el sprite se dibuja escalado a 81×14.
- Unidades: `dt` en **segundos**, como el original, limitado a 0,05 s (ajuste necesario al integrar en una página, equivalente al de la SPEC 05). Las explosiones avanzan en milisegundos (`dt * 1000`).
- `score` es la puntuación del HUD: 10 por bloque y 20 por cada bloque gris al romperlo. Los 5 niveles suman 208 bloques, 2 de ellos grises, es decir **2 100 puntos como máximo**, muy por debajo del tope de 1 000 000 de la base. No hace falta migrar el `check`.
- Spritesheet: `lib/games/arkanoid/spritesheet.ts` carga `public/games/arkanoid/spritesheet-breakout.png` dentro del motor, no durante el render. El motor arranca el bucle en `onload`; si la limpieza se ejecuta antes, una bandera `stopped` impide arrancarlo.
- Sonido: los `Audio` se crean dentro de `startArkanoid` y se reproducen con `cloneNode()`. Un `play()` rechazado por el navegador (sin interacción previa) se ignora sin error.
- Teclas: `createInput` ya ignora `keydown` con `target` en `input`/`textarea` y vacía las teclas en `blur`. Hay que comprobar que su conjunto de teclas cubre `ArrowLeft`, `ArrowRight`, Espacio, `P` y `Escape`.

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` las guías de Client Components y `cacheComponents`, según indica `AGENTS.md`. Para la página y los estilos (paso 3), usar el skill `/frontend-design`, como exige `CLAUDE.md`. Se trabaja en la rama `spec-08-juego-arkanoid` con un commit por paso y pausa para confirmar tras cada uno. Cada paso deja la app ejecutable.

1. **Sembrar el juego.** Crear `supabase/migrations/<timestamp>_seed_arkanoid.sql` con el `insert` anterior, mostrarlo, esperar el visto bueno y aplicarlo con `apply_migration` desde el archivo. Verificación: `execute_sql` devuelve la fila `arkanoid` y `games` tiene 3 filas.
2. **Assets y motor.** Copiar `spritesheet-breakout.png` y los dos mp3 a `public/games/arkanoid/`. Crear `lib/games/arkanoid/constants.ts`, `levels.ts`, `spritesheet.ts` y `engine.ts` con `startArkanoid`: carga del spritesheet con bandera `stopped`, bucle `requestAnimationFrame`, física y colisiones del original, explosiones, vidas, pausa (`P`/`Escape`), GAME OVER, victoria, reinicio con Espacio, flechas, sonidos y HUD. Sin menú de salto de nivel. Revisar el conjunto de teclas de `lib/games/input.ts`. Verificación: `npx tsc --noEmit` y `npx eslint lib` sin errores, y Asteroids y Tetris siguen funcionando.
3. **Componente y página.** Crear `components/arkanoid-game.tsx` (`"use client"`, `useRef`, `useEffect` que arranca el motor y devuelve la limpieza; estado `finished {id, score}`; `<ScoreSubmit gameSlug="arkanoid">`; ocultar el formulario al reiniciar con Espacio) y `app/juegos/arkanoid/page.tsx` con `metadata`, marco `.crt`, panel Top 10 en `<Suspense fallback={<LeaderboardSkeleton />}>` y leyenda de controles (← → mover pala, P o Esc pausa, Espacio reiniciar). El canvas es 800×600 (4:3): añadir en `app/globals.css` solo `.arkanoid-canvas` si hace falta, sin tocar las reglas de Asteroids ni Tetris. Verificación: `/juegos/arkanoid` muestra el juego y responde al teclado.
4. **Envío de puntuación.** `submitScore` y su `revalidatePath` por `gameSlug` ya son compartidos desde la SPEC 07: no se cambia código. Verificación: `ScoreSubmit` con `gameSlug="arkanoid"` inserta una fila y una entrada inválida devuelve `{ ok: false, error: "invalid" }`.
5. **Enlaces.** Enlazar la tarjeta "BLOQUE BUSTER" de `app/page.tsx` a `/juegos/arkanoid` y añadir el juego a la lista de `app/biblioteca/page.tsx`. Verificación: ambas pulsaciones abren el juego. Nav y `/ranking` no cambian: el juego aparece en el selector al estar sembrado.
6. **Cierre.** Ejecutar `npx tsc --noEmit`, `npx eslint app components lib`, `npx prettier --check .` y `npm run build`. Luego verificar en el navegador una partida completa: llegar a GAME OVER, ver el formulario, enviar un alias, ver la fila en el Top 10 y en `/ranking?juego=arkanoid`, y repetirlo tras reiniciar. Comprobar también la victoria tras el nivel 5. Revisar la consola en busca de errores de hidratación.

---

## Criterios de aceptación

- [ ] `npx eslint app components lib`, `npx tsc --noEmit`, `npx prettier --check .` y `npm run build` terminan sin errores.
- [x] El build lista `/juegos/arkanoid` como ruta (prerenderizado parcial) y Asteroids y Tetris siguen funcionando igual.
- [x] `games` contiene una fila con `slug = 'arkanoid'` y existe su migración en `supabase/migrations/`.
- [x] `/juegos/arkanoid` muestra el juego en un marco `.crt` con el título de pestaña "Arkanoid · Arcade Vault".
- [x] Se ven los 60 bloques del nivel 1 con los sprites del spritesheet, la pala y la pelota.
- [ ] ← → mueven la pala a 400 px/s sin salirse del canvas, y el ratón no la mueve.
- [ ] Un bloque gris aguanta el primer golpe (rebota la pelota, se oscurece y no suma puntos) y se rompe al segundo con explosión y +20; un solo impacto nunca cuenta dos golpes.
- [ ] La pelota rebota en paredes, techo y pala; romper un bloque de otro color suma 10 puntos, invierte `vy`, reproduce la explosión de 4 fotogramas y rompe como máximo un bloque por fotograma.
- [ ] Al romper todos los bloques se carga el nivel siguiente con la pelota más rápida (1,00 / 1,10 / 1,21 / 1,33 / 1,46) y el diseño del original; el HUD muestra el nivel.
- [x] Dejar caer la pelota resta una vida y la recoloca sobre la pala; con 0 vidas aparece "GAME OVER".
- [ ] Completar el nivel 5 muestra "¡Completaste el juego!".
- [ ] `P` y `Escape` pausan y reanudan mostrando "PAUSA" en el canvas; en pausa la pala no se mueve con el teclado. **No** hay botones de salto de nivel.
- [ ] Los sonidos de rebote y de rotura suenan tras la primera interacción; si el navegador los bloquea, no hay errores en la consola.
- [ ] Una partida produce como máximo una fila: `onGameOver` se llama una sola vez, tanto en derrota como en victoria, y no se puede enviar dos veces la misma puntuación; "Omitir" no inserta nada.
- [ ] Escribir el alias (incluida la barra espaciadora y las flechas) no mueve la pala ni reinicia el juego.
- [x] Reiniciar con Espacio oculta el formulario y empieza con nivel 1, 3 vidas y 0 puntos.
- [x] Espacio y las flechas no desplazan la página mientras el juego está en pantalla.
- [x] Navegar fuera de `/juegos/arkanoid` y volver no duplica la velocidad del juego, los sonidos ni `onGameOver`.
- [ ] Navegar fuera antes de que cargue el spritesheet no deja ningún bucle ni listener activo.
- [ ] Mantener una flecha pulsada y cambiar de ventana no deja la pala moviéndose al volver.
- [x] Tras enviar, el Top 10 refleja la puntuación sin recarga manual, y `/ranking?juego=arkanoid` lista el juego respetando el orden (puntuación descendente, más antigua primero).
- [ ] Con Supabase inalcanzable la página no falla y muestra "Sin puntuaciones todavía".
- [x] A 375 px de ancho no hay scroll horizontal y el canvas conserva su proporción.
- [ ] Pulsar la tarjeta "BLOQUE BUSTER" en `/` y la tarjeta de `/biblioteca` lleva a `/juegos/arkanoid`.
- [x] Sin errores ni warnings de hidratación en la consola, y ninguna clave `service_role` en el repositorio.

---

## Decisiones

- **Sí:** port a TypeScript con la lógica en `lib/games/arkanoid/` sin React y `startArkanoid(canvas, options)` devolviendo la limpieza. Es el contrato de la SPEC 05 y evita bucles y listeners duplicados.
- **Sí:** quitar el menú "Saltar al nivel" de la pausa. Es una decisión explícita del usuario: con ranking, permitiría empezar en cualquier nivel y falsear la partida. **Cambia el comportamiento respecto al original**, que lo usaba para probar niveles.
- **No:** mantener el salto de nivel, ni siquiera marcando la partida como no puntuable. Añade lógica y estado solo para una herramienta de depuración.
- **Sí:** control solo con flechas. Decisión posterior a la aprobación: el control con ratón del original se descarta porque no encaja bien en la página.
- **No:** control con ratón. Se aprobó inicialmente y se retiró tras probarlo; el original lo tenía, así que **cambia el comportamiento respecto a él**.
- **Sí:** reinicio con Espacio tras GAME OVER y tras la victoria. El original no reinicia; se sigue la convención de Asteroids y Tetris y es lo que permite jugar varias partidas con ranking.
- **Sí:** pausa con `P` y `Escape`, como el original.
- **No:** pausar al perder el foco. No existe en el original y es otra feature; sí se vacían las teclas pulsadas en `blur`.
- **Sí:** portar los sonidos tal cual, creados solo dentro del motor. Sin silenciar ni volumen; si hace falta, va en otra spec.
- **Sí:** HUD dibujado en el mismo canvas (puntuación, nivel y vidas con el sprite de la pelota), como el original. No hace falta panel React.
- **Sí:** `onGameOver(score)` también al ganar. La guía de port lo exige: la partida termina igualmente y la puntuación es válida para el ranking.
- **Sí:** mantener la pala de 81 px de `game.js` y no los 162 px que cita el `CLAUDE.md` del original. El código es lo que se jugó y balanceó; la discrepancia queda documentada.
- **Sí:** conservar `dt` en segundos y limitarlo a 0,05 s. El límite evita atravesar bloques o la pala al volver a la pestaña.
- **Sí:** copiar spritesheet y sonidos a `public/games/arkanoid/` y cargarlos en el motor. No se usa `next/image` porque se dibujan en el canvas.
- **No:** copiar `game.js` a `public/` ni usar un iframe. No hay forma limpia de leer la puntuación.
- **No:** tocar `lib/scores.ts`, `LeaderboardPanel`, `/ranking`, el nav ni `submitScore`. Ya son genéricos por `gameSlug`.
- **Sí:** los bloques grises aguantan dos golpes. Decisión posterior a la aprobación, a petición del usuario: el gris sugería un bloque "plateado" como en el Arkanoid clásico, aunque el original los rompía al primer golpe. **Cambia el comportamiento respecto al original.**
- **Sí:** el gris se oscurece tras el primer golpe (un velo negro del 50 %, sin sprites nuevos), no puntúa en ese golpe y da 20 al romperse. Se descartó puntuar en cada golpe.
- **No:** más bloques resistentes ni rediseñar niveles; solo el gris del nivel 2.
- **No:** migrar el `check` de `score`. El máximo posible es 2 100.

---

## Riesgos

| Riesgo                                                                                                           | Mitigación                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Con Strict Mode el `useEffect` corre dos veces y el juego se duplica.                                            | `startArkanoid` devuelve la limpieza y el `useEffect` la retorna; hay un criterio de aceptación.                                           |
| La imagen carga de forma asíncrona y el componente se desmonta antes: el bucle arranca tras la limpieza.         | Bandera `stopped` comprobada en `onload`; criterio de aceptación específico.                                                               |
| `cacheComponents` rompe el prerender si se usa `Math.random`, `performance.now`, `Audio` o `Image` en el render. | Todo vive dentro del motor, que arranca en `useEffect`.                                                                                    |
| Los navegadores bloquean `Audio.play()` sin interacción previa y lanzan promesas rechazadas.                     | Se captura el rechazo de `play()` sin ruido en consola.                                                                                    |
| `createInput` no cubre `Escape` o `P` y la página hace scroll o la pausa no responde.                            | El paso 2 revisa el conjunto de teclas, sin alterar el resto, y se verifica Asteroids y Tetris.                                            |
| Una `dt` grande atraviesa bloques o la pala (colisión AABB sin barrido).                                         | `dt` limitado a 0,05 s; con velocidad máxima de unos 440 px/s el desplazamiento por fotograma queda en 22 px, menor que el bloque (24 px). |
| La pala de 81 px difiere de los 162 px del `CLAUDE.md` original y el juego se siente distinto al esperado.       | Decisión explícita y documentada; se mantiene el valor del código.                                                                         |
| Quitar el salto de nivel dificulta verificar los niveles 2–5 manualmente.                                        | Se verifican jugando; si hace falta, una herramienta de depuración local va en otra spec, sin llegar a producción.                         |
| En móvil no hay teclado, así que no es jugable.                                                                  | Aceptado, igual que en las SPEC 05 y 07; los controles táctiles quedan fuera de alcance.                                                   |
| Alguien envía una puntuación falsa.                                                                              | Aceptado desde la SPEC 06; los `check` de la tabla acotan alias y puntuación.                                                              |

---

## Qué **no** está en esta spec

- El menú "Saltar al nivel" de la pausa.
- Potenciadores, otros bloques resistentes, ángulos de rebote variables y niveles adicionales.
- Silenciar, volumen, pausa automática, controles táctiles y mando.
- Autenticación, mejor puntuación por alias, anti-trampas y paginación.
- Cambios en el esquema, `lib/scores.ts`, `LeaderboardPanel`, `/ranking`, el nav y `submitScore`.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propia spec.

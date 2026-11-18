# Guía de port de los juegos de `references/resources/started-games/`

Cada carpeta es un proyecto independiente (HTML + JS con globales, sin módulos). Lee su `CLAUDE.md` y `game.js` entero antes de portar. Transformaciones comunes:

| Original                                           | En Next.js                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `document.getElementById('canvas')`                | el motor recibe el `canvas` por parámetro                                                                      |
| Variables globales (`score`, `board`, `gameOver`…) | estado local dentro de `startX` o un objeto `Game`                                                             |
| `window.addEventListener(...)` sin retirar         | registrar en un `createInput()` y retirar en `destroy()`                                                       |
| `requestAnimationFrame(loop)` sin handle           | guardar `rafId` y `cancelAnimationFrame` en la limpieza                                                        |
| HUD en el DOM (`#score`, `#lines`)                 | dibujarlo en el canvas, o exponer un callback adicional (`onStats`) que pinte React; decídelo en la spec       |
| `style.css` / tema propio                          | descartar; usar `.crt` y los tokens neón de `globals.css` (skill `frontend-design`). Sin toggle de tema propio |

Siempre: copiar constantes y fórmulas tal cual; no cambiar balance ni reglas.

## 02-asteroids (ya portado)

Referencia viva: `lib/games/asteroids/`. No volver a portarlo.

## 03-tetris (332 líneas, sin assets)

- Tablero 300×600 (10×20, bloque 30 px) y un segundo canvas "next" de 120×120. Decide: dibujar el siguiente dentro del mismo canvas, o recibir un segundo `<canvas>` (`options.nextCanvas`).
- HUD (score, lines, level) vive en el DOM en el original: panel React lateral alimentado por un callback del motor, o dibujado en el canvas.
- Tiene pausa y overlay compartido PAUSE/GAME OVER; mantenerlos (no inventar pausa en juegos que no la tienen).
- El motor usa `dropAccum` en ms, no `dt` en segundos: conservar su unidad.
- Fin de partida: `endGame()` (cuando `spawn()` colisiona) es donde va `onGameOver(score)`. La puntuación realista queda muy por debajo de 1 000 000.
- Teclas: flechas y Espacio (hard drop): mismo `preventDefault` y mismo filtro de `input`.
- Descartar `theme-toggle` y los estilos de `style.css`.

## 04-arkanoid (268 + 50 líneas, con assets)

- Canvas 800×600. `levels.js` define `LEVELS`: portar a `lib/games/arkanoid/levels.ts` tipado.
- Assets: `assets/spritesheet-breakout.png` y `assets/sounds/*.mp3` van a `public/games/arkanoid/`. `spritesheet.js` (`loadSpritesheet`, `drawSprite`, `drawFrame`) pasa a `lib/games/arkanoid/spritesheet.ts`. La carga de la imagen es asíncrona: el motor arranca el bucle al terminar `onload`, y la limpieza debe funcionar aunque se desmonte antes (bandera `stopped`).
- Sonido: crear `Audio` solo dentro del motor (cliente), nunca durante el render.
- Estados `'playing' | 'paused' | 'gameover' | 'win'`: `onGameOver(score)` se llama también al pasar a `win`, una sola vez.
- Si usa ratón, los listeners también se retiran en la limpieza y las coordenadas se convierten con `canvas.getBoundingClientRect()`, porque el canvas se escala por CSS.

## Juego nuevo (sin referencia)

Mismo contrato. Define en la spec: bucle, condición de fin, fórmula de puntuación y su tope. Mantén la estructura `lib/games/<slug>/` para que el siguiente juego copie el patrón.

## Escalado y coordenadas

La resolución interna es fija (`width`/`height` del `<canvas>`) y el CSS la reescala manteniendo la proporción. Cualquier cálculo con coordenadas de puntero convierte de píxeles CSS a internos con `getBoundingClientRect()`.

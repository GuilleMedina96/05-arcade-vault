# SPEC 05 — Juego Asteroids en `/juegos/asteroids`

> **Estado:** Implementada
> **Depende de:** SPEC 02 (layout con `Nav` y `Footer`, tarjeta "ROCAS" del Inicio y clases `.crt` de `app/globals.css`)
> **Fecha:** 2026-11-11
> **Objetivo:** Portar a TypeScript el juego Asteroids de `references/resources/started-games/02-asteroids/` y jugarlo en la ruta `/juegos/asteroids`, dentro de un marco CRT, con el mismo gameplay y sin guardar puntuaciones.

---

## Por qué existe esta spec

El juego existe como proyecto independiente: `index.html` + `game.js` (510 líneas, JavaScript con variables globales, `document.getElementById('canvas')` y listeners registrados en `window` que nunca se retiran). Esa forma no encaja en Next.js: dentro de un componente React el bucle y los listeners se duplicarían al montar y desmontar (por ejemplo con el doble montaje de Strict Mode en desarrollo).

La SPEC 01 planteó `/juegos/[id]/jugar`, pero aunque figura como "Implementado" esas rutas no existen en el código: solo existen Inicio, Acerca de y `/api/health`. Esta spec no depende de ellas. Crea una página autónoma en `/juegos/asteroids`, que es una URL compatible con la futura `/juegos/[id]`. El port separa la lógica del juego (sin React) de su montaje en el componente. Así Tetris y Arkanoid, que están en la misma carpeta de juegos de partida, podrán seguir el mismo patrón.

---

## Alcance

**Dentro:**

- Port a TypeScript de `game.js` en `lib/games/asteroids/`: constantes, utilidades, entidades (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`), entrada de teclado y motor del juego.
- Gameplay idéntico al original: 3 vidas, invencibilidad de 3 s al reaparecer, asteroides de 3 tamaños que se parten, power-up de triple disparo, niveles con `3 + nivel` asteroides, envolvimiento de bordes, GAME OVER y reinicio con Espacio.
- Render y HUD dentro del `<canvas>` de 800×600, como en el original (blanco sobre negro, textos en español).
- Componente cliente `components/asteroids-game.tsx` que monta el canvas, arranca el motor y lo detiene al desmontar sin dejar bucle ni listeners.
- Página `app/juegos/asteroids/page.tsx` con título, canvas dentro de `.crt` / `.crt-screen` y leyenda de controles (← → rotar, ↑ propulsar, Espacio disparar).
- Canvas reescalado por CSS al ancho disponible, manteniendo la proporción 4:3 (resolución interna fija de 800×600).
- Evitar que las flechas y Espacio desplacen la página mientras el juego está montado.
- La tarjeta "ROCAS" del Inicio (`app/page.tsx`) enlaza a `/juegos/asteroids`.
- `metadata` de la ruta: "Asteroids · Arcade Vault".

**Fuera de alcance (para otras specs):**

- Guardar o mostrar puntuaciones (Supabase, `localStorage`, ranking, Salón de la Fama) y cualquier callback `onGameOver`.
- La biblioteca, el detalle del juego y el reproductor genérico de la SPEC 01 (`/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`). Los demás botones del Inicio siguen apuntando a rutas inexistentes.
- Entrada en el nav, y cualquier otro enlace al juego distinto de la tarjeta "ROCAS".
- Pausa, controles táctiles, mando, sonido, pantalla de inicio o menú dentro del juego.
- Recolorear el juego con la paleta neón o cambiar su aspecto interior.
- Cambios de balance o de reglas respecto al original.
- Port de Tetris y Arkanoid.
- Tests automatizados.

---

## Modelo de datos

Esta feature no introduce datos persistentes. El estado vive en memoria dentro del motor y se descarta al desmontar.

Contrato público del módulo del juego:

```ts
// lib/games/asteroids/engine.ts
export const WIDTH = 800;
export const HEIGHT = 600;

// Arranca el juego sobre el canvas y devuelve la función que lo detiene
// (cancelAnimationFrame + retirada de listeners).
export function startAsteroids(canvas: HTMLCanvasElement): () => void;
```

Estructura interna (sustituye a los globales de `game.js`):

```ts
type GameState = "playing" | "dead" | "gameover";

interface Game {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  state: GameState;
  deadTimer: number;
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
}
```

Convenciones:

- Las constantes se copian tal cual del original: `RADII = [0,16,30,50]`, `SPEEDS = [0,85,55,32]`, `POINTS = [0,100,50,20]`, `POWERUP_DROP_CHANCE = 0.15`, `POWERUP_DURATION = 5`, `POWERUP_TTL = 12`, `TRIPLE_SPREAD = 0.18`.
- Las unidades son px, px/s y segundos. `dt` se limita a 0.05 s por fotograma.
- Las entidades reciben el `CanvasRenderingContext2D` en `draw(ctx)` en lugar de leer un `ctx` global.
- La entrada (`keys`, `justPressed`) es una instancia creada por `startAsteroids`, no un módulo con estado global.

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` la guía de Client Components y la de `cacheComponents`, según indica `AGENTS.md`. Para el aspecto de la página (paso 4), usar el skill `/frontend-design`, como exige `CLAUDE.md`. Cada paso deja la app ejecutable.

1. **Base del port.** Crear `lib/games/asteroids/constants.ts` y `lib/games/asteroids/math.ts` (`wrap`, `dist`, `rand`, `randInt`) y `lib/games/asteroids/input.ts` (`createInput()` con `keys`, `pressed(code)` y `destroy()`). Verificación: `npx tsc --noEmit` y `npx eslint lib` sin errores.
2. **Entidades.** Crear `lib/games/asteroids/entities.ts` con `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle`, con `update(dt)` y `draw(ctx)` y sin referencias a globales. Si el archivo supera el tamaño razonable, dividirlo por entidad. Verificación: `npx tsc --noEmit` sin errores.
3. **Motor.** Crear `lib/games/asteroids/engine.ts` con `startAsteroids(canvas)`: estado, `initGame`, `nextLevel`, `killShip`, `update`, `draw`, HUD, overlay de GAME OVER y bucle con `requestAnimationFrame`. Verificación: `npx tsc --noEmit` y `npx eslint lib` sin errores.
4. **Componente y página.** Crear `components/asteroids-game.tsx` (`"use client"`, `useRef` del canvas, `useEffect` que llama a `startAsteroids` y devuelve su limpieza) y `app/juegos/asteroids/page.tsx` con `metadata`, el marco `.crt` / `.crt-screen` y la leyenda de controles. Añadir en `app/globals.css` solo las clases nuevas que haga falta (canvas al 100 % del marco, leyenda de controles). Verificación: `npm run dev` y `/juegos/asteroids` muestra el juego y la nave responde al teclado.
5. **Control de la página.** En el motor, llamar a `preventDefault()` en `keydown` para `Space`, `ArrowUp`, `ArrowLeft` y `ArrowRight`, y vaciar las teclas pulsadas al perder el foco la ventana (`blur`). Verificación: con la ventana más baja que la página, Espacio y las flechas no hacen scroll.
6. **Enlace desde el Inicio.** En `app/page.tsx`, hacer que la tarjeta "ROCAS" enlace a `/juegos/asteroids` y que el resto siga igual. Verificación: pulsar "ROCAS" en `/` abre el juego.
7. **Cierre.** Ejecutar `npx tsc --noEmit`, `npx eslint app components lib`, `npx prettier --check .` y `npm run build`, y probar una partida completa en el navegador. Verificación: todo termina sin errores.

---

## Criterios de aceptación

- [ ] `npx eslint app components lib`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] El build lista `/juegos/asteroids` como ruta estática.
- [ ] `/juegos/asteroids` muestra el juego dentro de un marco `.crt`, con el título de pestaña "Asteroids · Arcade Vault".
- [ ] Al cargar hay 4 asteroides grandes, 3 vidas en el HUD, "SCORE 0" y "NIVEL 1", y la nave parpadea durante 3 s.
- [ ] ← y → rotan la nave, ↑ la propulsa con llama visible y Espacio dispara con un intervalo mínimo de 0,2 s entre disparos.
- [ ] Destruir un asteroide grande suma 20 puntos, uno mediano 50 y uno pequeño 100. Los grandes se parten en 2 medianos, los medianos en 2 pequeños y los pequeños desaparecen.
- [ ] Al chocar con un asteroide sin estar invencible se pierde una vida, la nave reaparece a los 2 s en el centro y no se puede disparar mientras tanto.
- [ ] Al destruir todos los asteroides pasa a "NIVEL 2" con 5 asteroides grandes y la nave en el centro.
- [ ] Recoger el cuadrado cian "3x" activa el disparo triple 5 s y el HUD muestra la cuenta atrás.
- [ ] Al perder la última vida aparece "GAME OVER" con la puntuación, y Espacio reinicia a 0 puntos, 3 vidas y nivel 1.
- [ ] Nave, balas, asteroides y power-ups reaparecen por el borde opuesto al salir del canvas.
- [ ] Espacio y las flechas no desplazan la página mientras el juego está en pantalla.
- [ ] Navegar fuera de `/juegos/asteroids` y volver no duplica la velocidad del juego ni dispara varias balas por pulsación.
- [ ] Mantener una tecla pulsada y cambiar de pestaña o ventana no deja la nave girando o propulsando al volver.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas conserva la proporción 4:3.
- [ ] Pulsar la tarjeta "ROCAS" en `/` lleva a `/juegos/asteroids`.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/juegos/asteroids` ni en `/`.
- [ ] No se escribe nada en `localStorage` ni se hace ninguna llamada a Supabase desde la ruta.

---

## Decisiones

- **Sí:** página autónoma en `/juegos/asteroids`. La biblioteca y el reproductor genérico de la SPEC 01 no existen; esperar a construirlos bloquearía el primer juego. La URL ya es compatible con `/juegos/[id]`.
- **No:** `/juegos/asteroids/jugar`. Sin página de detalle, `/juegos/asteroids` daría 404.
- **No:** `/biblioteca/asteroids`. Choca con el diseño de la SPEC 01.
- **Sí:** port a TypeScript con la lógica en `lib/games/asteroids/` sin dependencia de React. Permite tipado, lint y reutilización del patrón en otros juegos, y deja un punto limpio donde conectar la puntuación en el futuro.
- **No:** copiar `game.js` a `public/` y cargarlo en un iframe. Queda aislado de Next y no hay forma limpia de leer la puntuación después.
- **No:** un único componente de ~500 líneas. Mezcla lógica y React y no se reutiliza.
- **Sí:** `startAsteroids(canvas)` devuelve su función de limpieza y la entrada es una instancia, no un global. Es lo que evita bucles y listeners duplicados con el montaje doble de Strict Mode y con la navegación.
- **Sí:** conservar el render original (vectorial blanco sobre negro, HUD en el canvas) y enmarcarlo con `.crt`. Mantiene fidelidad con el juego existente y la identidad de la plataforma sin tocar el gameplay.
- **No:** recolorear con la paleta neón. Más trabajo y riesgo de alterar el aspecto del juego sin aportar al port.
- **Sí:** resolución interna fija de 800×600 y escalado por CSS. El gameplay (velocidades, radios, colisiones) está calibrado en esas coordenadas.
- **Sí:** `preventDefault()` en Espacio y flechas, y vaciar `keys` en `blur`. Son los dos ajustes que exige integrar el juego en una página con scroll; no cambian las reglas.
- **Sí:** la tarjeta "ROCAS" del Inicio es el único punto de entrada. Es el único juego existente de esa lista y evita tocar el nav, que la SPEC 02 reduce a Inicio y Acerca de.
- **No:** guardar puntuaciones ni exponer `onGameOver`. No hay esquema ni login todavía; añadir API sin consumidor sería especulativo. Se hará en la spec de puntuaciones.
- **No:** `localStorage` para un récord local. Sería un modelo de datos que luego habría que migrar o descartar.
- **No:** añadir pausa, controles táctiles o menú. No existen en el original y son otras features.
- **Sí:** copiar constantes y fórmulas tal cual, incluido el factor `0.82` en la colisión nave-asteroide y el límite de `dt` a 50 ms. Un port debe ser comparable con el original.

---

## Riesgos

| Riesgo                                                                                                     | Mitigación                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Con Strict Mode el `useEffect` se ejecuta dos veces en desarrollo y el juego se duplica.                   | `startAsteroids` devuelve la limpieza (`cancelAnimationFrame` y retirada de listeners) y el `useEffect` la retorna. Hay un criterio de aceptación para esto. |
| `cacheComponents` rompe el render si se usa `Math.random` o `performance.now` durante la prerenderización. | Esas llamadas solo ocurren dentro del motor, que arranca en `useEffect`, nunca durante el render.                                                            |
| Los pseudoelementos de `.crt-screen` (scanlines, viñeta) tapan el canvas o interceptan eventos.            | Ya tienen `pointer-events: none`; el canvas se coloca dentro de `.crt-screen` ocupando todo el marco. Se comprueba visualmente.                              |
| El escalado CSS cambia la sensación respecto al original en pantallas pequeñas.                            | La resolución interna no cambia, solo el tamaño mostrado; los controles son de teclado y no dependen del tamaño.                                             |
| En móvil no hay teclado, así que el juego no es jugable.                                                   | Aceptado en esta fase; los controles táctiles quedan fuera de alcance y la página sigue sin errores a 375 px.                                                |
| `dt` grande tras volver a la pestaña provoca saltos de física.                                             | Se mantiene el límite de 50 ms por fotograma del original.                                                                                                   |

---

## Qué **no** está en esta spec

- Guardado, lectura o ranking de puntuaciones, y cualquier uso de Supabase o `localStorage`.
- Biblioteca, detalle de juego y reproductor genérico (SPEC 01), y los demás enlaces del Inicio.
- Entrada de Asteroids en el nav.
- Pausa, controles táctiles, mando, sonido y menú dentro del juego.
- Recolorear o rediseñar el aspecto interior del juego, o cambiar su balance.
- Port de Tetris y Arkanoid.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propia spec.

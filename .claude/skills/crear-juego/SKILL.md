---
name: crear-juego
description: Crea un juego nuevo para Arcade Vault con su leaderboard e intégralo en la plataforma (Next.js + Supabase), partiendo de un juego de references/resources/started-games (Tetris, Arkanoid, Asteroids) o de uno nuevo hecho desde cero. Úsalo siempre que el usuario pida portar, añadir, crear, integrar o "meter" un juego, conectar un juego a las puntuaciones/ranking, sembrar una fila en la tabla games, o mencione Tetris, Arkanoid o un juego nuevo con ranking, aunque no diga "skill" ni "leaderboard". Replica el patrón de las SPEC 05 (motor + canvas) y SPEC 06 (scores, ranking, panel Top 10).
---

# Crear un juego con leaderboard en Arcade Vault

Este skill resume el patrón ya implementado en `specs/05-juego-asteroids.md` y `specs/06-leaderboard-y-tabla-de-juegos.md`. Asteroids es la implementación de referencia: ante cualquier duda, abre sus archivos y copia la forma, no la inventes.

El proyecto trabaja con specs. Un juego nuevo es una feature: **el primer entregable es su archivo de spec**, y no se implementa nada hasta que el usuario la apruebe, salvo que diga explícitamente que implementes ya. Los comandos `/spec` y `/spec-impl` no están instalados en este repo (solo existe `frontend-design`), así que este skill hace ese trabajo él mismo: el paso 0 crea la spec y el plan de abajo la implementa.

## Paso 0: crear la spec del juego

1. Lee `specs/05-juego-asteroids.md` y `specs/06-leaderboard-y-tabla-de-juegos.md` enteras, y abre los archivos que van a servir de modelo: `lib/games/asteroids/engine.ts`, `components/asteroids-game.tsx`, `components/score-submit.tsx` y `app/juegos/asteroids/actions.ts`. La spec nueva debe salir con la estructura y el nivel de detalle reales de esas dos, no de memoria.
2. Lista `specs/` y usa el siguiente número libre: `specs/NN-<slug-del-juego>.md`.
3. Escríbela en español con estas secciones, en este orden:
   - Cabecera: `# SPEC NN — <Título>` y líneas `Estado: Draft`, `Depende de:` (SPEC 05 y 06 como mínimo, y las de las que dependa), `Fecha:` (hoy, `YYYY-MM-DD`) y `Objetivo:` en una frase.
   - `## Por qué existe esta spec`
   - `## Alcance` con **Dentro** y **Fuera de alcance**
   - `## Modelo de datos` (fila de `games`, contrato `startX`, tipos del estado del juego y convenciones: unidades, constantes copiadas, qué es `score`)
   - `## Plan de implementación`: los 6 pasos de este skill adaptados al juego, cada uno con su verificación
   - `## Criterios de aceptación`: checklist con `- [ ]`, partiendo del checklist de este skill más los específicos del juego
   - `## Decisiones` (Sí/No con motivo), `## Riesgos` (tabla) y `## Qué **no** está en esta spec`
4. Antes de redactarla, pregunta al usuario las decisiones clave que no pueda deducir del juego (reglas, controles, qué cuenta como puntuación, HUD en canvas o en React, pausa) en vez de decidirlas tú.
5. Presenta la spec y espera aprobación. Al aprobarla, cambia `Estado` a `Approved`, y al terminar la implementación, a `Implementada` marcando los criterios cumplidos.

## Antes de escribir código

1. Lee `AGENTS.md` y las guías relevantes de `node_modules/next/dist/docs/` (Client Components, `cacheComponents`, Server Actions). Esta versión de Next tiene cambios incompatibles con lo que recuerdas.
2. Para toda la UI (página del juego, formulario, estilos) invoca el skill `frontend-design`, como exige `CLAUDE.md`.
3. Determina el origen del juego:
   - **Viene de `references/resources/started-games/<NN-nombre>/`**: lee su `game.js`, `index.html` y `CLAUDE.md` y sigue `references/portar-juego.md`.
   - **Es nuevo** (el usuario lo describe): diseña la lógica con el mismo contrato de motor (abajo). Pregunta solo lo que no puedas decidir: reglas, controles, qué cuenta como puntuación.
4. Decide y confirma en la spec: `slug` (`^[a-z0-9-]{2,40}$`), nombre, descripción, dimensiones del canvas, controles, cuándo termina la partida y qué es `score`.

## Contrato del motor (sin React)

Todo juego vive en `lib/games/<slug>/` (`constants.ts`, `math.ts` si hace falta, `entities.ts`, `engine.ts`) y expone:

```ts
export const WIDTH = ...; export const HEIGHT = ...;
export function startX(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void; // devuelve la limpieza
```

Por qué existe cada regla:

- **La limpieza cancela `requestAnimationFrame` y retira todos los listeners.** Strict Mode monta dos veces y la navegación vuelve a montar; sin esto el juego se duplica (doble velocidad, varias balas por pulsación).
- **Sin estado global de módulo ni `document.getElementById`.** Estado, entrada y `ctx` son locales a `startX`.
- **`onGameOver(score)` se llama una sola vez por partida**, al pasar a fin de partida (derrota o victoria final), nunca en cada fotograma. El componente depende de eso para no permitir dos envíos.
- **`Math.random`/`performance.now`/`Date.now` solo dentro del motor** (arranca en `useEffect`), nunca durante el render: con `cacheComponents` romperían el prerender.
- **`dt` limitado a 0,05 s** y constantes copiadas tal cual del original, para que el port sea comparable.
- **Entrada:** ignorar `keydown` cuyo `target` sea `input`/`textarea` (para poder escribir el alias), `preventDefault()` en las teclas del juego (Espacio, flechas) y vaciar las teclas en `blur`. Mira `lib/games/asteroids/input.ts`; si vas a usar `createInput` en un segundo juego, muévelo a `lib/games/input.ts` y actualiza el import de Asteroids en el mismo cambio, en vez de duplicarlo o importar de la carpeta de otro juego.
- Reiniciar tras fin de partida (normalmente Espacio) vive dentro del motor; el componente oculta el formulario al detectar esa pulsación.

## Piezas de la plataforma

| Pieza                                                                           | Estado                                                                                 | Qué hacer                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| Tablas `games`/`scores`, RLS, índice                                            | Genérico                                                                               | Solo **sembrar una fila** en `games` (paso 1) |
| `lib/scores.ts` (`getTopScores`, `getGames`)                                    | Genérico                                                                               | No tocar                                      |
| `components/leaderboard-panel.tsx`                                              | Genérico (recibe `gameSlug`)                                                           | Reutilizar dentro de `<Suspense>`             |
| `app/ranking/page.tsx`                                                          | Genérico (selector alimentado por `games`)                                             | No tocar: el juego aparece al sembrarlo       |
| `components/nav.tsx`                                                            | Genérico                                                                               | No tocar                                      |
| `app/juegos/asteroids/actions.ts` (`submitScore`)                               | Valida e inserta por `gameSlug`, pero `revalidatePath` está fijo a `/juegos/asteroids` | Generalizar (paso 4)                          |
| `components/score-submit.tsx`                                                   | Recibe `gameSlug`, pero importa `submitScore` de la carpeta de Asteroids               | Apuntar al import compartido (paso 4)         |
| `lib/games/<slug>/`, `components/<slug>-game.tsx`, `app/juegos/<slug>/page.tsx` | Por juego                                                                              | Crear                                         |
| Tarjeta del Inicio en `app/page.tsx`                                            | Por juego                                                                              | Enlazarla a `/juegos/<slug>`                  |

## Plan de implementación (cada paso deja la app ejecutable)

**Ritmo:** trabaja como `/spec-impl`. Crea la rama `spec-NN-<slug>`, y tras cada paso ejecuta su verificación, haz commit y **pausa para que el usuario confirme** antes de seguir con el siguiente. Antes de aplicar la migración del paso 1, muestra el SQL y espera el visto bueno.

1. **Sembrar el juego.** Crea una migración nueva `supabase/migrations/<timestamp>_seed_<slug>.sql` con `insert into public.games (slug, name, description) values (...)`. No modifiques la migración existente: el esquema ya está. Escribe el archivo primero y aplícalo con `apply_migration` desde su contenido, para que repo y base no diverjan. Verifica con `execute_sql` que la fila existe. No hace falta regenerar tipos.
2. **Motor.** Port o implementación en `lib/games/<slug>/` según el contrato. Verifica con `npx tsc --noEmit` y `npx eslint lib`.
3. **Componente y página.** `components/<slug>-game.tsx` (`"use client"`, `useRef` del canvas, `useEffect` que arranca el motor y devuelve la limpieza) siguiendo `components/asteroids-game.tsx`: estado `finished {id, score}`, contador de partidas para dar `key` único al formulario, `<ScoreSubmit>` bajo el canvas, `onSkip`, y ocultar el formulario al reiniciar con Espacio. `app/juegos/<slug>/page.tsx` con `metadata` "<Nombre> · Arcade Vault", marco `.crt`/`.crt-screen`, `<LeaderboardPanel gameSlug="<slug>" limit={10} title="Top 10" />` dentro de `<Suspense fallback={<LeaderboardSkeleton .../>}>` y leyenda de controles, reusando `game-layout`, `game-stage`, `game-side`, `game-controls`. Si el canvas no es 800×600 o necesita estilos propios, añade solo las clases necesarias a `app/globals.css` (hoy `.asteroids-canvas` es específica del juego).
4. **Envío de puntuación.** Haz compartido lo que hoy está acoplado a Asteroids, una sola vez (si otro juego ya lo hizo, comprueba y salta el paso): mueve `submitScore` a un archivo neutro (p. ej. `app/juegos/actions.ts`), cambia `revalidatePath("/juegos/asteroids")` por ``revalidatePath(`/juegos/${gameSlug}`)`` (más `/ranking`) y actualiza el import en `components/score-submit.tsx`. Mantén las reglas: alias `^[A-Za-z0-9_-]{3,12}$`, `score` entero 0–1 000 000, error genérico sin el mensaje de Supabase, clave `localStorage` `arcade-vault:alias:v1`. Comprueba que el rango de puntuación encaja con el juego; si puede superar 1 000 000, no cambies el `check` por tu cuenta: es decisión del usuario y una migración nueva.
5. **Enlace desde el Inicio.** Enlaza la tarjeta correspondiente de `app/page.tsx` a `/juegos/<slug>`. Nav y `/ranking` no necesitan cambios.
6. **Cierre.** Ejecuta `npx tsc --noEmit`, `npx eslint app components lib`, `npx prettier --check .` y `npm run build`. Luego verifica en navegador (skill `browser-automation` o Playwright MCP) una partida completa: llegar al fin de partida, ver el formulario, enviar un alias, ver la fila en el Top 10 y en `/ranking?juego=<slug>`, y repetir tras reiniciar. Mira la consola del navegador en busca de errores de hidratación.

## Checklist de aceptación para cada juego

- Una partida produce como máximo una fila; "Omitir" no inserta nada.
- Escribir el alias (incluida la barra espaciadora) no controla ni reinicia el juego.
- Reiniciar oculta el formulario y empieza con 0 puntos.
- Navegar fuera y volver no duplica el juego ni `onGameOver`.
- El Top 10 refleja el envío sin recarga manual.
- `/ranking?juego=<slug>` lista el juego en el selector y respeta el orden (puntuación desc, más antigua primero).
- Con Supabase inalcanzable la página no falla y muestra "Sin puntuaciones todavía".
- Sin scroll horizontal a 375 px; sin errores de hidratación.
- Ninguna clave `service_role` en el repo; solo la clave publicable.
- Assets (sprites, sonidos) en `public/games/<slug>/`, sin cargarse durante el render.

## Qué no hacer

- No usar `service_role` ni saltarse RLS.
- No añadir autenticación, mejor-puntuación-por-alias, anti-trampas ni paginación: están fuera de alcance de las SPEC 05/06 y van en specs propias.
- No copiar el `game.js` a `public/` ni usar un iframe: no hay forma limpia de leer la puntuación.
- No reescribir lo genérico (panel, ranking, nav) para un juego concreto: si falta algo, extiéndelo con una prop.
- No dar un paso por hecho sin haber ejecutado su verificación.

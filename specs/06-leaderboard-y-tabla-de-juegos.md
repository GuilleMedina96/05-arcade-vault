# SPEC 06 — Leaderboard y tabla de juegos

> **Estado:** Implementada
> **Depende de:** SPEC 04 (clientes de Supabase y variables de entorno), SPEC 05 (juego Asteroids y su motor), SPEC 02 (`Nav` y Inicio)
> **Fecha:** 2026-11-12
> **Objetivo:** Crear en Supabase las tablas `games` y `scores`, permitir enviar la puntuación con un alias al terminar una partida de Asteroids y mostrar el ranking en `/ranking` y en un panel junto al juego.

---

## Por qué existe esta spec

La SPEC 04 dejó la conexión con Supabase y la base vacía. La SPEC 05 dejó un juego jugable que descarta la puntuación al desmontar y explicó que se conectaría "en la spec de puntuaciones". Esta es esa spec.

Todavía no hay autenticación, así que el jugador se identifica con un alias libre. Eso no impide tener un ranking útil, pero obliga a aceptar que el alias no es una identidad y que el ranking no es a prueba de trampas. Las decisiones de esta spec buscan que el esquema siga valiendo cuando lleguen el login y los perfiles: `scores` es una tabla de partidas y no de jugadores, y `games` es el catálogo al que apuntarán Tetris y Arkanoid.

---

## Alcance

**Dentro:**

- Migración SQL versionada en `supabase/migrations/` con las tablas `games` y `scores`, sus restricciones, un índice por ranking, las políticas RLS y el sembrado de la fila `asteroids`. Se aplica con `apply_migration` del MCP de Supabase.
- Tipos generados de la base en `lib/supabase/database.types.ts` y clientes de `lib/supabase/` tipados con `Database`.
- Motor de Asteroids con un callback opcional `onGameOver(score)` que se invoca una vez por partida al pasar a `gameover`.
- Formulario de envío bajo el canvas en `/juegos/asteroids`: aparece al terminar la partida, pide un alias, permite omitir el envío y recuerda el último alias en `localStorage`.
- Server Action `submitScore` que valida los datos y los inserta en `scores`.
- Panel "Top 10" junto al juego en `/juegos/asteroids`, que se actualiza tras enviar una puntuación.
- Página `/ranking` con el ranking global por juego (top 20), un selector de juego alimentado por la tabla `games` y `metadata` "Ranking · Arcade Vault".
- Entrada "Ranking" en `components/nav.tsx` (escritorio y móvil).
- En el Inicio, el enlace "Salón de la Fama" que hoy apunta a `/salon` pasa a apuntar a `/ranking`.

**Fuera de alcance (para otras specs):**

- Autenticación, registro, login, `profiles` y asociar partidas a un usuario.
- Mejor puntuación por alias y unicidad de alias. Cada partida es una fila.
- Protección real contra trampas (repetición de partida, firmas, validación en servidor del desarrollo del juego) y límite de envíos por IP.
- Filtro de alias ofensivos y moderación; borrado o edición de puntuaciones.
- Sembrar otros juegos distintos de `asteroids` y portar Tetris y Arkanoid.
- Datos reales en el widget de ranking del Inicio (sigue con sus datos estáticos; solo cambia su enlace).
- Biblioteca, detalle de juego y reproductor genérico de la SPEC 01.
- Paginación del ranking, filtros por fecha (semana, mes) y tiempo real (Realtime).
- Créditos funcionales y logros.
- Tests automatizados.

---

## Modelo de datos

```sql
create table public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text,
  created_at  timestamptz not null default now()
);

create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  alias      text not null check (alias ~ '^[A-Za-z0-9_-]{3,12}$'),
  score      integer not null check (score between 0 and 1000000),
  created_at timestamptz not null default now()
);

create index scores_game_ranking_idx
  on public.scores (game_id, score desc, created_at asc);

-- Semilla
-- insert into games (slug, name, description) values ('asteroids', 'Asteroids', '...');
```

Políticas RLS (ambas tablas con RLS activo):

- `games`: `select` para `anon` y `authenticated`. Sin `insert`, `update` ni `delete`.
- `scores`: `select` para `anon` y `authenticated`; `insert` para `anon` y `authenticated` (con los `check` de la tabla como única barrera). Sin `update` ni `delete`.

Tipos de la aplicación:

```ts
// lib/supabase/database.types.ts — generado con generate_typescript_types, no se edita a mano
export type Database = { public: { Tables: { games: {...}; scores: {...} } } };

// lib/games/asteroids/engine.ts
export function startAsteroids(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void;

// lib/scores.ts
export type ScoreRow = { id: string; alias: string; score: number; created_at: string };
export async function getTopScores(gameSlug: string, limit: number): Promise<ScoreRow[]>;
export async function getGames(): Promise<{ slug: string; name: string }[]>;

// app/juegos/asteroids/actions.ts
export async function submitScore(input: { gameSlug: string; alias: string; score: number }):
  Promise<{ ok: true } | { ok: false; error: "invalid" | "failed" }>;
```

Convenciones:

- Orden del ranking: `score` descendente y, a igualdad, la más antigua primero (`created_at` ascendente).
- Clave de `localStorage` para el alias: `arcade-vault:alias:v1`. Es la única escritura en `localStorage` de la feature.
- `getTopScores` y `getGames` devuelven un array vacío si Supabase falla; la UI lo muestra como "Sin puntuaciones todavía".
- `submitScore` valida con las mismas reglas que la base (alias `^[A-Za-z0-9_-]{3,12}$`, `score` entero entre 0 y 1 000 000) y no devuelve el mensaje de error de Supabase.

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` las guías de Server Actions (`"use server"`), de `cacheComponents` (datos dinámicos dentro de `<Suspense>`) y de `revalidatePath`, según indica `AGENTS.md`. Para el aspecto de `/ranking`, el panel y el formulario (pasos 6 a 8), usar el skill `/frontend-design`, como exige `CLAUDE.md`. Cada paso deja la app ejecutable.

1. **Esquema.** Crear `supabase/migrations/20261112000000_games_and_scores.sql` con el SQL del modelo de datos, el RLS, las políticas y el `insert` de `asteroids`, y aplicarla con `apply_migration`. Verificación: `list_tables` muestra `games` y `scores` con RLS activo, `games` tiene 1 fila y `get_advisors` (seguridad) no marca tablas sin RLS.
2. **Tipos y clientes.** Generar `lib/supabase/database.types.ts` con `generate_typescript_types` y pasar `Database` a `createBrowserClient` y `createServerClient` en `lib/supabase/client.ts` y `lib/supabase/server.ts`. Verificación: `npx tsc --noEmit` sin errores.
3. **Lectura.** Crear `lib/scores.ts` con `getTopScores` y `getGames` usando el cliente de servidor. Verificación: `npx tsc --noEmit` y `npx eslint lib` sin errores.
4. **Envío.** Crear `app/juegos/asteroids/actions.ts` con `submitScore`: valida, busca el `game_id` por `slug`, inserta y llama a `revalidatePath` para `/juegos/asteroids` y `/ranking`. Verificación: `npx tsc --noEmit` sin errores y una llamada de prueba inserta una fila y una entrada inválida devuelve `{ ok: false, error: "invalid" }`.
5. **Callback del motor.** En `lib/games/asteroids/engine.ts`, aceptar `options.onGameOver` y llamarlo una sola vez al entrar en `gameover`. Hacer que el motor ignore `keydown` cuyo `target` sea un `input` o `textarea`, para poder escribir el alias sin disparar ni reiniciar. Verificación: `npx tsc --noEmit` sin errores y la partida se comporta igual que antes.
6. **Formulario de envío.** Crear `components/score-submit.tsx` (cliente): campo de alias con valor inicial de `localStorage`, botones "Enviar" y "Omitir", estados de envío, error y éxito. Integrarlo en `components/asteroids-game.tsx`, que pasa `onGameOver` al motor y oculta el formulario al reiniciar con Espacio. Verificación: al perder la última vida aparece el formulario bajo el canvas; enviar un alias válido inserta la fila.
7. **Panel Top 10.** Crear `components/leaderboard-panel.tsx` (servidor, dentro de `<Suspense>` con un estado de carga) y colocarlo junto al canvas en `app/juegos/asteroids/page.tsx`. Verificación: tras enviar una puntuación el panel la muestra sin recargar a mano.
8. **Página `/ranking`.** Crear `app/ranking/page.tsx` con el top 20 y el selector de juego (`?juego=<slug>`, por defecto `asteroids`; un `slug` desconocido muestra "Juego no encontrado"). Verificación: `/ranking` muestra el ranking con el mismo orden que el panel.
9. **Enlaces.** Añadir `{ href: "/ranking", label: "Ranking" }` a `components/nav.tsx` y cambiar el enlace `/salon` de `app/page.tsx` por `/ranking`. Verificación: el nav muestra "Ranking" activo en `/ranking` y el enlace del Inicio abre la página.
10. **Cierre.** Ejecutar `npx tsc --noEmit`, `npx eslint app components lib`, `npx prettier --check .` y `npm run build`, y probar una partida completa con envío en el navegador. Verificación: todo termina sin errores.

---

## Criterios de aceptación

- [ ] `npx eslint app components lib`, `npx tsc --noEmit`, `npx prettier --check .` y `npm run build` terminan sin errores.
- [x] Existe `supabase/migrations/20261112000000_games_and_scores.sql` y `list_tables` muestra `games` y `scores` con RLS activo.
- [x] `games` contiene exactamente una fila con `slug = 'asteroids'`.
- [x] Con la clave publicable, un `insert` en `scores` con alias de 2 caracteres, alias con espacios, `score` negativo o `score` mayor que 1 000 000 es rechazado por la base.
- [x] Con la clave publicable, un `update` o `delete` en `scores` y cualquier `insert` en `games` son rechazados.
- [x] Al llegar a GAME OVER aparece el formulario con el último alias guardado en `arcade-vault:alias:v1` (vacío la primera vez).
- [x] Escribir un alias con espacios o más de 12 caracteres muestra un error y no inserta nada.
- [x] Escribir en el campo del alias, incluida la barra espaciadora, no dispara ni reinicia el juego.
- [x] Enviar un alias válido inserta una fila en `scores` con el `game_id` de `asteroids` y la puntuación de la partida, y guarda el alias en `localStorage`.
- [x] Pulsar "Omitir" cierra el formulario sin insertar nada.
- [x] Una partida produce como máximo una fila: no se puede enviar dos veces la misma puntuación.
- [x] Tras enviar, el panel Top 10 de `/juegos/asteroids` incluye la nueva puntuación en su posición correcta sin recarga manual.
- [x] `/ranking` lista como máximo 20 filas ordenadas por puntuación descendente y, a igualdad, la más antigua primero.
- [x] `/ranking?juego=no-existe` muestra "Juego no encontrado" sin lanzar error.
- [x] Con Supabase inalcanzable, `/ranking` y el panel muestran "Sin puntuaciones todavía" y la página no falla.
- [x] El nav muestra "Ranking" en escritorio y móvil, y el enlace del Inicio que iba a `/salon` abre `/ranking`.
- [x] Reiniciar con Espacio tras GAME OVER oculta el formulario y empieza una partida nueva con 0 puntos.
- [x] Navegar fuera de `/juegos/asteroids` y volver no duplica el juego ni el callback `onGameOver`.
- [x] A 375 px de ancho no hay scroll horizontal en `/ranking` ni en `/juegos/asteroids`.
- [x] La consola del navegador no muestra errores ni warnings de hidratación en `/ranking`, `/juegos/asteroids` ni `/`.
- [x] Ningún archivo versionado contiene una clave `service_role` y no se usa ninguna clave distinta de la publicable.

---

## Decisiones

- **Sí:** tabla `games` en base de datos y `scores.game_id` como clave foránea. Es el catálogo al que apuntarán los demás juegos y evita repetir el nombre del juego en cada puntuación.
- **No:** solo un listado de juegos en código. Cada juego nuevo exigiría tocar código en varios sitios y las puntuaciones no tendrían a qué referirse.
- **Sí:** alias anónimo sin login. Desbloquea el ranking ahora; la autenticación y `profiles` son una spec propia que añadirá `scores.user_id` nullable sin romper nada.
- **No:** Auth con email y contraseña ni auth anónima de Supabase en esta spec. Tocan formularios, sesión y perfiles, y duplicarían trabajo de la spec de auth.
- **Sí:** cada partida es una fila. Sin identidad, "mejor puntuación por alias" dejaría a cualquiera usar el alias de otro, y permite ver todas las partidas.
- **No:** unicidad de alias. Sin login no se puede garantizar quién es el dueño.
- **Sí:** `insert` público con RLS y `check` en la propia tabla, y validación duplicada en la Server Action. La base es la barrera real; la acción da errores claros y mantiene la clave fuera del navegador de otro modo.
- **No:** validación con repetición de partida. Es una spec grande; se acepta que alguien pueda enviar una puntuación falsa.
- **No:** `service_role` para insertar. La clave publicable con RLS basta y evita introducir un secreto de servidor; se reevaluará con la protección anti-trampas.
- **Sí:** `check score <= 1000000` como tope razonable. Limita el daño de una inserción manipulada sin impedir puntuaciones legítimas.
- **Sí:** SQL versionado en `supabase/migrations/` y aplicado con `apply_migration`. El esquema queda en el repositorio y es reproducible.
- **Sí:** tipos generados en `lib/supabase/database.types.ts` y clientes tipados, como anticipó la SPEC 04.
- **Sí:** `onGameOver(score)` opcional en el motor. Era el punto de conexión previsto por la SPEC 05; sin el callback el motor sigue funcionando igual.
- **Sí:** formulario bajo el canvas, no dibujado dentro. Un `input` HTML da teclado, accesibilidad y autocompletado; dibujar texto editable en el canvas sería mucho código.
- **Sí:** el motor ignora `keydown` desde `input` y `textarea`. Sin esto, la barra espaciadora reiniciaría la partida y las flechas se bloquearían al escribir.
- **Sí:** alias recordado en `localStorage` con clave versionada, y envío opcional. Reduce fricción y no obliga a nadie a publicar su puntuación.
- **Sí:** panel Top 10 junto al juego y página `/ranking` con selector. El panel motiva a jugar de nuevo; la página escala a más juegos.
- **Sí:** panel y página renderizados en servidor dentro de `<Suspense>`, refrescados con `revalidatePath` tras enviar. Es el patrón compatible con `cacheComponents`.
- **No:** Realtime, paginación y filtros por fecha. Añaden complejidad sin ser necesarios con un solo juego.
- **Sí:** el widget de ranking del Inicio mantiene sus datos estáticos y solo cambia su enlace. Datos reales ahí se pueden hacer después con `getTopScores`.
- **Sí:** entrada "Ranking" en el nav. Modifica el alcance de la SPEC 02, que limitaba el nav a Inicio y Acerca de; es un cambio deliberado.

---

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cualquiera puede insertar puntuaciones falsas desde fuera de la aplicación.                      | Aceptado en esta fase. Los `check` de la tabla acotan alias y puntuación; la protección real va en otra spec.                                          |
| Spam: inserciones masivas llenan la tabla.                                                       | Aceptado en esta fase. Se puede limpiar con SQL y el límite de envíos por IP queda fuera de alcance.                                                   |
| Alias ofensivos visibles en el ranking.                                                          | El patrón del alias solo admite letras, números, `_` y `-`. El filtrado de palabras y la moderación quedan fuera de alcance.                           |
| Con `cacheComponents`, leer `cookies()` en el panel fuera de `<Suspense>` rompe `npm run build`. | El panel y `/ranking` leen datos dentro de `<Suspense>` y el cliente se crea dentro de la petición. `/juegos/asteroids` pasa a prerenderizado parcial. |
| La barra espaciadora al escribir el alias reinicia o dispara el juego.                           | El motor ignora teclas con `target` en `input`/`textarea` (paso 5) y hay un criterio de aceptación.                                                    |
| `onGameOver` se llama varias veces o se duplica con Strict Mode.                                 | Se invoca solo al transicionar a `gameover` y el montaje devuelve la limpieza; el formulario bloquea el reenvío tras un éxito.                         |
| Doble envío por doble clic.                                                                      | El botón se deshabilita mientras la acción está en curso y tras éxito.                                                                                 |
| `apply_migration` y el archivo del repositorio divergen.                                         | El SQL se escribe primero en el archivo y se aplica desde él; el paso 1 verifica el estado con `list_tables`.                                          |
| Falla Supabase al leer o enviar.                                                                 | La lectura devuelve vacío y la UI lo indica; el envío muestra un error genérico y deja reintentar sin perder la puntuación.                            |

---

## Qué **no** está en esta spec

- Autenticación, perfiles y asociar partidas a un usuario.
- Mejor puntuación por alias, unicidad de alias y moderación de alias.
- Protección real contra trampas y límite de envíos.
- Otros juegos en `games`, y el port de Tetris y Arkanoid.
- Datos reales en el widget de ranking del Inicio.
- Biblioteca, detalle de juego y reproductor genérico (SPEC 01).
- Paginación, filtros por fecha y Realtime.
- Borrado o edición de puntuaciones.
- Créditos funcionales y logros.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propia spec.

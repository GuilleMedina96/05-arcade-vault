# SPEC 01 — MVP visual de Arcade Vault (5 pantallas del template)

> **Estado:** Aprobado
> **Depende de:** ninguna (el commit `01-styles` ya portó el CSS y las fuentes)
> **Fecha:** 2026-10-21
> **Objetivo:** Implementar en Next.js las 5 pantallas del template `references/resources/templates/` (biblioteca, detalle, reproductor, auth y salón de la fama) con datos mock y sin ningún juego real.

---

## Por qué existe esta spec

El diseño ya existe como prototipo SPA en React 18 UMD + Babel (`references/resources/templates/*.jsx`, `styles.css`). Hay que llevarlo a Next.js 16 (App Router) conservando la estética neón/CRT sin cambios. Esta spec es solo la capa visual: es la base sobre la que después se montarán backend, cuentas reales y juegos.

Estado actual verificado del repo:

- `app/globals.css` ya contiene el tema completo portado del template (variables, `.av-nav`, `.card`, `.crt`, `.podium`, etc.) más el bloque `@theme inline`.
- `app/layout.tsx` ya carga Press Start 2P, JetBrains Mono y Courier Prime con `next/font/google` y renderiza `.av-bg` y `.av-noise` dentro de `#root`.
- `app/page.tsx` sigue siendo el scaffold de Create Next App.

---

## Alcance

**Dentro:**

- 5 pantallas como rutas reales del App Router:
  - `/` → Biblioteca (hero, búsqueda, chips de categoría, grilla de tarjetas con tilt).
  - `/juegos/[id]` → Detalle del juego (portada, tags, stats, leaderboard top 10).
  - `/juegos/[id]/jugar` → Reproductor (HUD, pantalla CRT, pausa, modal de fin de partida con guardado de puntuación).
  - `/auth` → Iniciar sesión / Crear cuenta / Jugar como invitado.
  - `/salon` → Salón de la Fama (tabs por juego, podio, tabla, fila "tu mejor marca").
- Componentes compartidos: `Nav` (con panel móvil/hamburguesa) y footer, presentes en todas las rutas desde `app/layout.tsx`.
- Datos mock tipados en TypeScript (los 8 juegos, categorías y `seededScores` determinista del template).
- Sesión simulada con `localStorage` (`av_user`) y guardado de puntuaciones simulado (`av_scores`), igual que el template.
- Partida simulada en el reproductor (la puntuación sube sola, pausa, fin, reiniciar), igual que el template.
- Estado vacío de la biblioteca ("NO HAY RESULTADOS") y `not-found` para ids de juego inexistentes.
- Diseño responsive tal como lo define `globals.css` (nav colapsa a hamburguesa).

**Fuera de alcance (para otras specs):**

- Cualquier juego real (canvas, lógica, controles). El reproductor solo muestra la arena decorativa.
- Backend, base de datos, autenticación real, OAuth (los botones Google/GitHub son decorativos).
- Persistencia real de puntuaciones y leaderboards reales (los rankings son mock deterministas).
- Mostrar en el salón o en el detalle las puntuaciones guardadas en `av_scores` (solo se escriben).
- Sistema de créditos funcional (`CRÉDITOS · 03` es texto estático).
- Tests automatizados (el proyecto no tiene test runner).
- Modo claro, i18n (todo el texto en español, fijo) y SEO avanzado más allá de `metadata` básica.

---

## Modelo de datos

Archivo nuevo `lib/games.ts` (traducción tipada de `data.jsx`):

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type AccentColor = "cyan" | "magenta" | "green" | "yellow";

export interface Game {
  id: string;        // slug de la URL, ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;     // clase CSS existente en globals.css, ej. "cover-bricks"
  color: AccentColor;
  best: number;
  plays: string;     // texto ya formateado, ej. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;      // "DD/MM/2026"
}

export const GAMES: Game[];                 // 8 juegos, mismos ids que el template
export const CATS: ("TODOS" | Category)[];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Archivo nuevo `components/session-provider.tsx` (Client Component, React context):

```ts
export interface User { name: string }      // máx. 10 caracteres, en mayúsculas

interface Session {
  user: User | null;
  ready: boolean;                           // false hasta leer localStorage (evita mismatch de hidratación)
  login: (u: User | null) => void;          // null = invitado
  signOut: () => void;
  saveScore: (e: { game: string; score: number; name: string }) => void;
}
```

Claves de `localStorage`:

- `av_user`: `User` serializado en JSON.
- `av_scores`: array de `{ game, score, name, at }` (`at` = `Date.now()`).

Convenciones:

- Los números se formatean con `toLocaleString("es-ES")`.
- Los ids de juego válidos son los de `GAMES`; la semilla de `seededScores` se calcula igual que en el template (`id.length * 17 + 3` en detalle, `id.length * 23 + 7` en salón).

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` las guías de `cacheComponents`, rutas dinámicas (`params` asíncrono), `not-found` y Client Components, según indica `AGENTS.md`. Cada paso deja la app ejecutable (`npm run dev`).

1. **Datos mock.** Crear `lib/games.ts` con los tipos, `GAMES`, `CATS` y `seededScores`. Verificación: `npm run lint` pasa y el módulo se importa sin errores.
2. **Sesión simulada.** Crear `components/session-provider.tsx` (`"use client"`, hook `useSession`) leyendo `av_user` en un `useEffect` para marcar `ready`. Envolver `children` en `app/layout.tsx`. Verificación: la app sigue renderizando.
3. **Nav y footer.** Crear `components/nav.tsx` (Client Component con `usePathname`, enlaces con `next/link`, botón Iniciar Sesión o `NOMBRE ▾` que cierra sesión, panel móvil con backdrop) y `components/footer.tsx`. Montarlos en `app/layout.tsx` alrededor de `<main className="av-main">`. Verificación: aparecen en todas las rutas y "Biblioteca" queda activa en `/` y `/juegos/*`.
4. **Biblioteca.** Crear `components/game-card.tsx` (tilt con `onMouseMove`), `components/library.tsx` (búsqueda + chips, Client Component) y reemplazar `app/page.tsx`. Verificación: se ven 8 tarjetas; buscar "zzz" muestra "NO HAY RESULTADOS".
5. **Detalle.** Crear `app/juegos/[id]/page.tsx` (con `generateStaticParams` sobre `GAMES`) y `app/juegos/not-found.tsx` o equivalente; llamar a `notFound()` si el id no existe. Verificación: `/juegos/caida` muestra el juego y 10 filas de leaderboard.
6. **Auth.** Crear `app/auth/page.tsx` y `components/auth-form.tsx` (tabs entrar/crear con campo email condicional, enviar → `login` + redirección a `/`, botón invitado → `login(null)` + redirección). Verificación: tras entrar, el nav muestra el nombre y sobrevive a un reload.
7. **Reproductor.** Crear `app/juegos/[id]/jugar/page.tsx` y `components/game-player.tsx` (Client Component con la simulación del template: intervalo de 220 ms, pausa, FIN, modal de fin, guardar vía `saveScore`, reiniciar). Verificación: la puntuación sube, PAUSA la detiene, FIN abre el modal.
8. **Salón de la Fama.** Crear `app/salon/page.tsx` y `components/hall-of-fame.tsx` (tabs por juego, podio top 3, tabla de 12 filas, fila "tu mejor marca" solo con sesión iniciada). Verificación: cambiar de tab cambia podio y tabla.
9. **Metadata y limpieza.** Añadir `metadata` por ruta (título "… · Arcade Vault"), borrar el scaffold sobrante de `app/page.tsx` y activos no usados de `public/` (p. ej. `next.svg`) si ya no se referencian, y ejecutar `npm run build` sin errores.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] Existen las rutas `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth` y `/salon` y cada una renderiza su pantalla del template.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna de las 5 rutas.
- [ ] La biblioteca muestra 8 tarjetas; el chip "SHOOTER" deja 2 (INVASORES y ROCAS); el chip "TODOS" vuelve a mostrar 8.
- [ ] Buscar un texto sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Pulsar una tarjeta o su botón JUGAR navega a `/juegos/<id>`.
- [ ] `/juegos/no-existe` y `/juegos/no-existe/jugar` muestran la página not-found.
- [ ] El detalle muestra título, descripción larga, 4 tags, 3 stats y 10 filas de leaderboard, con las 3 primeras con estilo top1/top2/top3.
- [ ] "JUGAR AHORA" lleva a `/juegos/<id>/jugar` y "VOLVER AL VAULT" a `/`.
- [ ] En el reproductor la puntuación aumenta sola cada ~220 ms, PAUSA la congela y muestra "EN PAUSA", y REANUDAR la retoma.
- [ ] FIN abre el modal con la puntuación final; "GUARDAR PUNTUACIÓN" escribe una entrada en `localStorage["av_scores"]` y muestra "PUNTUACIÓN GUARDADA_".
- [ ] "JUGAR DE NUEVO" reinicia puntuación, vidas y nivel; "SALIR" vuelve a `/juegos/<id>`.
- [ ] El campo de iniciales del modal admite como máximo 10 caracteres y los convierte a mayúsculas.
- [ ] En `/auth`, la pestaña "CREAR CUENTA" muestra el campo de correo y "INICIAR SESIÓN" lo oculta.
- [ ] Enviar el formulario con usuario `px_kai` guarda `av_user = {"name":"PX_KAI"}` y redirige a `/`; con usuario vacío guarda `PLAYER1`.
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin dejar `av_user` en `localStorage`.
- [ ] Con sesión iniciada, el nav muestra `NOMBRE ▾` y al pulsarlo cierra la sesión y muestra otra vez "Iniciar Sesión".
- [ ] La sesión persiste tras recargar la página.
- [ ] `/salon` muestra podio (02 · 01 · 03), tabla de 12 filas y un tab por cada uno de los 8 juegos.
- [ ] La fila "TU MEJOR MARCA EN <JUEGO>" aparece solo con sesión iniciada.
- [ ] A 375 px de ancho no hay scroll horizontal, el nav muestra el botón hamburguesa y su panel se abre y se cierra con el backdrop.
- [ ] El nav marca "Biblioteca" como activa en `/`, `/juegos/*` y "Salón de la Fama" en `/salon`.
- [ ] No quedan referencias al scaffold de Create Next App en `app/page.tsx`.

---

## Decisiones

- **Sí:** rutas reales del App Router. URLs compartibles y encaje natural con Next; el template usaba un hash con estado solo por ser un prototipo sin router.
- **No:** replicar la SPA con `useState` + hash. Pierde enlaces directos y no es idiomático en Next.
- **Sí:** reutilizar el CSS ya portado en `app/globals.css` y los nombres de clase del template. Máxima fidelidad visual y cero trabajo duplicado; el commit `01-styles` ya lo resolvió.
- **No:** reescribir los estilos con utilidades Tailwind. Más trabajo y riesgo de divergir del diseño sin aportar valor al MVP.
- **Sí:** datos mock en un módulo TS tipado (`lib/games.ts`). Es el punto único que luego se sustituirá por datos reales.
- **Sí:** sesión y puntuaciones simuladas en `localStorage` con las claves del template (`av_user`, `av_scores`). Permite probar el flujo completo sin backend.
- **No:** leer `av_scores` en detalle o salón. Mostrar puntuaciones propias reales exige decidir el modelo de datos; va en una spec posterior.
- **Sí:** mantener la partida simulada del reproductor. Valida HUD, pausa y modal de fin, que serán el contrato para los juegos reales.
- **Sí:** componentes servidor por defecto y `"use client"` solo donde hay estado o eventos (nav, biblioteca, tarjeta, auth, reproductor, salón, provider).
- **Sí:** `ready` en el provider para no renderizar según `localStorage` antes de hidratar. Evita warnings de hidratación.
- **No:** Context Provider para las rutas ni librerías de estado. El único estado global es el usuario.
- **Sí:** estilos inline del footer y de pequeños ajustes del template pueden pasar a clases en `globals.css` si el componente lo necesita; no se rediseña nada.
- **Sí:** respetar la regla del proyecto de usar `/frontend-design` si durante la implementación hay que añadir elementos visuales nuevos no presentes en el template (p. ej. página not-found).

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `cacheComponents` cambia la semántica de renderizado dinámico y de `params` en rutas `[id]`. | Leer la guía en `node_modules/next/dist/docs/` antes de empezar y usar `generateStaticParams` con `GAMES`. |
| Mismatch de hidratación por leer `localStorage` en el primer render. | `ready` en el provider; el nav no pinta el estado de sesión hasta que `ready` sea `true`. |
| `seededScores` puede devolver nombres repetidos si `count` supera la lista de jugadores. | Usar `key` con el índice además del nombre, como hace el salón en el template. |
| `Math.random` en la simulación del reproductor rompe el render en servidor. | Usarlo solo dentro del `setInterval` de un `useEffect`, nunca durante el render. |
| `localStorage` desactivado o lleno (modo privado). | Envolver lecturas y escrituras en `try/catch`; la app funciona sin persistir. |

---

## Qué **no** está en esta spec

- Ningún juego real: el reproductor es una simulación decorativa.
- Backend, base de datos, cuentas y OAuth reales.
- Leaderboards reales o lectura de `av_scores` en detalle y salón.
- Créditos funcionales, tienda, perfil de usuario.
- Tests automatizados, i18n y modo claro.

Cada uno de estos puntos, si se aborda, va en su propia spec.

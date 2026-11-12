# SPEC 04 — Integración de Supabase (clientes y sesión)

> **Estado:** Implementada
> **Depende de:** SPEC 03 (convención de `.env.example` y `.gitignore` para variables de entorno)
> **Fecha:** 2026-11-11
> **Objetivo:** Conectar la app Next.js con el proyecto de Supabase mediante clientes de servidor y navegador y un proxy que refresca la sesión, sin crear tablas ni esquemas y sin añadir ninguna pantalla.

---

## Por qué existe esta spec

El proyecto de Supabase existe pero está vacío y la app no tiene ninguna dependencia de Supabase. La autenticación y las puntuaciones necesitan esta base, pero mezclarla con el esquema de datos y las pantallas de login haría una spec demasiado grande. Aquí solo se deja lista la conexión: cuando lleguen las specs de esquema (perfiles, puntuaciones) y de UI (`/auth`, nav con sesión), tendrán los clientes ya listos.

---

## Alcance

**Dentro:**

- Dependencias nuevas: `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example` y rellenadas en `.env.local`.
- Cliente de navegador (`lib/supabase/client.ts`) y cliente de servidor (`lib/supabase/server.ts`) basados en cookies, sin tipos de base de datos por ahora.
- `proxy.ts` en la raíz (convención de Next.js 16 que sustituye a `middleware.ts`) que refresca la sesión en cada petición, apoyado en `lib/supabase/proxy.ts`.
- Ruta de salud `app/api/health/route.ts` que comprueba que Supabase es alcanzable con la configuración actual.
- Configuración manual en el panel de Supabase: autenticación por email y contraseña activa, confirmación de correo desactivada.

**Fuera de alcance (para otras specs):**

- Tablas, esquemas, migraciones, políticas RLS, triggers y tipos generados de base de datos (incluida la tabla `profiles`). La base sigue vacía.
- Cualquier cambio de interfaz: página `/auth`, entradas de login/salir en el nav, nombre de jugador en el nav y créditos funcionales. El contador `CRÉDITOS · 03` sigue estático.
- Server Actions de registro, inicio y cierre de sesión (`signUp`, `signIn`, `signOut`).
- Rutas protegidas. El proxy solo refresca la sesión, no redirige a nadie.
- Confirmación de correo, SMTP propio, recuperación de contraseña y OAuth.
- Tablas de juegos, puntuaciones y ranking.
- Clave `service_role` y cualquier cliente con privilegios de administrador.
- Entorno local con la CLI de Supabase (`supabase start`) y ramas de base de datos.
- Tests automatizados.

---

## Contratos

Contrato de los clientes:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient;

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;

// lib/supabase/proxy.ts
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse>;
```

Respuesta de la ruta de salud:

```ts
// app/api/health/route.ts — GET
// 200 → { ok: true }
// 503 → { ok: false }
```

La ruta hace un `fetch` a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` con la cabecera `apikey` (clave publicable). No consulta ninguna tabla, así que funciona con la base vacía. Responde 200 si Supabase contesta con éxito y 503 si falla la red o la respuesta no es correcta.

Variables de entorno (en `.env.local`, nunca en el repositorio):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Convenciones:

- Solo se usa la clave publicable; no existe ninguna variable con la clave `service_role`.
- Cuando una spec posterior cree el esquema, los clientes se tiparán con los tipos generados por `generate_typescript_types`.

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` la referencia de `03-api-reference/03-file-conventions/proxy.md`, la de la función `cookies` y la guía de Route Handlers, porque `cacheComponents` está activo y afecta a cómo se leen las cookies y qué rutas son dinámicas (según indica `AGENTS.md`). Cada paso deja la app ejecutable.

1. **Dependencias y entorno.** Ejecutar `npm install @supabase/supabase-js @supabase/ssr`. Añadir las 2 variables vacías a `.env.example`, y rellenar `.env.local` con la URL y la clave publicable (obtenidas con las herramientas `get_project_url` y `get_publishable_keys` del MCP de Supabase). Verificación: `npm run dev` arranca y `git status` muestra `.env.example` modificado y `.env.local` ausente.
2. **Clientes.** Crear `lib/supabase/client.ts` (`createBrowserClient`) y `lib/supabase/server.ts` (`createServerClient` con `cookies()` de `next/headers`). Ambos leen las 2 variables de entorno y lanzan un error claro si faltan. Verificación: `npx eslint lib` sin errores.
3. **Proxy de sesión.** Crear `lib/supabase/proxy.ts` con `updateSession(request)`, que crea el cliente de servidor sobre las cookies de la petición, llama a `supabase.auth.getClaims()` para refrescar el token y devuelve la respuesta con las cookies actualizadas. Crear `proxy.ts` en la raíz que lo invoca, con un `matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y archivos de imagen. Verificación: `npm run dev` y `/` y `/acerca-de` siguen respondiendo 200.
4. **Ruta de salud.** Crear `app/api/health/route.ts` según el contrato, sin exponer el mensaje de error. Verificación: `curl localhost:3000/api/health` devuelve `{"ok":true}`.
5. **Cierre.** Ejecutar `npx tsc --noEmit`, `npx eslint app components lib`, `npx prettier --check .` y `npm run build`, y marcar esta spec como implementada. Verificación: todo termina sin errores.

---

## Criterios de aceptación

- [x] `npx eslint app components lib`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [x] `.env.example` lista `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` vacías, y `.env.local` no aparece en `git status`.
- [x] Ningún archivo versionado contiene una clave `sb_publishable_` ni `service_role`.
- [x] `proxy.ts` existe en la raíz y no existe ningún `middleware.ts`.
- [x] `GET /api/health` devuelve `200` con `{"ok":true}` con la configuración correcta.
- [x] Con `NEXT_PUBLIC_SUPABASE_URL` apuntando a un host inválido, `GET /api/health` devuelve `503` con `{"ok":false}` y el cuerpo no contiene el mensaje de error.
- [x] No existe la carpeta `supabase/migrations/` y `list_tables` sigue mostrando 0 tablas.
- [ ] En el panel de Supabase (Authentication → Providers → Email), el proveedor está activo y "Confirm email" está desactivado.
- [x] `/` y `/acerca-de` se ven y se comportan igual que antes, y la consola del navegador no muestra errores ni warnings de hidratación.

---

## Decisiones

- **Sí:** limitar la spec a conexión y sesión, sin UI ni esquema. La interfaz de auth y las tablas son otras specs; mezclarlas tocaría nav, formularios, diseño y base de datos a la vez.
- **No:** crear tablas, migraciones ni tipos generados todavía. No se necesitan para conectar; se añaden con la spec que defina el modelo de datos.
- **Sí:** `@supabase/ssr` con clientes separados de navegador y servidor. Es el patrón oficial para App Router y mantiene la sesión en cookies, legible desde Server Components y Server Actions.
- **No:** `supabase-js` directo con `localStorage`. La sesión no llegaría al servidor.
- **Sí:** `proxy.ts`, no `middleware.ts`. En Next.js 16 `middleware` está deprecado y renombrado a `proxy`.
- **Sí:** el proxy solo refresca la sesión con `getClaims()`. Los tokens caducan y las cookies deben renovarse antes de renderizar; no protege rutas porque aún no hay ninguna.
- **No:** proteger rutas en esta spec. Se añade con las pantallas que lo necesiten (reproductor, salón de la fama).
- **Sí:** clave publicable (`sb_publishable_`) como única clave del cliente. Es la clave pensada para exponerse al navegador, y la seguridad real la darán las políticas RLS cuando existan tablas.
- **No:** clave `service_role`. Se salta RLS; si más adelante hace falta, va en su propia spec con una variable sin prefijo `NEXT_PUBLIC_`.
- **Sí:** confirmación de correo desactivada por ahora. El SMTP por defecto de Supabase permite muy pocos correos por hora y bloquearía el registro; se activa cuando haya SMTP propio.
- **Sí:** ruta `/api/health` mínima que consulta el endpoint de salud de Auth en vez de una tabla. Permite comprobar la conexión con la base vacía y sirve para comprobar despliegues; no devuelve detalles internos.
- **No:** Server Actions `signUp`, `signIn` y `signOut` en esta spec. Se escriben junto a los formularios que las usan.
- **No:** entorno local con `supabase start`. Requiere Docker y ramas de BD; innecesario por ahora.

---

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Con `cacheComponents`, leer `cookies()` fuera de un contexto dinámico rompe `npm run build`.   | Leer la guía de `cookies` antes del paso 2; el cliente de servidor se crea dentro de la petición, no a nivel de módulo, y `/api/health` es dinámica. |
| El `matcher` del proxy intercepta recursos estáticos y ralentiza la app.                       | El `matcher` excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes.                                                                        |
| Con la confirmación de correo desactivada, cualquiera puede registrarse con un correo ajeno.   | Aceptado en esta fase; se activa cuando haya SMTP propio y la spec de UI de auth.                                                                    |
| Una clave de Supabase subida al repositorio por error.                                         | Solo se usa la clave publicable, expuesta por diseño; `.env.local` está ignorado y un criterio de aceptación busca claves versionadas.               |
| El cliente de navegador o el proxy se rompen al cambiar los nombres de las claves de Supabase. | Ambos leen las 2 variables en un solo sitio y lanzan un error explícito si faltan.                                                                   |

---

## Qué **no** está en esta spec

- Tablas, esquemas, migraciones, RLS, triggers y tipos generados (incluida `profiles`).
- Pantalla `/auth`, cambios en el nav y créditos funcionales.
- Server Actions de registro, inicio y cierre de sesión.
- Rutas protegidas o redirecciones por falta de sesión.
- Confirmación de correo, SMTP propio, recuperación de contraseña y OAuth.
- Tablas de juegos, puntuaciones y ranking.
- Clave `service_role` y clientes administrativos.
- Entorno local con la CLI de Supabase y ramas de base de datos.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propia spec.

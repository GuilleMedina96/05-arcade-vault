# SPEC 02 — Inicio y Acerca de (estructura visual)

> **Estado:** Aprobado
> **Depende de:** SPEC 01 (tema en `app/globals.css` y fuentes en `app/layout.tsx`)
> **Fecha:** 2026-10-27
> **Objetivo:** Implementar en Next.js las pantallas Inicio (`/`) y Acerca de (`/acerca-de`) del template `references/resources/templates/home-about/`, con su nav y footer, solo como estructura visual con datos de ejemplo.

---

## Por qué existe esta spec

El template `home-about` es un prototipo SPA (React UMD + Babel: `home.jsx`, `about.jsx`, `nav.jsx`, `styles.css`). Hay que llevarlo al App Router conservando la estética neón sin cambios. Esta spec cubre solo la capa visual de la landing y de la página informativa; no añade lógica de negocio.

Esta spec choca con la SPEC 01 en un punto: la SPEC 01 asigna `/` a la Biblioteca. Aquí `/` pasa a ser el Inicio y la Biblioteca queda en `/biblioteca` (ver Decisiones).

---

## Alcance

**Dentro:**

- Ruta `/` → Inicio con 7 bloques: hero con siluetas pixel, "¿Por qué Arcade Vault?" (4 tarjetas), juegos disponibles (6 mini-tarjetas), franja de estadísticas (3), actividad en vivo (últimas puntuaciones + top jugadores), precios con FAQ (3 preguntas) y CTA final.
- Ruta `/acerca-de` → Acerca de con misión, 3 destacados, divisor animado y sección de contacto con formulario.
- Formulario de contacto simulado: valida que los 3 campos tengan contenido, anima "shake" si falta alguno y muestra la terminal de éxito con el nombre en mayúsculas. No envía nada.
- Componentes compartidos montados en `app/layout.tsx`: `Nav` (solo "Inicio" y "Acerca de", panel móvil con hamburguesa y contador estático `CRÉDITOS · 03`) y `Footer`.
- Animación de aparición al hacer scroll (clase `.reveal` + `IntersectionObserver`).
- Port del CSS del template a `app/globals.css`: secciones HOME PAGE, ABOUT PAGE, ACTIVITY y PRICING, más la clase `.blink`.
- `metadata` por ruta: "Inicio · Arcade Vault" y "Acerca de · Arcade Vault".

**Fuera de alcance (para otras specs):**

- Las rutas a las que apuntan los botones: `/biblioteca`, `/auth`, `/salon`. Mientras no existan darán 404.
- Entradas "Biblioteca", "Salón de la Fama" e "Iniciar Sesión" en el nav.
- Datos reales: juegos, puntuaciones, ranking y estadísticas son texto de ejemplo.
- Envío real del formulario de contacto (backend, correo).
- Sesión de usuario y créditos funcionales.
- Las variantes de tema (`Theme variants`) y el bloque `GAMEPAD` del CSS del template.
- Tests automatizados, i18n y modo claro.

---

## Modelo de datos

Esta feature no introduce estructuras de datos compartidas. Los datos de ejemplo son constantes locales de `app/page.tsx`:

```ts
type Accent = "cyan" | "magenta" | "yellow" | "green";

FEATURES: { i: FeatureKind; t: string; d: string; c: Accent }[]  // 4
GAMES:    { title: string; cat: string; cover: string }[]        // 6, cover = clase CSS existente
STATS:    { n: string; u: string; s: string }[]                  // 3
LATEST:   { p: string; g: string; s: number; t: string; c: string }[]  // 7
TOP:      { r: number; p: string; s: number }[]                  // 5
```

Convenciones:

- Los números se formatean con `toLocaleString("es-ES")`.
- Los iconos pixel (`FeatureKind`: GAMEPAD, FREE, TROPHY, ROCKET; `HighlightKind`: HEART, BROWSER, PLANT) viven en `components/pixel-icons.tsx`.

---

## Plan de implementación

1. **CSS.** Añadir a `app/globals.css` las secciones HOME PAGE, ABOUT PAGE, ACTIVITY y PRICING del `styles.css` del template, y `.blink`. Verificación: `npm run dev` sigue arrancando.
2. **Nav y footer.** Crear `components/nav.tsx` (Client Component, `usePathname`, `next/link`, panel móvil) y `components/footer.tsx`; montarlos en `app/layout.tsx` alrededor de `<main className="av-main">`. Verificación: aparecen en `/`.
3. **Utilidades visuales.** Crear `components/reveal-observer.tsx`, `components/pixel-icons.tsx` y `components/home-silhouettes.tsx`. Verificación: `npm run lint` sin errores en `components/`.
4. **Inicio.** Reemplazar el scaffold de `app/page.tsx` por las 7 secciones con las constantes de ejemplo. Verificación: `/` muestra todas las secciones.
5. **Acerca de.** Crear `components/contact-form.tsx` (Client Component) y `app/acerca-de/page.tsx`. Verificación: `/acerca-de` muestra misión, destacados y formulario.
6. **Cierre.** Ejecutar `npm run lint` sobre `app` y `components` y `npm run build`. Verificación: ambos terminan sin errores.

---

## Criterios de aceptación

- [ ] `npx eslint app components` y `npm run build` terminan sin errores.
- [ ] El build lista las rutas `/` y `/acerca-de` como estáticas.
- [ ] `/` no contiene referencias al scaffold de Create Next App.
- [ ] `/` muestra 4 tarjetas de características, 6 mini-tarjetas de juegos, 3 estadísticas, 7 filas de últimas puntuaciones y 5 de top jugadores.
- [ ] `/` muestra la tarjeta "JUGADOR VAULT $0" y 3 preguntas frecuentes.
- [ ] Las secciones con `.reveal` pasan a visibles al hacer scroll.
- [ ] `/acerca-de` muestra la misión, 3 destacados y la sección "CONTÁCTANOS".
- [ ] Enviar el formulario con algún campo vacío no muestra la terminal y aplica la clase `shake` durante 400 ms.
- [ ] Enviar el formulario con nombre `px_kai`, correo y mensaje muestra la terminal con "GRACIAS, PX_KAI.".
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario con los campos vacíos.
- [ ] El nav solo contiene "Inicio" y "Acerca de", y marca como activa la de la ruta actual.
- [ ] A 375 px de ancho no hay scroll horizontal, se ve el botón hamburguesa y su panel se abre y se cierra con el backdrop.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/` ni en `/acerca-de`.
- [ ] Los títulos de pestaña son "Inicio · Arcade Vault" y "Acerca de · Arcade Vault".

---

## Decisiones

- **Sí:** `/` es el Inicio y la Biblioteca irá en `/biblioteca`. Los botones del template ya apuntan a "biblioteca" como pantalla separada del home; se requiere ajustar la SPEC 01 cuando se implemente.
- **No:** mantener la Biblioteca en `/`. Dejaría la landing sin ruta.
- **Sí:** mantener la sección de precios ("$0 / SIEMPRE") y las FAQ. Es contenido del template y refuerza que el servicio es gratis.
- **Sí:** reutilizar los nombres de clase del template y el CSS portado. Máxima fidelidad visual, mismo criterio que la SPEC 01.
- **No:** reescribir estilos con utilidades Tailwind.
- **Sí:** datos de ejemplo como constantes locales en `app/page.tsx`. Evita crear `lib/games.ts`, que pertenece a la SPEC 01 y definirá el modelo real.
- **Sí:** nav reducido a Inicio y Acerca de. Las demás pantallas aún no existen; se añadirán con sus specs.
- **Sí:** botones y mini-tarjetas como `next/link` hacia rutas futuras. Quedan cableados; solo falta crear las páginas.
- **Sí:** componentes servidor por defecto y `"use client"` solo en nav, formulario de contacto y observer de scroll.
- **No:** `useReveal` repetido por página como en el template. Un único `RevealObserver` reutilizable.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los botones apuntan a `/biblioteca`, `/auth` y `/salon`, que no existen. | Documentado en el alcance; se resuelve al implementar sus specs. |
| Conflicto entre la SPEC 01 (`/` = Biblioteca) y esta spec. | Ajustar la SPEC 01 antes de implementarla. |
| Con JavaScript desactivado, `.reveal` deja las secciones en `opacity: 0`. | Aceptado para esta fase; el prototipo ya funcionaba así. |
| Tipos obsoletos en `.next/` pueden romper `npm run build` tras borrar rutas. | Borrar `.next/` y volver a compilar. |

---

## Qué **no** está en esta spec

- Las pantallas Biblioteca, Detalle, Reproductor, Auth y Salón de la Fama.
- Datos, puntuaciones y estadísticas reales.
- Envío real del formulario de contacto.
- Sesión, cuentas y créditos funcionales.
- Tests automatizados, i18n y modo claro.

Cada uno de estos puntos, si se aborda, va en su propia spec.

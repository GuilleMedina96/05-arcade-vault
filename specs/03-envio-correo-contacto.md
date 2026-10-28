# SPEC 03 — Envío real del formulario de contacto con Resend

> **Estado:** implementado
> **Depende de:** SPEC 02 (`app/acerca-de/page.tsx` y `components/contact-form.tsx`)
> **Fecha:** 2026-10-27
> **Objetivo:** Reemplazar el envío simulado del formulario de `/acerca-de` por un envío real de correo con Resend mediante una Server Action, manteniendo el diseño del template `home-about`.

---

## Por qué existe esta spec

La SPEC 02 dejó la página Acerca de con el diseño del template `references/resources/templates/home-about/about.jsx`, pero el formulario de contacto solo simula el envío (`setSent(...)` en el cliente) y deja fuera el envío real. Esta spec cierra ese punto sin tocar el diseño: la página, el CSS y la terminal de éxito ya coinciden con el template.

---

## Alcance

**Dentro:**

- Server Action `sendContactMessage` en `app/acerca-de/actions.ts` que valida en servidor y envía el correo con el SDK `resend`.
- Cambio de `components/contact-form.tsx` para llamar a la acción en lugar de simular: estado "enviando" y estado de error nuevos; la terminal de éxito se muestra solo si Resend confirma el envío.
- Validación en servidor: nombre, correo y mensaje obligatorios, formato de correo válido y longitudes máximas.
- Honeypot: campo oculto `website` que, si llega con contenido, hace que la acción responda éxito sin enviar nada.
- Configuración por variables de entorno (`RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`) y archivo `.env.example` versionado.
- Dependencia nueva: `resend`.

**Fuera de alcance (para otras specs):**

- Cambios de diseño o de contenido en `/acerca-de` (misión, destacados, divisor, textos del template).
- Dominio propio verificado en Resend. Se usa el remitente de pruebas.
- Rate limiting por IP o servicio externo (Upstash u otro).
- Copia de confirmación al correo de quien escribe.
- Plantilla HTML del correo con `react-email`. El correo es texto plano.
- Guardar los mensajes en base de datos o panel de administración.
- Captcha (Turnstile, reCAPTCHA).
- Tests automatizados e i18n.

---

## Modelo de datos

Esta feature no introduce datos persistentes. Define solo el contrato de la acción:

```ts
// app/acerca-de/actions.ts
export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "send_failed" };

export async function sendContactMessage(formData: FormData): Promise<ContactResult>;
```

Campos de `FormData`:

| Campo     | Obligatorio | Límite                | Notas                                   |
| --------- | ----------- | --------------------- | --------------------------------------- |
| `name`    | Sí          | 60 caracteres         | Se recorta con `trim()`.                |
| `email`   | Sí          | 254 caracteres        | Formato de correo válido.               |
| `msg`     | Sí          | 2000 caracteres       | Se recorta con `trim()`.                |
| `website` | No          | —                     | Honeypot. Debe llegar vacío.            |

Variables de entorno (en `.env.local`, nunca en el repositorio):

```bash
RESEND_API_KEY=re_xxx
CONTACT_FROM_EMAIL=onboarding@resend.dev
CONTACT_TO_EMAIL=<correo de la cuenta de Resend>
```

Convenciones del correo enviado:

- `from`: `Arcade Vault <${CONTACT_FROM_EMAIL}>`.
- `to`: `CONTACT_TO_EMAIL`.
- `replyTo`: el correo de quien escribe, para poder responder directamente.
- `subject`: `[Arcade Vault] Mensaje de <nombre>`.
- Cuerpo en texto plano con nombre, correo y mensaje.
- `RESEND_API_KEY` solo se lee en el servidor; no lleva prefijo `NEXT_PUBLIC_`.

---

## Plan de implementación

Antes del paso 1, leer en `node_modules/next/dist/docs/` la guía `01-app/01-getting-started/07-mutating-data.md` (Server Actions) y `10-error-handling.md`, según indica `AGENTS.md`. Cada paso deja la app ejecutable.

1. **Dependencia y entorno.** Ejecutar `npm install resend`, crear `.env.example` con las 3 variables vacías y añadir `!.env.example` a `.gitignore` (hoy `.env*` lo ignora). Verificación: `npm run dev` arranca y `git status` muestra `.env.example` como archivo nuevo.
2. **Server Action.** Crear `app/acerca-de/actions.ts` con `"use server"`, validación, honeypot y envío con Resend. Si falta alguna variable de entorno o Resend devuelve error, responde `send_failed`. Verificación: `npx eslint app` sin errores.
3. **Formulario.** Modificar `components/contact-form.tsx`: añadir el input honeypot oculto, usar `useTransition` para el estado pendiente (botón "▶ ENVIANDO…" deshabilitado), llamar a `sendContactMessage`, mantener el `shake` si falla la validación y mostrar un mensaje de error si falla el envío. La terminal de éxito usa el `name` devuelto. Verificación: con `RESEND_API_KEY` configurada, enviar el formulario hace llegar el correo.
4. **Estilo del error y del honeypot.** Añadir a `app/globals.css` las clases `.form-error` (mensaje de error con el estilo neón existente) y `.hp-field` (campo oculto fuera de pantalla, sin `display: none`). Este paso es un elemento visual nuevo no presente en el template, así que se diseña con `/frontend-design`. Verificación: el mensaje de error se ve coherente con el tema y el honeypot no es visible ni enfocable con teclado.
5. **Cierre.** Actualizar el estado de esta spec y ejecutar `npx eslint app components` y `npm run build`. Verificación: ambos terminan sin errores.

---

## Criterios de aceptación

- [x] `npx eslint app components` y `npm run build` terminan sin errores.
- [x] `package.json` incluye `resend` y `.env.example` está versionado con las 3 variables vacías.
- [x] `.env.local` no aparece en `git status` y ningún archivo versionado contiene una clave `re_`.
- [ ] Enviar el formulario con `px_kai`, un correo válido y un mensaje hace llegar un correo a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de px_kai`.
- [ ] Responder a ese correo escribe a la dirección que el usuario puso en el formulario (`replyTo`).
- [x] Tras el envío correcto se muestra la terminal con "GRACIAS, PX_KAI." y "ENVIAR OTRO MENSAJE" devuelve el formulario con los campos vacíos.
- [x] Enviar con algún campo vacío no llama a Resend, no muestra la terminal y aplica la clase `shake` durante 400 ms.
- [x] Una petición a la acción con correo sin formato válido, o con `msg` de más de 2000 caracteres, devuelve `{ ok: false, error: "invalid" }` sin llamar a Resend.
- [x] Una petición con el campo `website` relleno devuelve `{ ok: true }` y no se envía ningún correo.
- [x] Durante el envío el botón está deshabilitado y muestra "▶ ENVIANDO…".
- [x] Con `RESEND_API_KEY` ausente o inválida se muestra el mensaje de error del formulario, no la terminal de éxito, y los campos conservan lo escrito.
- [x] `RESEND_API_KEY` no aparece en el JavaScript enviado al navegador.
- [x] El campo `website` no es visible en pantalla ni alcanzable con Tab.
- [x] La consola del navegador no muestra errores ni warnings de hidratación en `/acerca-de`.
- [x] El diseño de `/acerca-de` es idéntico al anterior salvo el estado de error y el texto del botón mientras se envía.

---

## Decisiones

- **Sí:** Server Action. Menos código que un endpoint, tipada de extremo a extremo y es lo idiomático en App Router; la clave de Resend nunca llega al cliente.
- **No:** Route Handler `/api/contacto`. Solo aporta si otro cliente consumiera el endpoint, y hoy no existe.
- **Sí:** remitente `onboarding@resend.dev` y destino en `CONTACT_TO_EMAIL`. No exige dominio; Resend solo permite enviar a la dirección de la cuenta con ese remitente. Pasar a dominio propio es cambiar variables de entorno.
- **No:** dominio propio verificado en esta spec. Requiere DNS y tener un dominio; se hace cuando se despliegue.
- **Sí:** `replyTo` con el correo de quien escribe. Permite responder desde el cliente de correo sin copiar la dirección a mano.
- **Sí:** honeypot más validación y límites en servidor. Frena bots simples sin dependencias ni servicios externos.
- **No:** rate limiting ni captcha. Exigen un servicio externo; si aparece spam real, va en su propia spec.
- **Sí:** validar de nuevo en servidor aunque el cliente ya valide. El cliente se puede saltar.
- **Sí:** el honeypot responde éxito sin enviar. El bot no recibe señal de que fue detectado.
- **Sí:** correo en texto plano. Evita añadir `react-email` para un correo interno que solo lee el equipo.
- **Sí:** mostrar la terminal de éxito solo tras la confirmación de Resend. La simulación actual afirmaba "MENSAJE RECIBIDO" sin que lo fuera.
- **Sí:** al fallar el envío, conservar lo escrito y mostrar un error. El usuario no pierde su mensaje.
- **No:** copia de confirmación al remitente. Con el remitente de pruebas Resend no permite enviar a terceros, y duplicaría el alcance.
- **Sí:** crear `.env.example` y excepción `!.env.example` en `.gitignore`. Documenta las variables sin exponer secretos.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con `onboarding@resend.dev` Resend rechaza destinatarios distintos al correo de la cuenta. | `CONTACT_TO_EMAIL` debe ser el correo de la cuenta de Resend; se documenta en `.env.example`. |
| Falta `RESEND_API_KEY` en un despliegue y el formulario falla en silencio. | La acción responde `send_failed` y el formulario lo muestra; se registra el error en el log del servidor. |
| El envío de Server Actions es susceptible de abuso sin límite de frecuencia. | Honeypot y límites de longitud ahora; rate limiting queda como spec futura si hay abuso. |
| Una clave de API subida al repositorio por error. | `.env.local` ya queda ignorado por `.gitignore`; el criterio de aceptación comprueba que no hay claves `re_` versionadas. |
| El campo honeypot lo rellena el autocompletado del navegador y bloquea a una persona real. | `autoComplete="off"`, `tabIndex={-1}` y nombre `website`, poco habitual en autocompletado. |

---

## Qué **no** está en esta spec

- Cambios de diseño o contenido en `/acerca-de`.
- Dominio propio verificado en Resend.
- Rate limiting, captcha o servicios externos anti-abuso.
- Copia de confirmación al remitente y plantillas HTML de correo.
- Almacenar los mensajes o un panel para leerlos.
- Tests automatizados e i18n.

Cada uno de estos puntos, si se aborda, va en su propia spec.

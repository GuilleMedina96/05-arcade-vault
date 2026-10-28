"use server";

import { Resend } from "resend";

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "send_failed" };

const MAX_NAME = 60;
const MAX_EMAIL = 254;
const MAX_MSG = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function sendContactMessage(formData: FormData): Promise<ContactResult> {
  const name = field(formData, "name").trim();

  // Honeypot: los bots lo rellenan; respondemos éxito sin enviar nada.
  if (field(formData, "website") !== "") {
    return { ok: true, name };
  }

  const email = field(formData, "email").trim();
  const msg = field(formData, "msg").trim();

  if (
    !name ||
    !email ||
    !msg ||
    name.length > MAX_NAME ||
    email.length > MAX_EMAIL ||
    msg.length > MAX_MSG ||
    !EMAIL_RE.test(email)
  ) {
    return { ok: false, error: "invalid" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !from || !to) {
    console.error("[contact] Faltan variables de entorno de Resend.");
    return { ok: false, error: "send_failed" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `Arcade Vault <${from}>`,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}\n`,
    });

    if (error) {
      console.error("[contact] Resend devolvió un error:", error);
      return { ok: false, error: "send_failed" };
    }
  } catch (err) {
    console.error("[contact] Error al enviar con Resend:", err);
    return { ok: false, error: "send_failed" };
  }

  return { ok: true, name };
}

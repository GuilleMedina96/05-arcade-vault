import { connection } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";

// Comprueba que Supabase es alcanzable con la configuración actual.
// No consulta ninguna tabla y nunca expone el mensaje de error.
export async function GET() {
  // Con cacheComponents, sin esto la respuesta se prerenderizaría en el build.
  await connection();

  try {
    const { url, publishableKey } = getSupabaseEnv();
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json({ ok: false }, { status: 503 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

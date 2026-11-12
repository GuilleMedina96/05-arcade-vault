// Único lugar donde se leen las variables de Supabase.
// Next.js solo inyecta NEXT_PUBLIC_* en el cliente si se referencian literalmente.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Rellénalas en .env.local (ver .env.example).",
    );
  }

  return { url, publishableKey };
}

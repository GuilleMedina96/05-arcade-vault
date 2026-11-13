import { createClient } from "@/lib/supabase/server";

export type ScoreRow = {
  id: string;
  alias: string;
  score: number;
  created_at: string;
};

// Mejor puntuación primero; a igualdad, la más antigua primero.
// Devuelve [] si Supabase falla: la UI lo muestra como "Sin puntuaciones todavía".
export async function getTopScores(
  gameSlug: string,
  limit: number,
): Promise<ScoreRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scores")
      .select("id, alias, score, created_at, games!inner(slug)")
      .eq("games.slug", gameSlug)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error || !data) return [];

    return data.map(({ id, alias, score, created_at }) => ({
      id,
      alias,
      score,
      created_at,
    }));
  } catch {
    return [];
  }
}

export async function getGames(): Promise<{ slug: string; name: string }[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("games")
      .select("slug, name")
      .order("name", { ascending: true });

    if (error || !data) return [];

    return data;
  } catch {
    return [];
  }
}

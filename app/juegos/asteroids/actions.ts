"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,12}$/;
const SLUG_PATTERN = /^[a-z0-9-]{2,40}$/;
const MAX_SCORE = 1_000_000;

type SubmitScoreResult =
  { ok: true } | { ok: false; error: "invalid" | "failed" };

export async function submitScore(input: {
  gameSlug: string;
  alias: string;
  score: number;
}): Promise<SubmitScoreResult> {
  const { gameSlug, alias, score } = input ?? {};

  // Mismas reglas que los `check` de la base.
  if (
    typeof gameSlug !== "string" ||
    !SLUG_PATTERN.test(gameSlug) ||
    typeof alias !== "string" ||
    !ALIAS_PATTERN.test(alias) ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  ) {
    return { ok: false, error: "invalid" };
  }

  try {
    const supabase = await createClient();

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", gameSlug)
      .maybeSingle();

    if (gameError) return { ok: false, error: "failed" };
    if (!game) return { ok: false, error: "invalid" };

    const { error: insertError } = await supabase
      .from("scores")
      .insert({ game_id: game.id, alias, score });

    // No se devuelve el mensaje de Supabase al cliente.
    if (insertError) return { ok: false, error: "failed" };
  } catch {
    return { ok: false, error: "failed" };
  }

  revalidatePath("/juegos/asteroids");
  revalidatePath("/ranking");
  return { ok: true };
}

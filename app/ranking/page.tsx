import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  LeaderboardPanel,
  LeaderboardSkeleton,
} from "@/components/leaderboard-panel";
import { getGames } from "@/lib/scores";

export const metadata: Metadata = {
  title: "Ranking · Arcade Vault",
};

const DEFAULT_GAME = "asteroids";
const TOP = 20;

export default function RankingPage(props: PageProps<"/ranking">) {
  return (
    <div className="av-player ranking-page fade-in">
      <header className="game-head">
        <h1 className="pixel neon-cyan">Ranking</h1>
        <p>Las mejores puntuaciones de cada juego.</p>
      </header>

      {/* searchParams y la lectura de Supabase son datos de la petición:
          van dentro de <Suspense> para que el resto de la página sea estático. */}
      <Suspense fallback={<LeaderboardSkeleton title="Top 20" rows={TOP} />}>
        <RankingContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function RankingContent({
  searchParams,
}: {
  searchParams: PageProps<"/ranking">["searchParams"];
}) {
  const params = await searchParams;
  const raw = params.juego;
  const slug = (Array.isArray(raw) ? raw[0] : raw) || DEFAULT_GAME;

  const games = await getGames();
  // Si Supabase falla `games` llega vacío: no es "juego no encontrado",
  // se deja que el panel muestre "Sin puntuaciones todavía".
  const unknownGame = games.length > 0 && !games.some((g) => g.slug === slug);

  return (
    <>
      {games.length > 0 ? (
        <nav className="ranking-tabs" aria-label="Juego">
          {games.map((g) => (
            <Link
              key={g.slug}
              href={`/ranking?juego=${g.slug}`}
              className="ranking-tab"
              aria-current={g.slug === slug ? "page" : undefined}
            >
              {g.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="ranking-board">
        {unknownGame ? (
          <section className="leaderboard" aria-label="Ranking">
            <p className="lb-empty" role="status">
              Juego no encontrado
            </p>
          </section>
        ) : (
          <LeaderboardPanel gameSlug={slug} limit={TOP} title="Top 20" />
        )}
      </div>
    </>
  );
}

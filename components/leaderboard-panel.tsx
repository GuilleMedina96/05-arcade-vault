import { getTopScores } from "@/lib/scores";

type Props = {
  gameSlug: string;
  limit: number;
  title: string;
};

// Componente de servidor: lee datos de la petición (cookies del cliente de Supabase),
// así que siempre se renderiza dentro de <Suspense>.
export async function LeaderboardPanel({ gameSlug, limit, title }: Props) {
  const scores = await getTopScores(gameSlug, limit);

  return (
    <section className="leaderboard" aria-label={title}>
      <h2>{title}</h2>
      {scores.length === 0 ? (
        <p className="lb-empty">Sin puntuaciones todavía</p>
      ) : (
        <ol className="lb-list">
          {scores.map((s, i) => (
            <li key={s.id} className={`lb-row${i < 3 ? ` top${i + 1}` : ""}`}>
              <span className="rk">{i + 1}</span>
              <span className="pl">{s.alias}</span>
              <span className="sc">{s.score.toLocaleString("es-ES")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function LeaderboardSkeleton({
  title,
  rows = 10,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <section className="leaderboard" aria-label={title} aria-busy="true">
      <h2>{title}</h2>
      <p className="lb-empty">Cargando puntuaciones…</p>
      <ol className="lb-list lb-skeleton" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="lb-row">
            <span className="rk">{i + 1}</span>
            <span className="pl lb-bar" />
            <span className="sc lb-bar" />
          </li>
        ))}
      </ol>
    </section>
  );
}

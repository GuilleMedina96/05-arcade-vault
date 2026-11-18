import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
};

const GAMES = [
  {
    title: "TETRIS",
    cat: "PUZZLE",
    cover: "cover-tetro",
    href: "/juegos/tetris",
  },
  {
    title: "ARKANOID",
    cat: "ARCADE",
    cover: "cover-bricks",
    href: "/juegos/arkanoid",
  },
  {
    title: "ASTEROIDS",
    cat: "SHOOTER",
    cover: "cover-rocas",
    href: "/juegos/asteroids",
  },
];

export default function BibliotecaPage() {
  return (
    <div className="av-player library-page fade-in">
      <header className="game-head">
        <h1 className="pixel neon-cyan">Biblioteca</h1>
        <p>Elige un juego y compite por el Top 10.</p>
      </header>

      <div className="mini-rail library-grid">
        {GAMES.map((g) => (
          <Link key={g.href} href={g.href} className="mini-card">
            <div className="mini-cover">
              <div className={"cover-bg " + g.cover}></div>
            </div>
            <div className="mini-meta">
              <div className="mini-title">{g.title}</div>
              <div className="mini-cat">{g.cat}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

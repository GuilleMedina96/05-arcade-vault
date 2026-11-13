"use client";

import { useEffect, useRef, useState } from "react";

import { ScoreSubmit } from "@/components/score-submit";
import { HEIGHT, WIDTH, startAsteroids } from "@/lib/games/asteroids/engine";

type FinishedGame = { id: number; score: number };

export function AsteroidsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gamesPlayed = useRef(0);
  const [finished, setFinished] = useState<FinishedGame | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return startAsteroids(canvas, {
      onGameOver: (score) => {
        gamesPlayed.current += 1;
        setFinished({ id: gamesPlayed.current, score });
      },
    });
  }, []);

  // El motor reinicia con Espacio tras GAME OVER: al hacerlo se oculta el formulario.
  // Las pulsaciones dentro del campo del alias no cuentan (el motor las ignora igual).
  const hasForm = finished !== null;
  useEffect(() => {
    if (!hasForm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;
      setFinished(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasForm]);

  return (
    <>
      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            className="asteroids-canvas"
            width={WIDTH}
            height={HEIGHT}
            aria-label="Juego Asteroids"
          />
        </div>
        <div className="crt-bottom">
          <span className="led">ROCAS</span>
          <span>1 JUGADOR</span>
        </div>
      </div>

      {finished ? (
        <ScoreSubmit
          key={finished.id}
          gameSlug="asteroids"
          score={finished.score}
          onSkip={() => setFinished(null)}
        />
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { HEIGHT, WIDTH, startAsteroids } from "@/lib/games/asteroids/engine";

export function AsteroidsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return startAsteroids(canvas);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="asteroids-canvas"
      width={WIDTH}
      height={HEIGHT}
      aria-label="Juego Asteroids"
    />
  );
}

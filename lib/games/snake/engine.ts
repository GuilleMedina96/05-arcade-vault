import { createInput } from "../input";
import {
  CELL,
  COLS,
  FRUITS_SRC,
  HEIGHT,
  MAX_DT,
  POINTS_PER_FRUIT,
  ROWS,
  START_STEP_MS,
  WIDTH,
} from "./constants";
import {
  DOWN,
  LEFT,
  RIGHT,
  UP,
  advance,
  initialSnake,
  pickFruitCell,
  queueTurn,
  stepMsFor,
  type Cell,
  type Dir,
} from "./entities";
import { FRUIT_SPRITES, drawFruit, loadFruitSheet } from "./sprites";

export { HEIGHT, WIDTH };

// "ready": la serpiente espera a que el jugador pulse Espacio al cargar la página
type GameState = "ready" | "playing" | "paused" | "gameover" | "win";

interface Game {
  snake: Cell[]; // snake[0] es la cabeza
  dir: Dir; // sentido aplicado en el último paso
  queue: Dir[]; // giros pendientes
  fruit: Cell;
  fruitSprite: number; // índice en FRUIT_SPRITES (solo cosmético)
  score: number;
  eaten: number;
  stepMs: number;
  acc: number; // ms acumulados desde el último paso
  state: GameState;
}

const TURN_KEYS: [string, Dir][] = [
  ["ArrowUp", UP],
  ["KeyW", UP],
  ["ArrowDown", DOWN],
  ["KeyS", DOWN],
  ["ArrowLeft", LEFT],
  ["KeyA", LEFT],
  ["ArrowRight", RIGHT],
  ["KeyD", RIGHT],
];

/**
 * Arranca el juego sobre el canvas y devuelve la función que lo detiene
 * (cancelAnimationFrame + retirada de listeners + parada de la carga de la imagen).
 * `onGameOver(score)` se invoca una sola vez por partida: al morir o al llenar el tablero.
 */
export function startSnake(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const input = createInput();

  let stopped = false;
  let rafId = 0;
  let sheet: HTMLImageElement | null = null;
  let game: Game;
  createGame(true);

  // ── Estado ────────────────────────────────────────────────────────────────
  /** `waitForStart`: la serpiente no se mueve hasta pulsar Espacio (solo al cargar la página). */
  function createGame(waitForStart = false) {
    const snake = initialSnake();
    game = {
      snake,
      dir: RIGHT,
      queue: [],
      // Hay casillas libres de sobra al empezar, nunca es null
      fruit: pickFruitCell(snake, Math.random) ?? { x: 0, y: 0 },
      fruitSprite: randomSprite(),
      score: 0,
      eaten: 0,
      stepMs: START_STEP_MS,
      acc: 0,
      state: waitForStart ? "ready" : "playing",
    };
  }

  function randomSprite() {
    return Math.floor(Math.random() * FRUIT_SPRITES.length);
  }

  function endGame(state: "gameover" | "win") {
    game.state = state;
    options?.onGameOver?.(game.score);
  }

  /** Un paso de la serpiente. */
  function step() {
    const g = game;
    if (g.queue.length > 0) g.dir = g.queue.shift()!;

    const result = advance(g.snake, g.dir, g.fruit);
    if (result.dead) {
      endGame("gameover");
      return;
    }
    g.snake = result.snake;

    if (result.ate) {
      g.score += POINTS_PER_FRUIT;
      g.eaten++;
      g.stepMs = stepMsFor(g.eaten);
      const next = pickFruitCell(g.snake, Math.random);
      if (!next) {
        endGame("win");
        return;
      }
      g.fruit = next;
      g.fruitSprite = randomSprite();
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    // Se consumen siempre para que una pulsación vieja no actúe más tarde
    const pause = input.pressed("KeyP");
    const escape = input.pressed("Escape");
    const space = input.pressed("Space");
    const turns: Dir[] = [];
    for (const [code, dir] of TURN_KEYS) {
      if (input.pressed(code)) turns.push(dir);
    }

    if (game.state === "gameover" || game.state === "win") {
      if (space) createGame();
      return;
    }

    if (game.state === "ready") {
      if (space) game.state = "playing";
      return;
    }

    if (pause || escape) {
      game.state = game.state === "paused" ? "playing" : "paused";
    }
    if (game.state === "paused") return;

    for (const dir of turns) queueTurn(game.queue, game.dir, dir);

    game.acc += dt * 1000;
    while (game.state === "playing" && game.acc >= game.stepMs) {
      game.acc -= game.stepMs;
      step();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawOverlay(
    c: CanvasRenderingContext2D,
    title: string,
    size: number,
    sub?: string,
  ) {
    c.fillStyle = "rgba(0, 0, 0, 0.65)";
    c.fillRect(0, 0, WIDTH, HEIGHT);
    c.fillStyle = "#fff";
    c.font = `bold ${size}px monospace`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(title, WIDTH / 2, HEIGHT / 2);
    if (sub) {
      c.font = "bold 18px monospace";
      c.fillStyle = "rgba(255,255,255,0.7)";
      sub.split("\n").forEach((line, i) => {
        c.fillText(line, WIDTH / 2, HEIGHT / 2 + size / 2 + 24 + i * 26);
      });
    }
  }

  function drawSnake(c: CanvasRenderingContext2D, g: Game) {
    const inset = 3;
    for (let i = g.snake.length - 1; i >= 0; i--) {
      const seg = g.snake[i];
      const x = seg.x * CELL + inset;
      const y = seg.y * CELL + inset;
      const size = CELL - inset * 2;
      c.fillStyle = i === 0 ? "#6dffb8" : i % 2 === 0 ? "#00d974" : "#00ff88";
      c.beginPath();
      c.roundRect(x, y, size, size, i === 0 ? 10 : 6);
      c.fill();
    }

    // Ojos de la cabeza, según el sentido del último paso
    const head = g.snake[0];
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const fx = g.dir.x;
    const fy = g.dir.y;
    // Perpendicular al sentido: separa los dos ojos
    const px = -fy;
    const py = fx;
    for (const side of [-1, 1]) {
      const ex = cx + fx * 7 + px * side * 8;
      const ey = cy + fy * 7 + py * side * 8;
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(ex, ey, 4.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#0a0a0f";
      c.beginPath();
      c.arc(ex + fx * 1.5, ey + fy * 1.5, 2.2, 0, Math.PI * 2);
      c.fill();
    }
  }

  function draw(c: CanvasRenderingContext2D, img: HTMLImageElement) {
    const g = game;
    c.fillStyle = "#07080f";
    c.fillRect(0, 0, WIDTH, HEIGHT);

    // Cuadrícula tenue
    c.strokeStyle = "rgba(0, 245, 255, 0.06)";
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 1; x < COLS; x++) {
      c.moveTo(x * CELL + 0.5, 0);
      c.lineTo(x * CELL + 0.5, HEIGHT);
    }
    for (let y = 1; y < ROWS; y++) {
      c.moveTo(0, y * CELL + 0.5);
      c.lineTo(WIDTH, y * CELL + 0.5);
    }
    c.stroke();

    drawFruit(
      c,
      img,
      FRUIT_SPRITES[g.fruitSprite],
      g.fruit.x * CELL,
      g.fruit.y * CELL,
      CELL,
    );
    drawSnake(c, g);

    if (g.state !== "gameover" && g.state !== "win") {
      c.fillStyle = "#fff";
      c.font = "bold 18px monospace";
      c.textBaseline = "top";
      c.textAlign = "left";
      c.fillText("Score: " + g.score, 10, 10);
      c.textAlign = "right";
      c.fillText("Longitud: " + g.snake.length, WIDTH - 10, 10);
    }

    const points = g.score.toLocaleString("es-ES");
    if (g.state === "ready") {
      // Velo ligero: se ve el tablero con la serpiente y la fruta
      c.fillStyle = "rgba(0, 0, 0, 0.35)";
      c.fillRect(0, 0, WIDTH, HEIGHT);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#fff";
      c.font = "bold 30px monospace";
      c.fillText("ESPACIO PARA EMPEZAR", WIDTH / 2, 400);
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.font = "bold 16px monospace";
      c.fillText("FLECHAS O WASD PARA MOVER · P PAUSA", WIDTH / 2, 440);
    } else if (g.state === "paused")
      drawOverlay(c, "PAUSA", 56, "P O ESC PARA CONTINUAR");
    else if (g.state === "gameover")
      drawOverlay(
        c,
        "GAME OVER",
        64,
        `PUNTOS: ${points}\nESPACIO PARA REINICIAR`,
      );
    else if (g.state === "win")
      drawOverlay(
        c,
        "¡Tablero completo!",
        48,
        `PUNTOS: ${points}\nESPACIO PARA REINICIAR`,
      );
  }

  // ── Bucle principal ───────────────────────────────────────────────────────
  let lastTime: number | null = null;

  function loop(ts: number) {
    // dt en segundos, limitado para no dar saltos al volver a la pestaña
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    draw(ctx!, sheet!);
    rafId = requestAnimationFrame(loop);
  }

  // La imagen carga de forma asíncrona: si la limpieza llega antes, no se arranca
  loadFruitSheet(FRUITS_SRC)
    .then((img) => {
      if (stopped) return;
      sheet = img;
      rafId = requestAnimationFrame(loop);
    })
    .catch((err) => console.error(err));

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    input.destroy();
  };
}

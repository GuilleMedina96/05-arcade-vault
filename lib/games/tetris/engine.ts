import {
  clearLines,
  collide,
  createBoard,
  ghostY,
  lineScore,
  merge,
  randomPiece,
  tryRotate,
  type Piece,
} from "./board";
import {
  BASE_DROP_INTERVAL,
  BLOCK,
  BOARD_W,
  COLORS,
  COLS,
  DROP_STEP,
  GRID_LINE,
  HEIGHT,
  MIN_DROP_INTERVAL,
  PANEL_W,
  ROWS,
  WIDTH,
} from "./constants";
import { createInput } from "../input";

export { HEIGHT, WIDTH };

type GameState = "playing" | "paused" | "gameover";

interface Game {
  board: number[][]; // ROWS × COLS; 0 = vacío, 1..7 = color
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  dropInterval: number; // ms
  dropAccum: number; // ms
  state: GameState;
}

// Auto-repetición de ← → ↓ al mantener la tecla (el original usaba la del SO)
const REPEAT_DELAY = 170; // ms
const REPEAT_RATE = 50; // ms
const REPEAT_KEYS = ["ArrowLeft", "ArrowRight", "ArrowDown"] as const;
const ALL_KEYS = [...REPEAT_KEYS, "ArrowUp", "KeyX", "Space"] as const;

/**
 * Arranca el juego sobre el canvas y devuelve la función que lo detiene
 * (cancelAnimationFrame + retirada de listeners).
 * `onGameOver(score)` se invoca una sola vez por partida, al no caber la pieza nueva.
 */
export function startTetris(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const input = createInput();
  const held: Record<string, number> = {}; // ms que lleva pulsada cada tecla
  const nextRepeat: Record<string, number> = {}; // ms para la próxima repetición
  let game = createGame();

  // ── Estado ────────────────────────────────────────────────────────────────
  function createGame(): Game {
    const g: Game = {
      board: createBoard(),
      current: randomPiece(),
      next: randomPiece(),
      score: 0,
      lines: 0,
      level: 1,
      dropInterval: BASE_DROP_INTERVAL,
      dropAccum: 0,
      state: "playing",
    };
    return g;
  }

  function endGame() {
    game.state = "gameover";
    options?.onGameOver?.(game.score);
  }

  function spawn() {
    const g = game;
    g.current = g.next;
    g.next = randomPiece();
    if (collide(g.board, g.current.shape, g.current.x, g.current.y)) endGame();
  }

  function lockPiece() {
    const g = game;
    merge(g.board, g.current);
    const cleared = clearLines(g.board);
    if (cleared) {
      g.score += lineScore(cleared, g.level);
      g.lines += cleared;
      g.level = Math.floor(g.lines / 10) + 1;
      g.dropInterval = Math.max(
        MIN_DROP_INTERVAL,
        BASE_DROP_INTERVAL - (g.level - 1) * DROP_STEP,
      );
    }
    spawn();
  }

  function softDrop() {
    const g = game;
    if (!collide(g.board, g.current.shape, g.current.x, g.current.y + 1)) {
      g.current.y++;
      g.score += 1;
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    const g = game;
    const gy = ghostY(g.board, g.current);
    g.score += (gy - g.current.y) * 2;
    g.current.y = gy;
    lockPiece();
  }

  function move(dx: number) {
    const g = game;
    if (!collide(g.board, g.current.shape, g.current.x + dx, g.current.y))
      g.current.x += dx;
  }

  // ── Entrada ───────────────────────────────────────────────────────────────
  function drainInput() {
    for (const code of ALL_KEYS) input.pressed(code);
    for (const code of REPEAT_KEYS) held[code] = 0;
  }

  /** true si la acción debe dispararse este fotograma (pulsación o repetición). */
  function fires(code: (typeof REPEAT_KEYS)[number], dt: number): boolean {
    if (!input.keys[code]) {
      held[code] = 0;
      return false;
    }
    if (input.pressed(code)) {
      held[code] = 0;
      nextRepeat[code] = REPEAT_DELAY;
      return true;
    }
    held[code] = (held[code] ?? 0) + dt;
    if (held[code] < (nextRepeat[code] ?? REPEAT_DELAY)) return false;
    nextRepeat[code] = (nextRepeat[code] ?? REPEAT_DELAY) + REPEAT_RATE;
    return true;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    const g = game;

    if (input.pressed("KeyP") && g.state !== "gameover") {
      g.state = g.state === "paused" ? "playing" : "paused";
      drainInput();
      return;
    }

    if (g.state === "gameover") {
      const restart = input.pressed("Space");
      drainInput();
      if (restart) game = createGame();
      return;
    }

    // En pausa no se mueve nada ni se acumula tiempo; se descartan pulsaciones
    if (g.state === "paused") {
      drainInput();
      return;
    }

    if (fires("ArrowLeft", dt)) move(-1);
    if (fires("ArrowRight", dt)) move(1);
    if (input.pressed("ArrowUp") || input.pressed("KeyX")) {
      tryRotate(g.board, g.current);
    }
    if (fires("ArrowDown", dt)) {
      softDrop();
      g.dropAccum = 0;
    }
    if (game.state === "playing" && input.pressed("Space")) {
      hardDrop();
      g.dropAccum = 0;
    }
    if (game.state !== "playing") return;

    // Gravedad (en ms, como el original)
    g.dropAccum += dt;
    if (g.dropAccum >= g.dropInterval) {
      g.dropAccum = 0;
      if (!collide(g.board, g.current.shape, g.current.x, g.current.y + 1)) {
        g.current.y++;
      } else {
        lockPiece();
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawBlock(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    c.globalAlpha = alpha;
    c.fillStyle = COLORS[colorIndex] ?? "#fff";
    c.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    c.fillStyle = "rgba(255,255,255,0.12)";
    c.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, 4);
    c.globalAlpha = 1;
  }

  function drawGrid(c: CanvasRenderingContext2D) {
    c.strokeStyle = GRID_LINE;
    c.lineWidth = 0.5;
    for (let col = 1; col < COLS; col++) {
      c.beginPath();
      c.moveTo(col * BLOCK, 0);
      c.lineTo(col * BLOCK, ROWS * BLOCK);
      c.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      c.beginPath();
      c.moveTo(0, r * BLOCK);
      c.lineTo(BOARD_W, r * BLOCK);
      c.stroke();
    }
  }

  function drawBoard(c: CanvasRenderingContext2D) {
    const g = game;
    drawGrid(c);

    for (let r = 0; r < ROWS; r++)
      for (let col = 0; col < COLS; col++)
        drawBlock(c, col, r, g.board[r][col]);

    const { current } = g;
    const gy = ghostY(g.board, current);
    for (let r = 0; r < current.shape.length; r++)
      for (let col = 0; col < current.shape[r].length; col++)
        if (current.shape[r][col])
          drawBlock(c, current.x + col, gy + r, current.shape[r][col], 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let col = 0; col < current.shape[r].length; col++)
        drawBlock(c, current.x + col, current.y + r, current.shape[r][col]);
  }

  function drawPanel(c: CanvasRenderingContext2D) {
    const g = game;
    const cx = BOARD_W + PANEL_W / 2;

    // Separador del tablero
    c.strokeStyle = "rgba(255,255,255,0.25)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(BOARD_W + 0.5, 0);
    c.lineTo(BOARD_W + 0.5, HEIGHT);
    c.stroke();

    c.textAlign = "center";
    c.textBaseline = "alphabetic";

    const stat = (label: string, value: string, y: number) => {
      c.fillStyle = "rgba(255,255,255,0.55)";
      c.font = "12px monospace";
      c.fillText(label, cx, y);
      c.fillStyle = "#fff";
      c.font = "bold 22px monospace";
      c.fillText(value, cx, y + 26);
    };
    stat("PUNTOS", g.score.toLocaleString("es-ES"), 40);
    stat("LÍNEAS", String(g.lines), 108);
    stat("NIVEL", String(g.level), 176);

    // Pieza siguiente (caja de 4×4 bloques centrada en el panel)
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.font = "12px monospace";
    c.fillText("SIGUIENTE", cx, 252);
    const shape = g.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    const boxX = cx - (4 * BLOCK) / 2;
    const boxY = 266;
    c.save();
    c.translate(boxX, boxY);
    for (let r = 0; r < shape.length; r++)
      for (let col = 0; col < shape[r].length; col++)
        drawBlock(c, offX + col, offY + r, shape[r][col]);
    c.restore();
  }

  function drawOverlay(
    c: CanvasRenderingContext2D,
    title: string,
    sub: string,
  ) {
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(0, 0, BOARD_W, HEIGHT);
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillStyle = "#fff";
    c.font = "bold 36px monospace";
    c.fillText(title, BOARD_W / 2, HEIGHT / 2 - 14);
    c.font = "14px monospace";
    c.fillStyle = "rgba(255,255,255,0.7)";
    sub.split("\n").forEach((line, i) => {
      c.fillText(line, BOARD_W / 2, HEIGHT / 2 + 18 + i * 20);
    });
  }

  function draw(c: CanvasRenderingContext2D) {
    c.fillStyle = "#000";
    c.fillRect(0, 0, WIDTH, HEIGHT);

    drawBoard(c);
    drawPanel(c);

    if (game.state === "paused") drawOverlay(c, "PAUSA", "P PARA CONTINUAR");
    else if (game.state === "gameover")
      drawOverlay(
        c,
        "GAME OVER",
        `PUNTOS: ${game.score.toLocaleString("es-ES")}\nESPACIO PARA REINICIAR`,
      );
  }

  // ── Bucle principal ───────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId = 0;

  function loop(ts: number) {
    // dt en ms, limitado a 50 para no dar saltos al volver a la pestaña
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    update(dt);
    draw(ctx!);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(rafId);
    input.destroy();
  };
}

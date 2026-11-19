import { createInput } from "../input";
import {
  BALL_SIZE,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCK_H,
  BLOCK_SCORE,
  BLOCK_W,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  TOUGH_COLOR,
  TOUGH_DAMAGE_SHADE,
  TOUGH_HITS,
  TOUGH_SCORE,
  BOUNCE_SOUND_SRC,
  BREAK_SOUND_SRC,
  EXPLOSION_DURATION,
  HEIGHT,
  INITIAL_LIVES,
  MAX_DT,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  WIDTH,
} from "./constants";
import { LAST_LEVEL, LEVELS, type BlockColor } from "./levels";
import {
  BALL_SPRITE,
  PADDLE_SPRITE,
  blockSprite,
  drawFrame,
  explosionFrame,
  loadSpritesheet,
} from "./spritesheet";

export { HEIGHT, WIDTH };

type GameState = "playing" | "paused" | "gameover" | "win";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Block extends Rect {
  color: BlockColor;
  alive: boolean;
  hits: number; // golpes que le faltan para romperse
}

interface Explosion extends Rect {
  color: BlockColor;
  elapsed: number; // ms
}

interface Game {
  paddle: Rect;
  ball: Rect & { vx: number; vy: number };
  blocks: Block[];
  explosions: Explosion[];
  lives: number;
  score: number;
  level: number; // 1..LAST_LEVEL
  state: GameState;
}

/**
 * Arranca el juego sobre el canvas y devuelve la función que lo detiene
 * (cancelAnimationFrame + retirada de listeners + parada de la carga del spritesheet).
 * `onGameOver(score)` se invoca una sola vez por partida: al perder la última
 * vida o al completar el último nivel.
 */
export function startArkanoid(
  canvas: HTMLCanvasElement,
  options?: { onGameOver?: (score: number) => void },
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const input = createInput();
  const bounceSound = new Audio(BOUNCE_SOUND_SRC);
  const breakSound = new Audio(BREAK_SOUND_SRC);

  let stopped = false;
  let rafId = 0;
  let sheet: HTMLImageElement | null = null;
  let game: Game;
  createGame();

  function play(sound: HTMLAudioElement) {
    // El navegador puede rechazar play() sin interacción previa: se ignora
    const clone = sound.cloneNode() as HTMLAudioElement;
    clone.play().catch(() => {});
  }

  // ── Estado ────────────────────────────────────────────────────────────────
  function createGame() {
    game = {
      paddle: {
        x: (WIDTH - PADDLE_W) / 2,
        y: PADDLE_Y,
        w: PADDLE_W,
        h: PADDLE_H,
      },
      ball: { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 },
      blocks: [],
      explosions: [],
      lives: INITIAL_LIVES,
      score: 0,
      level: 1,
      state: "playing",
    };
    loadLevel(1);
  }

  /** Coloca la pelota sobre la pala con la velocidad del nivel actual. */
  function initBall() {
    const { ball, paddle } = game;
    const speed = LEVELS[game.level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    game.level = n;
    game.blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
      hits: b.color === TOUGH_COLOR ? TOUGH_HITS : 1,
    }));
    game.explosions = [];
    initBall();
  }

  function endGame(state: "gameover" | "win") {
    game.state = state;
    options?.onGameOver?.(game.score);
  }

  function collideAABB(a: Rect, b: Rect) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    // Se consumen siempre para que una pulsación vieja no actúe más tarde
    const pause = input.pressed("KeyP");
    const escape = input.pressed("Escape");
    const space = input.pressed("Space");

    if (game.state === "gameover" || game.state === "win") {
      if (space) createGame();
      return;
    }

    if (pause || escape) {
      game.state = game.state === "paused" ? "playing" : "paused";
    }
    if (game.state === "paused") return;

    const { paddle, ball } = game;

    // Pala
    if (input.keys.ArrowLeft)
      paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (input.keys.ArrowRight)
      paddle.x = Math.min(WIDTH - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en paredes y techo
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.x + ball.w >= WIDTH) {
      ball.x = WIDTH - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play(bounceSound);
    }

    // Rebote en la pala
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play(bounceSound);
    }

    // Colisión con bloques (uno por fotograma)
    for (const block of game.blocks) {
      if (!block.alive || !collideAABB(ball, block)) continue;
      block.hits--;
      ball.vy = -ball.vy;
      if (block.hits > 0) {
        // Aguanta: la pelota rebota y se saca del bloque para no contar el
        // mismo golpe en el fotograma siguiente
        ball.y = ball.vy < 0 ? block.y - ball.h : block.y + block.h;
        play(bounceSound);
        break;
      }
      block.alive = false;
      game.explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
      game.score += block.color === TOUGH_COLOR ? TOUGH_SCORE : BLOCK_SCORE;
      play(breakSound);
      if (game.blocks.every((b) => !b.alive)) {
        if (game.level < LAST_LEVEL) loadLevel(game.level + 1);
        else {
          endGame("win");
          return;
        }
      }
      break;
    }

    // Explosiones
    for (const exp of game.explosions) exp.elapsed += dt * 1000;
    game.explosions = game.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION,
    );

    // Pelota perdida
    if (game.ball.y > HEIGHT) {
      game.lives--;
      if (game.lives <= 0) {
        game.lives = 0;
        endGame("gameover");
      } else {
        initBall();
      }
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

  function draw(c: CanvasRenderingContext2D, img: HTMLImageElement) {
    const g = game;
    c.fillStyle = "#000";
    c.fillRect(0, 0, WIDTH, HEIGHT);

    for (const b of g.blocks) {
      if (!b.alive) continue;
      drawFrame(c, img, blockSprite(b.color), b.x, b.y, b.w, b.h);
      // Bloque resistente ya golpeado: se oscurece
      if (b.color === TOUGH_COLOR && b.hits < TOUGH_HITS) {
        c.fillStyle = TOUGH_DAMAGE_SHADE;
        c.fillRect(b.x, b.y, b.w, b.h);
      }
    }

    for (const e of g.explosions)
      drawFrame(c, img, explosionFrame(e.color, e.elapsed), e.x, e.y, e.w, e.h);

    drawFrame(
      c,
      img,
      PADDLE_SPRITE,
      g.paddle.x,
      g.paddle.y,
      g.paddle.w,
      g.paddle.h,
    );
    drawFrame(c, img, BALL_SPRITE, g.ball.x, g.ball.y, g.ball.w, g.ball.h);

    if (g.state === "playing" || g.state === "paused") {
      c.fillStyle = "#fff";
      c.font = "bold 18px monospace";
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText("Score: " + g.score, 10, 10);
      c.textAlign = "center";
      c.fillText("Nivel: " + g.level, WIDTH / 2, 10);
      const spacing = 4;
      for (let i = 0; i < g.lives; i++) {
        const bx = WIDTH - 10 - (g.lives - i) * (BALL_SIZE + spacing);
        drawFrame(c, img, BALL_SPRITE, bx, 10, BALL_SIZE, BALL_SIZE);
      }
    }

    const points = g.score.toLocaleString("es-ES");
    if (g.state === "paused")
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
        "¡Completaste el juego!",
        44,
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
  loadSpritesheet()
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

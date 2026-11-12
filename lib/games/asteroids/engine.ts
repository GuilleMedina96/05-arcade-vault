import {
  HEIGHT,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  WIDTH,
} from "./constants";
import { Asteroid, Bullet, Particle, PowerUp, Ship } from "./entities";
import { createInput } from "./input";
import { dist, rand } from "./math";

export { HEIGHT, WIDTH };

type GameState = "playing" | "dead" | "gameover";

interface Game {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  state: GameState;
  deadTimer: number;
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
}

/**
 * Arranca el juego sobre el canvas y devuelve la función que lo detiene
 * (cancelAnimationFrame + retirada de listeners).
 */
export function startAsteroids(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const input = createInput();
  let game = createGame();

  // ── Estado ────────────────────────────────────────────────────────────────
  function spawnAsteroids(g: Game, count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, WIDTH);
        y = rand(0, HEIGHT);
      } while (Math.hypot(x - WIDTH / 2, y - HEIGHT / 2) < SAFE_DIST);
      g.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function createGame(): Game {
    const g: Game = {
      ship: new Ship(),
      bullets: [],
      asteroids: [],
      particles: [],
      powerUps: [],
      score: 0,
      lives: 3,
      level: 1,
      state: "playing",
      deadTimer: 0,
      powerUpSpawned: false,
      killsSinceSpawn: 0,
    };
    spawnAsteroids(g, 4);
    return g;
  }

  function nextLevel() {
    game.level++;
    game.bullets = [];
    game.particles = [];
    game.powerUps = [];
    game.powerUpSpawned = false;
    game.killsSinceSpawn = 0;
    game.ship.reset();
    spawnAsteroids(game, 3 + game.level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) game.particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(game.ship.x, game.ship.y, 14);
    game.ship.dead = true;
    game.lives--;
    if (game.lives <= 0) {
      game.state = "gameover";
    } else {
      game.state = "dead";
      game.deadTimer = 2;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    const g = game;

    if (g.state === "gameover") {
      const restart = input.pressed("Space");
      g.particles.forEach((p) => p.update(dt));
      g.particles = g.particles.filter((p) => !p.dead);
      if (restart) game = createGame();
      return;
    }

    if (g.state === "dead") {
      g.deadTimer -= dt;
      g.particles.forEach((p) => p.update(dt));
      g.particles = g.particles.filter((p) => !p.dead);
      g.asteroids.forEach((a) => a.update(dt));
      if (g.deadTimer <= 0) {
        g.state = "playing";
        g.ship.reset();
      }
      return;
    }

    // Disparar
    if (input.pressed("Space")) {
      g.bullets.push(...g.ship.tryShoot());
    }

    g.ship.update(dt, input.keys);
    g.bullets.forEach((b) => b.update(dt));
    g.asteroids.forEach((a) => a.update(dt));
    g.particles.forEach((p) => p.update(dt));
    g.powerUps.forEach((p) => p.update(dt));

    g.bullets = g.bullets.filter((b) => !b.dead);
    g.particles = g.particles.filter((p) => !p.dead);
    g.powerUps = g.powerUps.filter((p) => !p.dead);

    for (const p of g.powerUps) {
      if (!p.dead && dist(g.ship, p) < g.ship.radius + p.radius) {
        p.dead = true;
        g.ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of g.bullets) {
      for (const a of g.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          g.score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!g.powerUpSpawned) {
            g.killsSinceSpawn++;
            const guaranteed = g.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              g.powerUps.push(new PowerUp(a.x, a.y));
              g.powerUpSpawned = true;
            }
          }
        }
      }
    }
    g.asteroids = g.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    g.bullets = g.bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (g.ship.invincible <= 0) {
      for (const a of g.asteroids) {
        if (dist(g.ship, a) < g.ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (g.asteroids.length === 0) nextLevel();
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawLifeIcon(c: CanvasRenderingContext2D, x: number, y: number) {
    c.save();
    c.translate(x, y);
    c.rotate(-Math.PI / 2);
    c.strokeStyle = "#fff";
    c.lineWidth = 1.2;
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(9, 0);
    c.lineTo(-6, -5);
    c.lineTo(-3, 0);
    c.lineTo(-6, 5);
    c.closePath();
    c.stroke();
    c.restore();
  }

  function drawHUD(c: CanvasRenderingContext2D) {
    c.fillStyle = "#fff";
    c.font = "15px monospace";
    c.textBaseline = "alphabetic";

    c.textAlign = "left";
    c.fillText(`SCORE  ${game.score}`, 14, 26);

    c.textAlign = "center";
    c.fillText(`NIVEL ${game.level}`, WIDTH / 2, 26);

    for (let i = 0; i < game.lives; i++)
      drawLifeIcon(c, WIDTH - 16 - i * 22, 18);

    if (game.ship.tripleShot > 0) {
      c.textAlign = "left";
      c.fillStyle = "#0ff";
      c.fillText(`3x  ${game.ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
  }

  function drawOverlay(
    c: CanvasRenderingContext2D,
    title: string,
    sub: string,
  ) {
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillStyle = "#fff";
    c.font = "bold 46px monospace";
    c.fillText(title, WIDTH / 2, HEIGHT / 2 - 18);
    c.font = "18px monospace";
    c.fillStyle = "rgba(255,255,255,0.65)";
    c.fillText(sub, WIDTH / 2, HEIGHT / 2 + 22);
  }

  function draw(c: CanvasRenderingContext2D) {
    c.fillStyle = "#000";
    c.fillRect(0, 0, WIDTH, HEIGHT);

    game.particles.forEach((p) => p.draw(c));
    game.asteroids.forEach((a) => a.draw(c));
    game.powerUps.forEach((p) => p.draw(c));
    game.bullets.forEach((b) => b.draw(c));
    game.ship.draw(c);

    drawHUD(c);

    if (game.state === "gameover")
      drawOverlay(
        c,
        "GAME OVER",
        `PUNTAJE: ${game.score}   —   ESPACIO PARA REINICIAR`,
      );
  }

  // ── Bucle principal ───────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId = 0;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
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

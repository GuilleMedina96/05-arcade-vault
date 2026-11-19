import {
  COLS,
  FRUITS_PER_SPEEDUP,
  INITIAL_LENGTH,
  MAX_QUEUED_TURNS,
  MIN_STEP_MS,
  ROWS,
  START_STEP_MS,
  STEP_DECREASE_MS,
} from "./constants";

/** Coordenadas de casilla, no de píxel. */
export interface Cell {
  x: number;
  y: number;
}

export interface Dir {
  x: number;
  y: number;
}

export const UP: Dir = { x: 0, y: -1 };
export const DOWN: Dir = { x: 0, y: 1 };
export const LEFT: Dir = { x: -1, y: 0 };
export const RIGHT: Dir = { x: 1, y: 0 };

/** Serpiente inicial: INITIAL_LENGTH segmentos en el centro, avanzando a la derecha. snake[0] es la cabeza. */
export function initialSnake(): Cell[] {
  const hx = Math.floor(COLS / 2);
  const hy = Math.floor(ROWS / 2);
  return Array.from({ length: INITIAL_LENGTH }, (_, i) => ({
    x: hx - i,
    y: hy,
  }));
}

/** Duración del paso (ms) tras `eaten` frutas. */
export function stepMsFor(eaten: number): number {
  return Math.max(
    MIN_STEP_MS,
    START_STEP_MS - Math.floor(eaten / FRUITS_PER_SPEEDUP) * STEP_DECREASE_MS,
  );
}

/**
 * Encola un giro. Se descarta si es igual o contrario al último giro encolado
 * (o al sentido actual si la cola está vacía), o si la cola está llena.
 */
export function queueTurn(queue: Dir[], current: Dir, next: Dir): void {
  if (queue.length >= MAX_QUEUED_TURNS) return;
  const last = queue.length > 0 ? queue[queue.length - 1] : current;
  const same = last.x === next.x && last.y === next.y;
  const reverse = last.x === -next.x && last.y === -next.y;
  if (same || reverse) return;
  queue.push(next);
}

/** Elige una casilla libre al azar; null si el tablero está lleno. */
export function pickFruitCell(snake: Cell[], rand: () => number): Cell | null {
  const taken = new Set(snake.map((c) => c.y * COLS + c.x));
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!taken.has(y * COLS + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rand() * free.length)];
}

export interface StepResult {
  snake: Cell[];
  ate: boolean;
  dead: boolean;
}

/**
 * Avanza un paso. Si no come, la cola se libera en el mismo paso, así que
 * moverse a la casilla que deja la cola es legal.
 */
export function advance(snake: Cell[], dir: Dir, fruit: Cell): StepResult {
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const ate = head.x === fruit.x && head.y === fruit.y;

  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    return { snake, ate: false, dead: true };
  }

  const body = ate ? snake : snake.slice(0, -1);
  if (body.some((c) => c.x === head.x && c.y === head.y)) {
    return { snake, ate: false, dead: true };
  }

  const next = [head, ...snake];
  if (!ate) next.pop();
  return { snake: next, ate, dead: false };
}

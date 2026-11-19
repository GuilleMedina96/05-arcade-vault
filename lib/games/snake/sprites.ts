export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Recortes de la fila de pixel art de `public/games/snake/fruits.png`
 * (hoja de 3790×442, fondo transparente), portados de `sprites.js`.
 * Los nombres del atlas original no coinciden con el dibujo (p. ej. "banana"
 * era una manzana roja), así que se usan solo las coordenadas.
 */
export const FRUIT_SPRITES: readonly SpriteRect[] = [
  { x: 34, y: 136, w: 110, h: 160 },
  { x: 186, y: 136, w: 150, h: 160 },
  { x: 378, y: 136, w: 110, h: 160 },
  { x: 540, y: 136, w: 130, h: 160 },
  { x: 712, y: 136, w: 130, h: 160 },
  { x: 894, y: 136, w: 110, h: 160 },
  { x: 1066, y: 136, w: 110, h: 160 },
  { x: 1228, y: 136, w: 130, h: 160 },
  { x: 1400, y: 136, w: 130, h: 160 },
  { x: 1582, y: 136, w: 110, h: 160 },
  { x: 1734, y: 136, w: 150, h: 160 },
  { x: 1906, y: 136, w: 150, h: 160 },
  { x: 2068, y: 136, w: 170, h: 160 },
  { x: 2250, y: 136, w: 140, h: 160 },
  { x: 2432, y: 136, w: 130, h: 160 },
  { x: 2604, y: 136, w: 130, h: 160 },
  { x: 2786, y: 136, w: 110, h: 160 },
  { x: 2948, y: 136, w: 130, h: 160 },
  { x: 3110, y: 136, w: 150, h: 160 },
  { x: 3302, y: 136, w: 110, h: 160 },
  { x: 3454, y: 136, w: 150, h: 160 },
  { x: 3637, y: 136, w: 130, h: 160 },
];

export function loadFruitSheet(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load fruit sprites"));
    img.src = src;
  });
}

/** Dibuja un sprite entero dentro de la casilla (x, y, size), centrado y sin deformarlo. */
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  sprite: SpriteRect,
  x: number,
  y: number,
  size: number,
) {
  const scale = Math.min(size / sprite.w, size / sprite.h);
  const dw = sprite.w * scale;
  const dh = sprite.h * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sheet,
    sprite.x,
    sprite.y,
    sprite.w,
    sprite.h,
    x + (size - dw) / 2,
    y + (size - dh) / 2,
    dw,
    dh,
  );
}

/**
 * Built-in Sprite Library and Render Engine for DIV-8 Fantasy Console
 */

import { Sprite } from './types';
import { PALETTE } from './palette';
import { createGreenHillBackdrop, createSonicSprites } from './sonicAssets';

// Helper to convert 8x8 or 16x16 ASCII art to color indices
function parseAsciiSprite(id: number, name: string, width: number, height: number, rows: string[]): Sprite {
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y] || '';
    for (let x = 0; x < width; x++) {
      const char = row[x] || '.';
      if (char === '.') {
        data.push(0); // transparent
      } else if (char >= '0' && char <= '9') {
        data.push(parseInt(char, 10));
      } else if (char === 'a') data.push(10);
      else if (char === 'b') data.push(11);
      else if (char === 'c') data.push(12);
      else if (char === 'd') data.push(13);
      else if (char === 'e') data.push(14);
      else if (char === 'f') data.push(15);
      else if (char === 'W') data.push(7); // White
      else if (char === 'R') data.push(8); // Red
      else if (char === 'Y') data.push(10); // Yellow
      else if (char === 'G') data.push(11); // Green
      else if (char === 'B') data.push(12); // Cyan/Blue
      else if (char === 'P') data.push(14); // Pink
      else if (char === 'X') data.push(5); // Gray
      else {
        data.push(7);
      }
    }
  }
  return { id, name, width, height, data };
}

export const DEFAULT_SPRITES: Sprite[] = [
  // 1: Player Ship (16x16)
  parseAsciiSprite(1, 'Nave Jugador', 16, 16, [
    '.......77.......',
    '......7cc7......',
    '......7cc7......',
    '.....7cccc7.....',
    '.....7cccc7.....',
    '....7cccccc7....',
    '....7c1111c7....',
    '...7c177771c7...',
    '...7c17..71c7...',
    '..7717....7177..',
    '.7cc17777771cc7.',
    '7ccc11111111ccc7',
    '77777a9aa9a77777',
    '....9a9..9a9....',
    '....98....89....',
    '.....8....8.....',
  ]),

  // 2: Laser Bullet (8x8)
  parseAsciiSprite(2, 'Laser / Bala', 8, 8, [
    '...aa...',
    '..aaaa..',
    '..a77a..',
    '..a77a..',
    '..a77a..',
    '..aaaa..',
    '...99...',
    '...88...',
  ]),

  // 3: Alien / Enemigo 1 (16x16)
  parseAsciiSprite(3, 'Alien Enemigo', 16, 16, [
    '....888....888..',
    '.....888..888...',
    '....8888888888..',
    '...889888888988.',
    '..88998888889988',
    '..88998888889988',
    '..88888888888888',
    '..88888888888888',
    '...888888888888.',
    '....88.88.88....',
    '...88..88..88...',
    '..88...88...88..',
    '.88....88....88.',
    '88............88',
    '................',
    '................',
  ]),

  // 4: Asteroid (16x16)
  parseAsciiSprite(4, 'Asteroide', 16, 16, [
    '....4444444.....',
    '...445555444....',
    '..45566655444...',
    '.4566666655444..',
    '456655566654444.',
    '456554556655444.',
    '456544456655444.',
    '456655566654444.',
    '.4566666655444..',
    '..45666655444...',
    '...455555444....',
    '....4444444.....',
    '.....4444.......',
    '................',
    '................',
    '................',
  ]),

  // 5: Explosion (16x16)
  parseAsciiSprite(5, 'Explosión', 16, 16, [
    '....9...aa...9..',
    '..9.aa.7777.aa.9',
    '...a7777aa777a..',
    '.9a7a999999a7a9.',
    '..a9988888899a..',
    '.a988888888889a.',
    'a79888888888897a',
    'a79888888888897a',
    '.a988888888889a.',
    '..a9988888899a..',
    '.9a7a999999a7a9.',
    '...a7777aa777a..',
    '..9.aa.7777.aa.9',
    '....9...aa...9..',
    '................',
    '................',
  ]),

  // 6: Hero Diver / Platformer (16x16)
  parseAsciiSprite(6, 'Héroe Diver', 16, 16, [
    '.....cccc.......',
    '....cccccc......',
    '....cccccc......',
    '....ffff77......',
    '...ffffff77.....',
    '...ff0ff0ff.....',
    '...ffffff.......',
    '....ffff........',
    '...88888888.....',
    '..8888888888....',
    '..8888888888....',
    '..88.8888.88....',
    '.....8888.......',
    '....11..11......',
    '....11..11......',
    '...555..555.....',
  ]),

  // 7: Coin / Gem (8x8)
  parseAsciiSprite(7, 'Moneda Oro', 8, 8, [
    '..aaaa..',
    '.aa77aa.',
    'aa7aaa9a',
    'aa7aaa9a',
    'aa7aaa9a',
    'aa7aaa9a',
    '.aa999a.',
    '..aaaa..',
  ]),

  // 8: Skeleton / Dungeon Ghost (16x16)
  parseAsciiSprite(8, 'Esqueleto / Fantasma', 16, 16, [
    '.....777777.....',
    '...7777777777...',
    '..777777777777..',
    '..770077770077..',
    '..778877778877..',
    '..770077770077..',
    '..777770077777..',
    '...7777777777...',
    '....70707070....',
    '....77777777....',
    '...5577557755...',
    '..55.77..77.55..',
    '.....77..77.....',
    '.....77..77.....',
    '....555..555....',
    '................',
  ]),

  // 9: Heart / Life (8x8)
  parseAsciiSprite(9, 'Corazón / Vida', 8, 8, [
    '.88..88.',
    '87788888',
    '87888888',
    '88888888',
    '.888888.',
    '..8888..',
    '...88...',
    '....8...',
  ]),

  // 10: Brick Block (16x16)
  parseAsciiSprite(10, 'Ladrillo / Muro', 16, 16, [
    '9999999999999999',
    '9444444494444444',
    '9444444494444444',
    '9444444494444444',
    '9999999999999999',
    '4444444944444449',
    '4444444944444449',
    '4444444944444449',
    '9999999999999999',
    '9444444494444444',
    '9444444494444444',
    '9444444494444444',
    '9999999999999999',
    '4444444944444449',
    '4444444944444449',
    '9999999999999999',
  ]),

  // 11: Ball (8x8)
  parseAsciiSprite(11, 'Pelota', 8, 8, [
    '..7777..',
    '.777777.',
    '77c77777',
    '7c1c7777',
    '77c77777',
    '77777777',
    '.777777.',
    '..7777..',
  ]),

  // 12: Paddle (16x8)
  parseAsciiSprite(12, 'Pala / Raqueta', 16, 8, [
    '..cccccccccccc..',
    '.c777777777777c.',
    'c7cccccccccccc7c',
    'c11111111111111c',
    'c11111111111111c',
    'c7cccccccccccc7c',
    '.c777777777777c.',
    '..cccccccccccc..',
  ]),

  // 13: Star (8x8)
  parseAsciiSprite(13, 'Estrella', 8, 8, [
    '...aa...',
    '...aa...',
    '..aaaa..',
    'aaaaaaaa',
    '..aaaa..',
    '.aa..aa.',
    'aa....aa',
    '........',
  ]),

  // 14: Key (8x8)
  parseAsciiSprite(14, 'Llave Cofre', 8, 8, [
    '..aaaa..',
    '.aa..aa.',
    '.aa..aa.',
    '..aaaa..',
    '...aa...',
    '...aaaa.',
    '...aa...',
    '...aaaa.',
  ]),

  // 15: Torch / Flame (8x8)
  parseAsciiSprite(15, 'Antorcha', 8, 8, [
    '...77...',
    '..7aa7..',
    '..a99a..',
    '..9889..',
    '...88...',
    '..4444..',
    '...44...',
    '...44...',
  ]),

  // 16: Chest (16x16)
  parseAsciiSprite(16, 'Cofre Tesoro', 16, 16, [
    '................',
    '..444444444444..',
    '.4aaaaaaaaaaaa4.',
    '.4a4444444444a4.',
    '44a4aaaaaaaa4a44',
    '44a4a999999a4a44',
    '44a4a9aaaa9a4a44',
    '4444444444444444',
    '44a4444aa4444a44',
    '44a444aaaa444a44',
    '44a444a00a444a44',
    '44a444aaaa444a44',
    '44a4444aa4444a44',
    '4444444444444444',
    '.4aaaaaaaaaaaa4.',
    '................',
  ]),
];

DEFAULT_SPRITES.push(createGreenHillBackdrop(320, 240));
DEFAULT_SPRITES.push(...createSonicSprites());

export function getSpriteById(sprites: Sprite[], id: number): Sprite | undefined {
  return sprites.find((s) => s.id === id) || DEFAULT_SPRITES.find((s) => s.id === id);
}

/**
 * Creates or retrieves a cached offscreen HTMLCanvasElement for a sprite.
 * Rasterizes the color indices once into ImageData instead of hundreds of fillRect() calls.
 */
export function getSpriteCanvas(sprite: Sprite): HTMLCanvasElement {
  if (sprite._canvas && sprite._canvas.width === sprite.width && sprite._canvas.height === sprite.height) {
    return sprite._canvas;
  }

  if (typeof document === 'undefined') {
    return {} as HTMLCanvasElement;
  }

  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(sprite.width, sprite.height);
    const data32 = new Uint32Array(imgData.data.buffer);

    for (let i = 0; i < sprite.data.length; i++) {
      const colIdx = sprite.data[i];
      if (colIdx > 0) {
        const c = PALETTE[colIdx % PALETTE.length];
        // ABGR for 32-bit little endian: 0xAABBGGRR
        data32[i] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
      } else {
        data32[i] = 0; // transparent
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  sprite._canvas = canvas;
  return canvas;
}

/**
 * Invalidate cached canvas when sprite pixels are edited
 */
export function invalidateSpriteCanvas(sprite: Sprite) {
  delete sprite._canvas;
  if (sprite._texture?.source) {
    sprite._texture.source.update();
  }
}

/**
 * Render a sprite onto a 2D canvas context efficiently using a single drawImage
 */
export function drawSpriteToCanvas(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  sizePercent: number = 100,
  angleDeg: number = 0,
  flags: number = 0,
  alpha: number = 1.0
) {
  const spriteCanvas = getSpriteCanvas(sprite);
  if (!spriteCanvas.width) return;

  const scale = sizePercent / 100;
  const w = sprite.width * scale;
  const h = sprite.height * scale;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));

  if (angleDeg !== 0) {
    ctx.rotate((angleDeg * Math.PI) / 180);
  }

  // Handle flags: 1 = flip horizontal, 2 = flip vertical, 3 = both
  const flipH = (flags & 1) !== 0;
  const flipV = (flags & 2) !== 0;
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // Single fast textured draw call!
  ctx.drawImage(spriteCanvas, -Math.round(w / 2), -Math.round(h / 2), Math.round(w), Math.round(h));

  ctx.restore();
}

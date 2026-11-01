/**
 * sonicAssets.ts — Procedural retro sprites & tilemaps for Sonic SMS Parallax demo
 */

import { Sprite } from './types';
import { DivTilemap, TILE_FLAG } from './tilemap';

/**
 * Generate 320x240 Green Hill Zone backdrop graphic (Sprite 101)
 * Palette indices:
 * 0: transparent, 1: dark blue, 2: purple, 3: dark green, 4: brown,
 * 5: gray, 6: light gray, 7: white, 8: red, 9: orange, 10: yellow,
 * 11: bright green, 12: cyan / sky blue, 13: blue, 14: pink, 15: peach
 */
export function createGreenHillBackdrop(width: number = 320, height: number = 240): Sprite {
  const data = new Array(width * height).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (y < 45) {
        // Deep Sky
        const cloud = (Math.sin(x * 0.05 + 1) * 6 + Math.cos(x * 0.02) * 4);
        if (y > 20 && y < 35 && Math.abs(y - 28) < cloud) {
          data[idx] = 7; // White cloud
        } else if (y > 22 && y < 37 && Math.abs(y - 30) < cloud) {
          data[idx] = 6; // Cloud shadow
        } else {
          data[idx] = 12; // Sky blue
        }
      } else if (y < 85) {
        // Mid Sky & Clouds
        const cloud2 = (Math.sin(x * 0.07 + 3) * 8);
        if (y > 55 && y < 70 && Math.abs(y - 62) < cloud2) {
          data[idx] = 7; // White
        } else if (y > 57 && y < 72 && Math.abs(y - 64) < cloud2) {
          data[idx] = 6; // Cloud shadow
        } else {
          data[idx] = 12;
        }
      } else if (y < 125) {
        // Distant Mountains & Waterfalls
        const mtnHeight = 100 + Math.sin(x * 0.04) * 15 + Math.cos(x * 0.02) * 10;
        const waterfall = (x % 80 >= 38 && x % 80 <= 42);

        if (y > mtnHeight) {
          if (waterfall && y > 105) {
            data[idx] = (x + y) % 2 === 0 ? 7 : 12; // Sparkling waterfall
          } else {
            // Mountain ridges
            const ridge = (x + y) % 6 < 3 ? 3 : 11;
            data[idx] = ridge;
          }
        } else {
          data[idx] = 12; // Sky
        }
      } else if (y < 155) {
        // Rolling Green Hills
        const hill1 = 135 + Math.sin(x * 0.06) * 10;
        const hill2 = 142 + Math.sin((x + 40) * 0.05) * 8;

        if (y > hill2) {
          data[idx] = (x + y) % 4 === 0 ? 11 : 3;
        } else if (y > hill1) {
          data[idx] = 11; // Bright grass
        } else {
          data[idx] = 3;
        }
      } else if (y < 185) {
        // Forest canopy & river bank
        const foliage = (Math.sin(x * 0.15) * 4) + 165;
        if (y > foliage) {
          data[idx] = (x % 16 < 8) ? 3 : 11;
        } else {
          data[idx] = 11;
        }
      } else {
        // Sparkling blue ocean with parallax waves
        const wave = (x + (y * 4)) % 16;
        if (wave < 4) {
          data[idx] = 7; // White wave crest
        } else if (wave < 10) {
          data[idx] = 12; // Light blue
        } else {
          data[idx] = 13; // Deep ocean blue
        }
      }
    }
  }

  return {
    id: 101,
    name: 'Fondo Green Hill (320x240)',
    width,
    height,
    data,
  };
}

/**
 * Sonic pixel art sprites (16x16 or 24x24):
 * Idle, Running frames, Jump roll, Look up, Crouch
 */
export function createSonicSprites(): Sprite[] {
  const S: Sprite[] = [];

  // Helper to parse pixel art strings
  const parse = (id: number, name: string, rows: string[]): Sprite => {
    const height = rows.length;
    const width = rows[0].length;
    const data: number[] = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const ch = rows[r][c];
        if (ch === '.') data.push(0);
        else if (ch === 'B') data.push(13); // Sonic Blue
        else if (ch === 'b') data.push(1);  // Dark Blue
        else if (ch === 'W') data.push(7);  // White
        else if (ch === 'R') data.push(8);  // Red shoes
        else if (ch === 'P') data.push(15); // Skin peach
        else if (ch === 'Y') data.push(10); // Yellow shoe buckle
        else if (ch === '0') data.push(0);
        else if (ch === 'X') data.push(5);
        else data.push(7);
      }
    }
    return { id, name, width, height, data };
  };

  // 1: Sonic Idle (Standing)
  S.push(parse(1, 'Sonic Reposo', [
    '.....BBB........',
    '....BBBBB.......',
    '..bBBBBBBBB.....',
    '.bbBBBBWWPBB....',
    '.bbBBBW0WPBB....',
    '..bBBBW0WPBB....',
    '....BBWWPPPPP...',
    '....BBPPPPPPP...',
    '...bBBPPPPPPP...',
    '..bbBBBBBBB.....',
    '..bBBBBBBBB.....',
    '....BB...BB.....',
    '...WW.....WW....',
    '..RRRY...RRRY...',
    '..RRRR...RRRR...',
    '..WWWW...WWWW...',
  ]));

  // 4..14: Sonic Running Animation Cycle
  const runFrames = [
    // 4: Run 1
    [
      '....BBBB........',
      '..bBBBBBBB......',
      '.bbBBWWPBB......',
      '..bBBW0WPBB.....',
      '..bBBWWPPPPP....',
      '...BBPPPPPPP....',
      '..bBBBBBBBB.....',
      '.bbBBBBBB.......',
      '...BB...BB......',
      '...WW....WW.....',
      '..RRRY....RRRY..',
      '..RRRR....RRRR..',
      '..WWWW....WWWW..',
      '................',
      '................',
      '................',
    ],
    // 5: Run 2
    [
      '...BBBBB........',
      '.bBBBBBBBB......',
      'bbBBWWPBBB......',
      '.bBBW0WPBB......',
      '..BBWWPPPPP.....',
      '..bBPPPPPPP.....',
      '.bbBBBBBBBB.....',
      '..bBBBB.........',
      '....WW...BB.....',
      '...RRRY...WW....',
      '...RRRR..RRRY...',
      '...WWWW..RRRR...',
      '.........WWWW...',
      '................',
      '................',
      '................',
    ],
    // 6: Run 3
    [
      '..bBBBBB........',
      'bbBBBBBBB.......',
      'bBBWWPBBB.......',
      '.BBW0WPBB.......',
      '..BWWPPPPP......',
      '..bPPPPPPP......',
      '.bbBBBBBBB......',
      '...BBBBBBBB.....',
      '....BB...BB.....',
      '....WW....WW....',
      '...RRRY..RRRY...',
      '...RRRR..RRRR...',
      '...WWWW..WWWW...',
      '................',
      '................',
      '................',
    ],
    // 7: Run 4
    [
      '....BBBB........',
      '..bBBBBBB.......',
      '.bbBBWWPBB......',
      '..bBBW0WPBB.....',
      '..bBBWWPPPPP....',
      '...BBPPPPPPP....',
      '..bBBBBBBBB.....',
      '.bbBBBB.........',
      '...BB....BB.....',
      '..RRRY...WW.....',
      '..RRRR..RRRY....',
      '..WWWW..RRRR....',
      '........WWWW....',
      '................',
      '................',
      '................',
    ],
    // 8: Run 5
    [
      '...BBBBB........',
      '.bBBBBBBBB......',
      'bbBBWWPBBB......',
      '.bBBW0WPBB......',
      '..BBWWPPPPP.....',
      '..bBPPPPPPP.....',
      '.bbBBBBBB.......',
      '..bBBBBBBB......',
      '....BB...WW.....',
      '....WW..RRRY....',
      '...RRRY.RRRR....',
      '...RRRR.WWWW....',
      '...WWWW.........',
      '................',
      '................',
      '................',
    ],
    // 9: Run 6
    [
      '..bBBBBB........',
      'bbBBBBBBB.......',
      'bBBWWPBBB.......',
      '.BBW0WPBB.......',
      '..BWWPPPPP......',
      '..bPPPPPPP......',
      '.bbBBBBBBB......',
      '...BBBBBB.......',
      '....BB...BB.....',
      '....WW....WW....',
      '...RRRY..RRRY...',
      '...RRRR..RRRR...',
      '...WWWW..WWWW...',
      '................',
      '................',
      '................',
    ],
    // 10: Run 7
    [
      '....BBBB........',
      '..bBBBBBB.......',
      '.bbBBWWPBB......',
      '..bBBW0WPBB.....',
      '..bBBWWPPPPP....',
      '...BBPPPPPPP....',
      '..bBBBBBBBB.....',
      '.bbBBBBBB.......',
      '...BB...BB......',
      '...WW....WW.....',
      '..RRRY....RRRY..',
      '..RRRR....RRRR..',
      '..WWWW....WWWW..',
      '................',
      '................',
      '................',
    ],
    // 11: Run 8
    [
      '...BBBBB........',
      '.bBBBBBBBB......',
      'bbBBWWPBBB......',
      '.bBBW0WPBB......',
      '..BBWWPPPPP.....',
      '..bBPPPPPPP.....',
      '.bbBBBBBBBB.....',
      '..bBBBB.........',
      '....WW...BB.....',
      '...RRRY...WW....',
      '...RRRR..RRRY...',
      '...WWWW..RRRR...',
      '.........WWWW...',
      '................',
      '................',
      '................',
    ],
    // 12: Run 9
    [
      '..bBBBBB........',
      'bbBBBBBBB.......',
      'bBBWWPBBB.......',
      '.BBW0WPBB.......',
      '..BWWPPPPP......',
      '..bPPPPPPP......',
      '.bbBBBBBBB......',
      '...BBBBBBBB.....',
      '....BB...BB.....',
      '....WW....WW....',
      '...RRRY..RRRY...',
      '...RRRR..RRRR...',
      '...WWWW..WWWW...',
      '................',
      '................',
      '................',
    ],
    // 13: Run 10
    [
      '....BBBB........',
      '..bBBBBBB.......',
      '.bbBBWWPBB......',
      '..bBBW0WPBB.....',
      '..bBBWWPPPPP....',
      '...BBPPPPPPP....',
      '..bBBBBBBBB.....',
      '.bbBBBB.........',
      '...BB....BB.....',
      '..RRRY...WW.....',
      '..RRRR..RRRY....',
      '..WWWW..RRRR....',
      '........WWWW....',
      '................',
      '................',
      '................',
    ],
    // 14: Run 11
    [
      '...BBBBB........',
      '.bBBBBBBBB......',
      'bbBBWWPBBB......',
      '.bBBW0WPBB......',
      '..BBWWPPPPP.....',
      '..bBPPPPPPP.....',
      '.bbBBBBBB.......',
      '..bBBBBBBB......',
      '....BB...WW.....',
      '....WW..RRRY....',
      '...RRRY.RRRR....',
      '...RRRR.WWWW....',
      '...WWWW.........',
      '................',
      '................',
      '................',
    ],
  ];

  for (let i = 0; i < runFrames.length; i++) {
    S.push(parse(4 + i, `Sonic Correr ${i + 1}`, runFrames[i]));
  }

  // 20: Sonic Looking Up
  S.push(parse(20, 'Sonic Mirar Arriba', [
    '.....BBB........',
    '....BBBBB.......',
    '..bBBBBBBBB.....',
    '.bbBBWWPBB......',
    '.bbBBW0WPBB.....',
    '..bBBW0WPBB.....',
    '....BBWWPPPP....',
    '....BBPPPPPP....',
    '...bBBPPPPPP....',
    '..bbBBBBBBB.....',
    '..bBBBBBBBB.....',
    '....BB...BB.....',
    '...WW.....WW....',
    '..RRRY...RRRY...',
    '..RRRR...RRRR...',
    '..WWWW...WWWW...',
  ]));

  // 21: Sonic Crouching
  S.push(parse(21, 'Sonic Agacharse', [
    '................',
    '................',
    '................',
    '.....BBBBB......',
    '...bBBBBBBBB....',
    '..bbBBWWPBBB....',
    '..bBBW0WPBB.....',
    '...BBWWPPPPP....',
    '...bBPPPPPPP....',
    '..bbBBBBBBBB....',
    '..bBBBBBBBBB....',
    '....WW...WW.....',
    '...RRRY.RRRY....',
    '...RRRR.RRRR....',
    '...WWWW.WWWW....',
    '................',
  ]));

  // 29.5 / 30..34: Sonic Spin Roll / Jump Ball
  const rollFrames = [
    [
      '.....BBBB.......',
      '...bBBBBBBb.....',
      '..bBBBBBBBBb....',
      '.bBBbBBBBbBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBbBBBBbBBb...',
      '..bBBBBBBBBb....',
      '...bBBBBBBb.....',
      '.....BBBB.......',
      '................',
      '................',
    ],
    [
      '.....BBBB.......',
      '...bBBBBBBb.....',
      '..bBBBRRBBBb....',
      '.bBBBBRRRBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBRRRBBBb...',
      '..bBBBRRBBBb....',
      '...bBBBBBBb.....',
      '.....BBBB.......',
      '................',
      '................',
    ],
    [
      '.....BBBB.......',
      '...bBBBBBBb.....',
      '..bBBBBBBBBb....',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '..bBBBBBBBBb....',
      '...bBBBBBBb.....',
      '.....BBBB.......',
      '................',
      '................',
    ],
    [
      '.....BBBB.......',
      '...bBBBBBBb.....',
      '..bBBBBRRBBb....',
      '.bBBBRRRRBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBRRRRBBBb...',
      '..bBBBBRRBBb....',
      '...bBBBBBBb.....',
      '.....BBBB.......',
      '................',
      '................',
    ],
    [
      '.....BBBB.......',
      '...bBBBBBBb.....',
      '..bBBBBBBBBb....',
      '.bBBbBBBBbBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBRRRRBBBb...',
      '.bBBBBBBBBBBb...',
      '.bBBbBBBBbBBb...',
      '..bBBBBBBBBb....',
      '...bBBBBBBb.....',
      '.....BBBB.......',
      '................',
      '................',
    ],
  ];

  for (let i = 0; i < rollFrames.length; i++) {
    S.push(parse(30 + i, `Sonic Rodar ${i + 1}`, rollFrames[i]));
  }

  // Pre-seed 29 as roll frame 1 (since code does `grafic = 29.5`)
  S.push(parse(29, 'Sonic Rodar Inicio', rollFrames[0]));

  return S;
}

/**
 * Generate standard Level "0030" Tilemap:
 * - 60 columns wide x 16 rows high (960x256 pixels)
 * - Ground layer at row 12-15 with checkerboard grass
 * - Platform steps and obstacles
 * - Walls: tile 4 (left solid wall) and tile 6 (right solid wall)
 * - Soil: tile 10 (solid ground)
 */
export function createDefaultSonicTilemap(): DivTilemap {
  const cols = 60;
  const rows = 16;
  const size = 16;
  const tm = DivTilemap.create(cols, rows, size, '0030');

  // Fill ground
  for (let c = 0; c < cols; c++) {
    // Solid floor at rows 13..15
    for (let r = 13; r < rows; r++) {
      tm.setTileByCell(c, r, 10); // Brick / solid grass block
      tm.setFlags(c * size, r * size, TILE_FLAG.SOLID);
    }
  }

  // Add floating platform 1
  for (let c = 10; c < 16; c++) {
    tm.setTileByCell(c, 10, 10);
    tm.setFlags(c * size, 10 * size, TILE_FLAG.PLATFORM | TILE_FLAG.SOLID);
  }

  // Add obstacle wall (tile 4) at x = 25
  tm.setTileByCell(25, 12, 4);
  tm.setFlags(25 * size, 12 * size, TILE_FLAG.WALL | TILE_FLAG.SOLID);

  // Add higher platform 2
  for (let c = 30; c < 38; c++) {
    tm.setTileByCell(c, 8, 10);
    tm.setFlags(c * size, 8 * size, TILE_FLAG.PLATFORM | TILE_FLAG.SOLID);
  }

  // Add left barrier wall at start
  for (let r = 0; r < rows; r++) {
    tm.setTileByCell(0, r, 6);
    tm.setFlags(0, r * size, TILE_FLAG.WALL | TILE_FLAG.SOLID);
  }

  // Add right barrier wall at end
  for (let r = 0; r < rows; r++) {
    tm.setTileByCell(cols - 1, r, 4);
    tm.setFlags((cols - 1) * size, r * size, TILE_FLAG.WALL | TILE_FLAG.SOLID);
  }

  return tm;
}

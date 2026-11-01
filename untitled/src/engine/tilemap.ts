/**
 * Tilemap.ts — DivGO v2 Tilemap System for DIV-8 Fantasy Console
 * Conforms to DivGO specification:
 * - map[row][col]: sprite id
 * - flags[row][col]: gameplay bitmask (SOLID=1, PLATFORM=2, WATER=4, HAZARD=8, LADDER=16, DESTRUCTIBLE=32, INTERACTIVE=64, WALL=128)
 * - transform[row][col]: visual transforms (0..7: FLIP_H=1, FLIP_V=2, ALPHA=4)
 */

export const TILEMAP_TYPE = 'DivGOtilemap';
export const TILEMAP_TYPE_LEGACY_B64 = 'RGl2R090aWxlbWFw';
export const TILEMAP_VERSION = 2;
export const MAX_TILEMAP_SIZE = 512;

export const TILE_FLAG = Object.freeze({
  SOLID: 1,         // bit 0: collision solid
  PLATFORM: 2,      // bit 1: jump-through platform
  WATER: 4,         // bit 2: water
  HAZARD: 8,        // bit 3: spikes / lava / damage
  LADDER: 16,       // bit 4: climbable ladder
  DESTRUCTIBLE: 32, // bit 5: breakable block
  INTERACTIVE: 64,  // bit 6: trigger / switch
  WALL: 128,        // bit 7: solid wall (side barrier)
});

export const TILE_TRANSFORM = Object.freeze({
  NONE: 0,
  FLIP_H: 1,
  FLIP_V: 2,
  FLIP_HV: 3,
  ALPHA: 4,
  ALPHA_FLIP_H: 5,
  ALPHA_FLIP_V: 6,
  ALPHA_FLIP_HV: 7,
});

export interface TilemapDefinition {
  type: string;
  version: number;
  size: number;
  map: number[][];
  flags?: number[][] | null;
  transform?: number[][] | null;
  name?: string;
  cols?: number;
  rows?: number;
  width?: number;
  height?: number;
}

function zeroMatrix(rows: number, cols: number): number[][] {
  const out: number[][] = new Array(rows);
  for (let f = 0; f < rows; f++) {
    out[f] = new Array(cols).fill(0);
  }
  return out;
}

function copyMatrix(source: number[][]): number[][] {
  return source.map((row) => (Array.isArray(row) ? row.slice() : []));
}

export class DivTilemap implements TilemapDefinition {
  public type: string = TILEMAP_TYPE;
  public version: number = TILEMAP_VERSION;
  public size: number = 16;
  public map: number[][] = [];
  public flags: number[][] | null = null;
  public transform: number[][] | null = null;
  public name?: string;
  public cols: number = 0;
  public rows: number = 0;
  public width: number = 0;
  public height: number = 0;

  constructor(definition?: Partial<TilemapDefinition> | string, name?: string) {
    if (typeof definition === 'string') {
      const parsed = DivTilemap.parse(definition, name);
      Object.assign(this, parsed);
      return;
    }

    if (definition) {
      this.size = Math.max(1, Math.min(MAX_TILEMAP_SIZE, definition.size || 16));
      this.name = name || definition.name;

      if (Array.isArray(definition.map) && definition.map.length > 0) {
        this.rows = definition.map.length;
        let maxCols = 0;
        for (let r = 0; r < this.rows; r++) {
          if (Array.isArray(definition.map[r]) && definition.map[r].length > maxCols) {
            maxCols = definition.map[r].length;
          }
        }
        this.cols = Math.max(1, maxCols);

        this.map = new Array(this.rows);
        for (let r = 0; r < this.rows; r++) {
          const row = definition.map[r] || [];
          const outRow = new Array(this.cols).fill(0);
          for (let c = 0; c < this.cols; c++) {
            outRow[c] = (row[c] || 0) | 0;
          }
          this.map[r] = outRow;
        }

        if (Array.isArray(definition.flags)) {
          this.flags = zeroMatrix(this.rows, this.cols);
          for (let r = 0; r < Math.min(this.rows, definition.flags.length); r++) {
            const row = definition.flags[r] || [];
            for (let c = 0; c < Math.min(this.cols, row.length); c++) {
              this.flags[r][c] = (row[c] || 0) & 0xff;
            }
          }
        }

        if (Array.isArray(definition.transform)) {
          this.transform = zeroMatrix(this.rows, this.cols);
          for (let r = 0; r < Math.min(this.rows, definition.transform.length); r++) {
            const row = definition.transform[r] || [];
            for (let c = 0; c < Math.min(this.cols, row.length); c++) {
              this.transform[r][c] = (row[c] || 0) & 0x07;
            }
          }
        }
      } else {
        this.cols = 20;
        this.rows = 15;
        this.map = zeroMatrix(this.rows, this.cols);
      }
    } else {
      this.size = 16;
      this.cols = 20;
      this.rows = 15;
      this.map = zeroMatrix(this.rows, this.cols);
    }

    this.width = this.cols * this.size;
    this.height = this.rows * this.size;
  }

  public static isTilemap(v: any): boolean {
    return (
      v !== null &&
      typeof v === 'object' &&
      (v.type === TILEMAP_TYPE || v.type === TILEMAP_TYPE_LEGACY_B64) &&
      Array.isArray(v.map)
    );
  }

  public static create(cols: number, rows: number, size: number = 16, name?: string): DivTilemap {
    const tm = new DivTilemap({
      type: TILEMAP_TYPE,
      version: TILEMAP_VERSION,
      size,
      map: zeroMatrix(rows, cols),
      flags: zeroMatrix(rows, cols),
      transform: zeroMatrix(rows, cols),
      name,
    });
    return tm;
  }

  public static parse(jsonText: string, name?: string): DivTilemap {
    let raw: any;
    try {
      raw = JSON.parse(jsonText.trim());
    } catch {
      // Try base64
      try {
        const decoded = atob(jsonText.trim());
        raw = JSON.parse(decoded);
      } catch (err) {
        throw new Error('[DivTilemap] Formato de tilemap inválido: ' + err);
      }
    }

    if (!raw || typeof raw !== 'object') {
      throw new Error('[DivTilemap] El contenido no es un objeto JSON válido');
    }

    return new DivTilemap(raw, name);
  }

  public clone(name?: string): DivTilemap {
    return new DivTilemap(
      {
        type: this.type,
        version: this.version,
        size: this.size,
        map: copyMatrix(this.map),
        flags: this.flags ? copyMatrix(this.flags) : null,
        transform: this.transform ? copyMatrix(this.transform) : null,
        name: name || this.name,
      },
      name || this.name
    );
  }

  public ensureFlags(): number[][] {
    if (!this.flags) {
      this.flags = zeroMatrix(this.rows, this.cols);
    }
    return this.flags;
  }

  public ensureTransform(): number[][] {
    if (!this.transform) {
      this.transform = zeroMatrix(this.rows, this.cols);
    }
    return this.transform;
  }

  public cellCoords(x: number, y: number): { col: number; row: number } | null {
    if (this.size <= 0) return null;
    return {
      col: Math.floor(x / this.size),
      row: Math.floor(y / this.size),
    };
  }

  public inBounds(col: number, row: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  public getTile(x: number, y: number): number {
    const pos = this.cellCoords(x, y);
    if (!pos || !this.inBounds(pos.col, pos.row)) return 0;
    return this.map[pos.row][pos.col] || 0;
  }

  public setTile(x: number, y: number, idTile: number): number {
    const pos = this.cellCoords(x, y);
    if (!pos || !this.inBounds(pos.col, pos.row)) return 0;
    this.map[pos.row][pos.col] = idTile | 0;
    return 1;
  }

  public getTileByCell(col: number, row: number): number {
    if (!this.inBounds(col, row)) return 0;
    return this.map[row][col] || 0;
  }

  public setTileByCell(col: number, row: number, idTile: number): number {
    if (!this.inBounds(col, row)) return 0;
    this.map[row][col] = idTile | 0;
    return 1;
  }

  public getFlags(x: number, y: number): number {
    const pos = this.cellCoords(x, y);
    if (!pos || !this.inBounds(pos.col, pos.row) || !this.flags) return 0;
    return this.flags[pos.row][pos.col] || 0;
  }

  public setFlags(x: number, y: number, value: number): number {
    const pos = this.cellCoords(x, y);
    if (!pos || !this.inBounds(pos.col, pos.row)) return 0;
    const flags = this.ensureFlags();
    flags[pos.row][pos.col] = value & 0xff;
    return 1;
  }

  public hasFlag(x: number, y: number, bit: number): boolean {
    return (this.getFlags(x, y) & (bit | 0)) !== 0;
  }

  public getTransform(x: number, y: number): number {
    const pos = this.cellCoords(x, y);
    if (!pos || !this.inBounds(pos.col, pos.row) || !this.transform) return 0;
    return this.transform[pos.row][pos.col] || 0;
  }

  public setTransform(x: number, y: number, value: number): number {
    const pos = this.cellCoords(x, y);
    if (!pos || !this.inBounds(pos.col, pos.row)) return 0;
    const tr = this.ensureTransform();
    tr[pos.row][pos.col] = value & 0x07;
    return 1;
  }

  public changeTileValue(oldId: number, newId: number): number {
    let replaced = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.map[r][c] === oldId) {
          this.map[r][c] = newId;
          replaced++;
        }
      }
    }
    return replaced;
  }

  public resize(newCols: number, newRows: number) {
    if (newCols <= 0 || newRows <= 0) return;
    const newMap = zeroMatrix(newRows, newCols);
    const newFlags = this.flags ? zeroMatrix(newRows, newCols) : null;
    const newTransform = this.transform ? zeroMatrix(newRows, newCols) : null;

    const copyR = Math.min(this.rows, newRows);
    const copyC = Math.min(this.cols, newCols);

    for (let r = 0; r < copyR; r++) {
      for (let c = 0; c < copyC; c++) {
        newMap[r][c] = this.map[r][c] || 0;
        if (newFlags && this.flags) newFlags[r][c] = this.flags[r][c] || 0;
        if (newTransform && this.transform) newTransform[r][c] = this.transform[r][c] || 0;
      }
    }

    this.cols = newCols;
    this.rows = newRows;
    this.map = newMap;
    this.flags = newFlags;
    this.transform = newTransform;
    this.width = this.cols * this.size;
    this.height = this.rows * this.size;
  }

  public toJSON(): TilemapDefinition {
    return {
      type: this.type,
      version: this.version,
      size: this.size,
      map: this.map,
      flags: this.flags,
      transform: this.transform,
      name: this.name,
    };
  }

  public exportJSON(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}

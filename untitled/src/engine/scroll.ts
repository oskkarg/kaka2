/**
 * Scroll.ts — DivGO compatible Scroll Engine for DIV-8 Fantasy Console
 * Handles parallax scrolling, multiscroll strip slicing (break_back_scroll),
 * camera tracking, and tilemap layer rendering.
 */

import { DivTilemap } from './tilemap';
import { ProcessInstance, Sprite } from './types';

export interface ScrollLayer {
  graph: number;
  graphObj: DivTilemap | Sprite | null;
  x: number;
  y: number;
  size_x: number;
  size_y: number;
  angle: number;
  alpha: number;
}

export interface MultiScrollDef {
  orientacion: number; // 0 = horizontal strips, 1 = vertical strips
  distancia: number[];
  velocidad: number[];
  trasladar: number[];
  total: number;
}

export class ScrollInstance {
  public id: number;
  public file: number | string;
  public region: number;
  public bloqueo: number;
  public active: boolean = true;

  public front: ScrollLayer;
  public half: ScrollLayer;
  public back: ScrollLayer;

  public z: number = 512;
  public camera: number | ProcessInstance | null = null;
  public ratio: number = 200; // Parallax ratio
  public speed: number = 0;

  public multiscroll: MultiScrollDef = {
    orientacion: 0,
    distancia: [],
    velocidad: [],
    trasladar: [],
    total: 0,
  };

  public posHalf = { x: 0, y: 0 };

  constructor(
    id: number,
    file: number | string = 0,
    frontGraphOrTilemap?: any,
    backGraph?: any,
    region: number = 0,
    bloqueo: number = 0
  ) {
    this.id = id;
    this.file = file;
    this.region = region;
    this.bloqueo = bloqueo | 0;

    this.front = this._createLayer();
    this.half = this._createLayer();
    this.back = this._createLayer();

    if (frontGraphOrTilemap !== undefined && frontGraphOrTilemap !== null) {
      this.setFront(frontGraphOrTilemap);
    }
    if (backGraph !== undefined && backGraph !== null) {
      this.setBack(backGraph);
    }
  }

  private _createLayer(): ScrollLayer {
    return {
      graph: 0,
      graphObj: null,
      x: 0,
      y: 0,
      size_x: 100,
      size_y: 100,
      angle: 0,
      alpha: 100,
    };
  }

  public setFront(graphOrTilemap: any) {
    if (DivTilemap.isTilemap(graphOrTilemap)) {
      this.front.graphObj = graphOrTilemap;
      this.front.graph = 0;
    } else if (typeof graphOrTilemap === 'number') {
      this.front.graph = graphOrTilemap;
      this.front.graphObj = null;
    }
  }

  public setBack(graph: any) {
    if (DivTilemap.isTilemap(graph)) {
      this.back.graphObj = graph;
      this.back.graph = 0;
    } else if (typeof graph === 'number') {
      this.back.graph = graph;
      this.back.graphObj = null;
    }
  }

  public setHalf(graph: any) {
    if (typeof graph === 'number') {
      this.half.graph = graph;
      this.half.graphObj = null;
    }
  }

  public breakBack(orientacion: number, distancias: number[], velocidades: number[]): number[] {
    const dCopy = Array.isArray(distancias) ? distancias.slice() : [];
    const vCopy = Array.isArray(velocidades) ? velocidades.slice() : [];

    this.multiscroll = {
      orientacion: orientacion | 0,
      distancia: dCopy,
      velocidad: dCopy.map((_, i) => (vCopy[i] !== undefined ? vCopy[i] : 1)),
      trasladar: new Array(dCopy.length).fill(0),
      total: dCopy.length,
    };

    return this.multiscroll.trasladar;
  }

  public static modulo(value: number, size: number): number {
    if (size <= 0) return 0;
    return ((value % size) + size) % size;
  }

  /**
   * Update camera position, parallax offsets and boundary locks
   */
  public update(processes: ProcessInstance[], buffW: number, buffH: number) {
    if (!this.active) return;

    // Follow camera process if assigned
    if (this.camera !== null && this.camera !== undefined) {
      let camProc: ProcessInstance | undefined;
      if (typeof this.camera === 'number') {
        const camId = this.camera;
        camProc = processes.find((p) => p.id === camId && p.alive);
      } else if (typeof this.camera === 'object' && 'x' in this.camera) {
        camProc = this.camera as ProcessInstance;
      }

      if (camProc) {
        this.front.x = camProc.x - buffW * 0.5;
        this.front.y = camProc.y - buffH * 0.5;
      }
    }

    // Parallax calculation
    const ratio = this.ratio || 200;
    this.back.x = Math.round(this.front.x / (ratio * 0.01));
    this.back.y = Math.round(this.front.y / (ratio * 0.01));

    this.posHalf.x = this.half.x + Math.round(this.front.x / (ratio * 0.0075));
    this.posHalf.y = this.half.y + Math.round(this.front.y / (ratio * 0.0075));

    // Bloqueo / world limit locks
    // 0 = lock X & Y inside world bounds (if tilemap)
    if (this.front.graphObj && DivTilemap.isTilemap(this.front.graphObj)) {
      const tm = this.front.graphObj as DivTilemap;
      const maxX = Math.max(0, tm.width - buffW);
      const maxY = Math.max(0, tm.height - buffH);

      switch (this.bloqueo) {
        case 0: // Lock both X and Y
          if (this.front.x < 0) this.front.x = 0;
          if (this.front.x > maxX) this.front.x = maxX;
          if (this.front.y < 0) this.front.y = 0;
          if (this.front.y > maxY) this.front.y = maxY;
          break;
        case 4: // Wrap X, lock Y
          if (this.front.y < 0) this.front.y = 0;
          if (this.front.y > maxY) this.front.y = maxY;
          break;
        case 8: // Lock X, wrap Y
          if (this.front.x < 0) this.front.x = 0;
          if (this.front.x > maxX) this.front.x = maxX;
          break;
      }
    }
  }
}

export class ScrollManager {
  public scrolls: (ScrollInstance | null)[] = new Array(10).fill(null);
  public tilemaps: Map<string, DivTilemap> = new Map();

  constructor() {
    this.reset();
  }

  public reset() {
    for (let i = 0; i < 10; i++) {
      this.scrolls[i] = null;
    }
  }

  public registerTilemap(name: string, tilemap: DivTilemap) {
    this.tilemaps.set(name, tilemap);
  }

  public getTilemap(name: string): DivTilemap | null {
    const tm = this.tilemaps.get(name);
    return tm ? tm.clone() : null;
  }

  public startScroll(
    id: number = 0,
    file: number | string = 0,
    frontGraphOrTilemap?: any,
    backGraph?: any,
    region: number = 0,
    bloqueo: number = 0
  ): ScrollInstance {
    const idx = Math.max(0, Math.min(9, id | 0));

    // Resolve tilemap name if string passed
    let resolvedFront = frontGraphOrTilemap;
    if (typeof frontGraphOrTilemap === 'string') {
      resolvedFront = this.getTilemap(frontGraphOrTilemap) || frontGraphOrTilemap;
    }

    const scroll = new ScrollInstance(idx, file, resolvedFront, backGraph, region, bloqueo);
    this.scrolls[idx] = scroll;
    return scroll;
  }

  public stopScroll(id: number = 0) {
    const idx = Math.max(0, Math.min(9, id | 0));
    if (this.scrolls[idx]) {
      this.scrolls[idx]!.active = false;
      this.scrolls[idx] = null;
    }
  }

  public breakBackScroll(
    id: number = 0,
    orientacion: number = 0,
    distancias: number[] = [],
    velocidades: number[] = []
  ): number[] {
    const idx = Math.max(0, Math.min(9, id | 0));
    const scroll = this.scrolls[idx];
    if (scroll) {
      return scroll.breakBack(orientacion, distancias, velocidades);
    }
    return [];
  }

  public updateAll(processes: ProcessInstance[], buffW: number, buffH: number) {
    for (let i = 0; i < 10; i++) {
      const scroll = this.scrolls[i];
      if (scroll && scroll.active) {
        scroll.update(processes, buffW, buffH);
      }
    }
  }

  public getPrimaryScroll(): ScrollInstance | null {
    for (let i = 0; i < 10; i++) {
      if (this.scrolls[i] && this.scrolls[i]!.active) {
        return this.scrolls[i];
      }
    }
    return null;
  }
}

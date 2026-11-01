/**
 * Hardware-Accelerated Pixi.js (v8) Renderer for DIV-8 Fantasy Console
 * High-performance GPU sprite batching, dynamic resolution (set_mode),
 * shape rendering, multiscroll parallax slicing (break_back_scroll), and tilemap layer rendering.
 * Optimized for thousands of concurrent processes at solid 60 FPS.
 */

import * as PIXI from 'pixi.js';
import { ProcessInstance, ShapeDrawCall, Sprite, TextDrawCall } from './types';
import { getSpriteCanvas } from './sprites';
import { getColorRgb } from './palette';
import { ScrollManager, ScrollInstance } from './scroll';
import { DivTilemap } from './tilemap';

const DEG_TO_RAD = 0.017453292519943295;

export class PixiRenderer {
  public app: PIXI.Application | null = null;
  public canvas: HTMLCanvasElement;
  public width: number;
  public height: number;

  // Pixi Containers & Layers
  private rootContainer: PIXI.Container | null = null;
  private bgGraphics: PIXI.Graphics | null = null;
  private scrollBackContainer: PIXI.Container | null = null;
  private scrollFrontContainer: PIXI.Container | null = null;
  private shapesGraphics: PIXI.Graphics | null = null;
  private spritesContainer: PIXI.Container | null = null;
  private textContainer: PIXI.Container | null = null;

  // High-performance Lookup Caches
  private textureCache: Map<number, PIXI.Texture> = new Map();
  private spriteMap: Map<number, Sprite> = new Map();
  private lastSpritesRef: Sprite[] | null = null;
  private stripTextureMap: Map<string, PIXI.Texture> = new Map();

  // Background state cache
  private lastBgColor: number = -1;
  private lastBgWidth: number = -1;
  private lastBgHeight: number = -1;
  private hasDrawnShapes: boolean = false;

  // Pre-allocated object pools
  private spritePool: PIXI.Sprite[] = [];
  private scrollBackPool: PIXI.Sprite[] = [];
  private scrollFrontPool: PIXI.Sprite[] = [];
  private textPool: PIXI.Text[] = [];

  public isReady: boolean = false;

  constructor(canvas: HTMLCanvasElement, width: number = 320, height: number = 240) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
  }

  /**
   * Asynchronous initialization of PixiJS v8 Application
   */
  public async init() {
    if (this.app) return;

    try {
      this.app = new PIXI.Application();
      await this.app.init({
        canvas: this.canvas,
        width: this.width,
        height: this.height,
        backgroundColor: 0x000000,
        antialias: false,
        roundPixels: true,
        resolution: 1,
        autoDensity: false,
        preference: 'webgl',
      });

      this.rootContainer = new PIXI.Container();
      this.app.stage.addChild(this.rootContainer);

      // 1. Background layer
      this.bgGraphics = new PIXI.Graphics();
      this.rootContainer.addChild(this.bgGraphics);

      // 1.5 Scroll Back layer (Parallax & Sliced backdrop)
      this.scrollBackContainer = new PIXI.Container();
      this.rootContainer.addChild(this.scrollBackContainer);

      // 1.8 Scroll Front layer (Tilemaps)
      this.scrollFrontContainer = new PIXI.Container();
      this.rootContainer.addChild(this.scrollFrontContainer);

      // 2. Shapes layer (boxes, lines, circles)
      this.shapesGraphics = new PIXI.Graphics();
      this.rootContainer.addChild(this.shapesGraphics);

      // 3. Sprites layer (processes)
      this.spritesContainer = new PIXI.Container();
      this.spritesContainer.sortableChildren = false;
      this.rootContainer.addChild(this.spritesContainer);

      // 4. Text HUD layer
      this.textContainer = new PIXI.Container();
      this.rootContainer.addChild(this.textContainer);

      this.isReady = true;
    } catch (err) {
      console.error('Error initializing Pixi.js:', err);
      this.isReady = false;
    }
  }

  /**
   * Set resolution dynamically (DIV set_mode)
   */
  public resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.lastBgWidth = -1;
    this.lastBgHeight = -1;
    if (this.app && this.app.renderer) {
      this.app.renderer.resize(width, height);
    }
  }

  private syncSpriteMap(sprites: Sprite[]) {
    if (this.lastSpritesRef === sprites) return;
    this.lastSpritesRef = sprites;
    this.spriteMap.clear();
    for (let i = 0; i < sprites.length; i++) {
      this.spriteMap.set(sprites[i].id, sprites[i]);
    }
  }

  public getTextureById(spriteId: number, sprites: Sprite[]): PIXI.Texture | null {
    let texture = this.textureCache.get(spriteId);
    if (texture) return texture;

    this.syncSpriteMap(sprites);
    const spriteDef = this.spriteMap.get(spriteId);
    if (!spriteDef) return null;

    const spriteCanvas = getSpriteCanvas(spriteDef);
    texture = PIXI.Texture.from(spriteCanvas);
    texture.source.scaleMode = 'nearest';
    this.textureCache.set(spriteId, texture);
    spriteDef._texture = texture;
    return texture;
  }

  public invalidateTexture(spriteId: number) {
    const tex = this.textureCache.get(spriteId);
    if (tex && tex.source) {
      tex.source.update();
    } else {
      this.textureCache.delete(spriteId);
    }
    // Also clear any strip texture derived from this sprite
    const prefix = `${spriteId}_`;
    for (const key of this.stripTextureMap.keys()) {
      if (key.startsWith(prefix)) {
        this.stripTextureMap.delete(key);
      }
    }
  }

  /**
   * Render single game frame using PixiJS GPU pipeline
   */
  public renderFrame(
    bgColorIndex: number,
    shapeCalls: ShapeDrawCall[],
    processes: ProcessInstance[],
    sprites: Sprite[],
    textCalls: TextDrawCall[],
    scrollManager?: ScrollManager
  ) {
    if (!this.app || !this.isReady) return;

    // 1. Background clear
    if (this.bgGraphics) {
      if (
        this.lastBgColor !== bgColorIndex ||
        this.lastBgWidth !== this.width ||
        this.lastBgHeight !== this.height
      ) {
        this.bgGraphics.clear();
        const [r, g, b] = getColorRgb(bgColorIndex);
        const hexNum = (r << 16) | (g << 8) | b;
        this.bgGraphics.rect(0, 0, this.width, this.height);
        this.bgGraphics.fill({ color: hexNum, alpha: 1.0 });

        this.lastBgColor = bgColorIndex;
        this.lastBgWidth = this.width;
        this.lastBgHeight = this.height;
      }
    }

    const primaryScroll = scrollManager?.getPrimaryScroll();
    let scrollOffX = 0;
    let scrollOffY = 0;
    if (primaryScroll) {
      scrollOffX = primaryScroll.front.x;
      scrollOffY = primaryScroll.front.y;
    }

    // 1.5 Render Scroll Back Layer (Multiscroll Slicing / Parallax Backdrop)
    if (this.scrollBackContainer) {
      let backPoolIdx = 0;

      if (primaryScroll && primaryScroll.back.graph > 0) {
        const bgTexture = this.getTextureById(primaryScroll.back.graph, sprites);
        if (bgTexture) {
          const bgW = bgTexture.width || 320;
          const bgH = bgTexture.height || 240;

          if (primaryScroll.multiscroll.total > 0) {
            // Sliced multiscroll (break_back_scroll)
            const orient = primaryScroll.multiscroll.orientacion;
            let acum = 0;

            for (let i = 0; i < primaryScroll.multiscroll.total; i++) {
              const dist = primaryScroll.multiscroll.distancia[i] || 0;
              const vel = primaryScroll.multiscroll.velocidad[i] || 1;
              const tras = primaryScroll.multiscroll.trasladar[i] || 0;
              if (dist <= 0) continue;

              if (orient === 0) {
                // Horizontal strips moving on X
                const movX = (-primaryScroll.back.x + tras) * (vel * 0.1);
                const startX = -ScrollInstance.modulo(-movX, bgW);

                const key = `${primaryScroll.back.graph}_h_${acum}_${dist}`;
                let stripTex = this.stripTextureMap.get(key);
                if (!stripTex && bgTexture.source) {
                  const frameY = Math.min(acum, Math.max(0, bgH - dist));
                  stripTex = new PIXI.Texture({
                    source: bgTexture.source,
                    frame: new PIXI.Rectangle(0, frameY, bgW, dist),
                  });
                  stripTex.source.scaleMode = 'nearest';
                  this.stripTextureMap.set(key, stripTex);
                }

                if (stripTex) {
                  let curX = startX;
                  while (curX < this.width) {
                    let s = this.scrollBackPool[backPoolIdx];
                    if (!s) {
                      s = new PIXI.Sprite(stripTex);
                      this.scrollBackPool.push(s);
                      this.scrollBackContainer.addChild(s);
                    } else {
                      s.texture = stripTex;
                      s.visible = true;
                    }
                    s.position.set(curX, acum);
                    s.anchor.set(0, 0);
                    backPoolIdx++;
                    curX += bgW;
                  }
                }
                acum += dist;
              } else {
                // Vertical strips moving on Y
                const movY = (-primaryScroll.back.y + tras) * (vel * 0.1);
                const startY = -ScrollInstance.modulo(-movY, bgH);

                const key = `${primaryScroll.back.graph}_v_${acum}_${dist}`;
                let stripTex = this.stripTextureMap.get(key);
                if (!stripTex && bgTexture.source) {
                  const frameX = Math.min(acum, Math.max(0, bgW - dist));
                  stripTex = new PIXI.Texture({
                    source: bgTexture.source,
                    frame: new PIXI.Rectangle(frameX, 0, dist, bgH),
                  });
                  stripTex.source.scaleMode = 'nearest';
                  this.stripTextureMap.set(key, stripTex);
                }

                if (stripTex) {
                  let curY = startY;
                  while (curY < this.height) {
                    let s = this.scrollBackPool[backPoolIdx];
                    if (!s) {
                      s = new PIXI.Sprite(stripTex);
                      this.scrollBackPool.push(s);
                      this.scrollBackContainer.addChild(s);
                    } else {
                      s.texture = stripTex;
                      s.visible = true;
                    }
                    s.position.set(acum, curY);
                    s.anchor.set(0, 0);
                    backPoolIdx++;
                    curY += bgH;
                  }
                }
                acum += dist;
              }
            }
          } else {
            // Full backdrop cyclical tiling
            const startX = -ScrollInstance.modulo(primaryScroll.back.x, bgW);
            const startY = -ScrollInstance.modulo(primaryScroll.back.y, bgH);

            for (let y = startY; y < this.height; y += bgH) {
              for (let x = startX; x < this.width; x += bgW) {
                let s = this.scrollBackPool[backPoolIdx];
                if (!s) {
                  s = new PIXI.Sprite(bgTexture);
                  this.scrollBackPool.push(s);
                  this.scrollBackContainer.addChild(s);
                } else {
                  s.texture = bgTexture;
                  s.visible = true;
                }
                s.position.set(x, y);
                s.anchor.set(0, 0);
                backPoolIdx++;
              }
            }
          }
        }
      }

      // Hide unused pooled back sprites
      for (let j = backPoolIdx; j < this.scrollBackPool.length; j++) {
        if (this.scrollBackPool[j].visible) {
          this.scrollBackPool[j].visible = false;
        }
      }
    }

    // 1.8 Render Scroll Front Layer (Tilemaps)
    if (this.scrollFrontContainer) {
      let frontPoolIdx = 0;

      if (primaryScroll && primaryScroll.front.graphObj && DivTilemap.isTilemap(primaryScroll.front.graphObj)) {
        const tm = primaryScroll.front.graphObj as DivTilemap;
        const tam = tm.size;

        const colStart = Math.max(0, Math.floor(primaryScroll.front.x / tam));
        const colEnd = Math.min(tm.cols, Math.ceil((primaryScroll.front.x + this.width) / tam));
        const rowStart = Math.max(0, Math.floor(primaryScroll.front.y / tam));
        const rowEnd = Math.min(tm.rows, Math.ceil((primaryScroll.front.y + this.height) / tam));

        for (let r = rowStart; r < rowEnd; r++) {
          const row = tm.map[r];
          if (!row) continue;
          for (let c = colStart; c < colEnd; c++) {
            const tileId = row[c];
            if (!tileId) continue;

            const tileTex = this.getTextureById(tileId, sprites);
            if (!tileTex) continue;

            let s = this.scrollFrontPool[frontPoolIdx];
            if (!s) {
              s = new PIXI.Sprite(tileTex);
              this.scrollFrontPool.push(s);
              this.scrollFrontContainer.addChild(s);
            } else {
              s.texture = tileTex;
              s.visible = true;
            }

            s.anchor.set(0, 0);
            const posX = c * tam - primaryScroll.front.x;
            const posY = r * tam - primaryScroll.front.y;

            // Handle transforms: flipX, flipY, alpha
            const tr = tm.transform && tm.transform[r] ? tm.transform[r][c] || 0 : 0;
            const flipX = (tr & 1) !== 0;
            const flipY = (tr & 2) !== 0;
            const halfAlpha = (tr & 4) !== 0;

            s.scale.set(flipX ? -1 : 1, flipY ? -1 : 1);
            s.position.set(flipX ? posX + tam : posX, flipY ? posY + tam : posY);
            s.alpha = halfAlpha ? 0.5 : 1.0;

            frontPoolIdx++;
          }
        }
      }

      // Hide unused pooled tilemap sprites
      for (let j = frontPoolIdx; j < this.scrollFrontPool.length; j++) {
        if (this.scrollFrontPool[j].visible) {
          this.scrollFrontPool[j].visible = false;
        }
      }
    }

    // 2. Shapes layer: only touch if shapes are requested or need clearing
    if (this.shapesGraphics) {
      if (shapeCalls.length > 0 || this.hasDrawnShapes) {
        this.shapesGraphics.clear();
        this.hasDrawnShapes = shapeCalls.length > 0;

        for (let i = 0; i < shapeCalls.length; i++) {
          const shape = shapeCalls[i];
          const [r, g, b] = getColorRgb(shape.color);
          const color = (r << 16) | (g << 8) | b;

          if (shape.type === 'box_fill') {
            this.shapesGraphics.rect(shape.x1, shape.y1, shape.x2, shape.y2);
            this.shapesGraphics.fill({ color, alpha: 1.0 });
          } else if (shape.type === 'box') {
            this.shapesGraphics.rect(shape.x1, shape.y1, shape.x2, shape.y2);
            this.shapesGraphics.stroke({ color, width: 1 });
          } else if (shape.type === 'circle_fill') {
            this.shapesGraphics.circle(shape.x1, shape.y1, shape.x2);
            this.shapesGraphics.fill({ color, alpha: 1.0 });
          } else if (shape.type === 'circle') {
            this.shapesGraphics.circle(shape.x1, shape.y1, shape.x2);
            this.shapesGraphics.stroke({ color, width: 1 });
          } else if (shape.type === 'line') {
            this.shapesGraphics.moveTo(shape.x1, shape.y1);
            this.shapesGraphics.lineTo(shape.x2, shape.y2);
            this.shapesGraphics.stroke({ color, width: 1 });
          } else if (shape.type === 'pixel') {
            this.shapesGraphics.rect(shape.x1, shape.y1, 1, 1);
            this.shapesGraphics.fill({ color, alpha: 1.0 });
          }
        }
      }
    }

    // 3. Hardware-Accelerated Process Sprites
    if (this.spritesContainer) {
      let spriteIdx = 0;
      let hasCustomZ = false;
      const procCount = processes.length;

      for (let i = 0; i < procCount; i++) {
        const proc = processes[i];
        if (!proc.alive || proc.graph <= 0) continue;

        const texture = this.getTextureById(proc.graph, sprites);
        if (!texture) continue;

        // Obtain or allocate pooled sprite
        let pixiSprite = this.spritePool[spriteIdx];
        if (!pixiSprite) {
          pixiSprite = new PIXI.Sprite(texture);
          pixiSprite.anchor.set(0.5, 0.5);
          this.spritePool.push(pixiSprite);
          this.spritesContainer.addChild(pixiSprite);
        } else {
          if (pixiSprite.texture !== texture) {
            pixiSprite.texture = texture;
          }
          if (!pixiSprite.visible) {
            pixiSprite.visible = true;
          }
        }

        // Direct position update with camera offset if ctype === 1 (c_scroll)
        let drawX = proc.x;
        let drawY = proc.y;
        if (proc.ctype === 1) {
          drawX -= scrollOffX;
          drawY -= scrollOffY;
        }
        pixiSprite.position.set(drawX, drawY);

        // Z-Index: avoid dirtying unless changed
        if (pixiSprite.zIndex !== proc.z) {
          pixiSprite.zIndex = proc.z;
        }
        if (proc.z !== 0) {
          hasCustomZ = true;
        }

        // Alpha: avoid dirtying unless changed
        if (pixiSprite.alpha !== proc.alpha) {
          pixiSprite.alpha = proc.alpha;
        }

        // Rotation: avoid recomputation if angle unchanged
        const targetRot = proc.angle * DEG_TO_RAD;
        if (pixiSprite.rotation !== targetRot) {
          pixiSprite.rotation = targetRot;
        }

        // Scale & Flags: avoid recomputation if unchanged
        const baseScale = proc.size * 0.01;
        const targetScaleX = (proc.flags & 1) !== 0 ? -baseScale : baseScale;
        const targetScaleY = (proc.flags & 2) !== 0 ? -baseScale : baseScale;

        if (pixiSprite.scale.x !== targetScaleX) {
          pixiSprite.scale.x = targetScaleX;
        }
        if (pixiSprite.scale.y !== targetScaleY) {
          pixiSprite.scale.y = targetScaleY;
        }

        spriteIdx++;
      }

      // Dynamically toggle container z-sorting only if non-zero z values exist
      if (this.spritesContainer.sortableChildren !== hasCustomZ) {
        this.spritesContainer.sortableChildren = hasCustomZ;
      }

      // Hide unused pooled sprites
      const poolLen = this.spritePool.length;
      for (let j = spriteIdx; j < poolLen; j++) {
        if (this.spritePool[j].visible) {
          this.spritePool[j].visible = false;
        }
      }
    }

    // 4. Text HUD Layer
    if (this.textContainer) {
      const callCount = textCalls.length;
      let textIdx = 0;

      for (let i = 0; i < callCount; i++) {
        const call = textCalls[i];
        const [r, g, b] = getColorRgb(call.color);
        const color = (r << 16) | (g << 8) | b;

        let pixiText = this.textPool[textIdx];
        if (!pixiText) {
          pixiText = new PIXI.Text({
            text: call.text,
            style: {
              fontFamily: 'monospace',
              fontSize: 8,
              fill: color,
              align: call.align,
            },
          });
          this.textPool.push(pixiText);
          this.textContainer.addChild(pixiText);
        } else {
          if (!pixiText.visible) pixiText.visible = true;
          if (pixiText.text !== call.text) pixiText.text = call.text;
          if (pixiText.style.fill !== color) pixiText.style.fill = color;
        }

        if (call.align === 'center') pixiText.anchor.set(0.5, 0);
        else if (call.align === 'right') pixiText.anchor.set(1, 0);
        else pixiText.anchor.set(0, 0);

        pixiText.position.set(call.x, call.y);
        textIdx++;
      }

      for (let j = textIdx; j < this.textPool.length; j++) {
        if (this.textPool[j].visible) {
          this.textPool[j].visible = false;
        }
      }
    }
  }

  public destroy() {
    this.isReady = false;
    this.textureCache.clear();
    this.stripTextureMap.clear();
    this.spritePool = [];
    this.scrollBackPool = [];
    this.scrollFrontPool = [];
    this.textPool = [];
    if (this.app) {
      try {
        this.app.destroy(true, { children: true, texture: false });
      } catch (e) {
        console.warn('Error destroying Pixi app:', e);
      }
      this.app = null;
    }
  }
}

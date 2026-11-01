
/**
 * Scroll.js — Scroll compatible con DIV Games Studio (DivGO).
 *
 * Estructura:
 *   scroll.front   → capa principal
 *   scroll.half    → capa intermedia
 *   scroll.back    → capa de fondo
 *
 * Las imágenes se dibujan mediante drawImage().
 * El mosaico cíclico se calcula explícitamente, sin CanvasPattern.
 *
 * API pública:
 *   new Scroll(id, file, frontGraph, backGraph, region, bloqueo)
 *   .update(process)
 *   .draw(ctx)
 *   .setHalf(graph)
 *   .refresh()
 *   .breakBack(orient, dist, vel)
 *   .getTile / .setTile / .changeTilemap / .changeTileValue
 *   static newTilemap(name)
 */

class Scroll {

    constructor(id, file, frontGraph, backGraph, region, bloqueo) {
        this.id = id;
        this.file = file;
        this.region = region;
        this.bloqueo = bloqueo | 0;

        const engine = window.engine;
		if (!engine) {
		throw new Error('[Scroll] Engine no está inicializado.');
		}
		const buffer = engine.getBuffer(region);
		
		this.buffW = buffer.width;
		this.buffH = buffer.height;
		this.ctx = engine.bufferContexts[region];

        this.front = this._newLayer(frontGraph);
        this.half = this._newLayer(0);
        this.back = this._newLayer(backGraph);

        this.z = 512;
        this.camera = null;
        this.ratio = 200;
        this.speed = 0;
        this.region1 = -1;
        this.region2 = -1;

        this.img0 = null;
        this.img1 = null;
        this.img2 = null;

        // Se mantienen por compatibilidad con código externo.
        // El dibujo ya no depende de CanvasPattern.
        this.pat0 = null;
        this.pat1 = null;
        this.pat2 = null;

        this.img0_w = 0;
        this.img0_h = 0;
        this.img1_w = 0;
        this.img1_h = 0;
        this.img2_w = 0;
        this.img2_h = 0;

        this.multiscroll = {
            orientacion: 0,
            distancia: [],
            velocidad: [],
            trasladar: [],
            total: 0
        };

        this.bloqueoX = 0;
        this.bloqueoY = 0;

        this.posHalf = { x: 0, y: 0 };

        this._loadLayerResource(this.front, frontGraph, 0);
        this._loadLayerResource(this.back, backGraph, 2);
    }

    // ─────────────────────────────────────────────────────────
    // CAPAS
    // ─────────────────────────────────────────────────────────

    _newLayer(graph) {
        return {
            graph: graph | 0,
            x: 0,
            y: 0,
            size_x: 100,
            size_y: 100,
            angle: 0,
            alpha: 100,
            blur: 0,
            grayscale: 0,
            sepia: 0,
            saturate: 0,
            invert: 0,
            tone: 0,
            brightness: 0
        };
    }

    _isTilemap(value) {
        if (typeof Tilemap !== 'undefined' && Tilemap.isTilemap) {
            return Tilemap.isTilemap(value);
        }
        return typeof value === 'object' && value !== null &&
            (value.type === 'DivGOtilemap' ||
             value.type === 'RGl2R090aWxlbWFw');
    }

    /**
     * Resuelve un nombre de tilemap ("0030", "mapas/nivel1", ...) a su
     * definición registrada. Devuelve null si no existe.
     */
    _resolveTilemap(value) {
        if (this._isTilemap(value)) return value;

        if (typeof value === 'string' && typeof Assets !== 'undefined' &&
            Assets.getTilemap) {
            return Assets.getTilemap(value);
        }

        return null;
    }

    _loadLayerResource(layer, graph, which) {
        if (!graph) return;

        const tilemap = this._resolveTilemap(graph);
        if (tilemap) {
            layer.graphObj = tilemap;
            this._setImage(layer, tilemap, which);
            return;
        }

        if (typeof graph === 'string') {
            console.warn('[Scroll] tilemap no encontrado:', graph);
            return;
        }

        const img = Assets.resolve(this.file, graph);

        if (!img) {
            console.warn('[Scroll] gráfico no encontrado:', this.file, graph);
            return;
        }

        layer.graphObj = img;
        this._setImage(layer, img, which);
    }

    _setImage(layer, img, which) {
        const isTilemap = this._isTilemap(img);

        layer.graphObj = img;

        const width = isTilemap
            ? img.width
            : (img.naturalWidth || img.width);

        const height = isTilemap
            ? img.height
            : (img.naturalHeight || img.height);

        if (which === 0) {
            this.img0 = img;
            this.img0_w = width;
            this.img0_h = height;
            this.pat0 = null;
        } else if (which === 1) {
            this.img1 = img;
            this.img1_w = width;
            this.img1_h = height;
            this.pat1 = null;
        } else if (which === 2) {
            this.img2 = img;
            this.img2_w = width;
            this.img2_h = height;
            this.pat2 = null;
        }
    }

    // ─────────────────────────────────────────────────────────
    // MATEMÁTICAS DEL MOSAICO
    // ─────────────────────────────────────────────────────────

    static modulo(value, size) {
        if (size <= 0) return 0;
        return ((value % size) + size) % size;
    }

    /**
     * Dibuja una imagen repetida por toda la región visible.
     *
     * px/py representan la posición de cámara en coordenadas
     * del mundo. El origen del primer gráfico será:
     *
     *   x = -modulo(px, ancho)
     *   y = -modulo(py, alto)
     *
     * clip permite utilizar el mismo dibujo para las franjas
     * del multiscroll.
     */
    _paintImage(ctx, img, layer, px, py,
                clipX, clipY, clipW, clipH) {

        if (!img) return;

        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) return;

        const blur = Math.max(0, (layer.blur || 0) * 0.4);

        if (clipX === undefined) clipX = 0;
        if (clipY === undefined) clipY = 0;
        if (clipW === undefined) clipW = this.buffW;
        if (clipH === undefined) clipH = this.buffH;

        if (clipW <= 0 || clipH <= 0) return;

        const left = clipX - blur;
        const top = clipY - blur;
        const right = clipX + clipW + blur;
        const bottom = clipY + clipH + blur;

        // Origen cíclico correcto.
        let startX = -Scroll.modulo(px, width);
        let startY = -Scroll.modulo(py, height);

        // Retroceder hasta cubrir también el borde izquierdo
        // y el borde superior del área de recorte.
        startX += Math.floor((left - startX) / width) * width;
        startY += Math.floor((top - startY) / height) * height;

        ctx.save();

        ctx.beginPath();
        ctx.rect(left, top, right - left, bottom - top);
        ctx.clip();

        this._applyFilters(ctx, layer);

        for (let y = startY; y < bottom; y += height) {
            for (let x = startX; x < right; x += width) {
                ctx.drawImage(img, x, y);
            }
        }

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────
    // ACTUALIZACIÓN
    // ─────────────────────────────────────────────────────────

    update(process) {
        const datos = this;

        if (process.ctype !== 1) return;

        process.DivGO = process.DivGO || {};
        process.DivGO.mueveX = process.DivGO.mueveX || [];
        process.DivGO.mueveY = process.DivGO.mueveY || [];

        process.DivGO.mueveX[this.id] = process.x;
        process.DivGO.mueveY[this.id] = process.y;

        const isCamera = (
            this.camera === process ||
            this.camera === process.id
        );

        if (isCamera) {
            process.DivGO.mueveX[this.id] -= this.buffW * 0.5;
            process.DivGO.mueveY[this.id] -= this.buffH * 0.5;

            datos.front.x = process.DivGO.mueveX[this.id];
            datos.front.y = process.DivGO.mueveY[this.id];

            if (this.bloqueoX === 0) {
                process.DivGO.mueveX[this.id] = this.buffW * 0.5;
            }

            if (this.bloqueoX === 1) {
                process.DivGO.mueveX[this.id] +=
                    this.buffW * 0.5 - (this.img0_w - this.buffW);
            }

            if (this.bloqueoX === 2) {
                process.DivGO.mueveX[this.id] += this.buffW * 0.5;
            }

            if (this.bloqueoY === 0) {
                process.DivGO.mueveY[this.id] = this.buffH * 0.5;
            }

            if (this.bloqueoY === 1) {
                process.DivGO.mueveY[this.id] +=
                    this.buffH * 0.5 - (this.img0_h - this.buffH);
            }

            if (this.bloqueoY === 2) {
                process.DivGO.mueveY[this.id] += this.buffH * 0.5;
            }

        } else {
            process.DivGO.mueveX[this.id] -= datos.front.x;
            process.DivGO.mueveY[this.id] -= datos.front.y;

            if (this.bloqueoX === 1) {
                process.DivGO.mueveX[this.id] =
                    process.x - (this.img0_w - this.buffW);
            }

            if (this.bloqueoY === 1) {
                process.DivGO.mueveY[this.id] =
                    process.y - (this.img0_h - this.buffH);
            }
        }

        this.bloqueoX = 0;
        this.bloqueoY = 0;

        // ── Límites de cámara ─────────────────────────────────

        switch (this.bloqueo) {

            case 0:
            case 4:
            case 8:
            case 12:

                if (this.img0_w >= this.buffW) {
                    if (datos.front.x >= this.img0_w - this.buffW) {
                        datos.front.x = this.img0_w - this.buffW;
                        this.bloqueoX = 1;
                    }

                    if (datos.front.x <= 0) {
                        datos.front.x = 0;
                        this.bloqueoX = 2;
                    }
                }

                if (this.img0_h >= this.buffH) {
                    if (datos.front.y >= this.img0_h - this.buffH) {
                        datos.front.y = this.img0_h - this.buffH;
                        this.bloqueoY = 1;
                    }

                    if (datos.front.y <= 0) {
                        datos.front.y = 0;
                        this.bloqueoY = 2;
                    }
                }
                break;

            case 1:
            case 5:
            case 9:
            case 13:

                if (this.img0_h >= this.buffH) {
                    if (datos.front.y >= this.img0_h - this.buffH) {
                        datos.front.y = this.img0_h - this.buffH;
                        this.bloqueoY = 1;
                    }

                    if (datos.front.y <= 0) {
                        datos.front.y = 0;
                        this.bloqueoY = 2;
                    }
                }
                break;

            case 2:
            case 6:
            case 10:
            case 14:

                if (this.img0_w >= this.buffW) {
                    if (datos.front.x >= this.img0_w - this.buffW) {
                        datos.front.x = this.img0_w - this.buffW;
                        this.bloqueoX = 1;
                    }

                    if (datos.front.x <= 0) {
                        datos.front.x = 0;
                        this.bloqueoX = 2;
                    }
                }
                break;
        }

        // ── Parallax ──────────────────────────────────────────

      if (this.camera !== null && this.camera !== undefined) {
			const ratio = this.ratio || 1;

			datos.back.x = Math.round(datos.front.x / (ratio * 0.01));
			datos.back.y = Math.round(datos.front.y / (ratio * 0.01));

			this.posHalf.x = datos.half.x +
			Math.round(datos.front.x / (ratio * 0.0075));

			this.posHalf.y = datos.half.y +
			Math.round(datos.front.y / (ratio * 0.0075));

		} else {
			this.posHalf.x = datos.half.x;
			this.posHalf.y = datos.half.y;
		}

        // ── Límites de la capa back ───────────────────────────

        switch (this.bloqueo) {

            case 0:
            case 1:
            case 2:
            case 3:

                if (this.img2_w >= this.buffW) {
                    if (datos.back.x >= this.img2_w - this.buffW) {
                        datos.back.x = this.img2_w - this.buffW;
                    }

                    if (datos.back.x <= 0) datos.back.x = 0;
                }

                if (this.img2_h >= this.buffH) {
                    if (datos.back.y >= this.img2_h - this.buffH) {
                        datos.back.y = this.img2_h - this.buffH;
                    }

                    if (datos.back.y <= 0) datos.back.y = 0;
                }
                break;

            case 4:
            case 5:
            case 6:
            case 7:

                if (this.img2_h >= this.buffH) {
                    if (datos.back.y >= this.img2_h - this.buffH) {
                        datos.back.y = this.img2_h - this.buffH;
                    }

                    if (datos.back.y <= 0) datos.back.y = 0;
                }
                break;

            case 8:
            case 9:
            case 10:
            case 11:

                if (this.img2_w >= this.buffW) {
                    if (datos.back.x >= this.img2_w - this.buffW) {
                        datos.back.x = this.img2_w - this.buffW;
                    }

                    if (datos.back.x <= 0) datos.back.x = 0;
                }
                break;
        }
    }

    // ─────────────────────────────────────────────────────────
    // DIBUJO
    // ─────────────────────────────────────────────────────────

    draw(ctx) {

        // Fondo.
        if (this.img2 && !this._isTilemap(this.img2)) {
            this._paintBack(ctx);
        }

        // Capa intermedia.
        if (this.img1 && !this._isTilemap(this.img1)) {
            this._paintLayer(
                ctx,
                this.img1,
                this.half,
                this.posHalf.x,
                this.posHalf.y
            );
        }

        // Capa frontal.
        if (this.img0) {
            if (this._isTilemap(this.img0)) {
                this._paintTilemap(ctx);
            } else {
                this._paintLayer(
                    ctx,
                    this.img0,
                    this.front,
                    this.front.x,
                    this.front.y
                );
            }
        }
    }

    _paintLayer(ctx, img, layer, px, py) {
        this._paintImage(ctx, img, layer, px, py);
    }

    // ─────────────────────────────────────────────────────────
    // MULTISCROLL
    // ─────────────────────────────────────────────────────────

    _paintBack(ctx) {
        const layer = this.back;

        if (this.multiscroll.total <= 0) {
            this._paintImage(
                ctx,
                this.img2,
                layer,
                layer.x,
                layer.y
            );
            return;
        }

        const total = this.multiscroll.total;
        const orientacion = this.multiscroll.orientacion;

        let acum = 0;

        for (let i = 0; i < total; i++) {
            const distancia = Math.max(
                0,
                this.multiscroll.distancia[i] || 0
            );

            const velocidad = this.multiscroll.velocidad[i] || 1;
            const trasladar = this.multiscroll.trasladar[i] || 0;

            if (distancia <= 0) continue;

            if (orientacion === 0) {
                // Franjas horizontales: cada una desplaza X.
                const movimientoX =
                    (-layer.x + trasladar) * (velocidad * 0.1);

                this._paintImage(
                    ctx,
                    this.img2,
                    layer,
                    -movimientoX,
                    layer.y,
                    0,
                    acum,
                    this.buffW,
                    distancia
                );

            } else {
                // Franjas verticales: cada una desplaza Y.
                const movimientoY =
                    (-layer.y + trasladar) * (velocidad * 0.1);

                this._paintImage(
                    ctx,
                    this.img2,
                    layer,
                    layer.x,
                    -movimientoY,
                    acum,
                    0,
                    distancia,
                    this.buffH
                );
            }

            acum += distancia;
        }

        // La zona restante conserva el movimiento normal.
        if (orientacion === 0 && acum < this.buffH) {
            this._paintImage(
                ctx,
                this.img2,
                layer,
                layer.x,
                layer.y,
                0,
                acum,
                this.buffW,
                this.buffH - acum
            );
        }

        if (orientacion !== 0 && acum < this.buffW) {
            this._paintImage(
                ctx,
                this.img2,
                layer,
                layer.x,
                layer.y,
                acum,
                0,
                this.buffW - acum,
                this.buffH
            );
        }
    }

    // ─────────────────────────────────────────────────────────
    // TILEMAP
    // ─────────────────────────────────────────────────────────

    _paintTilemap(ctx) {
        const tilemap = this.img0;

        if (!tilemap || !tilemap.map || tilemap.size <= 0) return;

        const tam = tilemap.size;
        const filas = tilemap.map.length;

        if (filas <= 0 || !tilemap.map[0]) return;

        const columnas = tilemap.map[0].length;

        const filaIni = Math.max(
            0,
            Math.floor(this.front.y / tam)
        );

        const filaFin = Math.min(
            filas,
            Math.ceil((this.front.y + this.buffH) / tam)
        );

        const colIni = Math.max(
            0,
            Math.floor(this.front.x / tam)
        );

        const colFin = Math.min(
            columnas,
            Math.ceil((this.front.x + this.buffW) / tam)
        );

        ctx.save();

        ctx.beginPath();
        ctx.rect(0, 0, this.buffW, this.buffH);
        ctx.clip();

        ctx.translate(-this.front.x, -this.front.y);
        this._applyFilters(ctx, this.front);

        const transform = tilemap.transform;

        for (let fila = filaIni; fila < filaFin; fila++) {
            const row = tilemap.map[fila];
            if (!row) continue;

            for (let col = colIni; col < colFin; col++) {
                const idTile = row[col];
                if (!idTile) continue;

                const img = Assets.resolve(this.file, idTile);
                if (!img) continue;

                // v2: `transform` contiene los giros y el alpha.
                // En mapas antiguos ya migrados también se usa esta matriz.
                const tr = transform && transform[fila]
                    ? (transform[fila][col] || 0)
                    : 0;

                const flipX = (tr & 1) !== 0;
                const flipY = (tr & 2) !== 0;
                const halfAlpha = (tr & 4) !== 0;

                ctx.save();

                ctx.translate(col * tam, fila * tam);

                if (halfAlpha) {
                    ctx.globalAlpha *= 0.5;
                }

                if (flipX || flipY) {
                    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                }

                ctx.drawImage(
                    img,
                    flipX ? -tam : 0,
                    flipY ? -tam : 0,
                    tam,
                    tam
                );

                ctx.restore();
            }
        }

        ctx.restore();
    }

    _applyFilters(ctx, layer) {
        ctx.globalAlpha =
            (layer.alpha != null ? layer.alpha : 100) * 0.01;

        let filter = '';

        if (layer.blur > 0) {
            filter += `blur(${layer.blur * 0.2}px) `;
        }

        if (layer.grayscale > 0) {
            filter += `grayscale(${layer.grayscale}%) `;
        }

        if (layer.sepia > 0) {
            filter += `sepia(${layer.sepia}%) `;
        }

        if (layer.saturate > 0) {
            filter += `saturate(${layer.saturate}%) `;
        }

        if (layer.invert > 0) {
            filter += `invert(${layer.invert}%) `;
        }

        if (layer.tone !== 0) {
            filter += `hue-rotate(${layer.tone * 3.6}deg) `;
        }

        if (layer.brightness !== 0) {
            filter += `brightness(${layer.brightness + 100}%) `;
        }

        ctx.filter = filter || 'none';
    }

    // ─────────────────────────────────────────────────────────
    // API PÚBLICA
    // ─────────────────────────────────────────────────────────

    setHalf(graph) {
        if (!graph) return;

        const img = Assets.resolve(this.file, graph);
        if (!img) return;

        this._setImage(this.half, img, 1);
    }

    refresh() {
        // No se necesitan CanvasPattern.
        // Las imágenes se dibujan directamente con drawImage().
        this.pat0 = null;
        this.pat1 = null;
        this.pat2 = null;
    }

    breakBack(orientacion, distancias, velocidades) {
        if (!this.img2) return;

        this.multiscroll = {
            orientacion: orientacion | 0,
            distancia: distancias.slice(),
            velocidad: distancias.map((_, i) =>
                velocidades[i] || 1
            ),
            trasladar: new Array(distancias.length).fill(0),
            total: distancias.length
        };

        return this.multiscroll.trasladar;
    }

    // ─────────────────────────────────────────────────────────
    // TILEMAP: MÉTODOS ESTÁTICOS
    // ─────────────────────────────────────────────────────────

    /**
     * Crea una instancia INDEPENDIENTE del tilemap registrado.
     * Las matrices se copian en profundidad: modificar la instancia no
     * altera el recurso original cargado desde el .tmap.
     */
    static newTilemap(nombre) {
        const origen = Assets.getTilemap
            ? Assets.getTilemap(nombre)
            : (Assets.tilemaps && Assets.tilemaps.get(nombre));

        if (!origen) {
            console.warn('[Scroll.newTilemap] tilemap no encontrado:', nombre);
            return null;
        }

        const label = (typeof nombre === 'string')
            ? nombre.split('/').pop().replace(/\.tmap$/i, '')
            : origen.name;

        return Tilemap.clone(origen, label);
    }

    static getTile(tilemap, x, y) {
        return Tilemap.getTile(tilemap, x, y);
    }

    static setTile(tilemap, x, y, idTile) {
        return Tilemap.setTile(tilemap, x, y, idTile);
    }

    static getTileFlags(tilemap, x, y) {
        return Tilemap.getFlags(tilemap, x, y);
    }

    static setTileFlags(tilemap, x, y, value) {
        return Tilemap.setFlags(tilemap, x, y, value);
    }

    static getTileTransform(tilemap, x, y) {
        return Tilemap.getTransform(tilemap, x, y);
    }

    static setTileTransform(tilemap, x, y, value) {
        return Tilemap.setTransform(tilemap, x, y, value);
    }

    static tileHasFlag(tilemap, x, y, bit) {
        return Tilemap.hasFlag(tilemap, x, y, bit);
    }

    changeTilemap(nombre) {
        const tilemap = Scroll.newTilemap(nombre);
        if (!tilemap) return 0;

        this.img0 = tilemap;
        this.img0_w = tilemap.width;
        this.img0_h = tilemap.height;
        this.front.graphObj = tilemap;

        return tilemap;
    }

    static changeTileValue(tilemap, idAntiguo, idNuevo) {
        return Tilemap.changeTileValue(tilemap, idAntiguo, idNuevo);
    }
}

if (typeof window !== 'undefined') {
    window.Scroll = Scroll;
}

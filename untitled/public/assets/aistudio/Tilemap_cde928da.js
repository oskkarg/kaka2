/**
 * Tilemap.js — Sistema de tilemaps de DivGO (formato v2).
 *
 * Un tilemap separa tres conceptos que el formato antiguo mezclaba:
 *
 *   map[fila][col]        → id de gráfico del FPG (qué se dibuja)
 *   flags[fila][col]      → máscara de bits de gameplay (qué hace)
 *   transform[fila][col]  → transformación visual (giros / alpha)
 *
 * Formato de archivo .tmap (JSON legible, versión 2):
 *
 *   {
 *     "type": "DivGOtilemap",
 *     "version": 2,
 *     "size": 16,
 *     "map":       [[1, 2], [3, 4]],
 *     "flags":     [[1, 0], [0, 128]],
 *     "transform": [[0, 0], [0, 1]]
 *   }
 *
 * `flags` y `transform` son opcionales. Si se omiten, se asume 0.
 *
 * Compatibilidad: también se aceptan los .tmap antiguos, que contenían
 * JSON codificado en Base64 y usaban `flags` para las transformaciones
 * visuales (0 = normal, 1 = flip H, ... 7 = flip HV + alpha).
 * Al cargarlos se mueven esos valores a `transform` y `flags` queda a 0.
 *
 * REGLA CLAVE (v2):
 *   - Si el .tmap declara "version": 2  → SIEMPRE se interpreta como v2,
 *     venga en JSON plano o en Base64. `flags` es máscara de gameplay.
 *   - Si no declara `version`:
 *       · JSON plano  → se asume v2 (formato nuevo documentado).
 *       · Base64      → se asume v1 (archivo antiguo) y `flags` pasa a
 *                       `transform`.
 */

(function (global) {
    'use strict';

    const TYPE = 'DivGOtilemap';

    // btoa('DivGOtilemap'): tipo tal y como aparece en los .tmap antiguos.
    const TYPE_LEGACY_B64 = 'RGl2R090aWxlbWFw';

    const VERSION = 2;
    const MAX_SIZE = 512;

    // ── Propiedades de gameplay (máscara de bits) ────────────────
    // Son valores por defecto. Cada juego puede reinterpretarlos:
    // el motor sólo ofrece lectura/escritura genérica de bits.
    const FLAG = Object.freeze({
        SOLID:       1,    // bit 0
        PLATFORM:    2,    // bit 1 (plataforma atravesable)
        WATER:       4,    // bit 2
        HAZARD:      8,    // bit 3 (daño)
        LADDER:      16,   // bit 4
        DESTRUCTIBLE:32,   // bit 5
        INTERACTIVE: 64,   // bit 6
        WALL:        128   // bit 7 (propiedad personalizada)
    });

    // ── Transformaciones visuales (0..7) ─────────────────────────
    const TRANSFORM = Object.freeze({
        NONE:          0,
        FLIP_H:        1,
        FLIP_V:        2,
        FLIP_HV:       3,
        ALPHA:         4,
        ALPHA_FLIP_H:  5,
        ALPHA_FLIP_V:  6,
        ALPHA_FLIP_HV: 7
    });

    function isObject(v) {
        return v !== null && typeof v === 'object';
    }

    function isTilemap(v) {
        return isObject(v) &&
            (v.type === TYPE || v.type === TYPE_LEGACY_B64) &&
            Array.isArray(v.map);
    }

    function fail(message) {
        throw new Error('[Tilemap] ' + message);
    }

    /**
     * Convierte un valor a entero de forma estricta.
     *
     * Acepta:
     *   - número entero  → se devuelve tal cual.
     *   - string numérico ("16", " 16 ", "-3") → se convierte.
     *
     * Rechaza:
     *   - cadenas vacías o no numéricas ("16px", "", " ").
     *   - números no enteros (16.8).
     *   - NaN, Infinity, valores no seguros.
     */
    function toInt(value, name) {
        const n = (typeof value === 'string' && value.trim() !== '')
            ? Number(value)
            : value;

        if (!Number.isSafeInteger(n)) {
            fail(name + ' debe ser un número entero');
        }

        return n;
    }

    // ─────────────────────────────────────────────────────────────
    // LECTURA DE ARCHIVO
    // ─────────────────────────────────────────────────────────────

    /**
     * Decodifica el texto de un .tmap.
     *
     * Devuelve { data, fromBase64 }.
     *   - fromBase64 = true  → el archivo venía codificado en Base64.
     *   - fromBase64 = false → el archivo era JSON plano.
     *
     * OJO: `fromBase64` NO implica "esquema v1". Un archivo Base64
     * puede contener un JSON con "version": 2 perfectamente válido.
     * Es `normalize()` quien decide el esquema, mirando `version`.
     */
    function decode(text) {
        if (typeof text !== 'string') fail('el contenido del .tmap no es texto');

        let src = text.replace(/^\uFEFF/, '').trim();
        if (src.length === 0) fail('el archivo .tmap está vacío');

        // JSON legible (formato nuevo).
        if (src[0] === '{' || src[0] === '[') {
            let data;
            try {
                data = JSON.parse(src);
            } catch (e) {
                fail('JSON inválido: ' + e.message);
            }
            return { data, fromBase64: false };
        }

        // Base64 (formato antiguo o exportadores que codificaban).
        let binary;
        try {
            binary = global.atob
                ? global.atob(src)
                : Buffer.from(src, 'base64').toString('binary');
        } catch (e) {
            fail('el archivo no es JSON ni Base64 válido');
        }

        // 1) Base64 de UTF-8.
        let decoded;
        try {
            if (typeof global.TextDecoder !== 'undefined' &&
                typeof global.Uint8Array !== 'undefined') {
                const bytes = new global.Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                decoded = new global.TextDecoder('utf-8').decode(bytes);
            } else {
                decoded = binary;
            }
        } catch (e) {
            decoded = binary;
        }

        // 2) Algunos exportadores aplicaban encodeURIComponent antes de btoa.
        const candidates = [decoded];
        try { candidates.push(decodeURIComponent(decoded)); } catch (e) { /* ignorar */ }

        for (const candidate of candidates) {
            try {
                return { data: JSON.parse(candidate), fromBase64: true };
            } catch (e) { /* probar el siguiente */ }
        }

        fail('Base64 decodificado, pero el contenido no es JSON válido');
    }

    // ─────────────────────────────────────────────────────────────
    // NORMALIZACIÓN / VALIDACIÓN
    // ─────────────────────────────────────────────────────────────

    function copyMatrix(rows) {
        return rows.map(row => Array.isArray(row) ? row.slice() : []);
    }

    function isEmptyMatrix(rows) {
        if (!rows) return true;
        for (let f = 0; f < rows.length; f++) {
            const row = rows[f];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                if (row[c]) return false;
            }
        }
        return true;
    }

    function zeroMatrix(rows, cols) {
        const out = new Array(rows);
        for (let f = 0; f < rows; f++) out[f] = new Array(cols).fill(0);
        return out;
    }

    function normalizeMatrix(name, source, cols, rows, maxValue) {
        if (source === undefined || source === null) return null;
        if (!Array.isArray(source)) fail(name + ' debe ser una matriz');

        const out = new Array(rows);

        for (let f = 0; f < rows; f++) {
            const row = source[f];
            const outRow = new Array(cols).fill(0);

            if (Array.isArray(row)) {
                for (let c = 0; c < cols; c++) {
                    if (row[c] === undefined || row[c] === null) continue;
                    const value = toInt(row[c], name + '[' + f + '][' + c + ']');
                    if (value < 0 || value > maxValue) {
                        fail(name + '[' + f + '][' + c + '] fuera de rango (0..' + maxValue + ')');
                    }
                    outRow[c] = value;
                }
            }

            out[f] = outRow;
        }

        return out;
    }

    /**
     * Convierte cualquier definición en un tilemap v2 validado.
     *
     * @param {object} raw     definición leída de JSON
     * @param {object} [opts]  { fromBase64:boolean, name:string }
     */
    function normalize(raw, opts) {
        opts = opts || {};

        if (!isObject(raw)) fail('la definición no es un objeto');

        if (raw.type !== TYPE && raw.type !== TYPE_LEGACY_B64) {
            fail('type debe ser "' + TYPE + '"');
        }

        // ── Decisión del esquema ─────────────────────────────────
        //
        // Solo miramos `version`, NO la codificación.
        //
        //   · "version": 2     → v2 (siempre, venga como venga).
        //   · sin "version":
        //       - JSON plano   → v2 (formato nuevo).
        //       - Base64       → v1 (archivo antiguo → migrar).
        //
        const hasVersion = raw.version !== undefined && raw.version !== null;

        const legacy = !hasVersion && (
            opts.fromBase64 === true ||
            raw.type === TYPE_LEGACY_B64
        );

        let version;
        if (!hasVersion) {
            version = legacy ? 1 : VERSION;
        } else {
            version = toInt(raw.version, 'version');
            if (version < 1) fail('version inválida: ' + version);
            if (version > VERSION) {
                fail('version ' + version + ' no soportada (máximo ' + VERSION + ')');
            }
        }

        const size = toInt(raw.size, 'size');
        if (size <= 0 || size > MAX_SIZE) {
            fail('size debe ser un entero entre 1 y ' + MAX_SIZE);
        }

        if (!Array.isArray(raw.map) || raw.map.length === 0) {
            fail('map debe ser una matriz no vacía');
        }

        const rows = raw.map.length;
        let cols = 0;
        for (let f = 0; f < rows; f++) {
            if (Array.isArray(raw.map[f]) && raw.map[f].length > cols) {
                cols = raw.map[f].length;
            }
        }
        if (cols <= 0) fail('map no contiene ninguna columna');

        const map = normalizeMatrix('map', raw.map, cols, rows, 65535);

        let flags = null;
        let transform = null;

        if (legacy || version < 2) {
            // v1: `flags` eran transformaciones visuales (0..7).
            transform = normalizeMatrix('flags', raw.flags, cols, rows, 7);
            flags = null;
        } else {
            // v2: `flags` es máscara de gameplay (0..255) y
            //     `transform` es transformación visual (0..7).
            flags = normalizeMatrix('flags', raw.flags, cols, rows, 255);
            transform = normalizeMatrix('transform', raw.transform, cols, rows, 7);
        }

        const tm = {
            type: TYPE,
            version: VERSION,
            size,
            map,
            flags: flags,
            transform: transform
        };

        if (opts.name) tm.name = String(opts.name);

        tm.cols = cols;
        tm.rows = rows;
        tm.width = cols * size;
        tm.height = rows * size;

        return tm;
    }

    /** Parsea el texto de un .tmap y devuelve el tilemap normalizado. */
    function parse(text, name) {
        const decoded = decode(text);
        return normalize(decoded.data, {
            fromBase64: decoded.fromBase64,
            name
        });
    }

    /** Crea un tilemap v2 desde una definición de objeto. */
    function create(definition, name) {
        return normalize(definition, { fromBase64: false, name });
    }

    /** Copia profunda de un tilemap (map/flags/transform independientes). */
    function clone(tilemap, name) {
        if (!isTilemap(tilemap)) return null;

        const copy = {
            type: TYPE,
            version: VERSION,
            size: tilemap.size | 0,
            map: copyMatrix(tilemap.map),
            flags: tilemap.flags ? copyMatrix(tilemap.flags) : null,
            transform: tilemap.transform ? copyMatrix(tilemap.transform) : null
        };

        const label = name || tilemap.name;
        if (label) copy.name = String(label);

        copy.cols = copy.map[0] ? copy.map[0].length : 0;
        copy.rows = copy.map.length;
        copy.width = copy.cols * copy.size;
        copy.height = copy.rows * copy.size;

        return copy;
    }

    // ─────────────────────────────────────────────────────────────
    // CONSULTA / MODIFICACIÓN
    // ─────────────────────────────────────────────────────────────

    function cellCoords(tilemap, x, y) {
        if (!tilemap || tilemap.size <= 0) return null;
        const col = Math.floor(x / tilemap.size);
        const row = Math.floor(y / tilemap.size);
        return { col, row };
    }

    function inBounds(tilemap, col, row) {
        return row >= 0 && row < tilemap.map.length &&
               col >= 0 && col < tilemap.map[row].length;
    }

    function ensureMatrix(tilemap, key) {
        if (!tilemap) return null;
        if (tilemap[key]) return tilemap[key];

        const rows = tilemap.map.length;
        const cols = tilemap.map[0] ? tilemap.map[0].length : 0;
        tilemap[key] = zeroMatrix(rows, cols);
        return tilemap[key];
    }

    function getTile(tilemap, x, y) {
        const pos = cellCoords(tilemap, x, y);
        if (!pos || !inBounds(tilemap, pos.col, pos.row)) return 0;
        return tilemap.map[pos.row][pos.col] || 0;
    }

    function setTile(tilemap, x, y, idTile) {
        const pos = cellCoords(tilemap, x, y);
        if (!pos || !inBounds(tilemap, pos.col, pos.row)) return 0;
        tilemap.map[pos.row][pos.col] = idTile | 0;
        return 1;
    }

    function getTileByCell(tilemap, col, row) {
        if (!tilemap || !inBounds(tilemap, col, row)) return 0;
        return tilemap.map[row][col] || 0;
    }

    function setTileByCell(tilemap, col, row, idTile) {
        if (!tilemap || !inBounds(tilemap, col, row)) return 0;
        tilemap.map[row][col] = idTile | 0;
        return 1;
    }

    function getMatrixValue(tilemap, matrixName, x, y) {
        const matrix = tilemap ? tilemap[matrixName] : null;
        const pos = cellCoords(tilemap, x, y);
        if (!matrix || !pos || !inBounds(tilemap, pos.col, pos.row)) return 0;
        if (!matrix[pos.row]) return 0;
        return matrix[pos.row][pos.col] || 0;
    }

    function setMatrixValue(tilemap, matrixName, x, y, value) {
        const pos = cellCoords(tilemap, x, y);
        if (!tilemap || !pos || !inBounds(tilemap, pos.col, pos.row)) return 0;
        const matrix = ensureMatrix(tilemap, matrixName);
        if (!matrix[pos.row]) matrix[pos.row] = [];
        matrix[pos.row][pos.col] = value | 0;
        return 1;
    }

    function getFlags(tilemap, x, y) {
        return getMatrixValue(tilemap, 'flags', x, y);
    }

    function setFlags(tilemap, x, y, value) {
        return setMatrixValue(tilemap, 'flags', x, y, value & 0xFF);
    }

    function hasFlag(tilemap, x, y, bit) {
        return (getFlags(tilemap, x, y) & (bit | 0)) !== 0;
    }

    function getTransform(tilemap, x, y) {
        return getMatrixValue(tilemap, 'transform', x, y);
    }

    function setTransform(tilemap, x, y, value) {
        return setMatrixValue(tilemap, 'transform', x, y, value & 0x07);
    }

    function changeTileValue(tilemap, oldId, newId) {
        if (!tilemap || !Array.isArray(tilemap.map)) return 0;
        let changes = 0;
        const mapa = tilemap.map;

        for (let f = 0; f < mapa.length; f++) {
            const row = mapa[f];
            if (!Array.isArray(row)) continue;
            for (let c = 0; c < row.length; c++) {
                if (row[c] === oldId) {
                    row[c] = newId;
                    changes++;
                }
            }
        }

        return changes;
    }

    function changeFlagValue(tilemap, oldValue, newValue) {
        if (!tilemap || !tilemap.flags) return 0;
        let changes = 0;
        for (let f = 0; f < tilemap.flags.length; f++) {
            const row = tilemap.flags[f];
            if (!Array.isArray(row)) continue;
            for (let c = 0; c < row.length; c++) {
                if (row[c] === oldValue) {
                    row[c] = newValue;
                    changes++;
                }
            }
        }
        return changes;
    }

    // ─────────────────────────────────────────────────────────────
    // SERIALIZACIÓN
    // ─────────────────────────────────────────────────────────────

    function formatMatrix(rows, indent) {
        const pad = ' '.repeat(indent);
        const inner = rows.map(row => pad + '    [' + row.join(',') + ']');
        return '[\n' + inner.join(',\n') + '\n' + pad + ']';
    }

    /**
     * Serializa un tilemap a JSON legible. Las matrices se escriben una
     * fila por línea para que el archivo siga siendo editable a mano.
     */
    function stringify(tilemap) {
        if (!isTilemap(tilemap)) fail('stringify: no es un tilemap');

        const size = tilemap.size | 0;
        const map = tilemap.map;
        const flags = tilemap.flags;
        const transform = tilemap.transform;

        const parts = [
            '  "type": "DivGOtilemap"',
            '  "version": ' + VERSION,
            '  "size": ' + size
        ];

        parts.push('  "map": ' + formatMatrix(map, 2));

        if (flags && !isEmptyMatrix(flags)) {
            parts.push('  "flags": ' + formatMatrix(flags, 2));
        }

        if (transform && !isEmptyMatrix(transform)) {
            parts.push('  "transform": ' + formatMatrix(transform, 2));
        }

        return '{\n' + parts.join(',\n') + '\n}\n';
    }

    // ─────────────────────────────────────────────────────────────
    // EXPORTACIÓN
    // ─────────────────────────────────────────────────────────────

    const Tilemap = {
        TYPE,
        TYPE_LEGACY_B64,
        VERSION,
        FLAG,
        TRANSFORM,

        isTilemap,
        decode,
        parse,
        create,
        clone,
        normalize,

        getTile,
        setTile,
        getTileByCell,
        setTileByCell,
        getFlags,
        setFlags,
        hasFlag,
        getTransform,
        setTransform,
        changeTileValue,
        changeFlagValue,

        stringify
    };

    global.Tilemap = Tilemap;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Tilemap;
    }

})(typeof window !== 'undefined' ? window : globalThis);
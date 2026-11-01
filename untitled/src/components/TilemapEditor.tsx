/**
 * TilemapEditor.tsx — DivGO v2 Compatible Tilemap & Parallax Editor for DIV-8
 * Allows creating, editing, and exporting/importing tilemaps with collision flags,
 * transforms, and multiscroll strip previews.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DivTilemap, TILE_FLAG, TILE_TRANSFORM } from '../engine/tilemap';
import { Sprite } from '../engine/types';
import { DivRuntime } from '../engine/runtime';
import { getSpriteCanvas } from '../engine/sprites';
import {
  Paintbrush,
  Eraser,
  PaintBucket,
  Flag,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Download,
  Upload,
  Copy,
  Check,
  Grid,
  Layers,
  Sparkles,
  Sliders
} from 'lucide-react';

interface TilemapEditorProps {
  runtime: DivRuntime;
  sprites: Sprite[];
  onTilemapUpdated?: (name: string, tilemap: DivTilemap) => void;
}

export const TilemapEditor: React.FC<TilemapEditorProps> = ({ runtime, sprites, onTilemapUpdated }) => {
  const [mapName, setMapName] = useState<string>('0030');
  const [cols, setCols] = useState<number>(60);
  const [rows, setRows] = useState<number>(16);
  const [tileSize, setTileSize] = useState<number>(16);
  const [zoom, setZoom] = useState<number>(2);
  const [selectedTool, setSelectedTool] = useState<'paint' | 'erase' | 'fill' | 'flag'>('paint');
  const [selectedTileId, setSelectedTileId] = useState<number>(10);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showFlagOverlay, setShowFlagOverlay] = useState<boolean>(true);
  const [activeFlag, setActiveFlag] = useState<number>(TILE_FLAG.SOLID);
  const [copied, setCopied] = useState<boolean>(false);
  const [showMultiscrollPreview, setShowMultiscrollPreview] = useState<boolean>(false);

  // Active transforms for placed tiles
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [halfAlpha, setHalfAlpha] = useState<boolean>(false);

  // Multiscroll simulator settings
  const [msOrientation, setMsOrientation] = useState<number>(0); // 0 = horizontal
  const [msSlices, setMsSlices] = useState<number[]>([137, 15, 15, 2, 3, 5, 5, 5, 5, 8, 8, 8, 16, 16, 16, 16, 8]);
  const [msSpeeds, setMsSpeeds] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  const [msScrollX, setMsScrollX] = useState<number>(0);

  // Tilemap instance
  const [tilemap, setTilemap] = useState<DivTilemap>(() => {
    const existing = runtime.scrollManager.getTilemap('0030');
    if (existing) return existing;
    return DivTilemap.create(60, 16, 16, '0030');
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync canvas size & tilemap dimensions
  useEffect(() => {
    setCols(tilemap.cols);
    setRows(tilemap.rows);
    setTileSize(tilemap.size);
    setMapName(tilemap.name || '0030');
  }, [tilemap]);

  // Compute transform byte
  const currentTransform = (flipH ? 1 : 0) | (flipV ? 2 : 0) | (halfAlpha ? 4 : 0);

  // Redraw main canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderW = tilemap.cols * tilemap.size * zoom;
    const renderH = tilemap.rows * tilemap.size * zoom;
    canvas.width = renderW;
    canvas.height = renderH;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, renderW, renderH);

    // Background checkerboard
    const checkSize = 16 * zoom;
    for (let y = 0; y < renderH; y += checkSize) {
      for (let x = 0; x < renderW; x += checkSize) {
        ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#181825' : '#1e1e2e';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    const tSize = tilemap.size * zoom;

    // Draw tiles
    for (let r = 0; r < tilemap.rows; r++) {
      for (let c = 0; c < tilemap.cols; c++) {
        const tileId = tilemap.getTileByCell(c, r);
        const tr = tilemap.transform ? tilemap.transform[r]?.[c] || 0 : 0;
        const flag = tilemap.flags ? tilemap.flags[r]?.[c] || 0 : 0;

        const posX = c * tSize;
        const posY = r * tSize;

        if (tileId > 0) {
          const spriteDef = sprites.find((s) => s.id === tileId);
          if (spriteDef) {
            const spriteCanvas = getSpriteCanvas(spriteDef);
            ctx.save();
            ctx.translate(posX, posY);

            const isFlipH = (tr & 1) !== 0;
            const isFlipV = (tr & 2) !== 0;
            const isAlpha = (tr & 4) !== 0;

            if (isAlpha) ctx.globalAlpha = 0.5;
            if (isFlipH || isFlipV) {
              ctx.scale(isFlipH ? -1 : 1, isFlipV ? -1 : 1);
              ctx.drawImage(
                spriteCanvas,
                isFlipH ? -tSize : 0,
                isFlipV ? -tSize : 0,
                tSize,
                tSize
              );
            } else {
              ctx.drawImage(spriteCanvas, 0, 0, tSize, tSize);
            }
            ctx.restore();
          } else {
            ctx.fillStyle = '#6c7086';
            ctx.fillRect(posX, posY, tSize, tSize);
          }
        }

        // Draw collision flag overlay
        if (showFlagOverlay && flag > 0) {
          ctx.save();
          if ((flag & TILE_FLAG.SOLID) !== 0) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.35)'; // Red solid
            ctx.fillRect(posX, posY, tSize, tSize);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.strokeRect(posX + 0.5, posY + 0.5, tSize - 1, tSize - 1);
          } else if ((flag & TILE_FLAG.PLATFORM) !== 0) {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.4)'; // Yellow top line
            ctx.fillRect(posX, posY, tSize, 4 * zoom);
          } else if ((flag & TILE_FLAG.HAZARD) !== 0) {
            ctx.fillStyle = 'rgba(249, 115, 22, 0.45)'; // Orange hazard
            ctx.fillRect(posX, posY, tSize, tSize);
          } else if ((flag & TILE_FLAG.WATER) !== 0) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.35)'; // Blue water
            ctx.fillRect(posX, posY, tSize, tSize);
          } else if ((flag & TILE_FLAG.WALL) !== 0) {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.4)'; // Purple wall
            ctx.fillRect(posX, posY, tSize, tSize);
          }
          ctx.restore();
        }
      }
    }

    // Grid lines
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;

      for (let c = 0; c <= tilemap.cols; c++) {
        const x = Math.round(c * tSize);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, renderH);
        ctx.stroke();
      }

      for (let r = 0; r <= tilemap.rows; r++) {
        const y = Math.round(r * tSize);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(renderW, y);
        ctx.stroke();
      }
    }
  }, [tilemap, zoom, sprites, showGrid, showFlagOverlay]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Click & Drag painting handler
  const handleCanvasAction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const tSize = tilemap.size * zoom;
    const col = Math.floor(clickX / tSize);
    const row = Math.floor(clickY / tSize);

    if (!tilemap.inBounds(col, row)) return;

    if (selectedTool === 'paint') {
      tilemap.setTileByCell(col, row, selectedTileId);
      if (currentTransform !== 0) {
        tilemap.ensureTransform()[row][col] = currentTransform;
      }
      setTilemap(tilemap.clone());
    } else if (selectedTool === 'erase') {
      tilemap.setTileByCell(col, row, 0);
      if (tilemap.flags) tilemap.flags[row][col] = 0;
      if (tilemap.transform) tilemap.transform[row][col] = 0;
      setTilemap(tilemap.clone());
    } else if (selectedTool === 'flag') {
      const currentFlag = tilemap.getFlags(col * tilemap.size, row * tilemap.size);
      const newFlag = currentFlag ^ activeFlag;
      tilemap.setFlags(col * tilemap.size, row * tilemap.size, newFlag);
      setTilemap(tilemap.clone());
    } else if (selectedTool === 'fill') {
      floodFill(col, row, selectedTileId);
    }
  };

  const floodFill = (startCol: number, startRow: number, targetId: number) => {
    const originId = tilemap.getTileByCell(startCol, startRow);
    if (originId === targetId) return;

    const queue: [number, number][] = [[startCol, startRow]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [c, r] = queue.pop()!;
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (tilemap.inBounds(c, r) && tilemap.getTileByCell(c, r) === originId) {
        tilemap.setTileByCell(c, r, targetId);
        if (currentTransform !== 0) {
          tilemap.ensureTransform()[r][c] = currentTransform;
        }

        queue.push([c + 1, r]);
        queue.push([c - 1, r]);
        queue.push([c, r + 1]);
        queue.push([c, r - 1]);
      }
    }
    setTilemap(tilemap.clone());
  };

  // Resize Tilemap dimensions
  const handleResizeMap = (newC: number, newR: number) => {
    const safeC = Math.max(5, Math.min(256, newC));
    const safeR = Math.max(5, Math.min(128, newR));
    tilemap.resize(safeC, safeR);
    setCols(safeC);
    setRows(safeR);
    setTilemap(tilemap.clone());
  };

  // Register in runtime so new_tilemap(mapName) / start_scroll loads this map
  const handleApplyToGame = () => {
    tilemap.name = mapName;
    runtime.scrollManager.registerTilemap(mapName, tilemap);
    // If primary scroll front layer is active, update it
    const primary = runtime.scrollManager.getPrimaryScroll();
    if (primary && primary.front.graphObj) {
      primary.setFront(tilemap);
    }
    if (onTilemapUpdated) {
      onTilemapUpdated(mapName, tilemap);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export .tmap
  const handleExportTmap = () => {
    const jsonStr = tilemap.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapName || 'map'}.tmap`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import .tmap
  const handleImportTmap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const loaded = DivTilemap.parse(text, file.name.replace(/\.tmap$/i, ''));
        setTilemap(loaded);
        setMapName(loaded.name || '0030');
      } catch (err: any) {
        alert('Error al importar archivo .tmap: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Copy JSON string
  const handleCopyJSON = () => {
    navigator.clipboard.writeText(tilemap.exportJSON());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f17] text-gray-200 select-none overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#181825] border-b border-[#2d2d3f] gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-4 h-4 text-emerald-400" />
            Mapa de Tiles (v2)
          </span>

          <div className="flex items-center gap-1 ml-2 bg-[#11111b] px-2 py-1 rounded border border-[#2d2d3f]">
            <span className="text-xs text-gray-400 font-mono">Nombre:</span>
            <input
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              className="w-24 bg-transparent text-xs font-mono text-cyan-300 focus:outline-none"
              title="Identificador de tilemap (e.g. '0030')"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#11111b] px-2 py-1 rounded border border-[#2d2d3f] text-xs font-mono">
            <span className="text-gray-400">Dim:</span>
            <input
              type="number"
              value={cols}
              onChange={(e) => handleResizeMap(parseInt(e.target.value, 10) || cols, rows)}
              className="w-12 bg-transparent text-center text-cyan-300 focus:outline-none"
            />
            <span className="text-gray-500">x</span>
            <input
              type="number"
              value={rows}
              onChange={(e) => handleResizeMap(cols, parseInt(e.target.value, 10) || rows)}
              className="w-12 bg-transparent text-center text-cyan-300 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#11111b] px-2 py-1 rounded border border-[#2d2d3f] text-xs font-mono">
            <span className="text-gray-400">Tile:</span>
            <select
              value={tileSize}
              onChange={(e) => {
                const s = parseInt(e.target.value, 10);
                setTileSize(s);
                tilemap.size = s;
                tilemap.width = tilemap.cols * s;
                tilemap.height = tilemap.rows * s;
                setTilemap(tilemap.clone());
              }}
              className="bg-transparent text-cyan-300 focus:outline-none cursor-pointer"
            >
              <option value={8} className="bg-[#181825]">8x8</option>
              <option value={16} className="bg-[#181825]">16x16</option>
              <option value={32} className="bg-[#181825]">32x32</option>
            </select>
          </div>
        </div>

        {/* Tools and View Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedTool('paint')}
            className={`p-1.5 rounded transition ${selectedTool === 'paint' ? 'bg-indigo-600 text-white' : 'bg-[#242438] text-gray-300 hover:bg-[#2f2f48]'}`}
            title="Lápiz (Pintar Tile)"
          >
            <Paintbrush className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedTool('erase')}
            className={`p-1.5 rounded transition ${selectedTool === 'erase' ? 'bg-indigo-600 text-white' : 'bg-[#242438] text-gray-300 hover:bg-[#2f2f48]'}`}
            title="Goma (Borrar Tile)"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedTool('fill')}
            className={`p-1.5 rounded transition ${selectedTool === 'fill' ? 'bg-indigo-600 text-white' : 'bg-[#242438] text-gray-300 hover:bg-[#2f2f48]'}`}
            title="Cubo de Relleno (Flood Fill)"
          >
            <PaintBucket className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedTool('flag')}
            className={`p-1.5 rounded transition ${selectedTool === 'flag' ? 'bg-amber-600 text-white' : 'bg-[#242438] text-gray-300 hover:bg-[#2f2f48]'}`}
            title="Editor de Banderas de Colisión"
          >
            <Flag className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-gray-700 mx-1" />

          {/* Grid & Overlay Toggles */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded transition ${showGrid ? 'bg-cyan-700 text-white' : 'bg-[#242438] text-gray-400'}`}
            title="Alternar Cuadrícula"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFlagOverlay(!showFlagOverlay)}
            className={`p-1.5 rounded transition ${showFlagOverlay ? 'bg-rose-700 text-white' : 'bg-[#242438] text-gray-400'}`}
            title="Alternar Capa de Colisiones"
          >
            <Flag className="w-4 h-4" />
          </button>

          {/* Zoom Selector */}
          <div className="flex bg-[#11111b] rounded border border-[#2d2d3f] p-0.5 text-xs font-mono">
            <button
              onClick={() => setZoom(1)}
              className={`px-1.5 py-0.5 rounded ${zoom === 1 ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              1x
            </button>
            <button
              onClick={() => setZoom(2)}
              className={`px-1.5 py-0.5 rounded ${zoom === 2 ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              2x
            </button>
            <button
              onClick={() => setZoom(3)}
              className={`px-1.5 py-0.5 rounded ${zoom === 3 ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              3x
            </button>
          </div>

          <div className="h-4 w-px bg-gray-700 mx-1" />

          {/* Save / Apply / Export */}
          <button
            onClick={handleApplyToGame}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium rounded transition"
            title="Registrar en la consola actual para new_tilemap('0030')"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            Aplicar al Juego
          </button>

          <button
            onClick={handleExportTmap}
            className="p-1.5 bg-[#242438] hover:bg-[#2f2f48] text-gray-300 rounded transition"
            title="Descargar archivo .tmap"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 bg-[#242438] hover:bg-[#2f2f48] text-gray-300 rounded transition"
            title="Importar archivo .tmap"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tmap,.json"
            onChange={handleImportTmap}
            className="hidden"
          />

          <button
            onClick={handleCopyJSON}
            className="p-1.5 bg-[#242438] hover:bg-[#2f2f48] text-gray-300 rounded transition"
            title="Copiar JSON v2"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowMultiscrollPreview(!showMultiscrollPreview)}
            className={`p-1.5 rounded transition ${showMultiscrollPreview ? 'bg-purple-600 text-white' : 'bg-[#242438] text-gray-300 hover:bg-[#2f2f48]'}`}
            title="Simulador de Multiscroll (Parallax Slicing)"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas Scrollable Workspace */}
        <div className="flex-1 overflow-auto p-4 bg-[#0a0a10] flex items-center justify-center">
          <div className="shadow-2xl border border-[#2d2d3f] bg-black inline-block">
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => {
                isPaintingRef.current = true;
                handleCanvasAction(e);
              }}
              onMouseMove={(e) => {
                if (isPaintingRef.current && (selectedTool === 'paint' || selectedTool === 'erase' || selectedTool === 'flag')) {
                  handleCanvasAction(e);
                }
              }}
              onMouseUp={() => { isPaintingRef.current = false; }}
              onMouseLeave={() => { isPaintingRef.current = false; }}
              className="cursor-crosshair block"
            />
          </div>
        </div>

        {/* Right Sidebar: Tile Palette & Flags */}
        <div className="w-72 bg-[#141420] border-l border-[#2d2d3f] flex flex-col overflow-y-auto">
          {/* Tile Selection */}
          <div className="p-3 border-b border-[#2d2d3f]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-medium text-gray-300">Sprite / Tile Activo</span>
              <span className="text-xs font-mono text-cyan-400">ID #{selectedTileId}</span>
            </div>

            {/* Sprites Grid */}
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 bg-[#0b0b12] rounded border border-[#232336]">
              {sprites.filter((s) => s.id <= 40).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedTileId(s.id)}
                  className={`p-1.5 rounded flex flex-col items-center justify-center transition border ${selectedTileId === s.id ? 'border-cyan-400 bg-[#252540]' : 'border-transparent hover:bg-[#1a1a2e]'}`}
                >
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center overflow-hidden bg-black/40"
                    style={{
                      backgroundImage: 'linear-gradient(45deg, #181825 25%, transparent 25%), linear-gradient(-45deg, #181825 25%, transparent 25%)',
                      backgroundSize: '8px 8px',
                    }}
                  >
                    <canvas
                      ref={(c) => {
                        if (!c) return;
                        c.width = s.width;
                        c.height = s.height;
                        const ctx = c.getContext('2d');
                        if (ctx) {
                          ctx.imageSmoothingEnabled = false;
                          ctx.drawImage(getSpriteCanvas(s), 0, 0);
                        }
                      }}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 mt-1 truncate max-w-[50px]">{s.id}</span>
                </button>
              ))}
            </div>

            {/* Transform toggles for placed tiles */}
            <div className="flex items-center gap-1 mt-2.5">
              <button
                onClick={() => setFlipH(!flipH)}
                className={`flex-1 py-1 px-1.5 text-xs rounded border transition flex items-center justify-center gap-1 ${flipH ? 'bg-cyan-800 border-cyan-400 text-white' : 'bg-[#1e1e30] border-gray-700 text-gray-400'}`}
                title="Voltear Horizontal"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Flip H
              </button>
              <button
                onClick={() => setFlipV(!flipV)}
                className={`flex-1 py-1 px-1.5 text-xs rounded border transition flex items-center justify-center gap-1 ${flipV ? 'bg-cyan-800 border-cyan-400 text-white' : 'bg-[#1e1e30] border-gray-700 text-gray-400'}`}
                title="Voltear Vertical"
              >
                <FlipVertical className="w-3.5 h-3.5" />
                Flip V
              </button>
              <button
                onClick={() => setHalfAlpha(!halfAlpha)}
                className={`flex-1 py-1 px-1.5 text-xs rounded border transition flex items-center justify-center gap-1 ${halfAlpha ? 'bg-cyan-800 border-cyan-400 text-white' : 'bg-[#1e1e30] border-gray-700 text-gray-400'}`}
                title="50% Transparencia Alpha"
              >
                Alpha
              </button>
            </div>
          </div>

          {/* Collision Flags Selector */}
          <div className="p-3 border-b border-[#2d2d3f]">
            <span className="text-xs font-mono font-medium text-amber-400 block mb-2">Banderas de Colisión (Gameplay)</span>
            <div className="space-y-1.5 text-xs font-mono">
              <label className="flex items-center gap-2 p-1.5 bg-[#181828] hover:bg-[#202035] rounded cursor-pointer">
                <input
                  type="radio"
                  name="flagSelect"
                  checked={activeFlag === TILE_FLAG.SOLID}
                  onChange={() => setActiveFlag(TILE_FLAG.SOLID)}
                  className="accent-red-500"
                />
                <span className="w-3 h-3 rounded bg-red-500 inline-block" />
                <span className="text-gray-200">SOLID (1) — Muro/Suelo</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 bg-[#181828] hover:bg-[#202035] rounded cursor-pointer">
                <input
                  type="radio"
                  name="flagSelect"
                  checked={activeFlag === TILE_FLAG.PLATFORM}
                  onChange={() => setActiveFlag(TILE_FLAG.PLATFORM)}
                  className="accent-yellow-500"
                />
                <span className="w-3 h-3 rounded bg-yellow-500 inline-block" />
                <span className="text-gray-200">PLATFORM (2) — Atravesable</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 bg-[#181828] hover:bg-[#202035] rounded cursor-pointer">
                <input
                  type="radio"
                  name="flagSelect"
                  checked={activeFlag === TILE_FLAG.HAZARD}
                  onChange={() => setActiveFlag(TILE_FLAG.HAZARD)}
                  className="accent-orange-500"
                />
                <span className="w-3 h-3 rounded bg-orange-500 inline-block" />
                <span className="text-gray-200">HAZARD (8) — Pinchos/Daño</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 bg-[#181828] hover:bg-[#202035] rounded cursor-pointer">
                <input
                  type="radio"
                  name="flagSelect"
                  checked={activeFlag === TILE_FLAG.WATER}
                  onChange={() => setActiveFlag(TILE_FLAG.WATER)}
                  className="accent-blue-500"
                />
                <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                <span className="text-gray-200">WATER (4) — Agua/Líquido</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 bg-[#181828] hover:bg-[#202035] rounded cursor-pointer">
                <input
                  type="radio"
                  name="flagSelect"
                  checked={activeFlag === TILE_FLAG.WALL}
                  onChange={() => setActiveFlag(TILE_FLAG.WALL)}
                  className="accent-purple-500"
                />
                <span className="w-3 h-3 rounded bg-purple-500 inline-block" />
                <span className="text-gray-200">WALL (128) — Pared Lateral</span>
              </label>
            </div>
          </div>

          {/* Quick Info & Usage */}
          <div className="p-3 text-[11px] font-mono text-gray-400 space-y-2">
            <div className="bg-[#0b0b14] p-2 rounded border border-[#232338]">
              <span className="text-emerald-400 block font-semibold mb-1">API DIV / DivGO:</span>
              <p className="text-gray-300">tilemap = new_tilemap("{mapName}");</p>
              <p className="text-gray-300">start_scroll(0, 0, tilemap, 101, 0, 4);</p>
              <p className="text-cyan-400 mt-1">col = get_tile(tilemap, x, y);</p>
              <p className="text-cyan-400">set_tile(tilemap, x, y, id);</p>
            </div>
          </div>
        </div>

        {/* Multiscroll Slicing Live Simulator Drawer */}
        {showMultiscrollPreview && (
          <div className="absolute top-0 right-72 bottom-0 w-80 bg-[#161626] border-l border-[#2d2d3f] p-4 flex flex-col z-20 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#2d2d3f] mb-3">
              <span className="text-xs font-mono font-semibold text-purple-400 flex items-center gap-1">
                <Sliders className="w-4 h-4" />
                Simulador Parallax
              </span>
              <button
                onClick={() => setShowMultiscrollPreview(false)}
                className="text-gray-400 hover:text-white text-xs font-mono"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto text-xs font-mono">
              <div>
                <label className="text-gray-400 block mb-1">Orientación:</label>
                <select
                  value={msOrientation}
                  onChange={(e) => setMsOrientation(parseInt(e.target.value, 10))}
                  className="w-full bg-[#0d0d17] p-1.5 rounded border border-[#2d2d3f] text-cyan-300"
                >
                  <option value={0}>0: Tiras Horizontales (X)</option>
                  <option value={1}>1: Tiras Verticales (Y)</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Simular Movimiento de Cámara:</label>
                <input
                  type="range"
                  min="-200"
                  max="600"
                  value={msScrollX}
                  onChange={(e) => setMsScrollX(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500"
                />
                <div className="text-right text-[11px] text-gray-500">X: {msScrollX} px</div>
              </div>

              {/* Slices representation */}
              <div className="bg-[#0b0b14] p-2.5 rounded border border-[#232338]">
                <span className="text-gray-400 block mb-2 font-semibold">Tiras Activas ({msSlices.length}):</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {msSlices.map((dist, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] bg-[#1a1a2c] px-2 py-1 rounded">
                      <span className="text-gray-400">Franja #{idx + 1}</span>
                      <span className="text-amber-400">Alto: {dist}px</span>
                      <span className="text-cyan-400">Vel: {msSpeeds[idx]}x</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  runtime.breakBackScroll(0, msOrientation, msSlices, msSpeeds);
                  alert('¡break_back_scroll configurado en el scroll actual del juego!');
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium transition"
              >
                Aplicar al Scroll Actual
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

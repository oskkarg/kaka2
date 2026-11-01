/**
 * Sprite Editor for DIV-8 Fantasy Console
 */

import React, { useState } from 'react';
import { Sprite } from '../engine/types';
import { PALETTE, getColorHex } from '../engine/palette';
import { Paintbrush, Eraser, RotateCcw, PaintBucket, Sparkles } from 'lucide-react';

interface SpriteEditorProps {
  sprites: Sprite[];
  onUpdateSprite: (sprite: Sprite) => void;
}

export const SpriteEditor: React.FC<SpriteEditorProps> = ({ sprites, onUpdateSprite }) => {
  const [selectedSpriteId, setSelectedSpriteId] = useState<number>(1);
  const [selectedColor, setSelectedColor] = useState<number>(7); // White
  const [tool, setTool] = useState<'pen' | 'eraser' | 'fill'>('pen');
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  const currentSprite = sprites.find((s) => s.id === selectedSpriteId) || sprites[0];

  const handlePixelAction = (x: number, y: number) => {
    if (!currentSprite) return;
    const index = y * currentSprite.width + x;
    const newData = [...currentSprite.data];

    if (tool === 'eraser') {
      newData[index] = 0; // transparent
    } else if (tool === 'pen') {
      newData[index] = selectedColor;
    } else if (tool === 'fill') {
      const targetColor = newData[index];
      if (targetColor === selectedColor) return;
      floodFill(newData, currentSprite.width, currentSprite.height, x, y, targetColor, selectedColor);
    }

    onUpdateSprite({
      ...currentSprite,
      data: newData,
    });
  };

  const floodFill = (
    data: number[],
    w: number,
    h: number,
    startX: number,
    startY: number,
    target: number,
    fill: number
  ) => {
    const queue: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(w * h);

    while (queue.length > 0) {
      const [cx, cy] = queue.pop()!;
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
      const idx = cy * w + cx;
      if (visited[idx]) continue;
      visited[idx] = 1;

      if (data[idx] === target) {
        data[idx] = fill;
        queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    }
  };

  const clearCurrentSprite = () => {
    if (!currentSprite) return;
    onUpdateSprite({
      ...currentSprite,
      data: new Array(currentSprite.width * currentSprite.height).fill(0),
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-4 text-zinc-200 overflow-y-auto">
      {/* Top Header & Sprite Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-zinc-800 pb-3">
        <div>
          <h3 className="font-pixel text-xs text-amber-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            EDITOR DE SPRITES (GRAPH)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Sprite #{currentSprite.id}: <span className="text-zinc-200 font-semibold">{currentSprite.name}</span> ({currentSprite.width}x{currentSprite.height}px)
          </p>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setTool('pen')}
            title="Lápiz"
            className={`p-1.5 rounded transition-colors ${
              tool === 'pen' ? 'bg-amber-500 text-black' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            <Paintbrush className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('fill')}
            title="Bote de Pintura (Relleno)"
            className={`p-1.5 rounded transition-colors ${
              tool === 'fill' ? 'bg-amber-500 text-black' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            <PaintBucket className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            title="Borrador (Transparente)"
            className={`p-1.5 rounded transition-colors ${
              tool === 'eraser' ? 'bg-amber-500 text-black' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={clearCurrentSprite}
            title="Limpiar Sprite"
            className="p-1.5 hover:bg-zinc-800 text-rose-400 rounded transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 items-start">
        {/* Drawing Grid */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="p-2 bg-zinc-900 border-2 border-zinc-800 rounded-lg shadow-xl"
            onMouseLeave={() => setIsMouseDown(false)}
            onMouseUp={() => setIsMouseDown(false)}
          >
            <div
              className="grid gap-[1px] bg-zinc-800/80 p-[1px] select-none"
              style={{
                gridTemplateColumns: `repeat(${currentSprite.width}, minmax(0, 1fr))`,
                width: currentSprite.width * 18,
                height: currentSprite.height * 18,
              }}
            >
              {Array.from({ length: currentSprite.height }).map((_, y) =>
                Array.from({ length: currentSprite.width }).map((__, x) => {
                  const idx = y * currentSprite.width + x;
                  const colorIdx = currentSprite.data[idx] || 0;
                  const hex = colorIdx === 0 ? 'transparent' : getColorHex(colorIdx);

                  return (
                    <div
                      key={`${x}-${y}`}
                      onMouseDown={() => {
                        setIsMouseDown(true);
                        handlePixelAction(x, y);
                      }}
                      onMouseEnter={() => {
                        if (isMouseDown) handlePixelAction(x, y);
                      }}
                      style={{ backgroundColor: hex }}
                      className={`cursor-pointer transition-transform hover:scale-110 ${
                        colorIdx === 0 ? 'bg-zinc-950/90 border border-zinc-800/50' : ''
                      }`}
                    />
                  );
                })
              )}
            </div>
          </div>

          <span className="text-[11px] font-mono text-zinc-500">
            Haz clic o arrastra para dibujar • Usa en código con <code className="text-amber-400">graph = {currentSprite.id};</code>
          </span>
        </div>

        {/* Color Palette & Sprite Carousel */}
        <div className="flex-1 flex flex-col gap-4 w-full">
          {/* Palette */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Paleta de Color (32 Colores Retro):
            </label>
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 p-2 bg-zinc-900 rounded-lg border border-zinc-800">
              {PALETTE.map((c) => (
                <button
                  key={c.index}
                  onClick={() => {
                    setSelectedColor(c.index);
                    setTool('pen');
                  }}
                  title={`Color ${c.index}: ${c.name}`}
                  style={{ backgroundColor: c.hex }}
                  className={`w-6 h-6 rounded border transition-all ${
                    selectedColor === c.index
                      ? 'ring-2 ring-white scale-110 border-white'
                      : 'border-zinc-800 hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Sprite Catalog / Carousel */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Biblioteca de Sprites:
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2 bg-zinc-900 rounded-lg border border-zinc-800 max-h-48 overflow-y-auto">
              {sprites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSpriteId(s.id)}
                  className={`p-2 rounded flex flex-col items-center gap-1 border transition-all ${
                    selectedSpriteId === s.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <div className="w-8 h-8 bg-black rounded flex items-center justify-center p-0.5">
                    {/* Mini pixel preview */}
                    <svg viewBox={`0 0 ${s.width} ${s.height}`} className="w-full h-full [image-rendering:pixelated]">
                      {s.data.map((c, i) => {
                        if (c === 0) return null;
                        const px = i % s.width;
                        const py = Math.floor(i / s.width);
                        return <rect key={i} x={px} y={py} width={1} height={1} fill={getColorHex(c)} />;
                      })}
                    </svg>
                  </div>
                  <span className="font-mono text-[10px]">#{s.id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

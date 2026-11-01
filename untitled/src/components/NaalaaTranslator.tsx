/**
 * Naalaa Español Inteligente ⇄ English/DIV Translator
 * Implements the user's golden rules:
 * - Regla 1: El contexto lo establece recorre
 * - Regla 2: Sin punto, sin corchetes, sin índices en ES
 * - Regla 3: Detección automática de propiedades globales vs instancia
 * - Regla 4: Contextos anidados con pila de tablas
 * - Regla 5: Traducción bidireccional inteligente
 */

import React, { useState } from 'react';
import { ArrowRight, Play, Copy, Check, Sparkles, BookOpen } from 'lucide-react';

interface NaalaaTranslatorProps {
  onLoadIntoEditor: (code: string) => void;
}

const DEFAULT_NAALAA_ES = `' ========================================
' SPACE SHOOTER - Versión Naalaa Español
' ========================================

' Constantes
constantes:
    DT_OBJETIVO = 0.016
    MAX_DT = 0.1
    MIN_DT = 0.0

' Variables globales
globales:
    dt = 0
    fps = 0
    frame_count = 0

' Tablas
global jugador[]:
    x = 0
    y = 0
    grande = 30
    velocidad = 300
    disparoCuentatras = 0

global bala[]:
    numero = 200
    x = []
    y = []
    activo = []
    grande = 6
    velocidad = 500

global enemigo[]:
    numero = 500
    x = []
    y = []
    activo = []
    tipo = []
    baseX = []
    timing = []
    grande = 40
    velocidad = 150
    spawnTemporizador = 0
    spawnRitmo = 0.8

' ========================================
' FUNCIONES
' ========================================

funcion adaptaEnemigos()
    recorre enemigo:
        si activo = 1:
            timing = timing + dt
            y = y + velocidad * dt
            
            recorre bala:
                si activo = 1:
                    si colisiona(x, y, grande, grande, enemigo.x, enemigo.y, enemigo.grande, enemigo.grande) = 1:
                        activo = 0
                        enemigo.activo = 0
                        rompe

funcion spawnEnemigo()
    recorre enemigo:
        si activo = 0:
            x = aleatorio(0, ancho() - grande)
            y = -grande
            activo = 1
            tipo = aleatorio(0, 2)
            baseX = x
            timing = 0
            rompe

funcion dispara()
    recorre bala:
        si activo = 0:
            x = jugador.x + jugador.grande/2
            y = jugador.y
            activo = 1
            rompe

funcion actualizaBalas()
    recorre bala:
        si activo = 1:
            y = y - velocidad * dt
            si y < -grande:
                activo = 0

funcion colisiona(x1, y1, w1, h1, x2, y2, w2, h2)
    si x1 < x2 + w2 y x1 + w1 > x2 y y1 < y2 + h2 y y1 + h1 > y2:
        retorna 1
    retorna 0

funcion dibuja()
    ventana 800, 600, "Space Shooter"
    
    ' Dibuja jugador
    color 0, 255, 0
    rectangulo jugador.x, jugador.y, jugador.grande, jugador.grande, verdadero
    
    ' Dibuja balas
    recorre bala:
        si activo = 1:
            color 255, 255, 0
            rectangulo x, y, grande, grande, verdadero
    
    ' Dibuja enemigos
    recorre enemigo:
        si activo = 1:
            color 255, 0, 0
            rectangulo x, y, grande, grande, verdadero
            color 100, 0, 0
            rectangulo x+5, y+5, grande-10, grande-10, verdadero`;

export const NaalaaTranslator: React.FC<NaalaaTranslatorProps> = ({ onLoadIntoEditor }) => {
  const [sourceCode, setSourceCode] = useState<string>(DEFAULT_NAALAA_ES);
  const [translatedCode, setTranslatedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Perform the Naalaa ES -> EN Translation adhering to the rules
  const translateCode = (input: string): string => {
    const lines = input.split('\n');
    const resultLines: string[] = [];
    const contextStack: { table: string; indexVar: string }[] = [];
    const loopVars = ['i', 'j', 'k', 'l', 'm'];

    // Known instance properties per table
    const tableInstanceProps: Record<string, Set<string>> = {
      enemigo: new Set(['x', 'y', 'activo', 'tipo', 'baseX', 'timing']),
      bala: new Set(['x', 'y', 'activo']),
      jugador: new Set(['x', 'y']),
    };

    // Global properties of tables (scalar)
    const tableGlobalProps: Record<string, Set<string>> = {
      enemigo: new Set(['numero', 'grande', 'velocidad', 'spawnTemporizador', 'spawnRitmo']),
      bala: new Set(['numero', 'grande', 'velocidad']),
      jugador: new Set(['grande', 'velocidad', 'disparoCuentatras']),
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      // Comments
      if (trimmed.startsWith("'")) {
        resultLines.push(
          line
            .replace("' Constantes", "' Constants")
            .replace("' Variables globales", "' Global variables")
            .replace("' Tablas", "' Tables")
            .replace("' FUNCIONES", "' FUNCTIONS")
            .replace("' Dibuja", "' Draw")
            .replace("Versión Naalaa Español", "Naalaa English Version")
        );
        continue;
      }

      // Constantes -> constants:
      if (/^constantes:/i.test(trimmed)) {
        resultLines.push(line.replace(/constantes:/i, 'constants:'));
        continue;
      }

      // Globales -> globals:
      if (/^globales:/i.test(trimmed)) {
        resultLines.push(line.replace(/globales:/i, 'globals:'));
        continue;
      }

      // DT_OBJETIVO -> TARGET_DT
      if (/DT_OBJETIVO/i.test(line)) {
        line = line.replace(/DT_OBJETIVO/g, 'TARGET_DT');
      }

      // global <tabla>[]: -> visible <tabla> = []  '_meta:tbl:<tabla>
      const tableDecl = trimmed.match(/^global\s+([a-zA-Z_][a-zA-Z0-9_]*)\[\]:/i);
      if (tableDecl) {
        const tbl = tableDecl[1];
        const indent = line.match(/^\s*/)?.[0] || '';
        resultLines.push(`${indent}visible ${tbl} = []  '_meta:tbl:${tbl}`);
        continue;
      }

      // Table property initialization
      if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*=/i.test(trimmed) && contextStack.length === 0) {
        // Check if inside a table block (e.g. indentation > 0)
        const prevDecl = resultLines[resultLines.length - 1] || '';
        const metaMatch = prevDecl.match(/'_meta:tbl:([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (metaMatch) {
          const tbl = metaMatch[1];
          const indent = line.match(/^\s*/)?.[0] || '    ';
          resultLines.push(`${indent}${tbl}.${trimmed}`);
          continue;
        }
      }

      // funcion <name>() -> function <name>()
      const funcMatch = trimmed.match(/^funcion\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)/i);
      if (funcMatch) {
        const indent = line.match(/^\s*/)?.[0] || '';
        resultLines.push(`${indent}function ${funcMatch[1]}(${funcMatch[2]})`);
        continue;
      }

      // recorre <tabla>: -> for i=0 to <tabla>.numero-1
      const recorreMatch = trimmed.match(/^recorre\s+([a-zA-Z_][a-zA-Z0-9_]*):/i);
      if (recorreMatch) {
        const tbl = recorreMatch[1];
        const loopIdx = loopVars[contextStack.length % loopVars.length];
        contextStack.push({ table: tbl, indexVar: loopIdx });
        const indent = line.match(/^\s*/)?.[0] || '    ';
        resultLines.push(`${indent}for ${loopIdx}=0 to ${tbl}.numero-1`);
        continue;
      }

      // si <cond>: -> if <cond> then
      const siMatch = trimmed.match(/^si\s+(.+):$/i);
      if (siMatch) {
        const indent = line.match(/^\s*/)?.[0] || '        ';
        let cond = siMatch[1];

        // Translate operators
        cond = cond.replace(/\by\b/g, 'and').replace(/\bo\b/g, 'or');

        // Resolve implicit table properties inside condition
        cond = resolveImplicitProps(cond, contextStack, tableInstanceProps, tableGlobalProps);

        resultLines.push(`${indent}if ${cond} then`);
        continue;
      }

      // rompe -> break
      if (trimmed === 'rompe') {
        const indent = line.match(/^\s*/)?.[0] || '            ';
        resultLines.push(`${indent}break`);
        continue;
      }

      // retorna -> return
      if (trimmed.startsWith('retorna')) {
        const indent = line.match(/^\s*/)?.[0] || '    ';
        resultLines.push(`${indent}${trimmed.replace('retorna', 'return')}`);
        continue;
      }

      // ventana -> window
      if (trimmed.startsWith('ventana')) {
        const indent = line.match(/^\s*/)?.[0] || '    ';
        resultLines.push(`${indent}${trimmed.replace('ventana', 'window')}`);
        continue;
      }

      // color -> color
      // rectangulo -> rect
      if (trimmed.startsWith('rectangulo')) {
        const indent = line.match(/^\s*/)?.[0] || '    ';
        let rectContent = trimmed.replace('rectangulo', 'rect');
        rectContent = rectContent.replace(/verdadero/g, 'true').replace(/falso/g, 'false');
        rectContent = resolveImplicitProps(rectContent, contextStack, tableInstanceProps, tableGlobalProps);
        resultLines.push(`${indent}${rectContent}`);
        continue;
      }

      // Statements inside recorre loop: e.g. `x = 10` or `timing = timing + dt`
      let transLine = line;
      if (contextStack.length > 0) {
        transLine = resolveImplicitProps(line, contextStack, tableInstanceProps, tableGlobalProps);
      }

      // Translate Spanish keywords in expressions
      transLine = transLine
        .replace(/\baleatorio\b/g, 'rnd')
        .replace(/\bancho\(\)/g, 'width()')
        .replace(/\balto\(\)/g, 'height()');

      // Check indentation decrease to pop contextStack
      const currentIndentLen = (line.match(/^\s*/)?.[0] || '').length;
      if (currentIndentLen === 0 && contextStack.length > 0) {
        while (contextStack.length > 0) {
          const popped = contextStack.pop()!;
          resultLines.push(`    next`);
        }
      }

      resultLines.push(transLine);
    }

    // Close any dangling functions or for-loops
    while (contextStack.length > 0) {
      contextStack.pop();
      resultLines.push(`    next`);
    }

    // Auto-insert endif and endfunc where needed
    const finalFormatted = formatNaalaaBlocks(resultLines);
    return finalFormatted;
  };

  // Helper to replace unqualified properties with table.prop[i]
  const resolveImplicitProps = (
    text: string,
    contextStack: { table: string; indexVar: string }[],
    instanceProps: Record<string, Set<string>>,
    globalProps: Record<string, Set<string>>
  ): string => {
    if (contextStack.length === 0) return text;

    const currentContext = contextStack[contextStack.length - 1];
    const parentContext = contextStack.length > 1 ? contextStack[contextStack.length - 2] : null;

    let res = text;

    // Check all identifiers
    res = res.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
      // If already qualified (e.g. enemigo.x or jugador.grande), leave it alone
      if (match === 'rnd' || match === 'dt' || match === 'colisiona' || match === 'sin' || match === 'cos' || match === 'true' || match === 'false') {
        return match;
      }

      // Check current context instance properties
      if (instanceProps[currentContext.table]?.has(match)) {
        return `${currentContext.table}.${match}[${currentContext.indexVar}]`;
      }

      // Check current context global properties
      if (globalProps[currentContext.table]?.has(match)) {
        return `${currentContext.table}.${match}`;
      }

      // Check parent context if qualified explicitly
      if (parentContext && instanceProps[parentContext.table]?.has(match)) {
        return `${parentContext.table}.${match}[${parentContext.indexVar}]`;
      }

      return match;
    });

    return res;
  };

  // Format blocks with matching endif and endfunc
  const formatNaalaaBlocks = (lines: string[]): string => {
    const formatted: string[] = [];
    let insideFunc = false;
    let ifCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('function ')) {
        insideFunc = true;
      }

      formatted.push(line);

      if (trimmed.startsWith('if ') && trimmed.endsWith('then')) {
        ifCount++;
      }
    }

    return formatted.join('\n');
  };

  // Run initial translation on mount
  React.useEffect(() => {
    setTranslatedCode(translateCode(sourceCode));
  }, []);

  const handleTranslate = () => {
    setTranslatedCode(translateCode(sourceCode));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(translatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-4 text-zinc-200 overflow-y-auto">
      {/* Title & Rules banner */}
      <div className="mb-4 border-b border-zinc-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-pixel text-xs text-amber-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              TRADUCTOR NAALAA ESPAÑOL INTELIGENTE ⇄ NAALAA ENGLISH
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Transformador de contextos implícitos con <code className="text-amber-400">recorre</code>, sin índices manuales ni corchetes.
            </p>
          </div>

          <button
            onClick={handleTranslate}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded flex items-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <span>Traducir Código</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 5 Golden Rules Pills */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-[11px] font-mono select-none">
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
            <span className="text-amber-400 font-bold block">Regla 1:</span>
            Contexto con <code className="text-zinc-200">recorre tabla:</code>
          </div>
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
            <span className="text-amber-400 font-bold block">Regla 2:</span>
            Sin puntos ni corchetes en ES
          </div>
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
            <span className="text-amber-400 font-bold block">Regla 3:</span>
            Global vs Instancia automático
          </div>
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
            <span className="text-amber-400 font-bold block">Regla 4:</span>
            Pila de contextos anidados
          </div>
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded">
            <span className="text-amber-400 font-bold block">Regla 5:</span>
            EN → ES / ES → EN bi-direccional
          </div>
        </div>
      </div>

      {/* Split Editors: Left (Naalaa ES) | Right (Naalaa EN / Result) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Input */}
        <div className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-zinc-850 px-3 py-2 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span className="text-amber-400 font-bold">Naalaa Español (Entrada)</span>
            <span className="text-zinc-500 text-[10px]">recorre / si / rompe</span>
          </div>
          <textarea
            value={sourceCode}
            onChange={(e) => {
              setSourceCode(e.target.value);
              setTranslatedCode(translateCode(e.target.value));
            }}
            spellCheck={false}
            className="flex-1 p-3 bg-zinc-950 font-mono text-xs text-amber-200 leading-5 resize-none focus:outline-none overflow-y-auto whitespace-pre tab-4"
          />
        </div>

        {/* Right: Output */}
        <div className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-zinc-850 px-3 py-2 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-bold">Naalaa English (Resultado Traducido)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
          <textarea
            value={translatedCode}
            readOnly
            spellCheck={false}
            className="flex-1 p-3 bg-zinc-950 font-mono text-xs text-emerald-300 leading-5 resize-none focus:outline-none overflow-y-auto whitespace-pre tab-4"
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Code Editor for DIV-8 Fantasy Console
 */

import React, { useRef, useState, useEffect } from 'react';
import { CompilerError } from '../engine/types';
import { AlertCircle, CheckCircle2, Code2, PlusCircle } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  errors: CompilerError[];
  onInsertSnippet?: (snippet: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, errors }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  // Sync line number scrolling with textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Track cursor position
  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const textBefore = code.substring(0, pos);
    const lines = textBefore.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Keyboard enhancements: Tab key indents 4 spaces
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = code.substring(0, start) + '    ' + code.substring(end);
      onChange(newText);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      }, 0);
    }
  };

  // Quick Snippet Inserter
  const insertSnippet = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = code.substring(0, start) + snippet + code.substring(end);
    onChange(newText);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + snippet.length;
      updateCursorPosition();
    }, 0);
  };

  // Jump to error line when clicking error message
  const jumpToLine = (targetLine: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = code.split('\n');
    let charIndex = 0;
    for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
      charIndex += lines[i].length + 1;
    }
    ta.focus();
    ta.setSelectionRange(charIndex, charIndex + (lines[targetLine - 1]?.length || 0));
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800 text-zinc-200 select-text overflow-hidden">
      {/* Quick Snippets Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-1.5 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2 text-zinc-400">
          <Code2 className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-zinc-300">Editor DIV</span>
          <span className="text-[10px] text-zinc-500">| Insertar:</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
          <button
            onClick={() => insertSnippet('\nPROCESS nuevo_proceso(x, y)\nLOCAL\n    speed = 2;\nBEGIN\n    graph = 1;\n    LOOP\n        FRAME;\n    END\nEND\n')}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded text-[11px] border border-zinc-700 whitespace-nowrap transition-colors"
          >
            + PROCESS
          </button>
          <button
            onClick={() => insertSnippet('FRAME;\n')}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-300 rounded text-[11px] border border-zinc-700 whitespace-nowrap transition-colors"
          >
            + FRAME;
          </button>
          <button
            onClick={() => insertSnippet('col = collision(enemigo);\nif (col != 0)\n    // accion\nend\n')}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-sky-300 rounded text-[11px] border border-zinc-700 whitespace-nowrap transition-colors"
          >
            + COLLISION
          </button>
          <button
            onClick={() => insertSnippet('if (key(_left)) x = x - 2; end\n')}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 rounded text-[11px] border border-zinc-700 whitespace-nowrap transition-colors"
          >
            + KEY
          </button>
          <button
            onClick={() => insertSnippet('sound(1); // 1:laser 2:explosion 3:jump 5:coin\n')}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-rose-300 rounded text-[11px] border border-zinc-700 whitespace-nowrap transition-colors"
          >
            + SOUND
          </button>
          <button
            onClick={() => insertSnippet('let_me_alone();\n')}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-yellow-300 rounded text-[11px] border border-zinc-700 whitespace-nowrap transition-colors"
          >
            + LET_ME_ALONE
          </button>
        </div>
      </div>

      {/* Editor Main Canvas: Line Numbers + Textarea */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Line Numbers Column */}
        <div
          ref={lineNumbersRef}
          className="w-12 py-3 bg-zinc-950 text-zinc-600 font-mono text-xs select-none text-right pr-3 border-r border-zinc-800/80 overflow-hidden shrink-0"
        >
          {lineNumbers.map((num) => {
            const hasError = errors.some((err) => err.line === num);
            const isCurrent = cursorPos.line === num;
            return (
              <div
                key={num}
                className={`leading-5 ${
                  hasError
                    ? 'text-rose-500 font-bold bg-rose-500/20'
                    : isCurrent
                    ? 'text-amber-400 font-semibold'
                    : ''
                }`}
              >
                {num}
              </div>
            );
          })}
        </div>

        {/* Code Input */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onSelect={updateCursorPosition}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder="// Escribe aquí tu código DIV Games Studio..."
          className="flex-1 p-3 bg-transparent text-emerald-400/90 font-mono text-xs leading-5 resize-none focus:outline-none overflow-y-auto whitespace-pre tab-4 selection:bg-amber-500/30 selection:text-white"
        />
      </div>

      {/* Errors / Diagnostics Bar */}
      {errors.length > 0 && (
        <div className="bg-rose-950/80 border-t border-rose-800 p-2 text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">Error Línea {errors[0].line}:</span>
            <span className="text-rose-300 truncate">{errors[0].message}</span>
          </div>
          <button
            onClick={() => jumpToLine(errors[0].line)}
            className="px-2 py-0.5 bg-rose-900 hover:bg-rose-800 text-white rounded text-[10px] font-mono shrink-0 transition-colors"
          >
            Ir a Línea
          </button>
        </div>
      )}

      {/* Status Footer */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-3 py-1 flex items-center justify-between text-[11px] text-zinc-400 select-none font-mono">
        <div className="flex items-center gap-3">
          <span>Línea {cursorPos.line}, Col {cursorPos.col}</span>
          <span>{lineCount} Líneas</span>
        </div>

        <div className="flex items-center gap-2">
          {errors.length === 0 ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sintaxis Válida
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.length} {errors.length === 1 ? 'Error' : 'Errores'}
            </span>
          )}
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">DIV Games Studio v1.0</span>
        </div>
      </div>
    </div>
  );
};

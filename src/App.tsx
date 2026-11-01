/**
 * DIV-8 Fantasy Console - Main Application
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { ScreenCanvas } from './components/ScreenCanvas';
import { VirtualGamepad } from './components/VirtualGamepad';
import { SpriteEditor } from './components/SpriteEditor';
import { SfxStudio } from './components/SfxStudio';
import { ReferenceDocs } from './components/ReferenceDocs';
import { ProcessInspector } from './components/ProcessInspector';
import { CARTRIDGES } from './demos';
import { newProjectTemplate } from './demos/newProject';
import { Cartridge, CompilerError, GamepadState, Sprite } from './engine/types';
import { DivCompiler } from './engine/compiler';
import { DivRuntime } from './engine/runtime';
import { audio } from './engine/audio';
import { DEFAULT_SPRITES } from './engine/sprites';
import { Code2, Paintbrush, Music, BookOpen, Sparkles, X } from 'lucide-react';

export default function App() {
  const [currentCartridge, setCurrentCartridge] = useState<Cartridge>(CARTRIDGES[0]);
  const [code, setCode] = useState<string>(CARTRIDGES[0].code);
  const [sprites, setSprites] = useState<Sprite[]>([...DEFAULT_SPRITES]);
  const [errors, setErrors] = useState<CompilerError[]>([]);
  const [activeTab, setActiveTab] = useState<'code' | 'sprites' | 'sfx' | 'docs'>('code');
  const [newProjectModal, setNewProjectModal] = useState<{ name: string; author: string } | null>(null);

  // Runtime State
  const runtimeRef = useRef<DivRuntime>(new DivRuntime());
  const runtime = runtimeRef.current;

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [processCount, setProcessCount] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'warn' | 'error'; timestamp: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup runtime log hook
  useEffect(() => {
    runtime.onLog = (msg, type) => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLogs((prev) => [...prev.slice(-49), { msg, type, timestamp: timeStr }]);
    };

    runtime.onStatsUpdate = (stats) => {
      setFps(stats.fps);
      setProcessCount(stats.processCount);
      setFrameCount(stats.frame);
    };
  }, [runtime]);

  // Sync sprites to runtime whenever updated
  useEffect(() => {
    runtime.sprites = sprites;
  }, [sprites, runtime]);

  // Execute / Run current code
  const handleRun = () => {
    const compileResult = DivCompiler.compile(code);
    if (compileResult.errors.length > 0) {
      setErrors(compileResult.errors);
      setActiveTab('code');
      return;
    }

    setErrors([]);
    runtime.reset();

    try {
      const runnerBuilder = compileResult.compiled!.createRunner(runtime);
      runtime.globals = runnerBuilder.initGlobals();
      runnerBuilder.initProcesses(runtime);

      setIsRunning(true);
      setIsPaused(false);

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLogs((prev) => [
        ...prev.slice(-49),
        { msg: `Juego '${currentCartridge.title}' iniciado con éxito`, type: 'info', timestamp: timeStr },
      ]);
    } catch (err: any) {
      console.error('Execution error:', err);
      setErrors([
        {
          line: 1,
          column: 1,
          message: err.message || 'Error al ejecutar el programa',
        },
      ]);
    }
  };

  // Stop running game
  const handleStop = () => {
    runtime.stop();
    setIsRunning(false);
    setIsPaused(false);
  };

  // Toggle Pause
  const handleTogglePause = () => {
    if (!isRunning) {
      handleRun();
      return;
    }
    runtime.pause();
    setIsPaused(runtime.isPaused);
  };

  // Step 1 frame
  const handleStep = () => {
    if (isRunning && isPaused) {
      runtime.step();
      setFrameCount(runtime.frameCount);
      setProcessCount(runtime.processes.length);
    }
  };

  // Reset current game
  const handleReset = () => {
    handleRun();
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audio.setMuted(nextMuted);
  };

  // Toggle CRT effect
  const handleToggleCrt = () => {
    setCrtEnabled(!crtEnabled);
  };

  // Select Cartridge
  const handleSelectCartridge = (cart: Cartridge) => {
    setCurrentCartridge(cart);
    setCode(cart.code);
    setErrors([]);
    handleStop();
  };

  // New Empty Project: pide el nombre del juego antes de crearlo
  const handleNewProject = () => {
    setNewProjectModal({ name: '', author: 'Usuario' });
  };

  const handleCreateProject = () => {
    if (!newProjectModal) return;
    const title = newProjectModal.name.trim() || 'Mi Nuevo Juego';
    const author = newProjectModal.author.trim() || 'Usuario';

    const newCart: Cartridge = {
      id: `custom_${Date.now()}`,
      title,
      author,
      description: 'Proyecto creado en DIV-8',
      code: newProjectTemplate(title, author),
    };
    setCurrentCartridge(newCart);
    setCode(newCart.code);
    setErrors([]);
    setNewProjectModal(null);
    handleStop();
    setActiveTab('code');
  };

  // Export Cartridge as JSON or text
  const handleExportCartridge = () => {
    const data = {
      title: currentCartridge.title,
      author: currentCartridge.author,
      description: currentCartridge.description,
      code,
      sprites,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCartridge.id || 'juego'}.div8`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Cartridge File
  const handleImportCartridge = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        // Check if JSON format
        if (text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          if (parsed.code) {
            setCode(parsed.code);
            if (parsed.sprites) setSprites(parsed.sprites);
            setCurrentCartridge({
              id: `imported_${Date.now()}`,
              title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
              author: parsed.author || 'Importado',
              description: parsed.description || 'Cartucho cargado externamente',
              code: parsed.code,
            });
          }
        } else {
          // Plain DIV code file
          setCode(text);
          setCurrentCartridge({
            id: `imported_${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            author: 'Importado',
            description: 'Código cargado externamente',
            code: text,
          });
        }
        handleStop();
        setActiveTab('code');
      } catch (err) {
        console.error('Error importing cartridge:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Virtual Gamepad Handlers
  const handleButtonDown = (btn: keyof GamepadState) => {
    runtime.input[btn] = true;
  };

  const handleButtonUp = (btn: keyof GamepadState) => {
    runtime.input[btn] = false;
  };

  // Global Keyboard Shortcuts (F5 to run, etc.)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [code, currentCartridge]);

  // Auto-run default cartridge on initial load for instant excitement
  useEffect(() => {
    handleRun();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Hidden File Input for .div8 cartridges */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".div8,.txt,.div,.prg,.json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header */}
      <Header
        currentCartridge={currentCartridge}
        onSelectCartridge={handleSelectCartridge}
        isRunning={isRunning}
        isPaused={isPaused}
        isMuted={isMuted}
        crtEnabled={crtEnabled}
        onRun={handleRun}
        onStop={handleStop}
        onPause={handleTogglePause}
        onStep={handleStep}
        onReset={handleReset}
        onToggleMute={handleToggleMute}
        onToggleCrt={handleToggleCrt}
        onExport={handleExportCartridge}
        onImport={handleImportCartridge}
        onNew={handleNewProject}
      />

      {/* Main Split Layout: Left Editor / Right Fantasy Console */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANE: Editor & Studio Tools */}
        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950 overflow-hidden h-[50vh] lg:h-full">
          {/* Navigation Tabs */}
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-3 py-1 flex items-center gap-1 overflow-x-auto text-xs select-none">
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'code'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Código DIV</span>
            </button>

            <button
              onClick={() => setActiveTab('sprites')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'sprites'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Paintbrush className="w-4 h-4" />
              <span>Sprites (Graph)</span>
            </button>

            <button
              onClick={() => setActiveTab('sfx')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'sfx'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Sonido SFX</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 transition-all font-mono ${
                activeTab === 'docs'
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-amber-500/30 shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Manual DIV</span>
            </button>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'code' && (
              <CodeEditor
                code={code}
                onChange={setCode}
                errors={errors}
                onInsertSnippet={(snippet) => setCode((prev) => prev + snippet)}
              />
            )}

            {activeTab === 'sprites' && (
              <SpriteEditor
                sprites={sprites}
                onUpdateSprite={(updated) => {
                  setSprites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                }}
              />
            )}

            {activeTab === 'sfx' && <SfxStudio />}

            {activeTab === 'docs' && (
              <ReferenceDocs
                onInsertCode={(snippet) => {
                  setCode((prev) => prev + '\n' + snippet);
                  setActiveTab('code');
                }}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANE: Fantasy Console Screen, Virtual Gamepad & Inspector */}
        <div className="w-full lg:w-1/2 flex flex-col bg-zinc-950 p-3 sm:p-4 gap-3 overflow-y-auto h-[50vh] lg:h-full items-center justify-between">
          {/* Virtual Retro Screen */}
          <ScreenCanvas
            runtime={runtime}
            isRunning={isRunning}
            isPaused={isPaused}
            crtEnabled={crtEnabled}
            fps={fps}
            processCount={processCount}
            frameCount={frameCount}
            onTogglePause={handleTogglePause}
          />

          {/* Virtual Gamepad Controller */}
          <VirtualGamepad
            inputState={runtime.input}
            onButtonDown={handleButtonDown}
            onButtonUp={handleButtonUp}
          />

          {/* Real-time Process Inspector & Debugger */}
          <div className="w-full max-w-[560px]">
            <ProcessInspector
              processes={runtime.processes}
              globals={runtime.globals}
              logs={logs}
              onClearLogs={() => setLogs([])}
            />
          </div>
        </div>
      </div>

      {/* Modal: Nuevo Proyecto */}
      {newProjectModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setNewProjectModal(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setNewProjectModal(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateProject();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="font-pixel text-xs text-amber-300">NUEVO PROYECTO</h2>
              </div>
              <button
                type="button"
                onClick={() => setNewProjectModal(null)}
                title="Cancelar"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <label className="block">
                <span className="block text-xs text-zinc-400 mb-1">Nombre del juego</span>
                <input
                  autoFocus
                  type="text"
                  value={newProjectModal.name}
                  onChange={(e) => setNewProjectModal({ ...newProjectModal, name: e.target.value })}
                  placeholder="Mi Nuevo Juego"
                  maxLength={60}
                  className="w-full bg-zinc-950 text-zinc-100 border border-zinc-700 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="block text-xs text-zinc-400 mb-1">Autor</span>
                <input
                  type="text"
                  value={newProjectModal.author}
                  onChange={(e) => setNewProjectModal({ ...newProjectModal, author: e.target.value })}
                  placeholder="Usuario"
                  maxLength={60}
                  className="w-full bg-zinc-950 text-zinc-100 border border-zinc-700 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-amber-400"
                />
              </label>

              <p className="text-[11px] text-zinc-500">
                Se creará una plantilla con movimiento, marcador y una función de ejemplo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800 bg-zinc-950">
              <button
                type="button"
                onClick={() => setNewProjectModal(null)}
                className="px-3 py-2 text-xs font-mono text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold font-mono text-white bg-amber-600 hover:bg-amber-500 rounded shadow transition-colors active:scale-95"
              >
                Crear juego
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

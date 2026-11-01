/**
 * DIV-8 Compiler / Transpiler
 * Transpiles DIV Games Studio and DivGO syntax into JavaScript Generator functions.
 * Full support for processes, local/private blocks, multiscroll, tilemaps, and array initializers.
 */
import { CompilerError } from './types';

export interface CompiledProgram {
  globalCode: string;
  processNames: string[];
  jsCode: string;
  createRunner: (engine: any) => {
    initGlobals: () => Record<string, any>;
    initProcesses: (engine: any) => void;
  };
}

// Built-in process properties that belong to `self`
const PROCESS_PROPS = new Set([
  'x', 'y', 'z', 'graph', 'size', 'angle', 'flags', 'alpha',
  'id', 'type', 'father', 'ctype', 'file'
]);

// DIV Built-in constants
const DIV_CONSTANTS: Record<string, any> = {
  // Keys
  _up: 'up', _down: 'down', _left: 'left', _right: 'right',
  _space: 'a', _z: 'a', _x: 'b', _enter: 'start', _shift: 'select',
  _a: 'a', _b: 'b', _c: 'c', _n: 'n', _m: 'm', _v: 'v',
  // Screen modes
  m320x200: 320200, m320x240: 320240, m640x400: 640400, m640x480: 640480, m800x600: 800600,
  // Signals
  s_kill: 0, s_freeze: 1, s_wakeup: 2, s_sleep: 3, all_process: -1,
  // Text align
  align_left: 'left', align_center: 'center', align_right: 'right',
  // Booleans & numbers
  true: 1, false: 0, verdadero: 1, falso: 0, pi: Math.PI,
  // DIV Scroll coordinates
  c_screen: 0, c_scroll: 1,
  // DIV Colors
  cc_black: 0, cc_white: 7, cc_red: 8, cc_blue: 12, cc_green: 11,
};

/**
 * Split text by a delimiter only at the top level
 * (ignoring delimiters inside parentheses, brackets, or string quotes).
 */
export function splitTopLevel(text: string, delimiter: string = ','): string[] {
  const parts: string[] = [];
  let current = '';
  let depthParen = 0;
  let depthBracket = 0;
  let inString: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      current += char;
      if (char === inString && text[i - 1] !== '\\') {
        inString = null;
      }
    } else {
      if (char === '"' || char === "'") {
        inString = char;
        current += char;
      } else if (char === '(') {
        depthParen++;
        current += char;
      } else if (char === ')') {
        depthParen--;
        current += char;
      } else if (char === '[') {
        depthBracket++;
        current += char;
      } else if (char === ']') {
        depthBracket--;
        current += char;
      } else if (char === delimiter && depthParen === 0 && depthBracket === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  if (current.trim().length > 0) {
    parts.push(current.trim());
  }
  return parts;
}

export class DivCompiler {
  public static compile(sourceCode: string): { compiled?: CompiledProgram; errors: CompilerError[] } {
    const errors: CompilerError[] = [];
    try {
      const cleanLines = DivCompiler.stripCommentsPreservingLines(sourceCode);
      const cleanText = cleanLines.join('\n');
      const processNames = DivCompiler.findProcessNames(cleanText);
      const globalVarNames = DivCompiler.findGlobalVariables(cleanText);
      const transpiledJS = DivCompiler.transpileToJS(cleanLines, processNames, globalVarNames);
      const factory = new Function('DIV_CONSTANTS', transpiledJS);
      const runnerBuilder = factory(DIV_CONSTANTS);

      return {
        compiled: {
          globalCode: '',
          processNames,
          jsCode: transpiledJS,
          createRunner: runnerBuilder,
        },
        errors: [],
      };
    } catch (err: any) {
      console.error('Compiler error:', err);
      const lineMatch = err.stack?.match(/<anonymous>:(\d+):(\d+)/);
      const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 1;
      errors.push({
        line: lineNum,
        column: 1,
        message: err.message || 'Error de sintaxis en el código DIV',
      });
      return { errors };
    }
  }

  private static stripCommentsPreservingLines(code: string): string[] {
    const lines = code.split('\n');
    let insideMultiLineComment = false;
    return lines.map((line) => {
      let out = '';
      let i = 0;
      let inString: string | null = null;
      while (i < line.length) {
        const char = line[i];
        if (insideMultiLineComment) {
          if (char === '*' && line[i + 1] === '/') {
            insideMultiLineComment = false;
            out += '  ';
            i += 2;
          } else {
            out += ' ';
            i++;
          }
          continue;
        }
        if (inString) {
          if (char === '\\') {
            out += line.substring(i, i + 2);
            i += 2;
            continue;
          }
          if (char === inString) {
            inString = null;
          }
          out += char;
          i++;
          continue;
        }
        if (char === "'" && (i === 0 || /\s/.test(line[i - 1]))) {
          out += ' '.repeat(line.length - i);
          break;
        }
        if (char === '"' || char === "'") {
          if (char === "'" && i < line.length - 2 && line[i + 2] === "'") {
            out += ' '.repeat(line.length - i);
            break;
          }
          inString = char;
          out += char;
          i++;
        } else if (char === '/' && line[i + 1] === '*') {
          insideMultiLineComment = true;
          out += '  ';
          i += 2;
        } else if (char === '/' && line[i + 1] === '/') {
          out += ' '.repeat(line.length - i);
          break;
        } else {
          out += char;
          i++;
        }
      }
      return out;
    });
  }

  private static findProcessNames(cleanText: string): string[] {
    const regex = /\b(?:process|proceso)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const names: string[] = [];
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      names.push(match[1]);
    }
    const progMatch = /\b(?:program|programa)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i.exec(cleanText);
    if (progMatch) {
      names.push(progMatch[1]);
    }
    return Array.from(new Set(names));
  }

  private static findGlobalVariables(cleanText: string): Set<string> {
    const globals = new Set<string>();
    const globalBlockRegex = /\b(?:global|globales)\b([\s\S]*?)(?=\b(?:process|proceso|local|locales|private|privadas|begin|inicio|program|programa)\b|$)/gi;
    let match;
    while ((match = globalBlockRegex.exec(cleanText)) !== null) {
      const block = match[1];
      const decls = block.split(/[;\n]/);
      for (const decl of decls) {
        const trimmed = decl.trim();
        if (!trimmed) continue;
        const varPart = trimmed.split(/[=\[]/)[0];
        const names = varPart.split(/[,;]/);
        for (const n of names) {
          const varName = n.trim().replace(/^constantes:|^tablas:/, '');
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            globals.add(varName);
          }
        }
      }
    }
    return globals;
  }

  private static transpileToJS(
    lines: string[],
    processNames: string[],
    globalVars: Set<string>
  ): string {
    const processDefs: string[] = [];
    const globalInits: string[] = [];
    let initialProcessToRun = '';
    let currentProcessName: string | null = null;
    let currentProcessParams: string[] = [];
    let currentProcessLocals = new Map<string, string>();
    let currentProcessBody: string[] = [];
    let insideGlobalBlock = false;
    let insideLocalBlock = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      let line = lines[lineIdx].trim();
      if (!line) continue;

      const progMatch = line.match(/^(?:program|programa)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (progMatch) {
        currentProcessName = progMatch[1];
        initialProcessToRun = currentProcessName;
        currentProcessParams = [];
        currentProcessLocals = new Map<string, string>();
        currentProcessBody = [];
        insideGlobalBlock = false;
        insideLocalBlock = false;
        continue;
      }

      if (/^(?:global|globales)\b/i.test(line)) {
        insideGlobalBlock = true;
        insideLocalBlock = false;
        const rest = line.replace(/^(?:global|globales)\b/i, '').trim();
        if (rest) DivCompiler.parseGlobalVarLine(rest, globalVars, globalInits);
        continue;
      }

      const procMatch = line.match(/^(?:process|proceso)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(([^)]*)\))?/i);
      if (procMatch) {
        if (currentProcessName) {
          processDefs.push(
            DivCompiler.buildProcessJS(currentProcessName, currentProcessParams, currentProcessLocals, currentProcessBody, processNames, globalVars)
          );
        }
        insideGlobalBlock = false;
        insideLocalBlock = false;
        currentProcessName = procMatch[1];
        if (!initialProcessToRun || currentProcessName.toLowerCase() === 'main' || currentProcessName.toLowerCase() === 'inicio') {
          initialProcessToRun = currentProcessName;
        }
        currentProcessParams = procMatch[2] ? procMatch[2].split(',').map((p) => p.trim()).filter(Boolean) : [];
        currentProcessLocals = new Map<string, string>();
        currentProcessBody = [];
        continue;
      }

      if (/^(?:local|locales|private|privadas)\b/i.test(line)) {
        insideLocalBlock = true;
        insideGlobalBlock = false;
        const rest = line.replace(/^(?:local|locales|private|privadas)\b/i, '').trim();
        if (rest) DivCompiler.parseLocalVarLine(rest, currentProcessLocals);
        continue;
      }

      if (insideGlobalBlock) {
        if (/^(?:begin|inicio|process|proceso|local|locales|private|privadas)\b/i.test(line)) {
          insideGlobalBlock = false;
          if (/^(?:local|locales|private|privadas)\b/i.test(line)) {
            insideLocalBlock = true;
            const rest = line.replace(/^(?:local|locales|private|privadas)\b/i, '').trim();
            if (rest) DivCompiler.parseLocalVarLine(rest, currentProcessLocals);
            continue;
          }
        } else {
          DivCompiler.parseGlobalVarLine(line, globalVars, globalInits);
          continue;
        }
      }

      if (insideLocalBlock) {
        if (/^(?:begin|inicio)\b/i.test(line)) {
          insideLocalBlock = false;
          continue;
        } else {
          DivCompiler.parseLocalVarLine(line, currentProcessLocals);
          continue;
        }
      }

      if (currentProcessName) {
        if (/^(?:begin|inicio);?$/i.test(line)) continue;
        currentProcessBody.push(line);
      } else {
        if (!/^(?:begin|inicio);?$/i.test(line)) {
          globalInits.push(DivCompiler.transpileStatement(line, processNames, globalVars, new Set(), null));
        }
      }
    }

    if (currentProcessName) {
      processDefs.push(
        DivCompiler.buildProcessJS(currentProcessName, currentProcessParams, currentProcessLocals, currentProcessBody, processNames, globalVars)
      );
    }

    if (processDefs.length === 0) {
      initialProcessToRun = 'main';
      processDefs.push(`
        engine.registerProcess('main', function* (self) {
          self.graph = 0;
          ${globalInits.join('\n')}
          while (true) { yield; }
        });
      `);
    }

    return `
      return function(engine) {
        return {
          initGlobals: function() {
            var g = {};
            ${Array.from(globalVars).map((v) => `g['${v}'] = 0;`).join('\n')}
            ${globalInits.join('\n')}
            return g;
          },
          initProcesses: function(engine) {
            ${processDefs.join('\n\n')}
            ${initialProcessToRun ? `engine.spawn('${initialProcessToRun}');` : ''}
          }
        };
      };
    `;
  }

  private static parseGlobalVarLine(line: string, varSet: Set<string>, outputLines: string[]) {
    const clean = line.replace(/;+$/, '').trim();
    if (!clean) return;

    // Support array literal declaration: name[] = v1, v2, ...
    const emptyArrayMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\]\s*=\s*(.+)$/);
    if (emptyArrayMatch) {
      const name = emptyArrayMatch[1];
      varSet.add(name);
      const elements = splitTopLevel(emptyArrayMatch[2], ',').map((v) => v.trim()).filter(Boolean);
      outputLines.push(`g['${name}'] = [${elements.join(', ')}];`);
      return;
    }

    const decls = clean.split(/[;,]/);
    for (const part of decls) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const arrayMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[([^\]]+)\](?:\s*=\s*(.+))?$/);
      if (arrayMatch) {
        const name = arrayMatch[1];
        const dimsStr = arrayMatch[2];
        varSet.add(name);
        const dims = dimsStr.split(',').map((d) => d.trim());
        let initCode = '';
        if (dims.length === 1) initCode = `new Array(${dims[0]}).fill(0)`;
        else if (dims.length === 2) initCode = `Array.from({length: ${dims[0]}}, () => new Array(${dims[1]}).fill(0))`;
        else if (dims.length === 3) initCode = `Array.from({length: ${dims[0]}}, () => Array.from({length: ${dims[1]}}, () => new Array(${dims[2]}).fill(0)))`;
        else initCode = `[]`;
        outputLines.push(`g['${name}'] = ${initCode};`);
        continue;
      }

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const name = trimmed.substring(0, eqIdx).trim();
        const expr = trimmed.substring(eqIdx + 1).trim();
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          varSet.add(name);
          outputLines.push(`g['${name}'] = ${expr || 0};`);
        }
      } else {
        const name = trimmed;
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          varSet.add(name);
          outputLines.push(`g['${name}'] = 0;`);
        }
      }
    }
  }

  private static parseLocalVarLine(line: string, localVarMap: Map<string, string>) {
    const clean = line.replace(/;+$/, '').trim();
    if (!clean) return;

    // Support array literal declaration: name[] = v1, v2, ...
    const emptyArrayMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\]\s*=\s*(.+)$/);
    if (emptyArrayMatch) {
      const name = emptyArrayMatch[1];
      const elements = splitTopLevel(emptyArrayMatch[2], ',').map((v) => v.trim()).filter(Boolean);
      localVarMap.set(name, `[${elements.join(', ')}]`);
      return;
    }

    const decls = clean.split(/[;,]/);
    for (const part of decls) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const arrayMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[([^\]]+)\](?:\s*=\s*(.+))?$/);
      if (arrayMatch) {
        const name = arrayMatch[1];
        const dimsStr = arrayMatch[2];
        const dims = dimsStr.split(',').map((d) => d.trim());
        let initCode = '';
        if (dims.length === 1) initCode = `new Array(${dims[0]}).fill(0)`;
        else if (dims.length === 2) initCode = `Array.from({length: ${dims[0]}}, () => new Array(${dims[1]}).fill(0))`;
        else if (dims.length === 3) initCode = `Array.from({length: ${dims[0]}}, () => Array.from({length: ${dims[1]}}, () => new Array(${dims[2]}).fill(0)))`;
        else initCode = `[]`;
        localVarMap.set(name, initCode);
        continue;
      }

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const name = trimmed.substring(0, eqIdx).trim();
        const expr = trimmed.substring(eqIdx + 1).trim();
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) localVarMap.set(name, expr || '0');
      } else {
        const name = trimmed;
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) localVarMap.set(name, '0');
      }
    }
  }

  private static buildProcessJS(
    name: string, params: string[], localsMap: Map<string, string>, bodyLines: string[], processNames: string[], globalVars: Set<string>
  ): string {
    const transpiledStatements: string[] = [];
    let blockDepth = 0;
    const localNames = new Set(localsMap.keys());

    params.forEach((p) => {
      const cleanP = p.trim();
      if (PROCESS_PROPS.has(cleanP.toLowerCase())) {
        transpiledStatements.push(`if (${cleanP} !== undefined) self.${cleanP.toLowerCase()} = ${cleanP};`);
      } else {
        localNames.add(cleanP);
        transpiledStatements.push(`self.locals['${cleanP}'] = ${cleanP};`);
      }
    });

    localsMap.forEach((initExpr, varName) => {
      const transInit = initExpr.includes('Array') || initExpr.startsWith('[')
        ? initExpr
        : DivCompiler.transpileExpression(initExpr, processNames, globalVars, localNames);
      transpiledStatements.push(`self.locals['${varName}'] = ${transInit};`);
    });

    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i].trim();
      if (!line) continue;

      if (/^(?:end|fin);?$/i.test(line)) {
        if (blockDepth > 0) { blockDepth--; transpiledStatements.push('}'); }
        continue;
      }
      if (/^(?:loop|bucle);?$/i.test(line)) { blockDepth++; transpiledStatements.push('while (true) {'); continue; }
      if (/^(?:repeat|repite);?$/i.test(line)) { blockDepth++; transpiledStatements.push('do {'); continue; }
      if (/^(?:until|hasta)\b/i.test(line)) {
        if (blockDepth > 0) blockDepth--;
        const condStr = line.replace(/^(?:until|hasta)\s*/i, '').replace(/;+$/, '').trim();
        const cond = DivCompiler.transpileExpression(condStr, processNames, globalVars, localNames);
        transpiledStatements.push(`} while (!(${cond}));`);
        continue;
      }
      if (/^(?:else|sino);?$/i.test(line)) { transpiledStatements.push('} else {'); continue; }
      if (/^(?:for|para)\b/i.test(line)) {
        const forMatch = line.match(/^(?:for|para)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+?)\s+(?:to|hasta)\s+(.+?)(?:\s+(?:step|paso)\s+(.+?))?$/i);
        if (forMatch) {
          blockDepth++;
          const varName = forMatch[1]; localNames.add(varName);
          const start = DivCompiler.transpileExpression(forMatch[2], processNames, globalVars, localNames);
          const end = DivCompiler.transpileExpression(forMatch[3], processNames, globalVars, localNames);
          const step = forMatch[4] ? DivCompiler.transpileExpression(forMatch[4], processNames, globalVars, localNames) : '1';
          transpiledStatements.push(`for (self.locals['${varName}'] = ${start}; self.locals['${varName}'] <= ${end}; self.locals['${varName}'] += ${step}) {`);
          continue;
        }
      }
      if (/^(?:while|mientras)\b/i.test(line)) {
        blockDepth++;
        const afterWhile = line.replace(/^(?:while|mientras)\s*/i, '').replace(/\s*(?:do|hacer);?$/i, '').trim();
        const cond = DivCompiler.transpileExpression(afterWhile, processNames, globalVars, localNames);
        transpiledStatements.push(`while (${cond}) {`);
        continue;
      }
      if (/^(?:recorre|recorrer)\s+([a-zA-Z_][a-zA-Z0-9_]*):?$/i.test(line)) {
        blockDepth++;
        const targetProc = line.match(/^(?:recorre|recorrer)\s+([a-zA-Z_][a-zA-Z0-9_]*):?$/i)![1];
        transpiledStatements.push(`for (let __inst of engine.getProcessesByType('${targetProc}')) {`);
        continue;
      }
      if (/^(?:if|si)\b/i.test(line)) {
        const res = DivCompiler.transpileIf(line, processNames, globalVars, localNames, name);
        if (res.isBlock) blockDepth++;
        transpiledStatements.push(res.code);
        continue;
      }

      const stmt = DivCompiler.transpileStatement(line, processNames, globalVars, localNames, name);
      if (stmt) transpiledStatements.push(stmt);
    }

    while (blockDepth > 0) { transpiledStatements.push('}'); blockDepth--; }

    return `
      engine.registerProcess('${name.toLowerCase()}', function* (self, ${params.join(', ')}) {
        ${transpiledStatements.join('\n        ')}
      });
    `;
  }

  private static transpileIf(
    line: string, processNames: string[], globalVars: Set<string>, locals: Set<string>, currentProcess: string | null
  ): { code: string; isBlock: boolean } {
    const afterIf = line.replace(/^(?:if|si)\s*/i, '').trim();
    let cond = '';
    let rest = '';
    if (afterIf.startsWith('(')) {
      let depth = 1;
      let closeIdx = -1;
      for (let i = 1; i < afterIf.length; i++) {
        if (afterIf[i] === '(') depth++;
        else if (afterIf[i] === ')') {
          depth--;
          if (depth === 0) { closeIdx = i; break; }
        }
      }
      if (closeIdx !== -1) { cond = afterIf.substring(1, closeIdx); rest = afterIf.substring(closeIdx + 1).trim(); }
      else cond = afterIf;
    } else {
      const thenMatch = afterIf.match(/^(.*?)\s+(?:then|entonces)\s*(.*)$/i);
      if (thenMatch) { cond = thenMatch[1]; rest = thenMatch[2]; }
      else cond = afterIf;
    }
    rest = rest.replace(/^(?:then|entonces)\s*/i, '').trim();
    let isInline = false;
    if (/;\s*(?:end|fin);?$/i.test(rest) || /\s+(?:end|fin);?$/i.test(rest)) {
      rest = rest.replace(/\s*(?:end|fin);?$/i, '').trim(); isInline = true;
    } else if (rest && rest !== ';') isInline = true;

    const transpiledCond = DivCompiler.transpileExpression(cond, processNames, globalVars, locals);
    if (isInline && rest) {
      const innerStmts = splitTopLevel(rest, ';').map((st) => DivCompiler.transpileStatement(st, processNames, globalVars, locals, currentProcess)).filter(Boolean).join(' ');
      return { code: `if (${transpiledCond}) { ${innerStmts} }`, isBlock: false };
    } else {
      return { code: `if (${transpiledCond}) {`, isBlock: true };
    }
  }

  public static transpileStatement(line: string, processNames: string[], globalVars: Set<string>, locals: Set<string>, _currentProcess: string | null): string {
    let s = line.trim();
    if (!s) return '';

    if (/^(?:end|fin);?$/i.test(s)) return '';
    if (/^(?:frame|cuadro)\s*(?:\(([^)]*)\))?;?$/i.test(s)) return 'yield;';
    if (/^(?:break|rompe|salir);?$/i.test(s)) return 'break;';
    
    if (/^(?:if|si)\b/i.test(s)) {
      const res = DivCompiler.transpileIf(s, processNames, globalVars, locals, _currentProcess);
      return res.code;
    }

    const retMatch = s.match(/^(?:return|retorna|regresa)\s*(.*);?$/i);
    if (retMatch) {
      const expr = retMatch[1] ? DivCompiler.transpileExpression(retMatch[1], processNames, globalVars, locals) : '';
      return `return ${expr};`;
    }
    if (/^(?:let_me_alone|dejame_solo|solo_yo)\s*\(\s*\);?$/i.test(s)) return 'engine.letMeAlone(self);';

    const signalMatch = s.match(/^(?:signal|senal)\s*\((.+?)\);?$/i);
    if (signalMatch) {
      const args = splitTopLevel(signalMatch[1], ',').map((a) => DivCompiler.transpileExpression(a, processNames, globalVars, locals)).join(', ');
      return `engine.signal(${args});`;
    }

    const setModeMatch = s.match(/^(?:set_mode|setmode|modo_pantalla)\s*\((.+?)\);?$/i);
    if (setModeMatch) {
      const args = splitTopLevel(setModeMatch[1], ',').map((a) => DivCompiler.transpileExpression(a, processNames, globalVars, locals)).join(', ');
      return `engine.setMode(${args});`;
    }

    const ventanaMatch = s.match(/^(?:ventana|window)\s+(.+?);?$/i);
    if (ventanaMatch) {
      const parts = splitTopLevel(ventanaMatch[1], ',');
      if (parts.length >= 2) {
        const w = DivCompiler.transpileExpression(parts[0], processNames, globalVars, locals);
        const h = DivCompiler.transpileExpression(parts[1], processNames, globalVars, locals);
        return `engine.setMode(${w}, ${h});`;
      }
    }

    // Array literal assignment: arr[] = 1, 2, 3;
    const arrayLiteralMatch = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\]\s*=\s*(.+)$/);
    if (arrayLiteralMatch) {
      const name = arrayLiteralMatch[1];
      const elements = splitTopLevel(arrayLiteralMatch[2].replace(/;+$/, ''), ',')
        .map((v) => DivCompiler.transpileExpression(v.trim(), processNames, globalVars, locals))
        .join(', ');
      if (globalVars.has(name)) {
        return `engine.globals['${name}'] = [${elements}];`;
      } else {
        return `self.locals['${name}'] = [${elements}];`;
      }
    }

    // Scroll camera assignment: scroll.camera = id or scroll[0].camera = id
    const scrollPropMatch = s.match(/^scroll(\[[^\]]+\])?\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/i);
    if (scrollPropMatch) {
      const idxStr = scrollPropMatch[1] || '';
      const prop = scrollPropMatch[2];
      const rhs = DivCompiler.transpileExpression(scrollPropMatch[3].replace(/;+$/, ''), processNames, globalVars, locals);
      return `engine.scroll${idxStr}.${prop} = ${rhs};`;
    }

    const semiParts = splitTopLevel(s, ';');
    if (semiParts.length > 1) {
      return semiParts.map((part) => DivCompiler.transpileStatement(part, processNames, globalVars, locals, _currentProcess)).filter(Boolean).join(' ');
    }

    const procCallMatch = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\);?$/);
    if (procCallMatch && processNames.includes(procCallMatch[1])) {
      const pName = procCallMatch[1];
      const rawArgs = procCallMatch[2].trim();
      const args = rawArgs ? splitTopLevel(rawArgs, ',').map((a) => DivCompiler.transpileExpression(a, processNames, globalVars, locals)).join(', ') : '';
      return `engine.spawn('${pName}'${args ? ', ' + args : ''}, self.id);`;
    }

    let depthParen = 0;
    let depthBracket = 0;
    let inString: string | null = null;
    let assignOpIdx = -1;
    let assignOp = '';

    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (inString) {
        if (char === inString && s[i - 1] !== '\\') inString = null;
        continue;
      }
      if (char === '"' || char === "'") { inString = char; continue; }
      if (char === '(') depthParen++;
      else if (char === ')') depthParen--;
      else if (char === '[') depthBracket++;
      else if (char === ']') depthBracket--;

      if (depthParen === 0 && depthBracket === 0) {
        if (i < s.length - 1) {
          const twoChar = s.substring(i, i + 2);
          if (['+=', '-=', '*=', '/='].includes(twoChar)) { assignOpIdx = i; assignOp = twoChar; break; }
        }
        if (s[i] === '=' && s[i - 1] !== '!' && s[i - 1] !== '<' && s[i - 1] !== '>' && s[i - 1] !== '=' && s[i + 1] !== '=') {
          assignOpIdx = i; assignOp = '='; break;
        }
      }
    }

    if (assignOpIdx !== -1) {
      const lhsStr = s.substring(0, assignOpIdx).trim();
      const rhsStr = s.substring(assignOpIdx + assignOp.length).trim().replace(/;+$/, '');
      const lhs = DivCompiler.transpileLHS(lhsStr, globalVars, locals);
      const rhs = DivCompiler.transpileExpression(rhsStr, processNames, globalVars, locals);
      return `${lhs} ${assignOp} ${rhs};`;
    }

    const expr = DivCompiler.transpileExpression(s.replace(/;+$/, ''), processNames, globalVars, locals);
    return `${expr};`;
  }

  private static transpileLHS(lhs: string, globalVars: Set<string>, locals: Set<string>): string {
    let clean = lhs.trim();
    clean = DivCompiler.convertMultiDimArrays(clean);

    if (clean.startsWith('scroll.') || clean.startsWith('scroll[')) {
      return 'engine.' + clean;
    }

    const dotIdx = clean.indexOf('.');
    const bracketIdx = clean.indexOf('[');

    if (dotIdx !== -1 && (bracketIdx === -1 || dotIdx < bracketIdx)) {
      const obj = clean.substring(0, dotIdx).trim();
      const prop = clean.substring(dotIdx + 1).trim();
      if (PROCESS_PROPS.has(prop.toLowerCase())) {
        let objTranspiled = obj;
        const idMatch = obj.match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (idMatch) {
          const name = idMatch[1];
          if (PROCESS_PROPS.has(name.toLowerCase())) objTranspiled = `self.${name.toLowerCase()}`;
          else if (globalVars.has(name)) objTranspiled = `engine.globals['${name}']`;
          else objTranspiled = `self.locals['${name}']`;
        }
        return `engine.getProcessById(${objTranspiled})?.${prop.toLowerCase()}`;
      }
      return `${obj}['${prop}']`;
    }

    const idMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (idMatch) {
      const baseName = idMatch[1];
      const mLower = baseName.toLowerCase();
      let replacement = '';
      if (PROCESS_PROPS.has(mLower)) replacement = `self.${mLower}`;
      else if (globalVars.has(baseName)) replacement = `engine.globals['${baseName}']`;
      else if (locals.has(baseName)) replacement = `self.locals['${baseName}']`;
      else replacement = `self.locals['${baseName}']`;
      return replacement + clean.substring(baseName.length);
    }

    return clean;
  }

  private static convertMultiDimArrays(expr: string): string {
    let result = '';
    let i = 0;
    while (i < expr.length) {
      if (expr[i] === '[') {
        let depth = 1;
        let j = i + 1;
        while (j < expr.length && depth > 0) {
          if (expr[j] === '[') depth++;
          else if (expr[j] === ']') depth--;
          j++;
        }
        const inner = expr.substring(i + 1, j - 1);
        const parts = splitTopLevel(inner, ',');
        if (parts.length > 1) {
          const processedParts = parts.map((p) => DivCompiler.convertMultiDimArrays(p.trim()));
          result += processedParts.map((p) => `[${p}]`).join('');
        } else {
          result += `[${DivCompiler.convertMultiDimArrays(inner)}]`;
        }
        i = j;
      } else {
        result += expr[i];
        i++;
      }
    }
    return result;
  }

  private static extractCallArgs(expr: string, openParenIdx: number): { args: string[]; endIdx: number } {
    let depth = 1;
    let inString: string | null = null;
    let currentArg = '';
    const args: string[] = [];
    let i = openParenIdx + 1;

    while (i < expr.length) {
      const char = expr[i];

      if (inString) {
        currentArg += char;
        if (char === '\\') {
          i++;
          if (i < expr.length) {
            currentArg += expr[i];
          }
          i++;
          continue;
        }
        if (char === inString) {
          inString = null;
        }
        i++;
        continue;
      }

      if (char === '"' || char === "'") {
        inString = char;
        currentArg += char;
        i++;
        continue;
      }

      if (char === '(') {
        depth++;
        currentArg += char;
        i++;
        continue;
      }

      if (char === ')') {
        depth--;
        if (depth === 0) {
          if (currentArg.trim().length > 0) {
            args.push(currentArg.trim());
          }
          return { args, endIdx: i + 1 };
        }
        currentArg += char;
        i++;
        continue;
      }

      if (char === ',' && depth === 1) {
        args.push(currentArg.trim());
        currentArg = '';
        i++;
        continue;
      }

      currentArg += char;
      i++;
    }

    if (currentArg.trim().length > 0) {
      args.push(currentArg.trim());
    }

    return { args, endIdx: expr.length };
  }

  private static replaceCall(
    expr: string,
    aliases: string[],
    transformer: (args: string[]) => string
  ): string {
    const aliasSet = new Set(aliases.map((a) => a.toLowerCase()));
    let result = '';
    let lastIdx = 0;
    let i = 0;

    while (i < expr.length) {
      const c = expr[i];

      if (c === '"' || c === "'") {
        const quote = c;
        i++;
        while (i < expr.length) {
          if (expr[i] === '\\') {
            i += 2;
            continue;
          }
          if (expr[i] === quote) {
            i++;
            break;
          }
          i++;
        }
        continue;
      }

      if (/[a-zA-Z_$]/.test(c)) {
        const start = i;
        i++;
        while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
          i++;
        }

        const name = expr.substring(start, i);

        let previous = start - 1;
        while (previous >= 0 && /\s/.test(expr[previous])) {
          previous--;
        }

        if (previous >= 0 && expr[previous] === '.') {
          continue;
        }

        if (!aliasSet.has(name.toLowerCase())) {
          continue;
        }

        let openParenIdx = i;
        while (openParenIdx < expr.length && /\s/.test(expr[openParenIdx])) {
          openParenIdx++;
        }

        if (expr[openParenIdx] !== '(') {
          continue;
        }

        const { args, endIdx } = DivCompiler.extractCallArgs(expr, openParenIdx);
        result += expr.substring(lastIdx, start);
        result += transformer(args);
        lastIdx = endIdx;
        i = endIdx;
        continue;
      }

      i++;
    }

    result += expr.substring(lastIdx);
    return result;
  }

  public static transpileExpression(expr: string, processNames: string[], globalVars: Set<string>, locals: Set<string>): string {
    let e = expr.trim();
    if (!e) return '0';

    const strings: string[] = [];
    e = e.replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, (str) => {
      const placeholder = `__DIV_STR_${strings.length}__`;
      strings.push(str);
      return placeholder;
    });

    e = DivCompiler.convertMultiDimArrays(e);

    // DIV Operators
    e = e.replace(/<>/g, '!==');
    e = e.replace(/\band\b/gi, '&&');
    e = e.replace(/\bor\b/gi, '||');
    e = e.replace(/\bnot\b/gi, '!');
    e = e.replace(/(?<=[0-9a-zA-Z_\)\]])\s+y\s+(?=[0-9a-zA-Z_\(\[])/g, ' && ');
    e = e.replace(/(?<=[0-9a-zA-Z_\)\]])\s+o\s+(?=[0-9a-zA-Z_\(\[])/g, ' || ');
    e = e.replace(/([^=<>!])=([^=])/g, '$1===$2');

    // Pointer offset: offset var -> var
    e = e.replace(/\boffset\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi, '$1');

    const constantKeys = Object.keys(DIV_CONSTANTS).join('|');
    const constRegex = new RegExp(`\\b(${constantKeys})\\b`, 'gi');
    e = e.replace(constRegex, (m) => {
      const val = DIV_CONSTANTS[m.toLowerCase()];
      return typeof val === 'string' ? `'${val}'` : String(val);
    });

    const compileArgs = (args: string[]) => {
      return args.map((a) =>
        DivCompiler.transpileExpression(a, processNames, globalVars, locals)
      ).join(', ');
    };

    e = DivCompiler.replaceCall(
      e,
      ['len', 'length', 'sizeof'],
      (args) => {
        if (args.length !== 1) throw new Error('len() necesita un argumento');
        const value = DivCompiler.transpileExpression(args[0], processNames, globalVars, locals);
        return `(${value}).length`;
      }
    );

    e = DivCompiler.replaceCall(e, ['key', 'tecla'], (args) => `engine.key(${compileArgs(args)})`);

    e = DivCompiler.replaceCall(
      e,
      ['collision', 'colision'],
      (args) => {
        if (args.length !== 1) throw new Error('collision() necesita un argumento');
        const typeArg = args[0].trim();
        const stringMatch = typeArg.match(/^__DIV_STR_(\d+)__$/);
        let typeName: string;
        if (stringMatch) {
          typeName = strings[Number(stringMatch[1])];
        } else {
          typeName = `'${typeArg.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
        }
        return `engine.collision(self, ${typeName})`;
      }
    );

    e = DivCompiler.replaceCall(e, ['rand', 'aleatorio', 'rnd'], (args) => `engine.rand(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['sound', 'sonido'], (args) => `engine.playSound(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['write', 'escribe', 'print'], (args) => `engine.write(${compileArgs(args)})`);

    // DIV write_int(font, x, y, align, &var)
    e = DivCompiler.replaceCall(e, ['write_int', 'escribe_int'], (args) => {
      if (args.length >= 5) {
        const x = DivCompiler.transpileExpression(args[1], processNames, globalVars, locals);
        const y = DivCompiler.transpileExpression(args[2], processNames, globalVars, locals);
        const text = DivCompiler.transpileExpression(args[4], processNames, globalVars, locals);
        return `engine.write(${x}, ${y}, ${text})`;
      }
      return `engine.write(${compileArgs(args)})`;
    });

    e = DivCompiler.replaceCall(e, ['draw_box', 'box', 'rectangulo', 'rect'], (args) => `engine.drawBox(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['circle', 'circulo'], (args) => `engine.drawCircle(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['line', 'linea'], (args) => `engine.drawLine(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['screen_clear', 'limpiar_pantalla', 'cls'], (args) => `engine.clearScreen(${args.length ? compileArgs(args) : '0'})`);
    e = DivCompiler.replaceCall(e, ['screen_color', 'color_fondo'], (args) => `engine.setScreenColor(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['sin'], (args) => `Math.sin(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['cos'], (args) => `Math.cos(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['abs'], (args) => `Math.abs(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['set_mode', 'setmode', 'modo_pantalla', 'set_resolution'], (args) => `engine.setMode(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['width', 'ancho'], () => 'engine.width');
    e = DivCompiler.replaceCall(e, ['height', 'alto'], () => 'engine.height');

    // Scroll & Tilemap API
    e = DivCompiler.replaceCall(e, ['start_scroll', 'iniciar_scroll'], (args) => `engine.startScroll(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['stop_scroll', 'parar_scroll'], (args) => `engine.stopScroll(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['break_back_scroll', 'trocear_scroll_fondo'], (args) => `engine.breakBackScroll(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['new_tilemap', 'nuevo_tilemap', 'crear_tilemap'], (args) => `engine.newTilemap(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['get_tile', 'obtener_tile'], (args) => `engine.getTile(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['set_tile', 'poner_tile'], (args) => `engine.setTile(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['get_tile_flags', 'obtener_flags_tile'], (args) => `engine.getTileFlags(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['set_tile_flags', 'poner_flags_tile'], (args) => `engine.setTileFlags(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['change_tilemap', 'cambiar_tilemap'], (args) => `engine.changeTilemap(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['change_tile_value', 'cambiar_valor_tile'], (args) => `engine.changeTileValue(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['load_fpg', 'cargar_fpg'], () => '0');
    e = DivCompiler.replaceCall(e, ['screen_scanline'], () => '0');
    e = DivCompiler.replaceCall(e, ['screen_smooth'], () => '0');
    e = DivCompiler.replaceCall(e, ['set_title', 'poner_titulo'], (args) => `engine.setTitle(${compileArgs(args)})`);
    e = DivCompiler.replaceCall(e, ['set_fps', 'poner_fps'], (args) => `engine.setFps(${compileArgs(args)})`);

    e = e.replace(/(?<![\.\'\"a-zA-Z0-9_])\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?![\'\"a-zA-Z0-9_])/g, (match) => {
      const mLower = match.toLowerCase();
      if (match.startsWith('__DIV_STR_')) return match;
      if (['function', 'let', 'var', 'const', 'return', 'if', 'else', 'while', 'for', 'true', 'false', 'null', 'undefined', 'yield', 'engine', 'self', 'Math', 'end', 'fin'].includes(match)) return match;
      if (match === 'scroll') return 'engine.scroll';
      if (PROCESS_PROPS.has(mLower)) return `self.${mLower}`;
      if (globalVars.has(match)) return `engine.globals['${match}']`;
      return `self.locals['${match}']`;
    });

    for (let i = 0; i < strings.length; i++) {
      e = e.replace(`__DIV_STR_${i}__`, strings[i]);
    }
    return e;
  }
}
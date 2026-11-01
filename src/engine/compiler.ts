/**
 * DIV-8 Compiler / Transpiler
 *
 * Compila el lenguaje canónico DIV Games Studio (inglés) a funciones
 * generadoras de JavaScript que el runtime ejecuta de forma cooperativa.
 *
 * El español se admite únicamente a través de tokenNormalizer.ts, que
 * traduce los sinónimos antes de parsear.
 *
 * Soporte:
 *  - PROGRAM, GLOBAL, LOCAL, PRIVATE, CONSTANTS
 *  - PROCESS con LOCAL/PRIVATE y BEGIN/END
 *  - FUNCTION con parámetros, locales y RETURN
 *  - Tablas / arrays: clásicas, multidimensionales y de registros (puntos[]:)
 *  - FOREACH con contexto de proceso o de array
 *  - FROM/FOR, WHILE, REPEAT/UNTIL, IF/ELSE IF/ELSE, LOOP
 *  - Operadores AND/OR/NOT/MOD y comparaciones
 */

import { CompilerError } from './types';
import { normalizeTokens } from './tokenNormalizer';
import {
  DivParser,
  DivSyntaxError,
  prepareLines,
  splitTopLevel,
  Expr,
  Stmt,
  VarDecl,
  TableDecl,
  RoutineDecl,
  DivProgram,
} from './divParser';

export interface CompiledProgram {
  globalCode: string;
  processNames: string[];
  jsCode: string;
  createRunner: (engine: any) => {
    initGlobals: () => Record<string, any>;
    initProcesses: (engine: any) => void;
  };
}

// Propiedades intrínsecas de cada proceso
const PROCESS_PROPS = new Set([
  'x', 'y', 'z', 'graph', 'size', 'angle', 'flags', 'alpha', 'id', 'type', 'father',
]);

// Constantes integradas de DIV (clave en minúsculas)
const DIV_CONSTANTS: Record<string, any> = {
  // Teclas
  _up: 'up', _down: 'down', _left: 'left', _right: 'right',
  _space: 'a', _z: 'a', _x: 'b', _enter: 'start', _shift: 'select',
  _a: 'a', _b: 'b', _c: 'c', _esc: 'escape', _tab: 'tab',
  up: 'up', down: 'down', left: 'left', right: 'right',

  // Señales
  s_kill: 0,
  s_freeze: 1,
  s_wakeup: 2,
  s_sleep: 3,
  all_process: -1,

  s_kill_tree: -2,
  s_freeze_tree: -3,
  s_wakeup_tree: -4,

  // Alineación de texto
  align_left: 'left', align_center: 'center', align_right: 'right',

  // Booleanos y números
  true: 1, false: 0, pi: Math.PI,
};

const JS_SPECIAL: Record<string, string> = {
  math: 'Math',
  json: 'JSON',
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  array: 'Array',
  object: 'Object',
  date: 'Date',
  engine: 'engine',
  self: 'self',
};

const JS_RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if',
  'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw',
  'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'enum',
  'await', 'implements', 'package', 'protected', 'interface', 'private', 'public',
  'null', 'true', 'false', 'arguments', 'eval', 'self', 'engine',
]);

function jsName(name: string): string {
  if (JS_RESERVED.has(name) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    return '__div_' + name.replace(/[^A-Za-z0-9_]/g, '_');
  }
  return name;
}

function constLiteral(value: any): string {
  return typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : String(value);
}

// ---------------------------------------------------------------------------
// Constructor de código con indentación
// ---------------------------------------------------------------------------
class CodeBuilder {
  public lines: string[] = [];
  public depth = 0;

  public push(line = '') {
    this.lines.push('  '.repeat(this.depth) + line);
  }

  public open(line: string) {
    this.push(line);
    this.depth++;
  }

  public close(line = '}') {
    this.depth = Math.max(0, this.depth - 1);
    this.push(line);
  }

  public toString(): string {
    return this.lines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Contextos de FOREACH
// ---------------------------------------------------------------------------
interface RecCtx {
  kind: 'process' | 'array';
  varName: string;
  alias?: string;
  processType?: string;
  processLocals?: Map<string, string>;
  elementVar?: string;
}

interface Scope {
  kind: 'process' | 'function' | 'global';
  locals: Map<string, string>;
  rec: RecCtx[];
  globalRef: string;
}

type VarRefKind = 'prop' | 'global' | 'local' | 'procLocal' | 'raw';

interface VarRef {
  kind: VarRefKind;
  code: string;
}

// ---------------------------------------------------------------------------
// Compilador
// ---------------------------------------------------------------------------
export class DivCompiler {
  public static compile(sourceCode: string): { compiled?: CompiledProgram; errors: CompilerError[] } {
    try {
      const normalized = normalizeTokens(sourceCode);
      const lines = prepareLines(normalized);
      const program = new DivParser(lines).parse();
      const generator = new DivCodeGen(program);
      const result = generator.generate();

      const factory = new Function('DIV_CONSTANTS', result.js);
      const runnerBuilder = factory(DIV_CONSTANTS);

      return {
        compiled: {
          globalCode: '',
          processNames: result.processNames,
          jsCode: result.js,
          createRunner: runnerBuilder,
        },
        errors: [],
      };
    } catch (err: any) {
      const line = err instanceof DivSyntaxError ? err.line : 0;
      let message = err?.message || 'Error de sintaxis en el código DIV';

      if (!(err instanceof DivSyntaxError)) {
        const stackLine = /<anonymous>:(\d+):(\d+)/.exec(err?.stack || '');
        if (stackLine) message = `${message} (JS interno línea ${stackLine[1]})`;
      }

      console.error('Compiler error:', err);
      return {
        errors: [{
          line: line || 1,
          column: 1,
          message,
        }],
      };
    }
  }

  public static splitTopLevel(text: string, delimiter = ','): string[] {
    return splitTopLevel(text, delimiter);
  }
}

// ---------------------------------------------------------------------------
// Generador de código
// ---------------------------------------------------------------------------
interface CollectedNames {
  names: Map<string, string>;
  indexBases: Map<string, string>;
  bound: Set<string>;
}

class DivCodeGen {
  private program: DivProgram;
  private tables = new Map<string, TableDecl>();
  private globals = new Map<string, VarDecl>();
  private programLocals = new Map<string, VarDecl>();
  private functions = new Map<string, RoutineDecl>();
  private processes = new Map<string, RoutineDecl>();
  private processLocals = new Map<string, Map<string, string>>();
  private uid = 0;
  private b = new CodeBuilder();

  constructor(program: DivProgram) {
    this.program = program;

    for (const table of program.tables) this.tables.set(table.name.toLowerCase(), table);
    for (const global of program.globals) this.globals.set(global.name.toLowerCase(), global);
    for (const local of program.locals) this.programLocals.set(local.name.toLowerCase(), local);
    for (const fn of program.functions) this.functions.set(fn.name.toLowerCase(), fn);
    for (const proc of program.processes) this.processes.set(proc.name.toLowerCase(), proc);

    for (const proc of program.processes) {
      const locals = new Map<string, string>();
      for (const param of proc.params) {
        if (!PROCESS_PROPS.has(param.toLowerCase())) locals.set(param.toLowerCase(), param);
      }
      for (const local of proc.locals) locals.set(local.name.toLowerCase(), local.name);
      for (const local of program.locals) locals.set(local.name.toLowerCase(), local.name);
      this.processLocals.set(proc.name.toLowerCase(), locals);
    }
  }

  public generate(): { js: string; processNames: string[] } {
    const functionCode = this.program.functions.map((fn) => this.genFunction(fn)).join('\n\n');
    const processCode = this.program.processes.map((proc) => this.genProcess(proc)).join('\n\n');

    const hasProcesses = this.program.processes.length > 0;
    const initial = this.pickInitialProcess();
    const initStatements: string[] = [];

    if (!hasProcesses) {
      const body: Stmt[] = [...this.program.topLevel];
      body.push({ t: 'loop', body: [{ t: 'yield', line: 0 }], line: 0 });
      initStatements.push(this.genProcess({ kind: 'process', name: 'main', params: [], locals: [], body, line: 0 }));
      initStatements.push(`engine.spawn('main', 0, []);`);
    } else {
      if (this.program.topLevel.length > 0) {
        initStatements.push(this.genProcess({
          kind: 'process', name: '__init', params: [], locals: [], body: this.program.topLevel, line: 0,
        }));
        initStatements.push(`engine.spawn('__init', 0, []);`);
      }
      initStatements.push(`engine.spawn('${initial}', 0, []);`);
    }

    const initGlobals = this.genGlobals();
    const initProcesses = [processCode, initStatements.join('\n\n')]
      .filter((code) => code.trim().length > 0)
      .join('\n\n');

    const processNames = this.program.processes.map((p) => p.name);
    if (!hasProcesses) processNames.push('main');

    const js = `
return function (engine) {
${this.indentBlock(functionCode, 1)}
  return {
    initGlobals: function () {
${this.indentBlock(initGlobals, 3)}
    },
    initProcesses: function (engine) {
${this.indentBlock(initProcesses, 3)}
    }
  };
};
`;

    return { js, processNames };
  }

  private indentBlock(code: string, levels: number): string {
    if (!code.trim()) return '';
    const pad = '  '.repeat(levels);
    return code
      .split('\n')
      .map((line) => (line.trim() ? pad + line : ''))
      .join('\n');
  }

  private pickInitialProcess(): string {
    const preferred = ['main', 'start', 'principal'];
    for (const name of preferred) {
      const proc = this.processes.get(name);
      if (proc) return proc.name;
    }
    return this.program.processes[0].name;
  }

  private nextTemp(prefix: string): string {
    return `__div_${prefix}${this.uid++}`;
  }

  // -------------------------------------------------------------------------
  // Variables globales y tablas
  // -------------------------------------------------------------------------

  private genGlobals(): string {
    const b = new CodeBuilder();
    b.push('var g = {};');

    const scope: Scope = { kind: 'global', locals: new Map(), rec: [], globalRef: 'g' };

    for (const global of this.program.globals) {
      const init = global.initValue
        ? this.genExpr(global.initValue, scope)
        : global.initList
        ? `[${global.initList.map((e) => this.genExpr(e, scope)).join(', ')}]`
        : '0';
      b.push(`g['${global.name}'] = ${init};`);
    }

    for (const table of this.program.tables) {
      // Tabla de registros:  puntos[]: numero=5, x=[], y=[], ...
      if (table.kind === 'record') {
        const fields = table.fields.map((field) => {
          if (field.kind === 'array') {
            const dims = field.dims && field.dims.length
              ? `engine.newArray([${field.dims.map((d) => this.genExpr(d, scope)).join(', ')}], 0)`
              : '[]';
            return `${field.name}: ${dims}`;
          }
          const value = field.init ? this.genExpr(field.init, scope) : '0';
          return `${field.name}: ${value}`;
        });
        b.push(`g['${table.name}'] = { ${fields.join(', ')} };`);
        continue;
      }

      if (table.dims && table.dims.length) {
        const dims = table.dims.map((d) => this.genExpr(d, scope)).join(', ');
        const fill = table.initValue ? this.genExpr(table.initValue, scope) : '0';
        b.push(`g['${table.name}'] = engine.newArray([${dims}], ${fill});`);
        if (table.initList) {
          table.initList.forEach((value, i) => {
            b.push(`g['${table.name}'][${i}] = ${this.genExpr(value, scope)};`);
          });
        }
      } else if (table.initList) {
        b.push(`g['${table.name}'] = [${table.initList.map((e) => this.genExpr(e, scope)).join(', ')}];`);
      } else {
        b.push(`g['${table.name}'] = [];`);
      }
    }

    b.push('return g;');
    return b.toString();
  }

  // -------------------------------------------------------------------------
  // Funciones
  // -------------------------------------------------------------------------

  private genFunction(fn: RoutineDecl): string {
    const b = new CodeBuilder();
    const scope: Scope = { kind: 'function', locals: new Map(), rec: [], globalRef: 'engine.globals' };

    const paramJs = fn.params.map((p) => jsName(p));
    const declared = new Set<string>();
    fn.params.forEach((p, i) => {
      const low = p.toLowerCase();
      scope.locals.set(low, paramJs[i]);
      declared.add(low);
    });

    for (const local of fn.locals) {
      const low = local.name.toLowerCase();
      declared.add(low);
      scope.locals.set(low, jsName(local.name));
    }

    const info = collectNames(fn.body);
    const autoLocals = new Map<string, { name: string; array: boolean }>();

    for (const [low, original] of info.names) {
      if (declared.has(low) || info.bound.has(low)) continue;
      if (this.isKnownName(low) || PROCESS_PROPS.has(low) || JS_SPECIAL[low]) continue;
      autoLocals.set(low, { name: jsName(original), array: info.indexBases.has(low) });
    }

    const signature = ['self', ...paramJs].join(', ');
    b.push(`function ${jsName(fn.name)}(${signature}) {`);
    b.depth++;

    for (const auto of autoLocals.values()) {
      b.push(`let ${auto.name} = ${auto.array ? '[]' : '0'};`);
    }
    scope.locals = new Map(scope.locals);
    for (const [low, auto] of autoLocals) scope.locals.set(low, auto.name);

    const paramLows = new Set(fn.params.map((p) => p.toLowerCase()));
    const emitted = new Set<string>();
    for (const local of fn.locals) {
      const target = jsName(local.name);
      const already = emitted.has(target) || paramLows.has(local.name.toLowerCase());
      this.emitDeclaration(b, local, target, scope, !already);
      emitted.add(target);
    }

    const saved = this.b;
    this.b = b;
    this.genStatements(fn.body, scope);
    this.b = saved;

    b.depth--;
    b.push('}');
    return b.toString();
  }

  // -------------------------------------------------------------------------
  // Procesos
  // -------------------------------------------------------------------------

  private genProcess(proc: RoutineDecl): string {
    const b = new CodeBuilder();
    const scope: Scope = { kind: 'process', locals: new Map(), rec: [], globalRef: 'engine.globals' };

    const paramJs = proc.params.map((p) => jsName(p));

    for (const param of proc.params) {
      const low = param.toLowerCase();
      if (!PROCESS_PROPS.has(low)) scope.locals.set(low, param);
    }
    for (const local of proc.locals) {
      const low = local.name.toLowerCase();
      if (!PROCESS_PROPS.has(low)) scope.locals.set(low, local.name);
    }

    const info = collectNames(proc.body);
    const autoArrays = new Map<string, string>();
    for (const [low, original] of info.indexBases) {
      if (scope.locals.has(low) || this.isKnownName(low) || info.bound.has(low)) continue;
      if (PROCESS_PROPS.has(low)) continue;
      autoArrays.set(low, original);
    }

    const signature = ['self', ...paramJs].join(', ');
    b.push(`engine.registerProcess('${proc.name}', function* (${signature}) {`);
    b.depth++;

    proc.params.forEach((param, i) => {
      const low = param.toLowerCase();
      const js = paramJs[i];
      if (PROCESS_PROPS.has(low)) {
        b.push(`if (${js} !== undefined) self.${low} = ${js};`);
      } else {
        b.push(`self.locals['${param}'] = (${js} === undefined ? 0 : ${js});`);
      }
    });

    for (const local of proc.locals) {
      const low = local.name.toLowerCase();
      const target = PROCESS_PROPS.has(low) ? `self.${low}` : `self.locals['${local.name}']`;
      this.emitDeclaration(b, local, target, scope);
    }

    for (const original of autoArrays.values()) {
      b.push(`self.locals['${original}'] = [];`);
    }

    // Datos LOCAL del programa: cada proceso hereda su propia copia.
    for (const local of this.program.locals) {
      const low = local.name.toLowerCase();
      if (scope.locals.has(low) || PROCESS_PROPS.has(low)) continue;
      this.emitDeclaration(b, local, `self.locals['${local.name}']`, scope);
    }

    const saved = this.b;
    this.b = b;
    this.genStatements(proc.body, scope);
    this.b = saved;

    b.depth--;
    b.push('});');
    return b.toString();
  }

  private emitDeclaration(b: CodeBuilder, decl: VarDecl, target: string, scope: Scope, declare = false) {
    if (decl.isArray) {
      if (decl.dims && decl.dims.length > 0) {
        const dims = decl.dims.map((d) => this.genExpr(d, scope)).join(', ');
        const fill = decl.initValue ? this.genExpr(decl.initValue, scope) : '0';
        b.push(`${declare ? 'let ' : ''}${target} = engine.newArray([${dims}], ${fill});`);
        if (decl.initList) {
          decl.initList.forEach((value, i) => {
            b.push(`${target}[${i}] = ${this.genExpr(value, scope)};`);
          });
        }
      } else if (decl.initList) {
        b.push(`${declare ? 'let ' : ''}${target} = [${decl.initList.map((e) => this.genExpr(e, scope)).join(', ')}];`);
      } else {
        b.push(`${declare ? 'let ' : ''}${target} = [];`);
      }
      return;
    }

    const init = decl.initValue ? this.genExpr(decl.initValue, scope) : '0';
    b.push(`${declare ? 'let ' : ''}${target} = ${init};`);
  }

  // -------------------------------------------------------------------------
  // Sentencias
  // -------------------------------------------------------------------------

  private genStatements(stmts: Stmt[], scope: Scope) {
    for (const stmt of stmts) this.genStatement(stmt, scope);
  }

  private genStatement(stmt: Stmt, scope: Scope) {
    const b = this.b;

    switch (stmt.t) {
      case 'empty':
        return;

      case 'assign': {
        b.push(`${this.genAssign(stmt.target, stmt.op, stmt.value, scope)};`);
        return;
      }

      case 'expr': {
        b.push(`${this.genExpr(stmt.e, scope)};`);
        return;
      }

      case 'yield':
        if (scope.kind === 'function') {
          b.push('/* FRAME ignored inside FUNCTION */');
        } else {
          b.push('yield;');
        }
        return;

      case 'break':
        b.push('break;');
        return;

      case 'continue':
        b.push('continue;');
        return;

      case 'return': {
        if (scope.kind === 'function') {
          b.push(`return ${stmt.value ? this.genExpr(stmt.value, scope) : '0'};`);
        } else {
          b.push('return;');
        }
        return;
      }

      case 'if': {
        b.open(`if (${this.genExpr(stmt.cond, scope)}) {`);
        this.genStatements(stmt.then, scope);
        b.close();
        if (stmt.else) {
          b.push('else {');
          b.depth++;
          this.genStatements(stmt.else, scope);
          b.depth--;
          b.push('}');
        }
        return;
      }

      case 'loop': {
        b.open('while (true) {');
        this.genStatements(stmt.body, scope);
        b.close();
        return;
      }

      case 'while': {
        b.open(`while (${this.genExpr(stmt.cond, scope)}) {`);
        this.genStatements(stmt.body, scope);
        b.close();
        return;
      }

      case 'repeat': {
        b.open('do {');
        this.genStatements(stmt.body, scope);
        b.close(`} while (!(${this.genExpr(stmt.cond, scope)}));`);
        return;
      }

      case 'for': {
        const stepVar = this.nextTemp('step');
        const idxVar = this.nextTemp('i');
        const endVar = this.nextTemp('end');

        b.push(`var ${stepVar} = ${stmt.step ? this.genExpr(stmt.step, scope) : '1'};`);
        b.push(`var ${endVar} = ${this.genExpr(stmt.end, scope)};`);
        b.open(
          `for (var ${idxVar} = ${this.genExpr(stmt.start, scope)}; ` +
          `${stepVar} >= 0 ? ${idxVar} <= ${endVar} : ${idxVar} >= ${endVar}; ` +
          `${idxVar} += ${stepVar}) {`
        );
        b.push(`${this.genAssignVariable(stmt.varName, idxVar, scope)};`);
        this.genStatements(stmt.body, scope);
        b.close();
        return;
      }

      case 'foreach': {
        const iterVar = this.nextTemp('it');
        b.open(`for (const ${iterVar} of engine.asArray(${this.genExpr(stmt.iterable, scope)})) {`);
        if (stmt.varName) {
          b.push(`${this.genAssignVariable(stmt.varName, iterVar, scope)};`);
        }
        this.genStatements(stmt.body, scope);
        b.close();
        return;
      }

      case 'recorre':
        this.genRecorre(stmt, scope);
        return;
    }
  }

  private genAssignVariable(varName: string, valueCode: string, scope: Scope): string {
    const ref = this.resolveIdent(varName, scope);
    return this.writeRef(ref, '=', valueCode);
  }

  private genRecorre(stmt: Extract<Stmt, { t: 'recorre' }>, scope: Scope) {
    const b = this.b;
    const target = stmt.target;

    if (target.t === 'ident') {
      const low = target.name.toLowerCase();
      const proc = this.processes.get(low);
      const table = this.tables.get(low);

      if (proc) {
        this.genRecorreProcess(stmt, proc.name, scope);
        return;
      }

      if (table) {
        this.genRecorreArray(stmt, this.tableRef(table, scope), scope);
        return;
      }

      const isVariable = this.globals.has(low) || this.programLocals.has(low) ||
        this.isConstant(low) || scope.locals.has(low);

      if (!isVariable) {
        this.genRecorreProcess(stmt, target.name, scope);
        return;
      }
    }

    this.genRecorreArray(stmt, this.genExpr(target, scope), scope);
  }

  private genRecorreProcess(stmt: Extract<Stmt, { t: 'recorre' }>, processName: string, scope: Scope) {
    const b = this.b;
    const loopVar = this.nextTemp('proc');
    const ctx: RecCtx = {
      kind: 'process',
      varName: loopVar,
      alias: stmt.alias ?? undefined,
      processType: processName,
      processLocals: this.processLocals.get(processName.toLowerCase()) ?? new Map(),
    };

    b.open(`for (const ${loopVar} of engine.getProcessesByType('${processName}')) {`);
    this.genStatements(stmt.body, { ...scope, rec: [...scope.rec, ctx] });
    b.close();
  }

  private genRecorreArray(stmt: Extract<Stmt, { t: 'recorre' }>, arrayCode: string, scope: Scope) {
    const b = this.b;
    const arrayVar = this.nextTemp('arr');
    const indexVar = this.nextTemp('idx');
    const countVar = this.nextTemp('n');
    const elementVar = this.nextTemp('el');

    const ctx: RecCtx = {
      kind: 'array',
      varName: indexVar,
      alias: stmt.alias ?? undefined,
      elementVar,
    };

    b.push(`var ${arrayVar} = engine.asArray(${arrayCode});`);
    b.push(`var ${countVar} = ${arrayVar}.length;`);
    b.open(`for (var ${indexVar} = 0; ${indexVar} < ${countVar}; ${indexVar}++) {`);
    b.push(`var ${elementVar} = ${arrayVar}[${indexVar}];`);
    this.genStatements(stmt.body, { ...scope, rec: [...scope.rec, ctx] });
    b.close();
  }

  // -------------------------------------------------------------------------
  // Asignaciones
  // -------------------------------------------------------------------------

  private genAssign(target: Expr, op: string, value: Expr, scope: Scope): string {
    const valueCode = this.genExpr(value, scope);

    if (target.t === 'ident') {
      return this.writeRef(this.resolveIdent(target.name, scope), op, valueCode);
    }

    if (target.t === 'index') {
      const base = this.genExpr(target.obj, scope);
      const indices = target.idx.map((e) => this.genExpr(e, scope)).join(', ');
      if (op === '=') {
        return `engine.arrSet(${base}, [${indices}], ${valueCode})`;
      }
      const current = `engine.arrGet(${base}, [${indices}])`;
      return `engine.arrSet(${base}, [${indices}], ${current} ${op.slice(0, -1)} ${valueCode})`;
    }

    if (target.t === 'member') {
      // Caso puntos[i].x = valor  (escritura en tabla de structs)
      if (target.obj.t === 'index' && target.obj.obj.t === 'ident') {
        const table = this.tables.get(target.obj.obj.name.toLowerCase());
        if (table && table.kind === 'record') {
          const field = table.fields.find((f) => f.name.toLowerCase() === target.name.toLowerCase());
          if (field && field.kind === 'array') {
            const indices = target.obj.idx.map((e) => this.genExpr(e, scope)).join(', ');
            if (op === '=') {
              return `engine.arrSet(engine.globals['${table.name}'].${field.name}, [${indices}], ${valueCode})`;
            }
            const current = `engine.arrGet(engine.globals['${table.name}'].${field.name}, [${indices}])`;
            return `engine.arrSet(engine.globals['${table.name}'].${field.name}, [${indices}], ${current} ${op.slice(0, -1)} ${valueCode})`;
          }
        }
      }

      const memberRef = this.resolveMemberRef(target, scope);
      if (memberRef) return this.writeRef(memberRef, op, valueCode);

      const obj = target.obj;
      const prop = target.name;
      const low = prop.toLowerCase();

      if (obj.t === 'ident') {
        const objLow = obj.name.toLowerCase();
        const idCode = this.genIdent(obj.name, scope);

        if (JS_SPECIAL[objLow]) {
          const objCode = this.genExpr(obj, scope);
          return this.assignCode(`(${objCode})['${prop}']`, op, valueCode);
        }

        if (op === '=') return `engine.setProcessProp(${idCode}, '${low}', ${valueCode})`;
        return `engine.setProcessProp(${idCode}, '${low}', ` +
          `engine.getProcessProp(${idCode}, '${low}') ${op.slice(0, -1)} ${valueCode})`;
      }

      const objCode = this.genExpr(obj, scope);
      return this.assignCode(`(${objCode})['${prop}']`, op, valueCode);
    }

    throw new DivSyntaxError(0, 'Invalid assignment');
  }

  private assignCode(code: string, op: string, valueCode: string): string {
    if (op === '=') return `${code} = ${valueCode}`;
    return `${code} = ${code} ${op.slice(0, -1)} ${valueCode}`;
  }

  private readRef(ref: VarRef): string {
    return ref.code;
  }

  private writeRef(ref: VarRef, op: string, valueCode: string): string {
    return this.assignCode(ref.code, op, valueCode);
  }

  // -------------------------------------------------------------------------
  // Resolución de identificadores
  // -------------------------------------------------------------------------

  private isConstant(low: string): boolean {
    return Object.prototype.hasOwnProperty.call(DIV_CONSTANTS, low);
  }

  private isKnownName(low: string): boolean {
    return this.globals.has(low) || this.programLocals.has(low) || this.tables.has(low) ||
      this.isConstant(low) || this.functions.has(low) || this.processes.has(low);
  }

  private tableRef(table: TableDecl, scope: Scope): string {
    return `${scope.globalRef}['${table.name}']`;
  }

  private findAlias(name: string, scope: Scope): RecCtx | null {
    const low = name.toLowerCase();
    for (let i = scope.rec.length - 1; i >= 0; i--) {
      const ctx = scope.rec[i];
      if (ctx.alias && ctx.alias.toLowerCase() === low) return ctx;
    }
    return null;
  }

  private findRecIndex(table: TableDecl, scope: Scope): string | null {
    const low = table.name.toLowerCase();
    for (let i = scope.rec.length - 1; i >= 0; i--) {
      const ctx = scope.rec[i];
      if (ctx.kind === 'array') {
        return ctx.varName;
      }
    }
    return null;
  }

  private resolveIdent(name: string, scope: Scope): VarRef {
    const low = name.toLowerCase();

    if (JS_SPECIAL[low]) return { kind: 'raw', code: JS_SPECIAL[low] };

    for (let i = scope.rec.length - 1; i >= 0; i--) {
      const ctx = scope.rec[i];

      if (ctx.kind === 'process') {
        if (PROCESS_PROPS.has(low)) return { kind: 'prop', code: `${ctx.varName}.${low}` };
        if (ctx.alias && ctx.alias.toLowerCase() === low) return { kind: 'raw', code: ctx.varName };
        const local = ctx.processLocals?.get(low);
        if (local) return { kind: 'prop', code: `${ctx.varName}['${local}']` };
        continue;
      }

      if (ctx.kind === 'array') {
        if (ctx.alias && ctx.alias.toLowerCase() === low) {
          return { kind: 'raw', code: ctx.elementVar! };
        }
        if (['item', 'value', 'element'].includes(low)) {
          return { kind: 'raw', code: ctx.elementVar! };
        }
        if (['index', 'idx'].includes(low)) {
          return { kind: 'raw', code: ctx.varName };
        }
      }
    }

    const local = scope.locals.get(low);
    if (local) {
      if (scope.kind === 'function') return { kind: 'local', code: local };
      return { kind: 'procLocal', code: `self.locals['${local}']` };
    }

    if (PROCESS_PROPS.has(low)) return { kind: 'prop', code: `self.${low}` };

    if (this.programLocals.has(low)) {
      return { kind: 'procLocal', code: `self.locals['${name}']` };
    }

    const table = this.tables.get(low);
    if (table) return { kind: 'global', code: this.tableRef(table, scope) };

    const global = this.globals.get(low);
    if (global) return { kind: 'global', code: `${scope.globalRef}['${global.name}']` };

    if (this.isConstant(low)) return { kind: 'raw', code: constLiteral(DIV_CONSTANTS[low]) };

    if (JS_SPECIAL[low]) return { kind: 'raw', code: JS_SPECIAL[low] };

    if (scope.kind === 'function') return { kind: 'local', code: jsName(name) };
    return { kind: 'procLocal', code: `self.locals['${name}']` };
  }

  private genIdent(name: string, scope: Scope): string {
    return this.readRef(this.resolveIdent(name, scope));
  }

  private resolveMemberRef(node: Extract<Expr, { t: 'member' }>, scope: Scope): VarRef | null {
    const obj = node.obj;
    const prop = node.name;
    const low = prop.toLowerCase();

    if (obj.t !== 'ident') return null;

        const aliasCtx = this.findAlias(obj.name, scope);
    if (aliasCtx) {
      if (aliasCtx.kind === 'process') {
        if (PROCESS_PROPS.has(low)) return { kind: 'prop', code: `${aliasCtx.varName}.${low}` };
        return { kind: 'raw', code: `${aliasCtx.varName}['${prop}']` };
      }
      if (aliasCtx.kind === 'array') {
        return { kind: 'raw', code: `(${aliasCtx.elementVar})['${prop}']` };
      }
    }

    // Tabla de structs: puntos.x
    const table = this.tables.get(obj.name.toLowerCase());
    if (table && table.kind === 'record') {
      const field = table.fields.find((f) => f.name.toLowerCase() === low);
      if (field) {
        const tableRef = `engine.globals['${table.name}']`;
        if (field.kind === 'array') {
          const idx = this.findRecIndex(table, scope);
          return {
            kind: 'raw',
            code: `engine.arrGet(${tableRef}.${field.name}, [${idx ?? '0'}])`,
          };
        }
        return { kind: 'raw', code: `${tableRef}.${field.name}` };
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Expresiones
  // -------------------------------------------------------------------------

  private genExpr(expr: Expr, scope: Scope): string {
    switch (expr.t) {
      case 'num':
        return String(expr.v);

      case 'str':
        return expr.v;

      case 'ident':
        return this.genIdent(expr.name, scope);

      case 'member':
        return this.genMember(expr, scope);

      case 'index': {
        const base = this.genExpr(expr.obj, scope);
        const indices = expr.idx.map((e) => this.genExpr(e, scope)).join(', ');
        return `engine.arrGet(${base}, [${indices}])`;
      }

      case 'call':
        return this.genCall(expr, scope);

      case 'unary': {
        const inner = this.genExpr(expr.e, scope);
        if (expr.op === '!') return `((${inner}) ? 0 : 1)`;
        if (expr.op === '+') return `(+(${inner}))`;
        return `(-(${inner}))`;
      }

      case 'binary': {
        const left = this.genExpr(expr.l, scope);
        const right = this.genExpr(expr.r, scope);
        switch (expr.op) {
          case '&&':
            return `(((${left}) && (${right})) ? 1 : 0)`;
          case '||':
            return `(((${left}) || (${right})) ? 1 : 0)`;
          case '=':
          case '==':
            return `(((${left}) === (${right})) ? 1 : 0)`;
          case '!=':
          case '<>':
            return `(((${left}) !== (${right})) ? 1 : 0)`;
          case '<':
          case '<=':
          case '>':
          case '>=':
            return `(((${left}) ${expr.op} (${right})) ? 1 : 0)`;
          default:
            return `((${left}) ${expr.op} (${right}))`;
        }
      }
    }
  }

  private genMember(node: Extract<Expr, { t: 'member' }>, scope: Scope): string {
    // Caso puntos[i].x  (lectura en tabla de structs)
    if (node.obj.t === 'index' && node.obj.obj.t === 'ident') {
      const table = this.tables.get(node.obj.obj.name.toLowerCase());
      if (table && table.kind === 'record') {
        const field = table.fields.find((f) => f.name.toLowerCase() === node.name.toLowerCase());
        if (field && field.kind === 'array') {
          const indices = node.obj.idx.map((e) => this.genExpr(e, scope)).join(', ');
          return `engine.arrGet(engine.globals['${table.name}'].${field.name}, [${indices}])`;
        }
      }
    }

    const ref = this.resolveMemberRef(node, scope);
    if (ref) return this.readRef(ref);

    const obj = node.obj;
    const prop = node.name;
    const low = prop.toLowerCase();

    if (obj.t === 'ident') {
      const objLow = obj.name.toLowerCase();

      if (JS_SPECIAL[objLow]) {
        return `${JS_SPECIAL[objLow]}.${prop}`;
      }

      const idCode = this.genIdent(obj.name, scope);
      return `engine.getProcessProp(${idCode}, '${low}')`;
    }

    return `(${this.genExpr(obj, scope)})['${prop}']`;
  }

  private genCall(node: Extract<Expr, { t: 'call' }>, scope: Scope): string {
    const args = node.args.map((a) => this.genExpr(a, scope));

    if (node.callee.t === 'member') {
      const callee = this.genExpr(node.callee, scope);
      return `${callee}(${args.join(', ')})`;
    }

    if (node.callee.t !== 'ident') {
      return `(${this.genExpr(node.callee, scope)})(${args.join(', ')})`;
    }

    const name = node.callee.name;
    const low = name.toLowerCase();

    // Funciones de usuario
    const fn = this.functions.get(low);
    if (fn) {
      return `${jsName(fn.name)}(self${args.length ? ', ' + args.join(', ') : ''})`;
    }

    // Procesos -> spawn
    const proc = this.processes.get(low);
    if (proc) {
      return `engine.spawn('${proc.name}', self.id, [${args.join(', ')}])`;
    }

    const builtin = this.genBuiltin(low, node, args);
    if (builtin !== null) return builtin;

    return `engine.invoke('${name}', self, [${args.join(', ')}])`;
  }

  private genBuiltin(
    low: string,
    node: Extract<Expr, { t: 'call' }>,
    args: string[]
  ): string | null {
    const a = (i: number) => args[i] ?? '0';

    switch (low) {
      case 'len':
      case 'length':
      case 'sizeof':
        return `engine.arrLen(${a(0)})`;

      case 'key':
        return `engine.key(${a(0)})`;
		
	 case 'move':
		return `engine.move(self, ${a(0)}, ${a(1)})`;

	case 'advance':
		return `engine.advance(self, ${a(0)})`;

	case 'scroll':
		return `engine.scroll(${a(0)}, ${a(1)})`;
		
		
		
		

      case 'collision': {
        const raw = node.args[0];
        let typeCode = `'unknown'`;
        if (raw) {
          if (raw.t === 'ident') typeCode = `'${raw.name}'`;
          else if (raw.t === 'str') typeCode = raw.v;
          else typeCode = a(0);
        }
        return `engine.collision(self, ${typeCode})`;
      }

      case 'rand':
      case 'rnd':
      case 'random':
        return `engine.rand(${a(0)}, ${a(1)})`;

      case 'sound':
      case 'play':
        return `engine.playSound(${a(0)})`;

      case 'write':
      case 'print':
        return `engine.write(${args.join(', ')})`;

      case 'draw_box':
      case 'drawbox':
      case 'box':
        return `engine.drawBox(${args.join(', ')})`;

      case 'draw_circle':
      case 'circle':
      case 'disc':
        return `engine.drawCircle(${args.join(', ')})`;

      case 'draw_line':
      case 'line':
        return `engine.drawLine(${args.join(', ')})`;

      case 'screen_clear':
      case 'clear_screen':
      case 'cls':
        return `engine.clearScreen(${a(0)})`;

      case 'screen_color':
      case 'set_screen_color':
        return `engine.setScreenColor(${a(0)})`;

      case 'signal':
        return `engine.signal(${args.join(', ')})`;

      case 'let_me_alone':
        return `engine.letMeAlone(self)`;

      case 'width':
      case 'screen_width':
        return `engine.width`;

      case 'height':
      case 'screen_height':
        return `engine.height`;

      case 'get_dist':
      case 'dist':
      case 'distance':
        return `engine.getDist(${args.join(', ')})`;

      case 'get_angle':
      case 'angle':
        return `engine.getAngle(${args.join(', ')})`;

      case 'exit':
        return `(engine.exit(), 0)`;

      case 'pause':
        return `(engine.pause(), 0)`;

      case 'get_id': {
        const raw = node.args[0];

        if (!raw) {
          return 'engine.get_id(0)';
        }

        // get_id(TYPE nave)
        if (raw.t === 'str') {
          return `engine.get_id(${raw.v})`;
        }

        // get_id(0)
        if (raw.t === 'num' && raw.v === 0) {
          return 'engine.get_id(0)';
        }

        // Otras expresiones.
        return `engine.get_id(${a(0)})`;
      }

      case 'sin': return `Math.sin(${a(0)})`;
      case 'cos': return `Math.cos(${a(0)})`;
      case 'tan': return `Math.tan(${a(0)})`;
      case 'asin': return `Math.asin(${a(0)})`;
      case 'acos': return `Math.acos(${a(0)})`;
      case 'atan': return `Math.atan(${a(0)})`;
      case 'atan2': return `Math.atan2(${a(0)}, ${a(1)})`;
      case 'sqrt': return `Math.sqrt(${a(0)})`;
      case 'abs': return `Math.abs(${a(0)})`;
      case 'floor': return `Math.floor(${a(0)})`;
      case 'ceil': return `Math.ceil(${a(0)})`;
      case 'round': return `Math.round(${a(0)})`;
      case 'min': return `Math.min(${args.join(', ')})`;
      case 'max': return `Math.max(${args.join(', ')})`;
      case 'pow': return `Math.pow(${a(0)}, ${a(1)})`;
      case 'log': return `Math.log(${a(0)})`;
      case 'exp': return `Math.exp(${a(0)})`;

      case 'int':
      case 'trunc':
        return `Math.trunc(${a(0)})`;

      case 'str':
      case 'string':
        return `String(${a(0)})`;

      case 'val':
      case 'number':
        return `Number(${a(0)})`;

      default:
        return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Recolección de nombres usados en un cuerpo
// ---------------------------------------------------------------------------
function collectNames(stmts: Stmt[]): CollectedNames {
  const result: CollectedNames = {
    names: new Map(),
    indexBases: new Map(),
    bound: new Set(),
  };

  const addName = (name: string, target: Map<string, string>) => {
    const low = name.toLowerCase();
    if (!target.has(low)) target.set(low, name);
  };

  const walkExpr = (expr: Expr) => {
    switch (expr.t) {
      case 'ident':
        addName(expr.name, result.names);
        return;
      case 'member':
        walkExpr(expr.obj);
        return;
      case 'index':
        if (expr.obj.t === 'ident') addName(expr.obj.name, result.indexBases);
        walkExpr(expr.obj);
        for (const idx of expr.idx) walkExpr(idx);
        return;
      case 'call':
        walkExpr(expr.callee);
        for (const arg of expr.args) walkExpr(arg);
        return;
      case 'unary':
        walkExpr(expr.e);
        return;
      case 'binary':
        walkExpr(expr.l);
        walkExpr(expr.r);
        return;
      default:
        return;
    }
  };

  const walkTarget = (expr: Expr) => {
    if (expr.t === 'ident') {
      addName(expr.name, result.names);
      return;
    }
    if (expr.t === 'index') {
      if (expr.obj.t === 'ident') addName(expr.obj.name, result.indexBases);
      walkExpr(expr.obj);
      for (const idx of expr.idx) walkExpr(idx);
      return;
    }
    if (expr.t === 'member') {
      walkExpr(expr.obj);
      return;
    }
    walkExpr(expr);
  };

  const walk = (list: Stmt[]) => {
    for (const stmt of list) {
      switch (stmt.t) {
        case 'assign':
          walkTarget(stmt.target);
          walkExpr(stmt.value);
          break;
        case 'expr':
          walkExpr(stmt.e);
          break;
        case 'if':
          walkExpr(stmt.cond);
          walk(stmt.then);
          if (stmt.else) walk(stmt.else);
          break;
        case 'while':
          walkExpr(stmt.cond);
          walk(stmt.body);
          break;
        case 'repeat':
          walk(stmt.body);
          walkExpr(stmt.cond);
          break;
        case 'loop':
          walk(stmt.body);
          break;
        case 'for':
          addName(stmt.varName, result.names);
          result.bound.add(stmt.varName.toLowerCase());
          walkExpr(stmt.start);
          walkExpr(stmt.end);
          if (stmt.step) walkExpr(stmt.step);
          walk(stmt.body);
          break;
        case 'foreach':
          if (stmt.varName) {
            addName(stmt.varName, result.names);
            result.bound.add(stmt.varName.toLowerCase());
          }
          walkExpr(stmt.iterable);
          walk(stmt.body);
          break;
        case 'recorre':
          if (stmt.alias) result.bound.add(stmt.alias.toLowerCase());
          walkExpr(stmt.target);
          walk(stmt.body);
          break;
        case 'return':
          if (stmt.value) walkExpr(stmt.value);
          break;
        default:
          break;
      }
    }
  };

  walk(stmts);
  return result;
}
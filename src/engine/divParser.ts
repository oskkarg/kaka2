/**
 * DIV-8 Language Parser
 *
 * Parser del lenguaje canónico: DIV Games Studio en inglés.
 *
 *   PROGRAM nombre;
 *   GLOBAL / LOCAL / PRIVATE / CONSTANTS
 *   PROCESS nombre(params) ... BEGIN ... END
 *   FUNCTION nombre(params) ... BEGIN ... END
 *   IF / ELSE / END
 *   FROM|FOR var=inicio TO fin STEP paso ... END
 *   WHILE ... END
 *   REPEAT ... UNTIL
 *   LOOP ... END
 *   FOREACH objetivo [AS alias] ... END
 *   FRAME, RETURN, BREAK, CONTINUE, EXIT
 *
 * Los sinónimos en español se normalizan ANTES de llegar aquí
 * (ver tokenNormalizer.ts). Este parser solo entiende inglés canónico.
 *
 * DIV Games Studio usa END para cerrar todos los bloques; REPEAT se cierra
 * con UNTIL (que lleva la condición).
 */

export interface SourceLine {
  text: string;
  indent: number;
  line: number;
}

export class DivSyntaxError extends Error {
  public line: number;
  constructor(line: number, message: string) {
    super(message);
    this.name = 'DivSyntaxError';
    this.line = line;
  }
}

// ---------------------------------------------------------------------------
// AST de expresiones
// ---------------------------------------------------------------------------
export type Expr =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ident'; name: string }
  | { t: 'member'; obj: Expr; name: string }
  | { t: 'index'; obj: Expr; idx: Expr[] }
  | { t: 'call'; callee: Expr; args: Expr[] }
  | { t: 'unary'; op: string; e: Expr }
  | { t: 'binary'; op: string; l: Expr; r: Expr };

// ---------------------------------------------------------------------------
// AST de sentencias
// ---------------------------------------------------------------------------
export interface StmtBase {
  line: number;
}

export type Stmt =
  | (StmtBase & { t: 'empty' })
  | (StmtBase & { t: 'assign'; target: Expr; op: string; value: Expr })
  | (StmtBase & { t: 'expr'; e: Expr })
  | (StmtBase & { t: 'if'; cond: Expr; then: Stmt[]; else: Stmt[] | null })
  | (StmtBase & { t: 'while'; cond: Expr; body: Stmt[] })
  | (StmtBase & { t: 'repeat'; body: Stmt[]; cond: Expr })
  | (StmtBase & { t: 'loop'; body: Stmt[] })
  | (StmtBase & { t: 'for'; varName: string; start: Expr; end: Expr; step: Expr | null; body: Stmt[] })
  | (StmtBase & { t: 'foreach'; varName: string | null; iterable: Expr; body: Stmt[] })
  | (StmtBase & { t: 'recorre'; target: Expr; alias: string | null; body: Stmt[] })
  | (StmtBase & { t: 'return'; value: Expr | null })
  | (StmtBase & { t: 'break' })
  | (StmtBase & { t: 'continue' })
  | (StmtBase & { t: 'yield' });

// ---------------------------------------------------------------------------
// Declaraciones
// ---------------------------------------------------------------------------
export interface VarDecl {
  name: string;
  dims: Expr[] | null;
  initList: Expr[] | null;
  initValue: Expr | null;
  isArray: boolean;
  isConst?: boolean;
  line: number;
}

/** Campo de una tabla de registros: numero = 5, x = [], etc. */
export interface TableField {
  name: string;
  kind: 'scalar' | 'array';
  init: Expr | null;
  dims: Expr[] | null;
  line: number;
}

/**
 * Tabla:
 *  - kind 'array': numeros[10], matriz[3,4], lista = {1,2,3}
 *  - kind 'record': puntos[]: numero=5, x=[], y=[], ...
 */
export interface TableDecl {
  name: string;
  kind: 'array' | 'record';
  dims: Expr[] | null;
  initList: Expr[] | null;
  initValue: Expr | null;
  fields: TableField[];
  line: number;
}

export interface RoutineDecl {
  kind: 'process' | 'function';
  name: string;
  params: string[];
  locals: VarDecl[];
  body: Stmt[];
  line: number;
}

export interface DivProgram {
  globals: VarDecl[];
  /** Datos LOCAL del programa: cada proceso hereda su propia copia. */
  locals: VarDecl[];
  tables: TableDecl[];
  functions: RoutineDecl[];
  processes: RoutineDecl[];
  topLevel: Stmt[];
}

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

/** Elimina comentarios // y /* *\/ */
export function stripComments(code: string): string {
  const out: string[] = [];
  let inBlock = false;

  for (const raw of code.split('\n')) {
    let line = '';
    let inString: string | null = null;

    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      const n = raw[i + 1];

      if (inBlock) {
        if (c === '*' && n === '/') {
          inBlock = false;
          line += '  ';
          i++;
        } else {
          line += ' ';
        }
        continue;
      }

      if (inString) {
        line += c;
        if (c === '\\') {
          line += raw[++i] ?? '';
          continue;
        }
        if (c === inString) inString = null;
        continue;
      }

      if (c === '"' || c === "'") {
        inString = c;
        line += c;
        continue;
      }
      if (c === '/' && n === '/') break;
      if (c === '/' && n === '*') {
        inBlock = true;
        line += '  ';
        i++;
        continue;
      }
      line += c;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Prepara el fuente en líneas lógicas. Además de limpiar comentarios y
 * tabulaciones, separa sentencias terminadas en ';' de nivel superior
 * (respetando strings, paréntesis, corchetes y llaves).
 */
export function prepareLines(code: string): SourceLine[] {
  const result: SourceLine[] = [];
  const lines = stripComments(code).split('\n');

  for (let i = 0; i < lines.length; i++) {
    const expanded = lines[i].replace(/\t/g, '    ');
    const trimmed = expanded.trim();
    if (!trimmed) continue;

    const indent = expanded.length - expanded.trimStart().length;
    for (const part of splitTopLevel(trimmed, ';')) {
      const text = part.trim();
      if (text) result.push({ text, indent, line: i + 1 });
    }
  }

  return result;
}

/** Divide por un separador solo en el nivel superior (respeta (), [], {}, "" y ''). */
export function splitTopLevel(text: string, delimiter: string = ','): string[] {
  const parts: string[] = [];
  let current = '';
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let inString: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      current += char;
      if (char === '\\') {
        current += text[++i] ?? '';
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      current += char;
      continue;
    }
    if (char === '(') depthParen++;
    else if (char === ')') depthParen--;
    else if (char === '[') depthBracket++;
    else if (char === ']') depthBracket--;
    else if (char === '{') depthBrace++;
    else if (char === '}') depthBrace--;

    if (char === delimiter && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

export function firstWord(text: string): string {
  const m = /^[A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*/.exec(text);
  return m ? m[0] : '';
}

/** Busca una palabra clave al nivel superior (fuera de paréntesis y cadenas). */
function findTopLevelWord(text: string, words: string[]): { start: number; end: number } | null {
  let depthParen = 0;
  let depthBracket = 0;
  let inString: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      continue;
    }
    if (c === '(') depthParen++;
    else if (c === ')') depthParen--;
    else if (c === '[') depthBracket++;
    else if (c === ']') depthBracket--;

    if (depthParen !== 0 || depthBracket !== 0) continue;
    if (i > 0 && /[A-Za-z0-9_\u00C0-\u00FF]/.test(text[i - 1])) continue;

    for (const word of words) {
      if (text.length < i + word.length) continue;
      if (text.substr(i, word.length).toLowerCase() !== word) continue;
      const after = text[i + word.length];
      if (after && /[A-Za-z0-9_\u00C0-\u00FF]/.test(after)) continue;
      return { start: i, end: i + word.length };
    }
  }
  return null;
}

function findMatchingParen(text: string, open: number): number {
  let depth = 0;
  let inString: string | null = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Detecta una asignación de nivel superior. */
export function findAssignment(text: string): { lhs: string; op: string; rhs: string } | null {
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let inString: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      continue;
    }
    if (c === '(') depthParen++;
    else if (c === ')') depthParen--;
    else if (c === '[') depthBracket++;
    else if (c === ']') depthBracket--;
    else if (c === '{') depthBrace++;
    else if (c === '}') depthBrace--;

    if (depthParen !== 0 || depthBracket !== 0 || depthBrace !== 0) continue;
    if (c !== '=') continue;

    const prev = text[i - 1];
    const next = text[i + 1];
    if (next === '=' || prev === '=' || prev === '<' || prev === '>' || prev === '!') continue;

    if (prev === '+' || prev === '-' || prev === '*' || prev === '/' || prev === '%') {
      return { lhs: text.slice(0, i - 1).trim(), op: prev + '=', rhs: text.slice(i + 1).trim() };
    }
    return { lhs: text.slice(0, i).trim(), op: '=', rhs: text.slice(i + 1).trim() };
  }

  const post = /^(.+?)\s*(\+\+|--)$/.exec(text.trim());
  if (post) {
    return { lhs: post[1].trim(), op: post[2] === '++' ? '+=' : '-=', rhs: '1' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tokenizador de expresiones
// ---------------------------------------------------------------------------
type TokenKind = 'num' | 'str' | 'id' | 'op' | 'eof';

interface Token {
  k: TokenKind;
  v: string;
  p: number;
}

const OPERATORS = [
  '**', '<<', '>>', '<=', '>=', '<>', '!=', '==', '&&', '||', '+=', '-=', '*=', '/=', '%=',
  '+', '-', '*', '/', '%', '<', '>', '=', '!', '(', ')', '[', ']', ',', '.', ':', '?', '^',
];

function isIdentStart(c: string): boolean {
  return /[A-Za-z_\u00C0-\u00FF]/.test(c);
}

function isIdentPart(c: string): boolean {
  return /[A-Za-z0-9_\u00C0-\u00FF]/.test(c);
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const c = source[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(source[i + 1]))) {
      let j = i;
      while (j < source.length && /[0-9]/.test(source[j])) j++;
      if (source[j] === '.' && /[0-9]/.test(source[j + 1])) {
        j++;
        while (j < source.length && /[0-9]/.test(source[j])) j++;
      }
      tokens.push({ k: 'num', v: source.slice(i, j), p: i });
      i = j;
      continue;
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === c) {
          j++;
          break;
        }
        j++;
      }
      if (j > source.length) throw new DivSyntaxError(0, 'Unterminated string');
      tokens.push({ k: 'str', v: source.slice(i, j), p: i });
      i = j;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < source.length && isIdentPart(source[j])) j++;
      tokens.push({ k: 'id', v: source.slice(i, j), p: i });
      i = j;
      continue;
    }

    let matched = '';
    for (const op of OPERATORS) {
      if (source.startsWith(op, i)) {
        matched = op;
        break;
      }
    }
    if (!matched) {
      throw new DivSyntaxError(0, `Invalid character: "${c}"`);
    }
    tokens.push({ k: 'op', v: matched, p: i });
    i += matched.length;
  }

  tokens.push({ k: 'eof', v: '', p: source.length });
  return tokens;
}

const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '=': 3, '==': 3, '!=': 3, '<>': 3, '<': 3, '<=': 3, '>': 3, '>=': 3,
  '+': 4, '-': 4,
  '*': 5, '/': 5, '%': 5,
  '**': 6,
};

const WORD_OPERATORS: Record<string, string> = {
  and: '&&',
  or: '||',
  mod: '%',
};

const UNARY_WORDS = new Set(['not']);

class ExprParser {
  private tokens: Token[];
  private pos = 0;

  constructor(source: string, private line: number) {
    try {
      this.tokens = tokenize(source);
    } catch (err: any) {
      throw new DivSyntaxError(line, err.message);
    }
  }

  public parse(): Expr {
    if (this.peek().k === 'eof') throw new DivSyntaxError(this.line, 'Empty expression');
    const expr = this.parseExpression(0);
    if (this.peek().k !== 'eof') {
      throw new DivSyntaxError(this.line, `Unexpected token "${this.peek().v}"`);
    }
    return expr;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private binaryOperator(): string | null {
    const tk = this.peek();
    if (tk.k === 'op') {
      if (BINARY_PRECEDENCE[tk.v] !== undefined) return tk.v;
      return null;
    }
    if (tk.k === 'id') {
      return WORD_OPERATORS[tk.v.toLowerCase()] ?? null;
    }
    return null;
  }

  private parseExpression(minPrecedence: number): Expr {
    let left = this.parseUnary();
    for (;;) {
      const op = this.binaryOperator();
      if (!op) break;
      const precedence = BINARY_PRECEDENCE[op];
      if (precedence < minPrecedence) break;
      this.next();
      const right = this.parseExpression(op === '**' ? precedence : precedence + 1);
      left = { t: 'binary', op, l: left, r: right };
    }
    return left;
  }

  private parseUnary(): Expr {
  const tk = this.peek();

  if (tk.k === 'op' && (tk.v === '-' || tk.v === '+' || tk.v === '!')) {
    this.next();
    return {
      t: 'unary',
      op: tk.v,
      e: this.parseUnary()
    };
  }

  if (tk.k === 'id' && UNARY_WORDS.has(tk.v.toLowerCase())) {
    this.next();
    return {
      t: 'unary',
      op: '!',
      e: this.parseUnary()
    };
  }

  // TYPE nombre -> string con el nombre del proceso.
  if (tk.k === 'id' && tk.v.toLowerCase() === 'type') {
    this.next();

    const name = this.next();

    if (name.k !== 'id') {
      throw new DivSyntaxError(
        this.line,
        'TYPE requires a process name'
      );
    }

    return {
      t: 'str',
      v: JSON.stringify(name.v)
    };
  }

  return this.parsePostfix();
}

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    for (;;) {
      const tk = this.peek();
      if (tk.k !== 'op') break;

      if (tk.v === '.') {
        this.next();
        const name = this.next();
        if (name.k !== 'id') throw new DivSyntaxError(this.line, 'Expected property after "."');
        expr = { t: 'member', obj: expr, name: name.v };
        continue;
      }

      if (tk.v === '(') {
        this.next();
        const args: Expr[] = [];
        if (this.peek().v !== ')') {
          do {
            args.push(this.parseExpression(0));
            if (this.peek().v === ',') this.next();
            else break;
          } while (true);
        }
        if (this.next().v !== ')') throw new DivSyntaxError(this.line, 'Missing ")" in call');
        expr = { t: 'call', callee: expr, args };
        continue;
      }

      if (tk.v === '[') {
        this.next();
        const idx: Expr[] = [];
        if (this.peek().v !== ']') {
          do {
            idx.push(this.parseExpression(0));
            if (this.peek().v === ',') this.next();
            else break;
          } while (true);
        }
        if (this.next().v !== ']') throw new DivSyntaxError(this.line, 'Missing "]" in index');
        expr = { t: 'index', obj: expr, idx };
        continue;
      }

      break;
    }
    return expr;
  }

  private parsePrimary(): Expr {
    const tk = this.next();

    if (tk.k === 'num') return { t: 'num', v: Number(tk.v) };
    if (tk.k === 'str') return { t: 'str', v: tk.v };
    if (tk.k === 'id') return { t: 'ident', name: tk.v };

    if (tk.v === '(') {
      const inner = this.parseExpression(0);
      if (this.next().v !== ')') throw new DivSyntaxError(this.line, 'Missing ")"');
      return inner;
    }

    throw new DivSyntaxError(this.line, `Expected value, found "${tk.v || 'end of line'}"`);
  }
}

function parseExpr(source: string, line: number): Expr {
  return new ExprParser(source, line).parse();
}

// ---------------------------------------------------------------------------
// Parser de programa
// ---------------------------------------------------------------------------
type BlockKind = 'block' | 'if' | 'for' | 'while' | 'repeat' | 'loop' | 'recorre' | 'routine';

const TERMINATORS: Record<BlockKind, string[]> = {
  block: ['end', 'endif', 'next'],
  if: ['end', 'endif', 'else', 'elseif', 'next'],
  for: ['end', 'endif', 'next'],
  while: ['end', 'endif', 'next'],
  repeat: ['until', 'to'],
  loop: ['end', 'endif', 'next'],
  recorre: ['end', 'endif', 'next'],
  routine: ['end', 'endif', 'next'],
};

const DECLARATION_HEADERS = new Set([
  'global', 'local', 'private', 'constants', 'const', 'constant',
]);

const ROUTINE_HEADERS = new Set(['process', 'function']);

const COMMAND_WORDS = new Set([
  'write', 'print',
  'draw_box', 'draw_circle', 'draw_line',
  'box', 'circle', 'disc', 'line',
  'sound', 'play',
  'screen_clear', 'clear_screen', 'cls',
  'screen_color', 'set_screen_color',
  'let_me_alone',
  'signal',
  'key',
  'rand', 'rnd',
  'collision',
  'pause',
  'exit',
]);

export class DivParser {
  private lines: SourceLine[];
  private index = 0;
  private program: DivProgram = {
    globals: [],
    locals: [],
    tables: [],
    functions: [],
    processes: [],
    topLevel: [],
  };

  constructor(lines: SourceLine[]) {
    this.lines = lines
      .map((l) => {
        let text = l.text;
        while (text.startsWith(';')) text = text.slice(1).trim();
        return { ...l, text };
      })
      .filter((l) => l.text.length > 0);
  }

  public parse(): DivProgram {
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      const word = firstWord(line.text).toLowerCase();

      if (word === 'program') {
        this.index++;
        continue;
      }

      if (DECLARATION_HEADERS.has(word)) {
        this.parseDeclarationBlock(word);
        continue;
      }

      if (word === 'process') {
        this.program.processes.push(this.parseRoutine('process'));
        continue;
      }

      if (word === 'function') {
        this.program.functions.push(this.parseRoutine('function'));
        continue;
      }

      if (word === 'begin' || word === 'end' || word === 'endif') {
        this.index++;
        continue;
      }

      this.program.topLevel.push(this.parseStatement());
    }

    return this.program;
  }

  // -------------------------------------------------------------------------
  // Bloques de declaración
  // -------------------------------------------------------------------------

  private parseDeclarationBlock(word: string) {
    const line = this.lines[this.index];
    let rest = line.text.replace(/^[A-Za-z_\u00C0-\u00FF]+\b/, '').trim();

    const isConst = word === 'constants' || word === 'const' || word === 'constant';
    const target: 'global' | 'local' = word === 'local' ? 'local' : 'global';

    // Tabla de registros en la misma cabecera:  GLOBAL puntos[]:
    const recordMatch = /^:?\s*([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s*\[\s*\]\s*:\s*(.*)$/.exec(rest);
    if (recordMatch) {
      this.index++;
      this.parseRecordTable(recordMatch[1], recordMatch[2], line);
      return;
    }

    rest = rest.replace(/^:\s*/, '').trim();
    this.index++;
    if (rest && rest !== ':') this.addDeclarations(rest, line.line, target, isConst);
    this.consumeDeclarationLines(target, isConst);
  }

  private consumeDeclarationLines(target: 'global' | 'local', isConst: boolean) {
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      const word = firstWord(line.text).toLowerCase();

      if (ROUTINE_HEADERS.has(word) || word === 'program' || word === 'begin' || word === 'end') {
        break;
      }
      if (DECLARATION_HEADERS.has(word)) break;

      // Tabla de registros:  nombre[]:
      const recordMatch = /^([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s*\[\s*\]\s*:\s*(.*)$/.exec(line.text);
      if (recordMatch) {
        this.index++;
        this.parseRecordTable(recordMatch[1], recordMatch[2], line);
        continue;
      }

      // Línea que parece una declaración (nombre, nombre[...], nombre = ...)
      if (!/^[A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*\s*(\[|=|$|,)/.test(line.text)) break;

      this.addDeclarations(line.text, line.line, target, isConst);
      this.index++;
    }
  }

  /** Tabla de registros:  nombre[]: numero = 5, x = [], ... */
  private parseRecordTable(name: string, inlineFields: string, headerLine: SourceLine) {
    const fields: TableField[] = [];

    const parseField = (text: string, lineNo: number) => {
      const clean = text.trim().replace(/;+$/, '').trim();
      if (!clean) return;
      const m = /^([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s*(?:\[\s*([^\]]*)\s*\])?\s*(?:=\s*([\s\S]+))?$/.exec(clean);
      if (!m) return;
      const fieldName = m[1];
      const dimsText = m[2];
      const initText = m[3] ? m[3].trim() : null;
      const isArray = dimsText !== undefined || initText === '[]' ||
        (!!initText && initText.trim().startsWith('{'));
      let dims: Expr[] | null = null;
      if (dimsText !== undefined && dimsText.trim() !== '') {
        dims = splitTopLevel(dimsText).map((d) => parseExpr(d, lineNo));
      }
      let init: Expr | null = null;
      if (initText && initText !== '[]' && !initText.startsWith('{')) {
        init = parseExpr(initText, lineNo);
      }
      fields.push({ name: fieldName, kind: isArray ? 'array' : 'scalar', init, dims, line: lineNo });
    };

    if (inlineFields.trim()) {
      for (const part of splitTopLevel(inlineFields)) parseField(part, headerLine.line);
    }

    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      const word = firstWord(line.text).toLowerCase();
      if (ROUTINE_HEADERS.has(word) || word === 'program' ||
        word === 'begin' || DECLARATION_HEADERS.has(word)) {
        break;
      }
      if (!/^[A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*\s*(\[|=|$)/.test(line.text)) break;
      parseField(line.text, line.line);
      this.index++;
    }

    this.program.tables.push({
      name,
      kind: 'record',
      dims: null,
      initList: null,
      initValue: null,
      fields,
      line: headerLine.line,
    });
  }

  private addDeclarations(
    text: string,
    lineNo: number,
    target: 'global' | 'local',
    isConst = false
  ) {
    const statements = splitTopLevel(text, ';');
    for (const statement of statements) {
      for (const part of splitTopLevel(statement, ',')) {
        const decl = this.parseDeclaration(part, lineNo);
        if (!decl) continue;
        decl.isConst = isConst;

        if (target === 'local') {
          this.program.locals.push(decl);
        } else if (decl.isArray) {
          this.program.tables.push({
            name: decl.name,
            kind: 'array',
            dims: decl.dims,
            initList: decl.initList,
            initValue: decl.initValue,
            fields: [],
            line: lineNo,
          });
        } else {
          this.program.globals.push(decl);
        }
      }
    }
  }

  private parseDeclaration(text: string, lineNo: number): VarDecl | null {
    const clean = text.trim().replace(/;+$/, '').trim();
    if (!clean) return null;

    const m = /^([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s*(?:\[\s*([^\]]*)\s*\])?\s*(?:=\s*([\s\S]+))?$/.exec(clean);
    if (!m) return null;

    const name = m[1];
    const dimsText = m[2];
    const initText = m[3] ? m[3].trim() : null;

    let dims: Expr[] | null = null;
    if (dimsText !== undefined) {
      dims = dimsText.trim() === ''
        ? []
        : splitTopLevel(dimsText).map((d) => parseExpr(d, lineNo));
    }

    let initList: Expr[] | null = null;
    let initValue: Expr | null = null;
    let arrayByInit = false;

    if (initText) {
      const trimmed = initText.trim();

      // Campo array declarado como x = []  (marca de tabla de structs)
      if (trimmed === '[]') {
        arrayByInit = true;
      } else if (trimmed.startsWith('{')) {
        const end = trimmed.lastIndexOf('}');
        const inner = end > 0 ? trimmed.slice(1, end) : trimmed.slice(1);
        initList = splitTopLevel(inner).filter((x) => x.length > 0).map((x) => parseExpr(x, lineNo));
        arrayByInit = true;
      } else {
        initValue = parseExpr(trimmed, lineNo);
      }
    }

    return {
      name,
      dims,
      initList,
      initValue,
      isArray: dims !== null || arrayByInit,
      line: lineNo,
    };
  }

  // -------------------------------------------------------------------------
  // Procesos y funciones
  // -------------------------------------------------------------------------

  private parseRoutine(kind: 'process' | 'function'): RoutineDecl {
    const header = this.lines[this.index];
    const pattern = kind === 'process'
      ? /^process\s+([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s*(?:\(([^)]*)\))?\s*$/i
      : /^function\s+([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s*(?:\(([^)]*)\))?\s*$/i;

    const m = pattern.exec(header.text.replace(/;+$/, '').trim());
    if (!m) {
      throw new DivSyntaxError(header.line, `Invalid ${kind === 'process' ? 'PROCESS' : 'FUNCTION'} header`);
    }

    const name = m[1];
    const params = m[2]
      ? splitTopLevel(m[2]).filter(Boolean).map((p) => p.trim())
      : [];

    this.index++;

    const locals: VarDecl[] = [];

    while (this.index < this.lines.length) {
      const word = firstWord(this.lines[this.index].text).toLowerCase();
      if (word !== 'local' && word !== 'private') break;

      const localHeader = this.lines[this.index];
      const rest = localHeader.text.replace(/^[A-Za-z_\u00C0-\u00FF]+\b/, '').trim();
      this.index++;
      if (rest) this.addLocalDeclarations(rest, localHeader.line, locals);
      this.consumeLocalLines(locals);
    }

    const bodyStart = this.index < this.lines.length
      ? firstWord(this.lines[this.index].text).toLowerCase()
      : '';
    if (bodyStart !== 'begin') {
      throw new DivSyntaxError(header.line, `${kind === 'process' ? 'PROCESS' : 'FUNCTION'} ${name} requires BEGIN`);
    }

    this.index++;
    const body = this.parseBody('routine');
    this.consumeTerminator('routine');

    return { kind, name, params, locals, body, line: header.line };
  }

  private addLocalDeclarations(text: string, lineNo: number, target: VarDecl[]) {
    for (const statement of splitTopLevel(text, ';')) {
      for (const part of splitTopLevel(statement, ',')) {
        const decl = this.parseDeclaration(part, lineNo);
        if (decl) target.push(decl);
      }
    }
  }

  private consumeLocalLines(target: VarDecl[]) {
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      const word = firstWord(line.text).toLowerCase();
      if (word === 'begin') break;
      if (ROUTINE_HEADERS.has(word) || word === 'program') break;
      if (DECLARATION_HEADERS.has(word)) break;
      if (TERMINATORS.routine.includes(word)) break;
      if (!/^[A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*\s*(\[|=|$|,)/.test(line.text)) break;
      this.addLocalDeclarations(line.text, line.line, target);
      this.index++;
    }
  }

  // -------------------------------------------------------------------------
  // Sentencias
  // -------------------------------------------------------------------------

  private parseBody(kind: BlockKind): Stmt[] {
    const body: Stmt[] = [];

    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      const word = firstWord(line.text).toLowerCase();

      if (TERMINATORS[kind].includes(word)) break;
      if (ROUTINE_HEADERS.has(word) || word === 'program') break;

      const before = this.index;
      body.push(this.parseStatement());
      if (this.index === before) this.index++; // seguridad contra bucles infinitos
    }

    return body;
  }

  private consumeTerminator(kind: BlockKind) {
    if (this.index >= this.lines.length) return;
    const word = firstWord(this.lines[this.index].text).toLowerCase();
    if (TERMINATORS[kind].includes(word)) this.index++;
  }

  private parseStatement(): Stmt {
    const line = this.lines[this.index];
    const text = line.text;
    const word = firstWord(text).toLowerCase();

    // Marcadores que se ignoran
    if (
      word === 'begin' || word === 'program' || word === 'end' ||
      word === 'endif' || word === 'next'
    ) {
      this.index++;
      return { t: 'empty', line: line.line };
    }

    if (word === 'loop') return this.parseLoop();
    if (word === 'repeat') return this.parseRepeat();
    if (word === 'from' || word === 'for') return this.parseFor(word);
    if (word === 'while') return this.parseWhile();
    if (word === 'foreach') return this.parseForeach();
    if (word === 'if') return this.parseIf();

    if (word === 'return') {
      this.index++;
      const rest = text.replace(/^[A-Za-z_\u00C0-\u00FF]+\b/, '').replace(/;+$/, '').trim();
      return { t: 'return', value: rest ? parseExpr(rest.replace(/^\((.*)\)$/, '$1'), line.line) : null, line: line.line };
    }

    if (word === 'break') {
      this.index++;
      return { t: 'break', line: line.line };
    }

    if (word === 'exit') {
      this.index++;
      const rest = text.replace(/^exit\b/i, '').replace(/;+$/, '').trim();
      const args = rest
        ? splitTopLevel(rest.replace(/^\((.*)\)$/, '$1')).filter((a) => a.trim().length > 0).map((a) => parseExpr(a, line.line))
        : [];
      return {
        t: 'expr',
        e: { t: 'call', callee: { t: 'ident', name: 'exit' }, args },
        line: line.line,
      };
    }

    if (word === 'continue') {
      this.index++;
      return { t: 'continue', line: line.line };
    }

    if (word === 'frame') {
      this.index++;
      return { t: 'yield', line: line.line };
    }

    if (DECLARATION_HEADERS.has(word)) {
      this.index++;
      return { t: 'empty', line: line.line };
    }

    if (word === 'else' || word === 'elseif') {
      this.index++;
      return { t: 'empty', line: line.line };
    }

    this.index++;
    return this.parseSimple(text, line.line);
  }

  private parseLoop(): Stmt {
    const line = this.lines[this.index];
    this.index++;
    const body = this.parseBody('loop');
    this.consumeTerminator('loop');
    return { t: 'loop', body, line: line.line };
  }

  private parseRepeat(): Stmt {
    const line = this.lines[this.index];
    this.index++;
    const body = this.parseBody('repeat');

    let cond: Expr | null = null;
    if (this.index < this.lines.length) {
      const cur = this.lines[this.index];
      const word = firstWord(cur.text).toLowerCase();
      if (word === 'until' || word === 'to') {
        let rest = cur.text.replace(/^[A-Za-z_\u00C0-\u00FF]+\b/, '').replace(/;+$/, '').trim();
        if (rest.startsWith('(')) {
          const close = findMatchingParen(rest, 0);
          if (close !== -1) rest = rest.slice(1, close).trim();
        }
        cond = rest ? parseExpr(rest, cur.line) : { t: 'num', v: 1 };
        this.index++;
      }
    }

    if (!cond) throw new DivSyntaxError(line.line, 'REPEAT without UNTIL');
    return { t: 'repeat', body, cond, line: line.line };
  }

  private parseWhile(): Stmt {
    const line = this.lines[this.index];
    let rest = line.text.replace(/^while\b/i, '').trim();
    rest = rest.replace(/\s+do\s*;?$/i, '').trim();
    rest = rest.replace(/;+$/, '').trim();

    if (rest.startsWith('(')) {
      const close = findMatchingParen(rest, 0);
      if (close === -1) throw new DivSyntaxError(line.line, 'Unclosed parenthesis in WHILE');
      rest = rest.slice(1, close);
    }

    const cond = parseExpr(rest, line.line);
    this.index++;
    const body = this.parseBody('while');
    this.consumeTerminator('while');
    return { t: 'while', cond, body, line: line.line };
  }

  private parseFor(keyword: string): Stmt {
    const line = this.lines[this.index];
    let rest = line.text.replace(new RegExp(`^${keyword}\\b`, 'i'), '').trim();
    rest = rest.replace(/;+$/, '').trim();

    // FOR EACH v IN tabla  /  FOR v OF tabla
    let each = /^each\s+([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s+(?:in|of)\s+([\s\S]+)$/i.exec(rest);
    if (!each) {
      each = /^([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s+(?:in|of)\s+([\s\S]+)$/i.exec(rest);
    }
    if (each) {
      const varName = each[1];
      const iterable = parseExpr(each[2], line.line);
      this.index++;
      const body = this.parseBody('for');
      this.consumeTerminator('for');
      return { t: 'foreach', varName, iterable, body, line: line.line };
    }

    const eqIndex = rest.indexOf('=');
    if (eqIndex === -1) throw new DivSyntaxError(line.line, `${keyword.toUpperCase()} without "=" (use: FROM i = 0 TO 10)`);

    const varName = rest.slice(0, eqIndex).trim();
    if (!/^[A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*$/.test(varName)) {
      throw new DivSyntaxError(line.line, `Invalid ${keyword.toUpperCase()} variable: "${varName}"`);
    }

    let range = rest.slice(eqIndex + 1).trim();
    const toWord = findTopLevelWord(range, ['to']);
    if (!toWord) throw new DivSyntaxError(line.line, `${keyword.toUpperCase()} without TO`);
    const start = parseExpr(range.slice(0, toWord.start).trim(), line.line);
    let after = range.slice(toWord.end).trim();

    const stepWord = findTopLevelWord(after, ['step']);
    let end: Expr;
    let step: Expr | null = null;

    if (stepWord) {
      end = parseExpr(after.slice(0, stepWord.start).trim(), line.line);
      step = parseExpr(after.slice(stepWord.end).trim(), line.line);
    } else {
      end = parseExpr(after.trim(), line.line);
    }

    this.index++;
    const body = this.parseBody('for');
    this.consumeTerminator('for');
    return { t: 'for', varName, start, end, step, body, line: line.line };
  }

  private parseForeach(): Stmt {
    const line = this.lines[this.index];
    let rest = line.text.replace(/^foreach\b/i, '').trim();
    rest = rest.replace(/;+$/, '').trim();

    let alias: string | null = null;
    const aliasMatch = /^([\s\S]+?)\s+as\s+([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)$/i.exec(rest);
    if (aliasMatch) {
      rest = aliasMatch[1].trim();
      alias = aliasMatch[2];
    }

    if (!rest) throw new DivSyntaxError(line.line, 'FOREACH without target');

    const target = parseExpr(rest, line.line);
    this.index++;
    const body = this.parseBody('recorre');
    this.consumeTerminator('recorre');
    return { t: 'recorre', target, alias, body, line: line.line };
  }

  private parseIf(): Stmt {
    const line = this.lines[this.index];

    let rest = line.text.replace(/^if\b/i, '').trim();

    let condText = '';
    let inline = '';

    if (rest.startsWith('(')) {
      const close = findMatchingParen(rest, 0);
      if (close === -1) throw new DivSyntaxError(line.line, 'Unclosed parenthesis in IF');
      condText = rest.slice(1, close).trim();
      inline = rest.slice(close + 1).trim();
    } else {
      const thenWord = findTopLevelWord(rest, ['then']);
      if (thenWord) {
        condText = rest.slice(0, thenWord.start).trim();
        inline = rest.slice(thenWord.end).trim();
      } else {
        condText = rest;
        inline = '';
      }
    }

    inline = inline.replace(/^then\b/i, '').trim();
    if (!condText) throw new DivSyntaxError(line.line, 'IF without condition');

    const cond = parseExpr(condText, line.line);
    this.index++;

    const thenBody = inline.length > 0
      ? [...this.parseInlineStatements(inline, line.line), ...this.parseBody('if')]
      : this.parseBody('if');

    const elseBody = this.parseElseBody();
    return { t: 'if', cond, then: thenBody, else: elseBody, line: line.line };
  }

  private parseElseBody(): Stmt[] | null {
    if (this.index >= this.lines.length) return null;

    const cur = this.lines[this.index];
    const word = firstWord(cur.text).toLowerCase();

    if (word === 'else' || word === 'elseif') {
      let after = cur.text.replace(/^(else|elseif)\b/i, '').trim();

      if (word === 'elseif') {
        this.lines[this.index] = { ...cur, text: `if ${after}` };
        return [this.parseIf()];
      }

      if (/^if\b/i.test(after)) {
        this.lines[this.index] = { ...cur, text: after };
        return [this.parseIf()];
      }

      this.index++;
      let body: Stmt[] = [];
      if (after.length > 0) {
        body = this.parseInlineStatements(after, cur.line);
      }
      body = [...body, ...this.parseBody('block')];
      this.consumeTerminator('block');
      return body;
    }

    if (word === 'end' || word === 'endif') {
      this.index++;
    }

    return null;
  }

  private parseInlineStatements(text: string, lineNo: number): Stmt[] {
    const result: Stmt[] = [];
    for (const part of splitTopLevel(text, ';')) {
      const clean = part.trim().replace(/;+$/, '').trim();
      if (!clean) continue;
      const word = firstWord(clean).toLowerCase();

      if (word === 'return') {
        const rest = clean.replace(/^[A-Za-z_\u00C0-\u00FF]+\b/, '').trim();
        result.push({ t: 'return', value: rest ? parseExpr(rest.replace(/^\((.*)\)$/, '$1'), lineNo) : null, line: lineNo });
      } else if (word === 'break') {
        result.push({ t: 'break', line: lineNo });
      } else if (word === 'continue') {
        result.push({ t: 'continue', line: lineNo });
      } else if (word === 'frame') {
        result.push({ t: 'yield', line: lineNo });
      } else if (word === 'exit') {
        const rest = clean.replace(/^exit\b/i, '').trim();
        const args = rest
          ? splitTopLevel(rest.replace(/^\((.*)\)$/, '$1')).filter((a) => a.trim().length > 0).map((a) => parseExpr(a, lineNo))
          : [];
        result.push({
          t: 'expr',
          e: { t: 'call', callee: { t: 'ident', name: 'exit' }, args },
          line: lineNo,
        });
      } else {
        result.push(this.parseSimple(clean, lineNo));
      }
    }
    return result;
  }

  private parseSimple(text: string, lineNo: number): Stmt {
    const clean = text.trim().replace(/;+$/, '').trim();
    if (!clean) return { t: 'empty', line: lineNo };

    const assignment = findAssignment(clean);
    if (assignment) {
      const target = parseExpr(assignment.lhs, lineNo);
      if (target.t !== 'ident' && target.t !== 'index' && target.t !== 'member') {
        throw new DivSyntaxError(lineNo, `Invalid assignment target: "${assignment.lhs}"`);
      }
      const value = parseExpr(assignment.rhs, lineNo);
      return { t: 'assign', target, op: assignment.op, value, line: lineNo };
    }

    const command = /^([A-Za-z_\u00C0-\u00FF][A-Za-z0-9_\u00C0-\u00FF]*)\s+([\s\S]+)$/.exec(clean);
    if (command && COMMAND_WORDS.has(command[1].toLowerCase())) {
      const argsText = command[2].trim();
      if (argsText && !/^[=+\-*/%<>!(\[.:]/.test(argsText)) {
        const args = splitTopLevel(argsText).map((a) => parseExpr(a, lineNo));
        return {
          t: 'expr',
          e: { t: 'call', callee: { t: 'ident', name: command[1] }, args },
          line: lineNo,
        };
      }
    }

    return { t: 'expr', e: parseExpr(clean, lineNo), line: lineNo };
  }
}
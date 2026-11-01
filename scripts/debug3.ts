import { DivCompiler } from "../src/engine/compiler";
const r = DivCompiler.compile(`PROGRAM X;
PROCESS main()
BEGIN
  LOOP
    FRAME;
  END
END
`);
const c: any = r.compiled;
console.log("keys", Object.keys(c));
console.log("createRunner", c.createRunner);
console.log("type", typeof c.createRunner);
const f = new Function("DIV_CONSTANTS", c.jsCode);
const g = f({});
console.log("factory result", typeof g, g);

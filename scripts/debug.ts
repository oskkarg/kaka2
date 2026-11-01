import { DivCompiler } from "../src/engine/compiler";
const r = DivCompiler.compile(`PROGRAM X;
GLOBAL
  a = 1;
PROCESS main()
BEGIN
  a = 2;
  LOOP
    FRAME;
  END
END
`);
console.log(r.errors);
console.log(r.compiled?.jsCode);
console.log(typeof r.compiled?.createRunner);

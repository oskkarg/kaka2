import { DivParser, prepareLines } from "../src/engine/divParser";
const src = `PROGRAM X;
GLOBAL
  a = 1;
PROCESS main()
BEGIN
  a = 2;
  LOOP
    FRAME;
  END
END
`;
const p = new DivParser(prepareLines(src)).parse();
console.log(JSON.stringify(p, null, 1).slice(0, 4000));

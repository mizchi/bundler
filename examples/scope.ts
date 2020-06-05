import traverse from "@babel/traverse";
// import { parse } from "../src/parser";
import { parse } from "@babel/parser";
// import

import { getGlobalsWithoutImports, analyzeModule } from "../src/analyzer";
const code = `
import foo, {a, b as c} from "./foo.js";
import bar from "./bar.js";
globalThis.__out = foo + "-" + bar;
`;
const x = parse(code, { sourceType: "module" });
const analyzed = analyzeModule(x, "/");

console.log(JSON.stringify(analyzed, null, 2));
// traverse(x, {
//   Program(path) {
//     // console.log("----");
//     // console.log(path.scope);

//     const bindings = Object.keys(path.scope.bindings);
//     console.log("bindings", bindings);

//     // @ts-ignore
//     const globalKeys = Object.keys(path.scope.globals);
//     console.log("globals", globalKeys);
//   },
//   // Identifier(path) {
//   //   console.log("----");
//   //   console.log(path.scope.bindings);
//   //   // console.log(path.scope.parent);
//   // },
// });

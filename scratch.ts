import traverse, { NodePath } from "@babel/traverse";
import { MemberExpression, Program } from "@babel/types";
import { parse } from "./src/parser";
import { isPure } from "./src/sideEffect";
import { Bundler } from "./src";

const pureCode = `
// import foo from "./foo.js";
// foo().x = 1;

const b = 1;
a.foo().x = 1;

console.log(a.foo);
const a = {foo: 1};
a.foo = 1;
a.bar.foo = 1;
a.foo.bar = 1;
`;

function getRefs(ast: Program) {
  const ids: string[] = [];
  traverse(ast, {
    Identifier(nodePath) {
      // console.log(nodePath.node.name, "in", nodePath.parent.type);
      if (
        nodePath.parent.type === "ObjectProperty" &&
        nodePath.node !== nodePath.parent.value
      ) {
        // console.log(nodePath.node.name, "is label of", nodePath.parent.key);
        return;
      }

      if (
        nodePath.parent.type === "MemberExpression" &&
        nodePath.node !== nodePath.parent.object
      ) {
        // console.log(nodePath.node.name, "is property of", nodePath.parent.object);
        return;
      }
      if (!ids.includes(nodePath.node.name)) {
        ids.push(nodePath.node.name);
      }
      // console.log(nodePath.node.name);
    },
  });
  return ids;
}
const ast = parse(pureCode, "/x.js");

console.log(getRefs(ast));
// @ts-ignore
// const pure = isPure(ast);

// (async () => {
//   console.time("build");
//   const bundler = new Bundler({
//     "/a.js": "console.log(1)",
//     "/b.js": "export default 1;",
//     "/c.js": "export const c = 1; export const dead = 2;",

//     "/index.js": `

//     import a from "./a.js";
//     import {c} from "./c.js";

//     console.log(a, c);
//     import b from "./b.js";
//     `,
//   });
//   const code = await bundler.bundle("/index.js");
//   console.timeEnd("build");
//   // console.log(format(code, { parser: "babel" }));
// })();

import { Bundler } from "./src/index";
import { format } from "prettier";
import assert from "assert";

// runtime
const files = {
  "/bar.js": `
import foo from "./foo.js";
console.log("eval bar once")
export default "bar$" + foo
`,
  "/foo.js": `
console.log("eval foo once")
export default "foo$default";
export const b = "b";
export const a = "a";
`,
  "/index.js": `
import "./bar.js";
import foo, {a, b as c} from "./foo.js";
import bar from "./bar.js";

export const x: number = c;
export default 1;
console.log(foo, bar);

`,
};

// (async () => {
//   const bundler = new Bundler(files);
//   const built = await bundler.bundle("/index.js", { format: "js" });
//   console.log(format(built, { parser: "babel" }));
//   eval(built);
// })();

import { parse } from "./src/babelHelpers";
import { isPure } from "./src/sideEffect";

const pureCode = `
import "./foo.js";
function b() {};
class X {};
export function a() {};
export class C {};

// variable
const v1 = 1;
const v2 = () => {};
const v3 = function() {}
const v4 = function x() {}
const v5 = class {};
const v6 = "xxx";
const v7 = true;
`;

const ast = parse(pureCode, "/x.js");

// @ts-ignore
const pure = isPure(ast);

assert.ok(pure);
// console.log(has);

(async () => {
  const bundler = new Bundler({
    "/a.js": "console.log(1)",
    "/b.js": "export default 1;",
    "/index.js": `
    import a from "./a.js";
    import b from "./b.js";
    console.log(a);
    `,
  });
  const code = await bundler.bundle("/index.js");
  console.log(format(code, { parser: "babel" }));
})();

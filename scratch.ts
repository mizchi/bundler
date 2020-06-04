import { Bundler } from "./src/index";
import { format } from "prettier";

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
import foo, {a, b as c} from "./foo.js";
import bar from "./bar.js";

export const x: number = c;
export default 1;

console.log(foo, bar);
`,
};

(async () => {
  const bundler = new Bundler(files);
  const built = await bundler.bundle("/index.js", { format: "js" });
  console.log(format(built, { parser: "babel" }));
  eval(built);
})();

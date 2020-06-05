import { Bundler } from "./../src/index";
import assert from "assert";

// runtime
const files = {
  "/bar.js": `
import foo from "./foo.js";
export default "bar$" + foo
`,
  "/foo.js": `
export default "foo$default";
export const b = "b";
export const a = "a";
`,
  "/index.js": `
import foo, {a, b as c} from "./foo.js";
import bar from "./bar.js";
globalThis.__out = foo + "-" + bar;
`,
};

test("bundle and eval", async () => {
  const bundler = new Bundler(files);
  const built = await bundler.bundle("/index.js", {});
  // console.log(built);
  eval(built);
  // @ts-ignore
  assert.equal(globalThis.__out, "foo$default-bar$foo$default");
});

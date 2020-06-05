import { Bundler } from "../src";
import assert from "assert";

test("drop unused modules", async () => {
  const bundler = new Bundler({
    "/a.js": "console.log(1)",
    "/b.js": "export default 1;",
    "/c.js": "export const c = 1; export const deadcode = 2;",

    "/index.js": `
    import a from "./a.js";
    import {c} from "./c.js";

    console.log(a, c);
    import b from "./b.js";
    `,
  });
  const code = await bundler.bundle("/index.js");
  assert.ok(!code.includes("/b.js"));
  assert.ok(!code.includes("deadcode"));
});

test("drop unused import", async () => {
  const bundler = new Bundler({
    "/foo.js": `export default 1`,
    "/index.js": `
    import foo from "./foo.js";
    const a = {foo: 1}
    console.log(a.foo);
    `,
  });
  const code = await bundler.bundle("/index.js");
  assert.ok(!code.includes("/foo.js"));
});

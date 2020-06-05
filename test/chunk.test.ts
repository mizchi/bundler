import assert from "assert";
import { Bundler } from "../src/index";

const fileMap = {
  "/foo.js": "export default 1;",
  "/index.js": `
const p = import("./foo.js");
`,
};

test("bundleChunks", async () => {
  const bundler = new Bundler(fileMap);
  const chunks = await bundler.bundleChunks("/index.js", { optimize: true });
  const entry = chunks?.find((c) => c.entry === "/index.js");
  assert.ok(entry?.builtCode.includes(`import("/_$_foo.js")`));
  assert.ok(chunks?.length === 2);
});

import { Bundler } from "./../src/index";
import { format } from "prettier";

// runtime
const files = {
  "/bar.js": `
export default "bar"
`,
  "/foo.js": `
export default "foo";
`,
  "/index.js": `
import foo from "./foo.js";
import bar from "./bar.js";

console.log(foo, bar);
`,
};

test("watcher", async () => {
  const bundler = new Bundler(files);
  const built = await bundler.bundle("/index.js", {});
  expect(format(built, { parser: "babel" })).toMatchSnapshot();

  await bundler.updateModule("/index.js", "console.log(1)");
  const out = await bundler.bundle("/index.js");
  expect(format(out, { parser: "babel" })).toMatchSnapshot();
  // console.log(out);
});

test("watcher 2", async () => {
  const bundler = new Bundler(files);
  const built = await bundler.bundle("/index.js", {});
  expect(format(built, { parser: "babel" })).toMatchSnapshot();

  await bundler.updateModule(
    "/index.js",
    `import bar from "./bar.js"\nconsole.log(bar)`
  );
  const out = await bundler.bundle("/index.js");
  // console.log(format(out, { parser: "babel" }));
  expect(format(out, { parser: "babel" })).toMatchSnapshot();
});

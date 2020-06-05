import { Bundler } from "./../src/index";
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
import foo, {a, b as c} from "./foo.js";
import bar from "./bar.js";

export const x: number = c;
export default 1;

console.log(foo, bar);
`,
};

test("bundle", async () => {
  const bundler = new Bundler(files);
  const built = await bundler.bundle("/index.js", {});
  expect(format(built, { parser: "babel" })).toMatchSnapshot();

  const built$foo = await bundler.bundle("/foo.js", {});
  expect(format(built$foo, { parser: "babel" })).toMatchSnapshot();

  const built$bar = await bundler.bundle("/bar.js", {});
  expect(format(built$bar, { parser: "babel" })).toMatchSnapshot();
});

test(`export {x, y as z} from "./m.js"`, async () => {
  const bundler = new Bundler({
    "/up.js": "export const up = 1; export const down = 2;",
    "/m.js": `export {up as a, down} from "./up.js"`,
    "/index.js": `
    import { a as b } from "./m.js";
    globalThis.__export_b = b;
    `,
  });
  const built = await bundler.bundle("/index.js", { optimize: false });
  // console.log(format(built, { parser: "babel" }));
  expect(format(built, { parser: "babel" })).toMatchSnapshot();
  eval(built);
  // @ts-ignore
  assert.equal(globalThis.__export_b, 1);
});

test(`entry: export {default as b} from "./m.js"`, async () => {
  const bundler = new Bundler({
    "/up.js": "export default 1;",
    "/m.js": `export {default as a} from "./up.js"`,
    "/index.js": `
    export { a as b } from "./m.js";
    `,
  });
  const built = await bundler.bundle("/index.js", {});
  console.log(format(built, { parser: "babel" }));
  expect(format(built, { parser: "babel" })).toMatchSnapshot();
});

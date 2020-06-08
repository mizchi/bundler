import { Bundler } from "@mizchi/bundler";
import { format } from "prettier"; // install yourself
const fileMap = {
  "/foo.js": "export default 1;",
  "/index.js": `import foo from "./foo.js"; console.log(foo); export const index = 1;`,
};
const bundler = new Bundler(fileMap);
(async () => {
  const code = await bundler.bundle("/index.js", { optimize: true });
  console.log(format(code, { parser: "babel" }));
})();

import { Bundler } from "../src/index";
import { format } from "prettier"; // install yourself
const fileMap = {
  "/foo.js": "export default 1;",
  // "/index.js": `import("./foo.js").then(m => console.log(m.default));`,
  "/index.js": `
const p = import("./foo.js");
`,
};
const bundler = new Bundler(fileMap);
(async () => {
  const chunks = await bundler.bundleChunks("/index.js");
  // console.log(format(code, { parser: "babel" }));
  console.log(chunks);
})();

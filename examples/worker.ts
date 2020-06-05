import { Bundler } from "../src/index";
import { format } from "prettier"; // install yourself
const fileMap = {
  "/foo.js": `self.addEventListener("message", (ev) => console.log(ev))`,
  "/index.js": `const worker = new Worker("./foo.js", {type: "module"});`,
};

const bundler = new Bundler(fileMap);
(async () => {
  const chunks = await bundler.bundleChunks("/index.js", {
    publicPath: "/dist/",
  });
  // console.log(format(code, { parser: "babel" }));
  console.log(chunks);
})();

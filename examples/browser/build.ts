import path from "path";
import fs from "fs/promises";
import { Bundler } from "../../src/index";
const fileMap = {
  "/foo.js": `self.addEventListener("message", (ev) => console.log("received", ev))`,
  "/index.js": `
console.log("started");
const worker = new Worker("./foo.js", {type: "module"});
worker.postMessage({hello: 1})
`,
};

const bundler = new Bundler(fileMap);
(async () => {
  const publicPath = "/out/";
  const chunks = await bundler.bundleChunks("/index.js", {
    publicPath,
  });
  // console.log(chunks);
  // @ts-ignore
  for (const c of chunks) {
    if (c.type === "entry") {
      console.log("out", path.join(__dirname, publicPath, c.entry));
      await fs.writeFile(
        path.join(__dirname, publicPath, c.entry),
        c.builtCode
      );
    }
    if (c.type === "chunk") {
      await fs.writeFile(path.join(__dirname, c.chunkName), c.builtCode);
    }
  }
})();

// import { Bundler } from '.';
import { Bundler } from "@mizchi/bundler";
import { resolveImportMap } from "@mizchi/bundler/src/importMap";

import fs from "fs/promises";
import path from "path";
import { watch } from "graceful-fs";
import { format } from "prettier";

async function main() {
  const files: { [k: string]: string } = {
    "/index.js": await fs.readFile(path.join(__dirname, "index.js"), "utf-8"),
  };
  const webFiles = await fs.readdir(path.join(__dirname, "web_modules"));
  for (const f of webFiles) {
    if (f.endsWith(".js") || f.endsWith(".json")) {
      files[path.join("/web_modules", f)] = await fs.readFile(
        path.join(__dirname, "web_modules", f),
        "utf-8"
      );
    }
  }
  const webCommonFiles = await fs.readdir(
    path.join(__dirname, "web_modules/common")
  );
  for (const f of webCommonFiles) {
    if (f.endsWith(".js") || f.endsWith(".json")) {
      files[path.join("/web_modules/common", f)] = await fs.readFile(
        path.join(__dirname, "web_modules/common", f),
        "utf-8"
      );
    }
  }

  const importMap = resolveImportMap(
    JSON.parse(files["/web_modules/import-map.json"]),
    "/web_modules"
  );
  console.log(importMap);
  // console.log(files);
  const bundler = new Bundler(files, importMap);
  const bundle = await bundler.bundle("/index.js");
  console.log(format(bundle, { parser: "babel" }));
  eval(bundle);

  // const debounced = debounce(async (event: any, filename: any) => {
  //   console.log("changed", filename);
  //   const content = await fs.readFile(filename, "utf-8");
  //   bundler.updateModule(path.join("/", filename), content);
  //   console.time("build");
  //   const bundle = await bundler.bundle("/index.js");
  //   console.timeEnd("build");

  //   console.log(bundle);
  //   eval(bundle);
  // }, 500);
  // watch("index.js", debounced);
}

main();

function debounce(fn: Function, ms: number) {
  let id: any;
  return (...args: any) => {
    if (id) {
      // console.log("cancel", id);
      clearTimeout(id);
    }
    id = setTimeout(() => {
      fn(...args);
      id = null;
    }, ms);
  };
}

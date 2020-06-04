import type { IPromisesAPI } from "memfs/lib/promises";
import type { BundleOptions, InternalOptions, ParsedModule } from "./types";

import path from "path";
import { generateRuntimeCode, parse } from "./babelHelpers";
import { getExports } from "./getExports";
import { transformToNonEsm } from "./transformToNoEsm";
import { createMemoryFs, readFile } from "./memfsHelpers";
import { getOrderFromModules } from "./getOrderFromModules";

export class Bundler {
  public modulesMap = new Map<string, ParsedModule>();
  private fs: IPromisesAPI;
  constructor(public files: { [k: string]: string }) {
    this.fs = createMemoryFs(files);
  }
  public async bundle(
    entry: string,
    {
      format = "es",
      exposeImport = false,
      preserveExternalImport = true,
    }: BundleOptions = {}
  ) {
    const internalOptions: InternalOptions = {
      exposeImport,
      preserveExport: format === "es",
      preserveExternalImport,
    };
    await this.addModule(entry, internalOptions);
    return await this.emit("/index.js", internalOptions);
  }

  async addModule(filepath: string, opts: InternalOptions): Promise<void> {
    if (this.modulesMap.has(filepath)) {
      return;
    }
    console.log("[addModule]", filepath);

    const basepath = path.dirname(filepath);

    const raw = await readFile(this.fs, filepath);
    const ast = parse(raw, filepath);

    // extract before transform
    const { imports, exports } = getExports(ast, basepath);
    // should call after getExports()
    transformToNonEsm(ast, basepath, opts);

    this.modulesMap.set(filepath, {
      raw,
      filepath,
      ast,
      imports,
      exports,
    });

    for (const i of imports) {
      await this.addModule(i.filepath, {
        ...opts,
        preserveExport: false,
      });
    }
  }

  private async emit(entry: string, { exposeImport }: InternalOptions) {
    const entryMod = this.modulesMap.get(entry)!;
    const outputOrder: string[] = getOrderFromModules(this.modulesMap, entry, [
      entry,
    ]);
    const importCodes = outputOrder
      .filter((filepath) => filepath !== entry)
      .map((filepath) => {
        return `$$import("${filepath}");`;
      })
      .join("\n");

    const moduleCodes = outputOrder
      .filter((filepath) => filepath !== entry)
      .map((filepath) => {
        const code = generateRuntimeCode(this.modulesMap.get(filepath)!.ast);
        return `"${filepath}": ($$exports) => { ${code}; return $$exports;}`;
      })
      .join(",");

    let additianalCode = "";
    if (exposeImport) {
      additianalCode += `globalThis.$$import = $$import;`;
    }
    const entryCode = generateRuntimeCode(entryMod!.ast);

    return `// minibundle generate
  const $$exported = {};
  const $$modules = { ${moduleCodes} };
  function $$import(id){
    if ($$exported[id]) {
      return $$exported[id];
    }
    $$exported[id] = {};
    $$modules[id]($$exported[id]);
    return $$exported[id];
  }
  // additional code
  ${additianalCode};

  // evaluate as static module
  ${importCodes};
  
  // -- runner --
  const $$exports = {}; // dummy
  ${entryCode};
  `;
  }
}

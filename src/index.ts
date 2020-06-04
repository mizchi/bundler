import type { IPromisesAPI } from "memfs/lib/promises";
import type { BundleOptions, InternalOptions, ParsedModule } from "./types";

import path from "path";
import { generateCode, parse } from "./babelHelpers";
import { getExports } from "./getExports";
import { transformModule, transformEntry } from "./transformer";
import { createMemoryFs, readFile } from "./memfsHelpers";
import { getOrderFromModules } from "./getOrderFromModules";

export class Bundler {
  private modulesMap = new Map<string, ParsedModule>();
  public fs: IPromisesAPI;

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
    await this.addModule(entry);
    return await this.emit("/index.js", internalOptions);
  }

  public async updateModule(filepath: string, nextContent: string) {
    await this.fs.writeFile(filepath, nextContent);
    this.modulesMap.delete(filepath);
    this.addModule(filepath);
  }

  // TODO: need this?
  async deleteRecursive(filepath: string) {
    const cached = this.modulesMap.get(filepath)!;
    if (cached) {
      for (const i of cached.imports) {
        this.deleteRecursive(i.filepath);
        this.modulesMap.delete(i.filepath);
      }
    }
  }

  private async addModule(filepath: string): Promise<void> {
    if (this.modulesMap.has(filepath)) {
      return;
    }

    const basepath = path.dirname(filepath);

    const raw = await readFile(this.fs, filepath);
    const ast = parse(raw, filepath);

    // extract before transform
    const { imports, exports } = getExports(ast, basepath);
    transformModule(ast, basepath);

    // console.log("[addModule]", filepath, imports, exports);
    this.modulesMap.set(filepath, {
      raw,
      filepath,
      ast,
      imports,
      exports,
    });

    for (const i of imports) {
      await this.addModule(i.filepath);
    }
  }

  private async emit(
    entry: string,
    { exposeImport, preserveExport }: InternalOptions
  ) {
    const entryMod = this.modulesMap.get(entry)!;
    const basepath = path.dirname(entryMod.filepath);
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
        const code = generateCode(this.modulesMap.get(filepath)!.ast);
        return `"${filepath}": ($$exports) => { ${code}; return $$exports;}`;
      })
      .join(",");

    let additianalCode = "";
    if (exposeImport) {
      additianalCode += `globalThis.$$import = $$import;`;
    }

    // retransform entry for runner
    const ast = parse(entryMod.raw, entryMod.filepath);
    transformEntry(ast, basepath, {
      preserveExport,
    });
    const entryCode = generateCode(ast);

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

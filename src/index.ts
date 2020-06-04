import type { IPromisesAPI } from "memfs/lib/promises";
import type { BundleOptions, InternalOptions, ParsedModule } from "./types";

import path from "path";
import { generate } from "./generator";
import { parse } from "./parser";
import { analyzeScope } from "./analyzer";
import { transformToRunnerModule, transformToEntry } from "./transformer";
import { treeshake } from "./treeshaker";
import { createMemoryFs, readFile } from "./memfsHelpers";
import { getOrderFromModules } from "./getOrderFromModules";
import { isPure } from "./sideEffect";

export class Bundler {
  private modulesMap = new Map<string, ParsedModule>();
  public fs: IPromisesAPI;

  constructor(public files: { [k: string]: string }) {
    this.fs = createMemoryFs(files);
  }
  public async bundle(
    entry: string,
    { exposeToGlobal = null, preserveExternalImport = true }: BundleOptions = {}
  ) {
    const internalOptions: InternalOptions = {
      exposeToGlobal: exposeToGlobal,
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
    const { imports, exports } = analyzeScope(ast, basepath);
    const hasSideEffect = !isPure(ast);

    // console.log("[addModule]", filepath, imports, exports);
    this.modulesMap.set(filepath, {
      raw,
      filepath,
      ast,
      imports,
      exports,
      hasSideEffect,
    });

    // console.log("used", filepath, JSON.stringify(imports, null, 2));
    for (const i of imports) {
      await this.addModule(i.filepath);
    }
  }

  private async emit(entryPath: string, { exposeToGlobal }: InternalOptions) {
    const entryMod = this.modulesMap.get(entryPath)!;
    const basepath = path.dirname(entryMod.filepath);
    // TODO: remove unused
    const outputOrder: string[] = getOrderFromModules(
      this.modulesMap,
      entryPath,
      [entryPath]
    );
    // TODO: tree shake here!

    const moduleCodes = outputOrder
      .filter((filepath) => filepath !== entryPath)
      .map((filepath) => {
        const ast = this.modulesMap.get(filepath)!.ast;
        const treeshaked = treeshake(ast, filepath, [], this.modulesMap);
        const runner = transformToRunnerModule(treeshaked, basepath);
        const code = generate(runner);
        return `"${filepath}": (_$_exports) => { ${code}; return _$_exports;}`;
      })
      .join(",");

    let additianalCode = "";
    if (exposeToGlobal) {
      additianalCode += `/* Expose import */ globalThis.${exposeToGlobal} = {import: _$_import};`;
    }

    // retransform entry for runner
    const treeshaked = treeshake(entryMod.ast, entryPath, [], this.modulesMap);
    const runner = transformToEntry(treeshaked, basepath);
    const entryCode = generate(runner);

    return `// minibundle generate
const _$_exported = {};
const _$_import = (id) => _$_exported[id] || _$_modules[id](_$_exported[id] = {});

const _$_modules = { ${moduleCodes} };

${additianalCode};

// -- entry --

${entryCode};
`;
  }
}

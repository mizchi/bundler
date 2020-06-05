import type { VariableDeclarator } from "@babel/types";
import type { IPromisesAPI } from "memfs/lib/promises";
import type {
  BundleOptions,
  InternalOptions,
  ParsedModule,
  ModulesMap,
} from "./types";
import * as t from "@babel/types";
import path from "path";
import { generate } from "./generator";
import traverse from "@babel/traverse";
import { parse } from "./parser";
import { analyzeScope } from "./analyzer";
import { transformToEntry, transformToRunnerModule } from "./transformer";
import { dropUnusedImports } from "./treeshaker";
import { createMemoryFs, readFile } from "./memfsHelpers";
import { isPure, isPureNode } from "./sideEffect";

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
    const ctx = new BuildContext(entry, this.modulesMap);
    return await ctx.emit(internalOptions);
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
}

type BuildContextModulesList = Array<
  ParsedModule & {
    filepath: string;
  }
>;

class BuildContext {
  ctxModulesMap: BuildContextModulesList = [];
  constructor(private entryPath: string, private modulesMap: ModulesMap) {}

  public async emit({ exposeToGlobal }: InternalOptions) {
    this.ctxModulesMap = [];
    const entryMod = this.modulesMap.get(this.entryPath)!;
    const basepath = path.dirname(entryMod.filepath);

    const treeshaked = dropUnusedImports(
      entryMod.ast,
      this.entryPath,
      this.modulesMap
    );

    const analyzed = analyzeScope(treeshaked, basepath);

    const mod = {
      ...entryMod,
      ...analyzed,
      ast: treeshaked,
    };

    let additianalCode = "";
    if (exposeToGlobal) {
      additianalCode += `/* Expose import */ globalThis.${exposeToGlobal} = {import: _$_import};`;
    }
    this.bundleRecursively(mod);
    this.optimize();
    const moduleCodes: string[] = [];
    for (const i of this.ctxModulesMap.filter(
      (x) => x.filepath !== this.entryPath
    )) {
      const basepath = path.dirname(i.filepath);
      const runnerAst = transformToRunnerModule(i.ast, basepath);
      const moduleCode = generate(runnerAst);
      moduleCodes.push(
        `"${i.filepath}": (_$_exports) => {${moduleCode}\nreturn _$_exports}`
      );
    }

    const code = "{" + moduleCodes.join(",") + "}";

    const runner = transformToEntry(treeshaked, basepath);
    const entryCode = generate(runner);
    return runnerTemplate(code, additianalCode, entryCode);
  }

  optimize() {
    const requiredMap = new Map<string, string[]>();
    this.ctxModulesMap.forEach((m) => {
      m.imports.forEach((imp) => {
        const list = requiredMap.get(imp.filepath) || [];
        requiredMap.set(imp.filepath, [
          ...list,
          ...imp.specifiers.map((s) => s.importedName),
        ]);
      });
    });

    for (const mod of this.ctxModulesMap) {
      const required = requiredMap.get(mod.filepath) || [];
      const cloned = t.cloneNode(mod.ast);
      traverse(cloned, {
        ExportNamedDeclaration(nodePath) {
          const decl: VariableDeclarator =
            nodePath.node.declaration?.declarations[0];
          if (decl.init && decl.id.type === "Identifier") {
            const name = decl.id.name;
            if (!required.includes(name) && isPureNode(decl.init)) {
              nodePath.replaceWith(t.emptyStatement());
            }
          }
        },
        ExportDefaultDeclaration(nodePath) {
          if (
            !required.includes("default") &&
            isPureNode(nodePath.node.declaration)
          ) {
            nodePath.replaceWith(t.emptyStatement());
          }
        },
      });
      mod.ast = cloned;
    }
  }

  bundleRecursively(mod: ParsedModule) {
    if (this.ctxModulesMap.find((x) => x.filepath === mod.filepath)) {
      return;
    }
    const shaked = dropUnusedImports(mod.ast, mod.filepath, this.modulesMap);
    const basepath = path.dirname(mod.filepath);
    const analyzed = analyzeScope(shaked, basepath);

    for (const imp of analyzed.imports) {
      if (this.ctxModulesMap.find((x) => x.filepath === imp.filepath)) {
        continue;
      }
      const child = this.modulesMap.get(imp.filepath)!;
      this.bundleRecursively(child);
    }
    this.ctxModulesMap.push({
      ...mod,
      ...analyzed,
      filepath: mod.filepath,
      ast: dropUnusedImports(mod.ast, mod.filepath, this.modulesMap),
    });
  }
}

const runnerTemplate = (
  moduleCodes: string,
  additianalCode: string,
  entryCode: string
) => `// minibundle generate
const _$_exported = {};
const _$_import = (id) => _$_exported[id] || _$_modules[id](_$_exported[id] = {});
const _$_modules = ${moduleCodes};
${additianalCode};

// -- entry --

${entryCode};

`;

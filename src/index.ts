import path from "path";

import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

import type { IPromisesAPI } from "memfs/lib/promises";
import createFs from "memfs/lib/promises";
import { vol } from "memfs";

// helper
function createMemoryFs(files: { [k: string]: string }): IPromisesAPI {
  vol.fromJSON(files, "/");
  return createFs(vol) as IPromisesAPI;
}

type Module = {
  ast: any;
  filepath: string;
  imports: Import[];
};

type Import = {
  filepath: string;
};

type Output = {
  filepath: string;
  code: string;
  imports: Import[];
};

export class Bundler {
  public modulesMap = new Map<string, Module>();
  public outModules: Array<Output> = [];
  fs: IPromisesAPI;
  constructor(public files: { [k: string]: string }) {
    this.fs = createMemoryFs(files);
  }
  public async bundle(
    entry: string,
    {
      format = "es",
      exposeImport = false,
    }: { format?: "es" | "js"; exposeImport?: boolean }
  ) {
    await this.addModule(entry);
    await this.transform(entry, {
      preserveExport: format === "es" ? true : false,
    });
    return await this.emit("/index.js", { exposeImport });
  }
  async addModule(filepath: string) {
    if (this.modulesMap.has(filepath)) {
      return;
    }
    const basepath = path.dirname(filepath);

    const code = (await this.fs.readFile(filepath, {
      encoding: "utf-8",
    })) as string;
    const ast = parse(code, {
      sourceFilename: filepath,
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    }) as any;

    let imports: Import[] = [];
    traverse(ast, {
      ImportDeclaration(nodePath) {
        const target = nodePath.node.source.value;
        const absPath = path.join(basepath, target);
        imports.push({
          filepath: absPath,
        });
      },
    });
    await Promise.all(
      imports.map((imp) => {
        return this.addModule(imp.filepath);
      })
    );
    this.modulesMap.set(filepath, {
      filepath,
      ast,
      imports,
    });
  }

  async transform(
    filepath: string,
    {
      preserveExport = false,
      preserveExternalImport = true,
    }: {
      preserveExport?: boolean;
      preserveExternalImport?: boolean;
    }
  ) {
    const mod = this.modulesMap.get(filepath);
    if (mod == null) {
      throw new Error(`${filepath} is not defined`);
    }

    const alreadyIncluded = this.outModules.find(
      (m) => m.filepath === filepath
    );
    if (alreadyIncluded) {
      return;
    }

    const basepath = path.dirname(filepath);

    traverse(mod.ast, {
      ImportDeclaration(nodePath) {
        const target = nodePath.node.source.value;
        if (preserveExternalImport && target.startsWith("http")) {
          // Example: import "https://cdn.pika.dev/preact"
          return;
        }
        const absPath = path.join(basepath, target);

        // TODO: check import/export matching
        const names: [string, string][] = [];
        nodePath.node.specifiers.forEach((n) => {
          if (n.type === "ImportDefaultSpecifier") {
            names.push(["default", n.local.name]);
          }
          if (n.type === "ImportSpecifier") {
            names.push([n.imported.name, n.local.name]);
          }
        });

        const newNode = t.variableDeclaration("const", [
          t.variableDeclarator(
            t.objectPattern(
              names.map(([imported, local]) => {
                return t.objectProperty(
                  t.identifier(imported),
                  t.identifier(local)
                );
              })
            ),
            t.callExpression(t.identifier("$$import"), [
              t.stringLiteral(absPath),
            ])
          ),
        ]);
        nodePath.replaceWith(newNode as any);
      },
      ExportDefaultDeclaration(nodePath) {
        if (preserveExport) {
          return;
        }
        const name = "default";
        const right = nodePath.node.declaration as any;
        const newNode = t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(
              t.identifier("$$exports"),
              t.stringLiteral(name),
              true
            ),
            right
          )
        );
        nodePath.replaceWith(newNode as any);
      },
      ExportNamedDeclaration(nodePath) {
        if (preserveExport) {
          return;
        }

        // TODO: name mapping
        // TODO: Export multiple name
        const decl = nodePath.node.declaration.declarations[0];
        const name = decl.id.name;
        const right = decl.init;
        const newNode = t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(
              t.identifier("$$exports"),
              t.stringLiteral(name),
              true
            ),
            right
          )
        );
        nodePath.replaceWith(newNode as any);
      },
    });

    const gen = generate(mod.ast);
    this.outModules.push({
      imports: mod.imports,
      filepath: mod.filepath,
      code: gen.code,
    });

    await Promise.all(
      mod.imports.map((imp) => {
        return this.transform(imp.filepath, { preserveExport: false });
      })
    );
  }

  async emit(entry: string, { exposeImport }: { exposeImport: boolean }) {
    const entryMod = this.outModules.find((m) => m.filepath === entry);

    const importCodes = this.outModules
      .filter((m) => m.filepath !== entry)
      .map((m) => {
        return `$$import("${m.filepath}");`;
      })
      .join("\n");

    const mods = this.outModules
      .filter((m) => m.filepath !== entry)
      .map((m) => {
        return `"${m.filepath}": ($$exports) => {
    ${m.code}
    return $$exports;
  }
  `;
      })
      .join(",");

    let additianalCode = "";
    if (exposeImport) {
      additianalCode += `globalThis.$$import = $$import;`;
    }
    return `// minibundle generate
  const $$exported = {};
  const $$modules = { ${mods} };
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
  ${entryMod?.code};
  `;
  }
}

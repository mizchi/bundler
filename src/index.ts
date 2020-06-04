import type { Program } from "@babel/types";
import type { IPromisesAPI } from "memfs/lib/promises";

import path, { basename } from "path";
import { parse as parseAsBabel } from "@babel/parser";
import traverse from "@babel/traverse";
import generateAsBabel, { CodeGenerator } from "@babel/generator";
import * as t from "@babel/types";
import createFs from "memfs/lib/promises";
import { Volume } from "memfs";

type BundleOptions = {
  format?: "es" | "js";
  exposeImport?: boolean;
  preserveExternalImport?: boolean;
};
type InternalOptions = {
  preserveExport: boolean;
  preserveExternalImport: boolean;
  exposeImport: boolean;
};

function generateRuntimeCode(ast: Program): string {
  const gen = generateAsBabel(ast);
  return gen.code;
}

type Import = {
  filepath: string;
};

type Export = {
  exportedName: string;
};

type Module = {
  raw: string;
  // transformed: string;
  ast: Program;
  filepath: string;
  imports: Import[];
  exports: Export[];
};

type Output = {
  filepath: string;
  code: string;
};

// TODO
// function hasSideEffect(ast: Program) {}

function parse(code: string, filepath: string): Program {
  return (parseAsBabel(code, {
    sourceFilename: filepath,
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  }) as any) as Program;
}

// helper
function createMemoryFs(files: { [k: string]: string }): IPromisesAPI {
  const vol = Volume.fromJSON(files, "/");
  return createFs(vol) as IPromisesAPI;
}

function getExports(
  ast: Program,
  basepath: string
): { exports: Export[]; imports: Import[] } {
  let imports: Import[] = [];
  let exports: Export[] = [];

  traverse(ast, {
    ImportDeclaration(nodePath) {
      const target = nodePath.node.source.value;
      const absPath = path.join(basepath, target);
      imports.push({
        filepath: absPath,
      });
    },
    ExportDeclaration(nodePath) {
      if (nodePath.node.type === "ExportNamedDeclaration") {
        const decl = nodePath.node.declaration.declarations[0];
        exports.push({ exportedName: decl.id.name });
      }
    },
  });
  return {
    imports,
    exports,
  };
}

async function transformToNonEsm(
  ast: Program,
  basepath: string,
  {
    preserveExport,
    preserveExternalImport,
  }: { preserveExport: boolean; preserveExternalImport: boolean }
) {
  traverse(ast, {
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
          t.callExpression(t.identifier("$$import"), [t.stringLiteral(absPath)])
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
}

export class Bundler {
  public modulesMap = new Map<string, Module>();
  fs: IPromisesAPI;
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

    const raw = (await this.fs.readFile(filepath, {
      encoding: "utf-8",
    })) as string;
    const ast = parse(raw, filepath);

    // extract before transform
    const { imports, exports } = getExports(ast, basepath);
    // console.log("[import]", filepath, imports);

    // should call after getExports()
    transformToNonEsm(ast, basepath, opts);
    // const transformed = generateRuntimeCode(ast);

    this.modulesMap.set(filepath, {
      raw,
      // transformed,
      filepath,
      ast,
      imports,
      exports,
    });

    // throw imports;
    for (const i of imports) {
      // console.log("import", i.filepath, "from", filepath);
      await this.addModule(i.filepath, {
        ...opts,
        preserveExport: false,
      });
    }
    // TODO: Check side effect flag
  }

  private reoder(filepath: string, orders: string[] = []) {
    const { imports } = this.modulesMap.get(filepath)!;
    for (const imp of imports) {
      if (!orders.includes(imp.filepath)) {
        orders.push(imp.filepath);
        this.reoder(imp.filepath, orders);
      }
    }
    return orders;
  }
  private async emit(entry: string, { exposeImport }: InternalOptions) {
    const entryMod = this.modulesMap.get(entry)!;

    const outputOrder: string[] = this.reoder(entry, [entry]);
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

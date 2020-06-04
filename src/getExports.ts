import type { Program } from "@babel/types";
import type { Export, Import } from "./types";

import path from "path";
import traverse from "@babel/traverse";

export function getExports(
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

import type { Program } from "@babel/types";
import type { Export, Import, Specifier } from "./types";

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
      const importers: Specifier[] = [];

      for (const specifier of nodePath.node.specifiers) {
        let used = false;
        traverse(
          {
            ...ast,
            body: ast.body.filter((n) => n.type !== "ImportDeclaration"),
          },
          {
            Identifier(identifierNodePath) {
              if (identifierNodePath.node.name === specifier.local.name) {
                used = true;
              }
            },
          }
        );
        // const from = filepath
        if (specifier.type === "ImportSpecifier") {
          importers.push({
            localName: specifier.local.name,
            importedName: specifier.imported.name,
            used,
          });
        }
        if (specifier.type === "ImportDefaultSpecifier") {
          importers.push({
            localName: specifier.local.name,
            importedName: "default",
            used,
          });
        }
      }

      imports.push({
        filepath: absPath,
        specifiers: importers,
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

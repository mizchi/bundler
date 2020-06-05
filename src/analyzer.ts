import type { Program } from "@babel/types";
import type { Export, Import, Specifier } from "./types";

import path from "path";
import traverse from "@babel/traverse";
import { isPureNode } from "./sideEffect";

export function analyzeModule(
  ast: Program,
  basepath: string
): { exports: Export[]; imports: Import[] } {
  let imports: Import[] = [];
  let exports: Export[] = [];

  const refenrencedIdentifiers = getReferencedIdentifiers({
    ...ast,
    body: ast.body.filter((x) => x.type !== "ImportDeclaration"),
  });

  traverse(ast, {
    ImportDeclaration(nodePath) {
      const target = nodePath.node.source.value;
      const absPath = path.join(basepath, target);
      const specifiers: Specifier[] = [];

      for (const specifier of nodePath.node.specifiers) {
        const used = refenrencedIdentifiers.includes(specifier.local.name);
        if (specifier.type === "ImportSpecifier") {
          specifiers.push({
            localName: specifier.local.name,
            importedName: specifier.imported.name,
            used,
          });
        }
        if (specifier.type === "ImportDefaultSpecifier") {
          specifiers.push({
            localName: specifier.local.name,
            importedName: "default",
            used,
          });
        }
      }

      imports.push({
        filepath: absPath,
        specifiers: specifiers,
      });
    },
    ExportDeclaration(nodePath) {
      if (nodePath.node.type === "ExportNamedDeclaration") {
        const decl = nodePath.node.declaration.declarations[0];
        const pure = isPureNode(decl.init);
        exports.push({ exportedName: decl.id.name, pure });
      }
    },
  });
  return {
    imports,
    exports,
  };
}

function getReferencedIdentifiers(ast: Program) {
  const ids: string[] = [];
  traverse(ast, {
    Identifier(nodePath) {
      // console.log(nodePath.node.name, "in", nodePath.parent.type);
      if (
        nodePath.parent.type === "ObjectProperty" &&
        nodePath.node !== nodePath.parent.value
      ) {
        // console.log(nodePath.node.name, "is label of", nodePath.parent.key);
        return;
      }

      if (
        nodePath.parent.type === "MemberExpression" &&
        nodePath.node !== nodePath.parent.object
      ) {
        // console.log(nodePath.node.name, "is property of", nodePath.parent.object);
        return;
      }
      if (!ids.includes(nodePath.node.name)) {
        ids.push(nodePath.node.name);
      }
      // console.log(nodePath.node.name);
    },
  });
  return ids;
}

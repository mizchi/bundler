import type { Program } from "@babel/types";

import path from "path";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

export function transformModule(ast: Program, basepath: string) {
  return transform(ast, basepath, {
    preserveExport: false,
    preserveExternalImport: true,
  });
}

export function transformEntry(
  ast: Program,
  basepath: string,
  options: { preserveExport: boolean }
) {
  return transform(ast, basepath, {
    preserveExport: options.preserveExport,
    preserveExternalImport: true,
  });
}

export function transform(
  ast: Program,
  basepath: string,
  {
    preserveExport,
    preserveExternalImport,
  }: { preserveExport: boolean; preserveExternalImport: boolean }
) {
  const cloned = t.cloneNode(ast);
  traverse(cloned, {
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
  return cloned;
}

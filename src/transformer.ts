import type { Program } from "@babel/types";

import path from "path";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { filepathToFlatSymbol } from "./helpers";

export function transformToModuleRunner(
  ast: Program,
  basepath: string,
  { transformDynamicImport = false }: { transformDynamicImport?: boolean } = {}
) {
  return transformToRunner(ast, basepath, {
    preserveExport: false,
    preserveExternalImport: true,
    transformDynamicImport,
  });
}

export function transformToEntryRunner(
  ast: Program,
  basepath: string,
  { transformDynamicImport = false }: { transformDynamicImport?: boolean } = {}
) {
  return transformToRunner(ast, basepath, {
    preserveExport: true,
    preserveExternalImport: true,
    transformDynamicImport,
  });
}

export function transformToRunner(
  ast: Program,
  basepath: string,
  {
    preserveExport,
    preserveExternalImport,
    transformDynamicImport,
  }: {
    preserveExport: boolean;
    preserveExternalImport: boolean;
    transformDynamicImport: boolean;
  }
) {
  const cloned = t.cloneNode(ast);
  const newImportStmts: t.VariableDeclaration[] = [];
  traverse(cloned, {
    CallExpression(nodePath) {
      if (!transformDynamicImport) {
        return;
      }
      // console.log("CallExpression", nodePath.node);
      if (nodePath.node.callee.type == "Import") {
        const arg = nodePath.node.arguments[0];
        if (arg.type === "StringLiteral") {
          const absPath = path.join(basepath, arg.value);
          arg.value = filepathToFlatSymbol(absPath);
        }
      }
    },

    ImportDeclaration(nodePath) {
      const target = nodePath.node.source.value;
      if (preserveExternalImport && target.startsWith("http")) {
        // Example: import "https://cdn.pika.dev/preact"
        return;
      }
      const absPath = path.join(basepath, target);
      const names: [string, string][] = [];
      nodePath.node.specifiers.forEach((n) => {
        if (n.type === "ImportDefaultSpecifier") {
          names.push(["default", n.local.name]);
        }
        if (n.type === "ImportSpecifier") {
          names.push([n.imported.name, n.local.name]);
        }
      });

      newImportStmts.push(
        t.variableDeclaration("const", [
          t.variableDeclarator(
            t.objectPattern(
              names.map(([imported, local]) => {
                return t.objectProperty(
                  t.identifier(imported),
                  t.identifier(local)
                );
              })
            ),
            t.callExpression(t.identifier("_$_import"), [
              t.stringLiteral(absPath),
            ])
          ),
        ])
      );
      nodePath.replaceWith(t.emptyStatement());
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
          t.memberExpression(t.identifier("_$_exports"), t.identifier(name)),
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
            t.identifier("_$_exports"),
            t.identifier(name)
            // true
          ),
          right
        )
      );
      nodePath.replaceWith(newNode as any);
    },
  });
  return { ...cloned, body: [...newImportStmts, ...cloned.body] };
}

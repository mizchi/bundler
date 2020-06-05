import { Ast } from "./types";
import path from "path";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { filepathToFlatSymbol } from "./helpers";

export function transformToModuleRunner(
  ast: Ast,
  basepath: string,
  {
    transformDynamicImport,
    publicPath,
  }: { transformDynamicImport: boolean; publicPath: string }
) {
  return transformToRunner(ast, basepath, {
    preserveExport: false,
    preserveExternalImport: true,
    transformDynamicImport,
    publicPath,
  });
}

export function transformToEntryRunner(
  ast: Ast,
  basepath: string,
  {
    transformDynamicImport,
    publicPath,
  }: { transformDynamicImport: boolean; publicPath: string }
) {
  return transformToRunner(ast, basepath, {
    preserveExport: true,
    preserveExternalImport: true,
    transformDynamicImport,
    publicPath,
  });
}

const transformWorkerSource = true;
export function transformToRunner(
  ast: Ast,
  basepath: string,
  {
    preserveExport,
    preserveExternalImport,
    transformDynamicImport,
    publicPath,
  }: {
    preserveExport: boolean;
    preserveExternalImport: boolean;
    transformDynamicImport: boolean;
    publicPath: string;
  }
): Ast {
  const cloned = t.cloneNode(ast);
  const newImportStmts: t.VariableDeclaration[] = [];
  traverse(cloned, {
    NewExpression(nodePath) {
      if (
        nodePath.node.callee.type === "Identifier" &&
        nodePath.node.callee.name === "Worker"
      ) {
        if (nodePath.node.arguments[0].type === "StringLiteral") {
          const abspath = path.join(basepath, nodePath.node.arguments[0].value);
          nodePath.node.arguments[0].value = filepathToFlatSymbol(
            abspath,
            publicPath
          );
        }
      }
    },
    CallExpression(nodePath) {
      if (!transformDynamicImport) {
        return;
      }
      // console.log("CallExpression", nodePath.node);
      if (nodePath.node.callee.type == "Import") {
        const arg = nodePath.node.arguments[0];
        if (arg.type === "StringLiteral") {
          const abspath = path.join(basepath, arg.value);
          arg.value = filepathToFlatSymbol(abspath, publicPath);
        }
      }
    },

    ImportDeclaration(nodePath) {
      const target = nodePath.node.source.value;
      if (preserveExternalImport && target.startsWith("http")) {
        // Example: import "https://cdn.pika.dev/preact"
        return;
      }
      const abspath = path.join(basepath, target);
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
              t.stringLiteral(abspath),
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
      if (nodePath.node.declaration) {
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
        nodePath.replaceWith(newNode);
      } else {
        // export { a as b }
        const exportNames: Array<{ exported: string; imported: string }> = [];
        for (const specifier of nodePath.node.specifiers) {
          if (specifier.type == "ExportSpecifier") {
            exportNames.push({
              exported: specifier.exported.name,
              imported: specifier.local.name,
            });
          }
        }
        const sourceMode = !!nodePath.node.source;

        nodePath.replaceWith(
          t.blockStatement(
            exportNames.map((exp) => {
              return t.expressionStatement(
                t.assignmentExpression(
                  "=",
                  t.memberExpression(
                    t.identifier("_$_exports"),
                    t.identifier(exp.exported)
                    // true
                  ),
                  nodePath.node.source
                    ? t.memberExpression(
                        t.callExpression(t.identifier("_$_import"), [
                          t.stringLiteral(
                            path.join(basepath, nodePath.node.source.value)
                          ),
                        ]),
                        t.identifier(exp.imported)
                      )
                    : t.identifier(exp.imported)
                )
              );
            })
          )
        );
      }
    },
  });
  return {
    ...cloned,
    program: {
      ...ast.program,
      body: [...newImportStmts, ...cloned.program.body],
    },
  };
}

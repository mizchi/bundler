import * as t from "@babel/types";
import type {
  Export,
  Import,
  Specifier,
  DynamicImport,
  Analyzed,
  WorkerSource,
  Ast,
  AstNode,
} from "./types";

import path from "path";
import traverse from "@babel/traverse";

export function analyzeModule(ast: Ast, basepath: string): Analyzed {
  let imports: Import[] = [];
  let exports_: Export[] = [];
  let dynamicImports: DynamicImport[] = [];
  let workerSources: WorkerSource[] = [];

  const refs = getGlobalsWithoutImports(ast);
  // console.log("globals", refs);

  traverse(ast, {
    NewExpression(nodePath) {
      if (
        nodePath.node.callee.type === "Identifier" &&
        nodePath.node.callee.name === "Worker"
      ) {
        if (nodePath.node.arguments[0].type === "StringLiteral") {
          const source = nodePath.node.arguments[0].value;
          workerSources.push({
            filepath: path.join(basepath, source),
            module: true,
          });
        }
      }
    },
    // detect dynamic import
    CallExpression(nodePath) {
      // console.log("CallExpression", nodePath.node);
      if (nodePath.node.callee.type == "Import") {
        const arg = nodePath.node.arguments[0];
        if (arg.type === "StringLiteral") {
          const abspath = path.join(basepath, arg.value);
          dynamicImports.push({
            filepath: abspath,
          });
        }
      }
    },
    ImportDeclaration(nodePath) {
      const target = nodePath.node.source.value;
      const absPath = path.join(basepath, target);
      const specifiers: Specifier[] = [];

      for (const specifier of nodePath.node.specifiers) {
        const used = refs.includes(specifier.local.name);
        if (specifier.type === "ImportSpecifier") {
          specifiers.push({
            type: "identifier",
            localName: specifier.local.name,
            importedName: specifier.imported.name,
            used,
          });
        }
        if (specifier.type === "ImportDefaultSpecifier") {
          specifiers.push({
            type: "identifier",
            importedName: "default",
            localName: specifier.local.name,
            used,
          });
        }

        if (specifier.type === "ImportNamespaceSpecifier") {
          // TODO: push all
          specifiers.push({
            type: "namespace",
            localName: specifier.local.name,
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
        if (nodePath.node.declaration) {
          const decl = nodePath.node.declaration.declarations[0];
          const pure = isPureAstNode(decl.init);
          exports_.push({ exportedName: decl.id.name, pure });
        } else {
          // Example: export { a }
          for (const specifier of nodePath.node.specifiers) {
            if (specifier.type == "ExportSpecifier") {
              exports_.push({
                exportedName: specifier.exported.name,
                pure: true,
              });
            }
          }

          // export {a} from "./m.js";
          // handle as import to used codes
          if (nodePath.node.source) {
            const specifiers: Specifier[] = nodePath.node.specifiers.map(
              (specifier) => {
                if (specifier.type == "ExportSpecifier") {
                  // local and exported are inverted
                  return {
                    type: "identifier",
                    localName: specifier.exported.name,
                    importedName: specifier.local.name,
                    used: true,
                  };
                } else if (specifier.type === "ExportDefaultSpecifier") {
                  // TODO: Check later
                  return {
                    type: "identifier",
                    localName: specifier.exported.name,
                    importedName: "default",
                    used: true,
                  };
                }
                throw new Error(`ExportNamespaces are deprecated`);
              }
            );

            imports.push({
              filepath: path.join(basepath, nodePath.node.source.value),
              specifiers: specifiers,
            });
          }
        }
      }
    },
  });
  return {
    imports,
    exports: exports_,
    dynamicImports,
    workerSources,
    pure: isPureAst(ast),
  };
}

export function getGlobalsWithoutImports(ast: Ast) {
  let ids: string[] = [];
  const astWithoutImports = {
    ...ast,
    program: {
      ...ast.program,
      body: ast.program.body.filter((x) => x.type !== "ImportDeclaration"),
    },
  };
  traverse(astWithoutImports, {
    Program(path) {
      // @ts-ignore
      ids = Object.keys(path.scope.globals);
    },
  });
  return ids;
}

const WHITELIST_NODE_TYPE: string[] = [
  // Statement
  "ImportDeclaration",
  "FunctionDeclaration",
  "EmptyStatement",
  "DebuggerStatement",
  "ClassDeclaration",
  "EmptyStatement",

  // Expression
  "ArrowFunctionExpression",
  "FunctionExpression",
  "ClassExpression",
  "Identifier",

  // Literal
  "Literal",
  "StringLiteral",
  "BooleanLiteral",
  "NumericLiteral",
  "Literal",
];

export function isPureAst(parsed: Ast): boolean {
  for (const stmt of parsed.program.body) {
    if (!isPureAstNode(stmt)) {
      return false;
    }
  }
  return true;
}

export function isPureAstNode(node: AstNode) {
  // TODO: why?
  if (node == null) {
    return true;
  }
  switch (node.type) {
    case "VariableDeclaration": {
      for (const declaration of node.declarations) {
        if (declaration.init) {
          if (!isPureAstNode(declaration.init)) {
            return false;
          }
        }
        continue;
      }
      return true;
    }
    case "ObjectExpression": {
      for (const prop of node.properties) {
        if (prop.type === "SpreadElement") {
          if (!isPureAstNode(prop.argument)) {
            return false;
          }
          continue;
        }
        if (prop.computed) {
          if (!isPureAstNode(prop.key)) {
            return false;
          }
        }
        if (prop.type === "ObjectProperty") {
          if (!isPureAstNode(prop.value)) {
            return false;
          }
        }
      }
      return true;
    }

    case "ArrayExpression": {
      for (const element of node.elements) {
        // TODO: [[]]
        if (element && !isPureAstNode(element)) {
          return false;
        }
      }
      return true;
    }
    case "ExpressionStatement": {
      if (!isPureAstNode(node.expression)) {
        return false;
      }
      return true;
    }
    case "ExportNamedDeclaration": {
      if (!isPureAstNode(node.declaration)) {
        return false;
      }
      return true;
    }
    case "ExportDefaultDeclaration": {
      if (!isPureAstNode(node.declaration)) {
        return false;
      }
      return true;
    }
    default: {
      if (!isPureAstNodeType(node.type)) {
        return false;
      }
      return true;
    }
  }
}

function isPureAstNodeType(type: string): boolean {
  return WHITELIST_NODE_TYPE.includes(type);
}

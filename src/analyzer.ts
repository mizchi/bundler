import * as t from "@babel/types";
import type {
  Export,
  Import,
  Specifier,
  DynamicImport,
  Analyzed,
  WorkerImport,
  Ast,
  AstNode,
} from "./types";

import path from "path";
import traverse from "@babel/traverse";

export function analyzeModule(ast: Ast, basepath: string): Analyzed {
  let imports: Import[] = [];
  let exports: Export[] = [];
  let dynamicImports: DynamicImport[] = [];
  let workerImports: WorkerImport[] = [];

  const refs = getGlobalsWithoutImports(ast);
  // console.log("globals", refs);

  traverse(ast, {
    // detect dynamic import
    CallExpression(nodePath) {
      // console.log("CallExpression", nodePath.node);
      if (nodePath.node.callee.type == "Import") {
        const arg = nodePath.node.arguments[0];
        if (arg.type === "StringLiteral") {
          const absPath = path.join(basepath, arg.value);
          dynamicImports.push({
            filepath: absPath,
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
    dynamicImports,
    workerImports,
    pure: isPureProgram(ast),
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

function isPureNodeType(type: string): boolean {
  return WHITELIST_NODE_TYPE.includes(type);
}

export function isPureNode(node: AstNode) {
  switch (node.type) {
    case "VariableDeclaration": {
      for (const declaration of node.declarations) {
        if (declaration.init) {
          if (!isPureNode(declaration.init)) {
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
          if (!isPureNode(prop.argument)) {
            return false;
          }
          continue;
        }
        if (prop.computed) {
          if (!isPureNode(prop.key)) {
            return false;
          }
        }
        if (prop.type === "ObjectProperty") {
          if (!isPureNode(prop.value)) {
            return false;
          }
        }
      }
      return true;
    }

    case "ArrayExpression": {
      for (const element of node.elements) {
        // TODO: [[]]
        if (element && !isPureNode(element)) {
          return false;
        }
      }
      return true;
    }
    case "ExpressionStatement": {
      if (!isPureNode(node.expression)) {
        return false;
      }
      return true;
    }
    case "ExportNamedDeclaration": {
      if (!isPureNode(node.declaration)) {
        return false;
      }
      return true;
    }
    case "ExportDefaultDeclaration": {
      if (!isPureNode(node.declaration)) {
        return false;
      }
      return true;
    }
    default: {
      if (!isPureNodeType(node.type)) {
        return false;
      }
      return true;
    }
  }
}

export function isPureProgram(parsed: Ast): boolean {
  for (const stmt of parsed.program.body) {
    if (!isPureNode(stmt)) {
      return false;
    }
  }
  return true;
}

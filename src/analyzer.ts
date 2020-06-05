import type { Program, Node } from "@babel/types";
import type { Export, Import, Specifier, DynamicImport } from "./types";

import path from "path";
import traverse from "@babel/traverse";

export function analyzeModule(
  ast: Program,
  basepath: string
): {
  exports: Export[];
  imports: Import[];
  dynamicImports: DynamicImport[];
  pure: boolean;
} {
  let imports: Import[] = [];
  let exports: Export[] = [];
  let dynamicImports: DynamicImport[] = [];

  const refenrencedIdentifiers = getReferencedIdentifiers({
    ...ast,
    body: ast.body.filter((x) => x.type !== "ImportDeclaration"),
  });

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
    dynamicImports,
    pure: isPureProgram(ast),
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

export function isPureNode(node: Node) {
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

export function isPureProgram(ast: Program): boolean {
  for (const stmt of ast.body) {
    if (!isPureNode(stmt)) {
      return false;
    }
  }
  return true;
}

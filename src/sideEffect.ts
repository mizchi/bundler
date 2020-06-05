import type { Program, Node } from "@babel/types";

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

export function isPure(ast: Program): boolean {
  for (const stmt of ast.body) {
    if (!isPureNode(stmt)) {
      return false;
    }
  }
  return true;
}

import { ParsedModule } from "./types";
import type { Program } from "@babel/types";

import path from "path";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

export function treeshake(
  ast: Program,
  filepath: string,
  requiredExports: string[],
  moduleMaps: Map<string, ParsedModule>
): Program {
  const cloned = t.cloneNode(ast);
  const basepath = path.dirname(filepath);
  const { imports } = moduleMaps.get(filepath)!;
  traverse(cloned, {
    ImportDeclaration(nodePath) {
      const target = nodePath.node.source.value;
      const abspath = path.join(basepath, target);
      const hasSideEffect = hasSideEffectRecuresive(abspath, moduleMaps);
      // do noting with side effect
      if (hasSideEffect) {
        return;
      }
      const import_ = imports.find((i) => i.filepath === abspath)!;
      if (
        import_.specifiers.every((s) => {
          return !s.used;
        })
      ) {
        nodePath.replaceWith(t.emptyStatement());
      }
    },
  });
  return cloned;
}

function hasSideEffectRecuresive(
  filepath: string,
  moduleMaps: Map<string, ParsedModule>
) {
  const mod = moduleMaps.get(filepath)!;
  if (mod.hasSideEffect) {
    return true;
  }
  for (const i of mod.imports) {
    if (hasSideEffectRecuresive(i.filepath, moduleMaps)) {
      return true;
    }
  }
  return false;
}

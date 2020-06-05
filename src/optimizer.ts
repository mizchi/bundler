import path from "path";
import type { AnalyzedChunk } from "./types";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { analyzeModule, isPureNode } from "./analyzer";

export function optimize(chunks: AnalyzedChunk[], entry: string) {
  return eliminateUnusedImports(treeshakeExports(chunks, entry));
}

export function treeshakeExports(
  chunks: AnalyzedChunk[],
  entry: string
): AnalyzedChunk[] {
  const requiredExportsMap = new Map<string, string[]>();
  chunks.forEach((m) => {
    m.imports.forEach((imp) => {
      const list = requiredExportsMap.get(imp.filepath) || [];
      requiredExportsMap.set(imp.filepath, [
        ...list,
        ...imp.specifiers.map((s) => s.importedName),
      ]);
    });
  });

  return chunks.map((mod) => {
    if (mod.filepath === entry) {
      return mod;
    }
    const required = requiredExportsMap.get(mod.filepath) || [];
    const cloned = t.cloneNode(mod.ast);
    traverse(cloned, {
      ExportNamedDeclaration(nodePath) {
        const decl: t.VariableDeclarator =
          nodePath.node.declaration?.declarations[0];
        if (decl.init && decl.id.type === "Identifier") {
          const name = decl.id.name;
          // console.log("identifier", name);

          if (!required.includes(name) && isPureNode(decl.init)) {
            nodePath.replaceWith(t.emptyStatement());
          }
        }
      },
      ExportDefaultDeclaration(nodePath) {
        if (
          !required.includes("default") &&
          isPureNode(nodePath.node.declaration)
        ) {
          nodePath.replaceWith(t.emptyStatement());
        }
      },
    });
    return {
      ...mod,
      ...analyzeModule(cloned, path.dirname(mod.filepath)),
      ast: cloned,
    };
  });
}

export function eliminateUnusedImports(
  chunks: AnalyzedChunk[]
): AnalyzedChunk[] {
  const optimized = chunks.map((chunk) => {
    const cloned = t.cloneNode(chunk.ast);
    const basepath = path.dirname(chunk.filepath);
    traverse(cloned, {
      ImportDeclaration(nodePath) {
        const target = nodePath.node.source.value;
        const abspath = path.join(basepath, target);
        const pure = isPureRec(abspath, chunks);
        if (!pure) {
          return;
        }
        const import_ = chunk.imports.find((i) => i.filepath === abspath)!;
        // console.log("spec", import_.specifiers);
        if (
          import_.specifiers.every((s) => {
            return !s.used;
          })
        ) {
          nodePath.replaceWith(t.emptyStatement());
        }
      },
    });
    return { ...chunk, ...analyzeModule(cloned, basepath), ast: cloned };
  });
  const survived: AnalyzedChunk[] = [];
  function reaggregate(chunk: AnalyzedChunk) {
    // console.log("reaggregate", chunk.filepath);
    const exists = survived.find((x) => x.filepath === chunk.filepath);
    if (exists) {
      return;
    }
    survived.push(chunk);
    chunk.imports.forEach((imp) => {
      const child = optimized.find((x) => x.filepath === imp.filepath)!;
      reaggregate(child);
    });
  }

  // last chunk should be entry
  reaggregate(optimized[optimized.length - 1]);

  // console.log("survived", survived);
  return survived;
}

function isPureRec(filepath: string, chunks: AnalyzedChunk[]): boolean {
  const mod = chunks.find((x) => x.filepath === filepath)!;
  return (
    mod.pure && mod.imports.every((imp) => isPureRec(imp.filepath, chunks))
  );
}
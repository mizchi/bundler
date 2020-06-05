import { ModulesMap } from "./types";
import type { AnalyzedChunk } from "./types";

export function aggregateChunks(modulesMap: ModulesMap, entryPath: string) {
  const entryMod = modulesMap.get(entryPath)!;
  const chunks: AnalyzedChunk[] = [];
  _aggregate(entryMod);
  return chunks;

  function _aggregate(mod: AnalyzedChunk) {
    if (chunks.find((x) => x.filepath === mod.filepath)) {
      return chunks;
    }

    for (const imp of mod.imports) {
      if (chunks.find((x) => x.filepath === imp.filepath)) {
        continue;
      }
      const child = modulesMap.get(imp.filepath)!;
      _aggregate(child);
    }
    chunks.push(mod);
    return chunks;
  }
}

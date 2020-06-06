import path from "path";
import { ImportMap } from "./types";

export function resolveImportMap(importMap: ImportMap, basepath: string) {
  return {
    imports: Object.entries(importMap.imports).reduce((acc, [k, v]) => {
      return { ...acc, [k]: path.join(basepath, v) };
    }, {}),
  };
}

export function resolveSource(
  source: string,
  basepath: string,
  importMap: ImportMap = { imports: {} }
) {
  if (source.startsWith("/")) {
    return source;
  }

  if (source.startsWith(".")) {
    return path.join(basepath, source);
  }
  const mapped = importMap.imports[source];
  if (mapped) {
    console.log("[resolveSource] use importMap", mapped);
    return mapped;
  }
  return source;
}

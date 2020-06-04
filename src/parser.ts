import type { Program } from "@babel/types";

import { parse as parseAsBabel } from "@babel/parser";

export function parse(code: string, filepath: string): Program {
  return parseAsBabel(code, {
    sourceFilename: filepath,
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  }).program as Program;
}

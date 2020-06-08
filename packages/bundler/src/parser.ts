import { Ast } from "./types";
import { parse as parseAsBabel } from "@babel/parser";

export function parse(code: string, filepath: string): Ast {
  return parseAsBabel(code, {
    sourceFilename: filepath,
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
}

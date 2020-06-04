import generateAsBabel from "@babel/generator";
import { parse as parseAsBabel } from "@babel/parser";
import type { Program } from "@babel/types";

export function generateCode(ast: Program): string {
  const gen = generateAsBabel(ast);
  return gen.code;
}

export function parse(code: string, filepath: string): Program {
  return parseAsBabel(code, {
    sourceFilename: filepath,
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  }).program as Program;
}

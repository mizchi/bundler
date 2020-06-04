import type { Program } from "@babel/types";

import generateAsBabel from "@babel/generator";

export function generate(ast: Program): string {
  const gen = generateAsBabel(ast);
  return gen.code;
}

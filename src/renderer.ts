import path from "path";
import { transformToEntryRunner, transformToModuleRunner } from "./transformer";
import type { AnalyzedChunk } from "./types";

export function render(
  entryPath: string,
  chunks: AnalyzedChunk[],
  opts: { exposeToGlobal: string | null }
) {
  const moduleCodes: string[] = [];
  const basepath = path.dirname(entryPath);
  const entryModule = chunks.find((x) => x.filepath === entryPath)!;
  const moduleChunks = chunks.filter((x) => x.filepath !== entryPath);

  for (const chunk of moduleChunks) {
    const basepath = path.dirname(chunk.filepath);
    const runnerAst = transformToModuleRunner(chunk.ast, basepath);
    const moduleCode = generate(runnerAst);
    moduleCodes.push(
      `"${chunk.filepath}": (_$_exports) => {${moduleCode}\nreturn _$_exports}`
    );
  }

  const code = "{" + moduleCodes.join(",") + "}";

  let additianalCode = "";
  if (opts.exposeToGlobal) {
    additianalCode += `/* Expose import */ globalThis.${opts.exposeToGlobal} = {import: _$_import};`;
  }

  const entryCode = generate(transformToEntryRunner(entryModule.ast, basepath));
  return runnerTemplate(code, additianalCode, entryCode);
}

import type { Program } from "@babel/types";

import generateAsBabel from "@babel/generator";

export function generate(ast: Program): string {
  const gen = generateAsBabel(ast);
  return gen.code;
}

const runnerTemplate = (
  moduleCodes: string,
  additianalCode: string,
  entryCode: string
) => `// @mizchi/bundler generate
const _$_exported = {};
const _$_import = (id) => _$_exported[id] || _$_modules[id](_$_exported[id] = {});
const _$_modules = ${moduleCodes};
${additianalCode};

// -- entry --

${entryCode};

`;

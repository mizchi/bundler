import type { Program } from "@babel/types";

export type BundleOptions = {
  exposeToGlobal?: string | null;
  preserveExternalImport?: boolean;
};

export type InternalOptions = {
  preserveExternalImport: boolean;
  exposeToGlobal: string | null;
};

export type Specifier = {
  localName: string;
  importedName: string;
  used: boolean;
};

export type Import = {
  filepath: string;
  specifiers: Specifier[];
};

export type Export = {
  exportedName: string;
  pure: boolean;
};

export type AnalyzedChunk = {
  raw: string;
  ast: Program;
  filepath: string;
  imports: Import[];
  exports: Export[];
  hasSideEffect: boolean;
};

export type ModulesMap = Map<string, AnalyzedChunk>;

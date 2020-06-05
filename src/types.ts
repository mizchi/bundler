import type { Program } from "@babel/types";

export type BundleOptions = {
  exposeToGlobal?: string | null;
  preserveExternalImport?: boolean;
  optimize?: boolean;
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

export type DynamicImport = {
  filepath: string;
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
  dynamicImports: DynamicImport[];
  exports: Export[];
  pure: boolean;
};

export type ModulesMap = Map<string, AnalyzedChunk>;

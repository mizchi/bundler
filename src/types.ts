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

export type WorkerImport = {
  filepath: string;
  module: boolean;
};

export type AnalyzedChunk = Analyzed & {
  raw: string;
  ast: Program;
  filepath: string;
};

export type ModulesMap = Map<string, AnalyzedChunk>;

export type Analyzed = {
  exports: Export[];
  imports: Import[];
  dynamicImports: DynamicImport[];
  workerImports: WorkerImport[];
  pure: boolean;
};

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
};

export type ParsedModule = {
  raw: string;
  ast: Program;
  filepath: string;
  imports: Import[];
  exports: Export[];
  hasSideEffect: boolean;
};

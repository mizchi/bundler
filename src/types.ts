import type { Program } from "@babel/types";

export type BundleOptions = {
  format?: "es" | "js";
  exposeImport?: boolean;
  preserveExternalImport?: boolean;
};

export type InternalOptions = {
  preserveExport: boolean;
  preserveExternalImport: boolean;
  exposeImport: boolean;
};

export type Import = {
  filepath: string;
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
};

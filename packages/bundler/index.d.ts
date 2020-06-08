export class Bundler {
  constructor(files: { [key: string]: string }, importMap?: any);
  updateModule(filepath: string, content: string): Promise<void>;
  bundle(
    entry: string,
    options?: { optimize?: boolean; exposeToGlobal?: string | null }
  ): Promise<string>;
  bundleChunks(
    entry: string,
    options?: {
      optimize?: boolean;
      exposeToGlobal?: string | null;
      publicPath?: string;
    }
  ): Promise<
    Array<
      | { type: "entry"; entry: string; builtCode: string }
      | { type: "chunk"; chunkName: string; builtCode: string }
    >
  >;
}

export async function bundle(
  files: { [k: string]: string },
  entry: string,
  options?: { optimize?: boolean; exposeToGlobal?: string | null }
): Promise<string>;

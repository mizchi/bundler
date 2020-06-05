export class Bundler {
  constructor(files: { [key: string]: string });
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
      pubicPath?: boolean;
    }
  ): Promise<
    Array<
      | { type: "entry"; builtCode: string }
      | { type: "chunk"; chunkName: string; builtCode: string }
    >
  >;
}

import type { IPromisesAPI } from "memfs/lib/promises";
import path from "path";
import { analyzeModule } from "./analyzer";
import { createMemoryFs, readFile } from "./memfsHelpers";
import { parse } from "./parser";
import { isPure } from "./sideEffect";
import type { BundleOptions, AnalyzedChunk } from "./types";
import { aggregateChunks } from "./aggregateChunks";
import { optimize } from "./optimizer";
import { render } from "./renderer";

export class Bundler {
  private modulesMap = new Map<string, AnalyzedChunk>();
  public fs: IPromisesAPI;

  constructor(public files: { [k: string]: string }) {
    this.fs = createMemoryFs(files);
  }
  public async bundle(
    entry: string,
    { exposeToGlobal = null }: BundleOptions = {}
  ) {
    await this.addModule(entry);
    const chunks = aggregateChunks(this.modulesMap, entry);
    const optimizedChunks = optimize(chunks);
    return render(entry, optimizedChunks, { exposeToGlobal: exposeToGlobal });
  }

  public async updateModule(filepath: string, nextContent: string) {
    await this.fs.writeFile(filepath, nextContent);
    this.modulesMap.delete(filepath);
    this.addModule(filepath);
  }

  // TODO: need this?
  async deleteRecursive(filepath: string) {
    const cached = this.modulesMap.get(filepath)!;
    if (cached) {
      for (const i of cached.imports) {
        this.deleteRecursive(i.filepath);
        this.modulesMap.delete(i.filepath);
      }
    }
  }

  private async addModule(filepath: string): Promise<void> {
    if (this.modulesMap.has(filepath)) {
      return;
    }

    const basepath = path.dirname(filepath);
    const raw = await readFile(this.fs, filepath);
    const ast = parse(raw, filepath);

    // extract before transform
    const { imports, exports } = analyzeModule(ast, basepath);
    const hasSideEffect = !isPure(ast);

    this.modulesMap.set(filepath, {
      raw,
      filepath,
      ast,
      imports,
      exports,
      hasSideEffect,
    });

    // console.log("used", filepath, JSON.stringify(imports, null, 2));
    for (const i of imports) {
      await this.addModule(i.filepath);
    }
  }
}

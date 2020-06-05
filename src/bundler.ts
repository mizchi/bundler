import type { IPromisesAPI } from "memfs/lib/promises";
import { Volume } from "memfs";
import createFs from "memfs/lib/promises";

import path from "path";
import { analyzeModule } from "./analyzer";
import { parse } from "./parser";
import type { BundleOptions, AnalyzedChunk } from "./types";
import { ModulesMap } from "./types";
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
    { exposeToGlobal = null, optimize: _optimize = true }: BundleOptions = {}
  ) {
    await this.addModule(entry);
    const chunks = aggregateChunks(this.modulesMap, entry);
    const optimizedChunks = _optimize ? optimize(chunks) : chunks;
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

    const { imports, exports, pure } = analyzeModule(ast, basepath);

    this.modulesMap.set(filepath, {
      raw,
      filepath,
      ast,
      imports,
      exports,
      pure,
    });

    // console.log("used", filepath, JSON.stringify(imports, null, 2));
    for (const i of imports) {
      await this.addModule(i.filepath);
    }
  }
}

export function aggregateChunks(modulesMap: ModulesMap, entryPath: string) {
  const entryMod = modulesMap.get(entryPath)!;
  const chunks: AnalyzedChunk[] = [];
  _aggregate(entryMod);
  return chunks;

  function _aggregate(mod: AnalyzedChunk) {
    if (chunks.find((x) => x.filepath === mod.filepath)) {
      return chunks;
    }

    for (const imp of mod.imports) {
      if (chunks.find((x) => x.filepath === imp.filepath)) {
        continue;
      }
      const child = modulesMap.get(imp.filepath)!;
      _aggregate(child);
    }
    chunks.push(mod);
    return chunks;
  }
}

// helper
export function createMemoryFs(files: { [k: string]: string }): IPromisesAPI {
  const vol = Volume.fromJSON(files, "/");
  return createFs(vol) as IPromisesAPI;
}

export async function readFile(fs: IPromisesAPI, filepath: string) {
  const raw = (await fs.readFile(filepath, {
    encoding: "utf-8",
  })) as string;
  return raw;
}

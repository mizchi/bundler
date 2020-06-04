import { Volume } from "memfs";
import createFs from "memfs/lib/promises";
import type { IPromisesAPI } from "memfs/lib/promises";

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

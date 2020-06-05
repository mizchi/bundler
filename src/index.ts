import { Bundler } from "./bundler";

export function bundle(
  files: { [k: string]: string },
  entry: string,
  options: { optimize?: boolean; exposeToGlobal?: string | null } = {}
) {
  const bundler = new Bundler(files);
  return bundler.bundle(entry, options);
}

export { Bundler };

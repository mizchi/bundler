export { Bundler } from "./bundler";

import { Bundler } from "./bundler";

export function bundle(files: { [k: string]: string }) {
  const bundler = new Bundler(files);
  return bundler.bundle("/index.js");
}

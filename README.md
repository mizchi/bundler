# @mizchi/bundler

My hobby bundler like webpack/rollup. Do not use production.

## Features

- Run universal
- Modern JS(ES2019) Target
- only handle ESM
- readable output(but loose)
- treeshake

## Example

```ts
import { Bundler } from "@mizchi/bundler";
import { format } from "prettier"; // install yourself
const fileMap = {
  "/foo.js": "export default 1;",
  "/index.js": `import foo from "./foo.js"; console.log(foo); export const index = 1;`,
};
const bundler = new Bundler(fileMap);
(async () => {
  const code = await bundler.bundle("/index.js", { optimize: true });
  console.log(format(code, { parser: "babel" }));
})();
```

output

```ts
// @mizchi/bundler generate
const _$_exported = {};
const _$_import = (id) =>
  _$_exported[id] || _$_modules[id]((_$_exported[id] = {}));
const _$_modules = {
  "/foo.js": (_$_exports) => {
    _$_exports.default = 1;
    return _$_exports;
  },
};
// -- entry --

const { default: foo } = _$_import("/foo.js");

console.log(foo);
export const index = 1;
```

Entry exports are left.

## Example: chunks

WIP

## Example: Worker

WIP

## TODO

- [x] Delete build cache and rebuild
- [x] `import "./xxx";`
- [x] `export const a = 1;`
- [x] Tree shaking
  - [x] Detect side effects
  - [x] Strip unused import
  - [x] Remove modules code by treeshake
  - [x] Remove unused exports
- [x] Dynamic import chunks: `bundler.bundleChunks(entry)`
- [x] publicPath
- [x] Bundle for worker
- [x] `export { a }`
- [x] `export { a } from "./b"`
- [x] `export { a as x} from "./b"`
- [x] Entry: `export {...}`;
- [x] Module: `export * as x from ...`
- [ ] Entry: `export {...} from ...`

## Dynamic library features

- [x] Skip import and export those are not relative
- [x] Support import-map
- [x] Use with snowpack
- [ ] name resolver on `preservedExternalImports` and `Worker`
- [ ] Rewrite to pikacdn options
- [ ] File watcher with node
- [ ] Support tsx
- [ ] Node fs/promises

## Icebox

- [ ] Inline Worker
- [ ] minilink integration
- [ ] compile to single html

## LICENSE

MIT

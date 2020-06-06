// @mizchi/bundler generate
const _$_exported = {};
const _$_import = (id) => _$_exported[id] || _$_modules[id](_$_exported[id] = {});
const _$_modules = {};

;

// -- entry --

console.log("started");
const worker = new Worker("/out/_$_foo.js", {
  type: "module"
});
worker.postMessage({
  hello: 1
});;


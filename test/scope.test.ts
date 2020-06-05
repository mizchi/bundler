// import { parse } from "../src/parser";
import { parse } from "@babel/parser";
import { getGlobalsWithoutImports } from "../src/analyzer";
import assert from "assert";

test("getRefs", () => {
  const parsed = parse(`a = 1;`, { sourceType: "module" });
  const keys = getGlobalsWithoutImports(parsed);
  assert.deepEqual(keys, ["a"]);
});

test("eval", () => {
  const parsed = parse(`x = (a) => {b};`, {
    sourceType: "module",
  });
  const keys = getGlobalsWithoutImports(parsed);
  assert.deepEqual(keys, ["x", "b"]);
});

import assert from "assert";

import { parse } from "../src/parser";
import { isPureProgram } from "../src/analyzer";

const pureCode = `
import "./foo.js";
function b() {};
class X {};
export function a() {};
export class C {};

// variable
const v1 = 1;
const v2 = () => {};
const v3 = function() {}
const v4 = function x() {}
const v5 = class {};
const v6 = "xxx";
const v7 = true;
const v8 = [];
const v9 = [1, () => {}, class {}, "xxx", true];
const v10 = [[]];
const v11 = v8;
const v12 = {}
const v13 = {a: 1}
const v14 = {["xxx"]: 1}
const v15 = {...{}};
`;

test("ok", () => {
  const ast = parse(pureCode, "/x.js");
  const pure = isPureProgram(ast);

  assert.ok(pure);
});

const onlyExport = `
export const a = 1;
export const b = 2;
`;
test("only export", () => {
  const ast = parse(onlyExport, "/x.js");
  const pure = isPureProgram(ast);
  assert.ok(pure);
});

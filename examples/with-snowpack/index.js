import { h } from "preact";
import render from "preact-render-to-string";
console.log(render(h("div", {}, "hello")));

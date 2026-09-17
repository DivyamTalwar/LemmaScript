import { test } from "node:test";
import assert from "node:assert/strict";

import { parseFileOptions } from "../src/config.ts";

test("parses a genuine leading option comment", () => {
  assert.deepEqual(
    parseFileOptions("//@ option safe-slice true\nconst value = 1;\n", "example.ts"),
    { "safe-slice": true },
  );
});

test("ignores directive-looking text in a template literal", () => {
  const source = "const help = `\n//@ option safe-slice true\n`;\n";
  assert.deepEqual(parseFileOptions(source, "example.ts"), {});
});

test("ignores directive-looking text in quoted strings and substitutions", () => {
  const source = [
    "const quoted = \"//@ option safe-slice true\";",
    "const templated = `value ${1}\n//@ safe-slice\n`;",
    "",
  ].join("\n");
  assert.deepEqual(parseFileOptions(source, "example.ts"), {});
});

test("does not mistake an escaped template backtick for the end of a literal", () => {
  const source = "const help = `before \\` after\n//@ option safe-slice true\n`;\n";
  assert.deepEqual(parseFileOptions(source, "example.ts"), {});
});

test("keeps actual block-comment directives compatible", () => {
  const source = "/*\n//@ option safe-slice true\n*/\nconst value = 1;\n";
  assert.deepEqual(parseFileOptions(source, "example.ts"), { "safe-slice": true });
});

test("still rejects a genuine directive after the first source statement", () => {
  const source = "const value = 1;\n//@ option safe-slice true\n";
  assert.throws(
    () => parseFileOptions(source, "example.ts"),
    /example\.ts:2: \/\/@ option directives must appear before the first source statement/,
  );
});

test("accepts a directive after a BOM and preserves CRLF input", () => {
  const source = "\uFEFF//@ option safe-slice true\r\nconst value = 1;\r\n";
  assert.deepEqual(parseFileOptions(source, "example.ts"), { "safe-slice": true });
});

test("only actual comments activate the legacy alias", () => {
  const source = "//@ safe-slice\nconst value = 1;\n";
  assert.deepEqual(parseFileOptions(source, "example.ts"), { "safe-slice": true });
});

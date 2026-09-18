import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, withCliFixture } from "./cli-test-helpers.js";

for (const command of ["gen", "gen-check", "check", "regen", "extract", "info", "config"]) {
  test(`${command} rejects extra source paths before processing the first`, () => withCliFixture(dir => {
    const result = runCli(dir, [command, "src/a.ts", "src/b.ts"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unexpected extra arguments/);
    assert.match(result.stderr, /src\/b\.ts/);
    for (const name of ["a.dfy.gen", "a.dfy", "a.ts.json", "b.dfy.gen", "b.dfy", "b.ts.json"]) {
      assert.equal(existsSync(join(dir, "src", name)), false);
    }
  }));
}
test("version rejects arguments but the bare command still prints semver", () => withCliFixture(dir => {
  const invalid = runCli(dir, ["version", "ignored"]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /does not accept arguments/);
  const valid = runCli(dir, ["version"]);
  assert.equal(valid.status, 0);
  assert.match(valid.stdout.trim(), /^\d+\.\d+\.\d+/);
}));
test("single-file generation and manifest batches still work", () => withCliFixture(dir => {
  assert.equal(runCli(dir, ["gen", "src/a.ts"]).status, 0);
  assert.equal(existsSync(join(dir, "src/a.dfy.gen")), true);
  writeFileSync(join(dir, "LemmaScript-files.txt"), "src/a.ts\nsrc/b.ts\n");
  assert.equal(runCli(dir, ["gen"]).status, 0);
  assert.equal(existsSync(join(dir, "src/b.dfy.gen")), true);
}));

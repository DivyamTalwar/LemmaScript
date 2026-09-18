import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, withCliFixture } from "./cli-test-helpers.js";

for (const flag of [
  "--backend=dafny=typo", "--backend=lean=", "--backend=",
  "--time-limit=10=typo", "--time-limit=10=", "--time-limit=0", "--time-limit=-1",
  "--time-limit=1.5", "--time-limit=1e3", "--time-limit=", "--time-limit= 10",
  "--time-limit=9007199254740993", `--time-limit=${"9".repeat(400)}`,
]) {
  test(`reject complete malformed value: ${flag.slice(0, 70)}`, () => withCliFixture(dir => {
    const result = runCli(dir, ["gen", "src/a.ts", flag]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown backend|Invalid --time-limit/);
    assert.equal(existsSync(join(dir, "src/a.dfy.gen")), false);
  }));
}
for (const seconds of ["1", "15", "9007199254740991"]) {
  test(`accept exactly representable positive timeout ${seconds}`, () => withCliFixture(dir => {
    const result = runCli(dir, ["config", "src/a.ts", "--backend=dafny", `--time-limit=${seconds}`]);
    assert.equal(result.status, 0, result.stderr);
  }));
}
test("config paths and opaque flags can still contain equals signs", () => withCliFixture(dir => {
  const config = join(dir, "config=custom.json");
  writeFileSync(config, JSON.stringify({ "safe-slice": true }));
  const result = runCli(dir, ["config", "src/a.ts", `--config=${config}`, "--extra-flags=--key=value=tail"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).options["safe-slice"], true);
}));

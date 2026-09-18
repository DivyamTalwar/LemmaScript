import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { runCli, withCliFixture } from "./cli-test-helpers.js";

// Exercise the real CLI with an argv-recording fake verifier, not a proof run.
function batch(manifest: string, args: string[], check: (calls: string[][], out: string, status: number | null, dir: string) => void, fail = false): void {
  withCliFixture(dir => {
    writeFileSync(join(dir, "LemmaScript-files.txt"), manifest);
    const bin = join(dir, "bin"), log = join(dir, "verifier.jsonl");
    mkdirSync(bin);
    const verifier = join(bin, "dafny");
    writeFileSync(verifier, `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.VERIFY_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
process.exit(process.env.VERIFY_FAIL === "1" ? 1 : 0);
`);
    chmodSync(verifier, 0o755);
    const result = runCli(dir, args, {
      ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      VERIFY_LOG: log, VERIFY_FAIL: fail ? "1" : "0",
    });
    const calls: string[][] = existsSync(log)
      ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
    check(calls, result.stdout, result.status, dir);
  });
}
const posix = { skip: process.platform === "win32" };
const manifest = "src/a.ts 20 --manifest\nsrc/b.ts\n";
test("manifest defaults remain unchanged", posix, () => batch(manifest, ["check"], (calls, _out, status, dir) => {
  assert.equal(status, 0);
  assert.deepEqual(calls, [["verify", "--verification-time-limit", "20", "--manifest", join(dir, "src/a.dfy")], ["verify", join(dir, "src/b.dfy")]]);
}));
test("explicit timeout and flags override every entry", posix, () => batch(manifest, ["check", "--time-limit=9", "--extra-flags=--cli=value --second"], (calls, _out, status, dir) => {
  assert.equal(status, 0);
  assert.deepEqual(calls, ["a", "b"].map(name => ["verify", "--verification-time-limit", "9", "--cli=value", "--second", join(dir, `src/${name}.dfy`)]));
}));
for (const [args, expected] of [
  [["--time-limit=9"], ["--verification-time-limit", "9", "--manifest"]],
  [["--extra-flags=--cli=value"], ["--verification-time-limit", "20", "--cli=value"]],
  [["--extra-flags="], ["--verification-time-limit", "20"]],
] as const) {
  test(`independent override: ${args[0]}`, posix, () => batch("src/a.ts 20 --manifest\n", ["check", ...args], (calls, _out, status, dir) => {
    assert.equal(status, 0);
    assert.deepEqual(calls, [["verify", ...expected, join(dir, "src/a.dfy")]]);
  }));
}
test("lower override makes slow entry eligible for verification", posix, () => batch("src/a.ts 300\n", ["check", "--time-limit=10"], (calls, _out, status, dir) => {
  assert.equal(status, 0);
  assert.deepEqual(calls, [["verify", "--verification-time-limit", "10", join(dir, "src/a.dfy")]]);
}));
test("higher effective timeout requires --slow", posix, () => {
  batch("src/a.ts 10\n", ["check", "--time-limit=120"], (calls, out, status) => {
    assert.equal(status, 0); assert.deepEqual(calls, []); assert.match(out, /timeout 120s > 60s, gen-check only/);
  });
  batch("src/a.ts 10\n", ["check", "--time-limit=120", "--slow"], (calls, _out, status, dir) => {
    assert.equal(status, 0); assert.deepEqual(calls, [["verify", "--verification-time-limit", "120", join(dir, "src/a.dfy")]]);
  });
});
test("60-second boundary uses effective timeout", posix, () => {
  for (const seconds of [60, 61]) batch("src/a.ts 10\n", ["check", `--time-limit=${seconds}`], (calls, _out, status) => {
    assert.equal(status, 0); assert.equal(calls.length, seconds === 60 ? 1 : 0);
  });
});
test("verifier failure stops before second entry", posix, () => batch(manifest, ["check", "--time-limit=9"], (calls, _out, status) => {
  assert.equal(status, 1); assert.equal(calls.length, 1);
}, true));
for (const args of [["check", "--time-limit=0"], ["check", "--time-limit=1", "--time-limit=2"], ["check", "--extra-flags=x", "--extra-flags=y"], ["regen"]]) {
  test(`invalid batch invocation: ${args.join(" ")}`, posix, () => batch(manifest, args, (calls, _out, status) => {
    assert.equal(status, 1); assert.deepEqual(calls, []);
  }));
}

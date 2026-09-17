import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { dafnyRegen } from "../src/dafny-commands.ts";

class ExitSignal extends Error {
  constructor(readonly code: number | undefined) {
    super(`process.exit(${code ?? ""})`);
  }
}

test("anchors a cleanly merged but unverified generation", () => {
  const dir = mkdtempSync(join(tmpdir(), "lemmascript-regen-"));
  const bin = join(dir, "bin");
  const genPath = join(dir, "example.dfy.gen");
  const proofPath = join(dir, "example.dfy");
  const basePath = join(dir, "example.dfy.base");
  const fakeDafny = join(bin, "dafny");
  const oldGen = "method M() {\n  var value := 0;\n}\n";
  const newGen = "method M() {\n  var value := 1;\n}\n";
  const proof = `${oldGen}\nlemma AddedProof() {}\n`;
  const originalExit = process.exit;
  const originalPath = process.env.PATH;

  try {
    writeFileSync(genPath, oldGen);
    writeFileSync(proofPath, proof);
    mkdirSync(bin);
    writeFileSync(fakeDafny, "#!/bin/sh\nexit 1\n");
    chmodSync(fakeDafny, 0o755);
    process.env.PATH = `${bin}${delimiter}${originalPath ?? ""}`;
    process.exit = ((code?: number) => { throw new ExitSignal(code); }) as typeof process.exit;

    assert.throws(
      () => dafnyRegen(genPath, proofPath, basePath, newGen, dir),
      (error) => error instanceof ExitSignal && error.code === 1,
    );

    assert.equal(readFileSync(basePath, "utf-8"), newGen);
    const mergedProof = readFileSync(proofPath, "utf-8");
    assert.match(mergedProof, /var value := 1/);
    assert.match(mergedProof, /lemma AddedProof/);
  } finally {
    process.exit = originalExit;
    process.env.PATH = originalPath;
    rmSync(dir, { recursive: true, force: true });
  }
});

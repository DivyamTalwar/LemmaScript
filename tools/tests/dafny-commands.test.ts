import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dafnyCheckDiff } from "../src/dafny-commands.ts";

function withFiles(gen: string, proof: string, check: (genPath: string, proofPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "lemmascript-diff-"));
  const genPath = join(dir, "example.dfy.gen");
  const proofPath = join(dir, "example.dfy");
  try {
    writeFileSync(genPath, gen);
    writeFileSync(proofPath, proof);
    check(genPath, proofPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("accepts identical generated and proof files", () => {
  withFiles("method M() {}\n", "method M() {}\n", (genPath, proofPath) => {
    assert.equal(dafnyCheckDiff(genPath, proofPath), true);
  });
});

test("accepts proof additions without changing generated lines", () => {
  withFiles(
    "method M() {}\n",
    "method M() {}\n\nlemma Proof() {}\n",
    (genPath, proofPath) => {
      assert.equal(dafnyCheckDiff(genPath, proofPath), true);
    },
  );
});

test("rejects deleted or modified generated lines", () => {
  withFiles("method M() {}\n", "method Changed() {}\n", (genPath, proofPath) => {
    assert.equal(dafnyCheckDiff(genPath, proofPath), false);
  });
});

test("fails closed when either comparison input is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "lemmascript-diff-missing-"));
  const genPath = join(dir, "example.dfy.gen");
  const proofPath = join(dir, "example.dfy");
  try {
    writeFileSync(genPath, "method M() {}\n");
    assert.equal(dafnyCheckDiff(genPath, proofPath), false);
    assert.equal(dafnyCheckDiff(join(dir, "missing.dfy.gen"), genPath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

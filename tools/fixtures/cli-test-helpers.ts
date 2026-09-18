import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const lsc = fileURLToPath(new URL("../src/lsc.ts", import.meta.url));

export function withCliFixture(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "lemmascript-cli-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "lemmascript.json"), "{}\n");
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
      compilerOptions: { strict: true, target: "ESNext" },
    }));
    for (const file of ["a.ts", "b.ts"]) {
      writeFileSync(join(dir, "src", file), "export function identity(x: number): number { return x; }\n");
    }
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function runCli(dir: string, args: string[], env: NodeJS.ProcessEnv = process.env): SpawnSyncReturns<string> {
  const result = spawnSync(process.execPath, [tsxCli, lsc, ...args], {
    cwd: dir, env, encoding: "utf8", timeout: 30_000,
  });
  if (result.error) throw result.error;
  return result;
}

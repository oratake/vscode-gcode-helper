import * as esbuild from "esbuild";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

const common = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node16",
  external: ["vscode"],
  sourcemap: true,
  minify: production,
  logLevel: "info",
};

// 再帰的に .ts テストファイルを収集（依存なしの mini-glob）
function collect(dir, out) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (entry.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

const testEntries = collect("test", []);

const extConfig = { ...common, entryPoints: ["src/extension.ts"], outfile: "dist/extension.js" };
const testConfig = testEntries.length
  ? { ...common, entryPoints: testEntries, outdir: "dist/test" }
  : undefined;

async function main() {
  if (watch) {
    // watch モードでは context を存続させる（意図的にプロセスを保持）
    await (await esbuild.context(extConfig)).watch();
    if (testConfig) await (await esbuild.context(testConfig)).watch();
    return;
  }
  // ワンショット: build() はサービスを閉じるのでプロセスが正常終了する
  await esbuild.build(extConfig);
  if (testConfig) await esbuild.build(testConfig);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
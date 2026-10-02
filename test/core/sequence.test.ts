import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSequences, parseNCode, extractComment } from "../../src/core/sequence";

test("parseNCode: 行頭の N コードを検出", () => {
  assert.equal(parseNCode("N10 G00 X100")?.n, "10");
  assert.equal(parseNCode("  N5 M30")?.n, "5");
  assert.equal(parseNCode("G01 X100"), null); // 行頭でない N は対象外
  assert.equal(parseNCode("XYZ"), null);
  assert.equal(parseNCode(""), null);
});

test("extractComment: ブロック / 行末コメント", () => {
  assert.equal(extractComment("N10 (ENDMILL T2 H2) G00 X100"), "ENDMILL T2 H2");
  assert.equal(extractComment("N20 G01 Z0 ; slow"), "slow");
  assert.equal(extractComment("N30 G00 X100"), "");
});

test("extractSequences: ブロック境界（次の N 行の手前まで）", () => {
  const lines = ["N10 G00 X100", "X200", "N20 G01 Z0"];
  const seqs = extractSequences(lines, { showAllConsecutiveComments: false });
  assert.equal(seqs.length, 2);
  assert.equal(seqs[0].startLine, 0);
  assert.equal(seqs[0].endLine, 1);
  assert.equal(seqs[0].lineCount, 2);
  assert.equal(seqs[1].startLine, 2);
  assert.equal(seqs[1].endLine, 2);
});

test("extractSequences: N 前のコメント行はどのブロックにも属さない", () => {
  const lines = ["; setup", "N10 G00 X100", "N20 G01 Z0"];
  const seqs = extractSequences(lines, { showAllConsecutiveComments: false });
  assert.equal(seqs.length, 2);
  assert.equal(seqs[0].startLine, 1); // N10 の行
});

test("コメントまとめ: on/off で displayLineCount が変わる", () => {
  const lines = ["N10 G00 X100", "; c1", "; c2", "X999", "N20 G01"];
  const all = extractSequences(lines, { showAllConsecutiveComments: true });
  const consolidated = extractSequences(lines, { showAllConsecutiveComments: false });
  // N 行 + ; c1 + ; c2 + X999 = 物理 4 行
  assert.equal(all[0].lineCount, 4);
  assert.equal(all[0].displayLineCount, 4); // 全て表示
  // N 行 + (c1,c2 を 1 行にまとめる) + X999 = 3 行
  assert.equal(consolidated[0].displayLineCount, 3);
});

test("大ファイル（5 万行）でも軽量に抽出できる", () => {
  const lines: string[] = [];
  for (let i = 0; i < 50000; i++) lines.push(`N${i} G00 X${i}`);
  const t0 = Date.now();
  const seqs = extractSequences(lines, { showAllConsecutiveComments: false });
  const dt = Date.now() - t0;
  assert.equal(seqs.length, 50000);
  assert.equal(seqs[0].n, "0");
  assert.equal(seqs[49999].n, "49999");
  console.log(`  [perf] 50k 行抽出: ${dt}ms`);
});

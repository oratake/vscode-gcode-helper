import { test } from "node:test";
import * as assert from "node:assert/strict";
import { parseZValue, findMinZ } from "../../src/core/zscan";

test("parseZValue: 小数点付きは mm（そのまま）", () => {
  assert.equal(parseZValue("G01 Z-29.000"), -29);
  assert.equal(parseZValue("G01Z-29."), -29);
  assert.equal(parseZValue("G01 Z+1.5"), 1.5);
  assert.equal(parseZValue("G0 Z5.000"), 5);
});

test("parseZValue: 点無しの整数は μm（÷1000）", () => {
  assert.equal(parseZValue("Z-7"), -7 / 1000);
  assert.equal(parseZValue("Z5"), 5 / 1000);
  assert.equal(parseZValue("Z-123"), -123 / 1000);
  assert.equal(parseZValue("G0 Z0"), 0);
});

test("parseZValue: Z が無ければ null", () => {
  assert.equal(parseZValue("G01 X10 Y20"), null);
  assert.equal(parseZValue(""), null);
});

test("parseZValue: コメント内（; と (...)）の Z は除外", () => {
  assert.equal(parseZValue("X0 ;Z5"), null);
  assert.equal(parseZValue("X0 (Z9)"), null);
});

test("parseZValue: XYZ 接頭語は除外・X1Y2Z3 は Z を抽出（μm）", () => {
  assert.equal(parseZValue("XYZ10"), null);
  assert.equal(parseZValue("X1Y2Z3"), 3 / 1000);
});

test("findMinZ: mm と μm を正しく比較（Z-6. と Z-7）", () => {
  // Z-6. = -6.000mm / Z-7 = -0.007mm → 最低は Z-6.（line 0）
  const r = findMinZ(["G00 Z-6.", "G01 Z-7"], 0, 1);
  assert.equal(r?.value, -6);
  assert.equal(r?.raw, "Z-6.");
  assert.equal(r?.line, 0);
});

test("findMinZ: ブロック全体の最低 Z と原文", () => {
  const lines = ["G00Z5.", "G01 Z-29.000", "G01 Z-10.", "G00Z5."];
  const r = findMinZ(lines, 0, 3);
  assert.equal(r?.value, -29);
  assert.equal(r?.raw, "Z-29.000");
  assert.equal(r?.line, 1);
});

test("findMinZ: 範囲外の Z は数えない", () => {
  const lines = ["G00Z5.", "G01 Z-99.000", "G01 Z-10."];
  const r = findMinZ(lines, 0, 0);
  assert.equal(r?.value, 5);
});

test("findMinZ: Z が無ければ null", () => {
  assert.equal(findMinZ(["G01 X10", "G01 Y20"], 0, 1), null);
});

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { parseZValue, findMinZ } from "../../src/core/zscan";

test("parseZValue: 通常の Z 値", () => {
  assert.equal(parseZValue("G01 Z-29.000"), -29);
  assert.equal(parseZValue("G0 Z0"), 0);
  assert.equal(parseZValue("G01Z-29."), -29);
  assert.equal(parseZValue("G01 Z+1.5"), 1.5);
});

test("parseZValue: Z が無ければ null", () => {
  assert.equal(parseZValue("G01 X10 Y20"), null);
  assert.equal(parseZValue(""), null);
});

test("parseZValue: コメント内（; と (...)）の Z は除外", () => {
  assert.equal(parseZValue("X0 ;Z5"), null);
  assert.equal(parseZValue("X0 (Z9)"), null);
});

test("parseZValue: XYZ 接頭語は除外・X1Y2Z3 は Z を抽出", () => {
  assert.equal(parseZValue("XYZ10"), null);
  assert.equal(parseZValue("X1Y2Z3"), 3);
});

test("findMinZ: ブロック全体の最低 Z と行", () => {
  const lines = ["G00Z5", "G01 Z-29.000", "G01 Z-10", "G00Z5"];
  const r = findMinZ(lines, 0, 3);
  assert.equal(r?.value, -29);
  assert.equal(r?.line, 1);
});

test("findMinZ: 範囲外の Z は数えない", () => {
  const lines = ["G00Z5", "G01 Z-99", "G01 Z-10"];
  const r = findMinZ(lines, 0, 0);
  assert.equal(r?.value, 5);
});

test("findMinZ: Z が無ければ null", () => {
  assert.equal(findMinZ(["G01 X10", "G01 Y20"], 0, 1), null);
});

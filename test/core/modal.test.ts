import test from "node:test";
import assert from "node:assert/strict";
import {
  MACHINES,
  computeModalSegments,
  stateAtLine,
  emptyState,
} from "../../src/core/modal";

const fanuc = MACHINES.fanuc;

test("recognize: 基本運動 + S/F/M", () => {
  const u = fanuc.recognize("N10 G01 X100 Y200 F150 S1000 M8");
  assert.deepEqual(u, { motion: "G01", f: "150", s: "1000", coolant: "M8" });
});

test("recognize: 単位・絶対/相対", () => {
  const u = fanuc.recognize("G21 G90");
  assert.deepEqual(u, { units: "G21", distance: "G90" });
});

test("recognize: 工具長 G43.1", () => {
  const u = fanuc.recognize("G43.1 H5 Z5.");
  assert.equal(u?.toolLength, "G43.1");
});

test("recognize: コメント内・空行はスルー", () => {
  assert.equal(fanuc.recognize("(G01 G90)"), null);
  assert.equal(fanuc.recognize("   "), null);
});

test("computeSegments: 連続する同一状態を 1 セグメントにまとめる", () => {
  const segs = computeModalSegments(["G01", "X100", "X200", "G00", "X300"], fanuc);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].startLine, 0);
  assert.equal(segs[0].endLine, 2);
  assert.equal(segs[0].state.motion, "G01");
  assert.equal(segs[1].startLine, 3);
  assert.equal(segs[1].endLine, 4);
  assert.equal(segs[1].state.motion, "G00");
});

test("computeSegments: モーダルは後続行に保持される", () => {
  const segs = computeModalSegments(["G01 G90", "S1000"], fanuc);
  assert.equal(segs.length, 2);
  assert.equal(segs[1].state.motion, "G01");
  assert.equal(segs[1].state.distance, "G90");
  assert.equal(segs[1].state.s, "1000");
});

test("stateAtLine: 行を覆うセグメントの状態を返す", () => {
  const segs = computeModalSegments(["G01", "X100", "X200", "G00", "X300"], fanuc);
  assert.equal(stateAtLine(segs, 2)?.motion, "G01");
  assert.equal(stateAtLine(segs, 3)?.motion, "G00");
  assert.equal(stateAtLine(segs, 4)?.motion, "G00");
  assert.equal(stateAtLine([], 0), null);
});

test("初期状態は全グループ null", () => {
  const s = emptyState();
  assert.equal(s.motion, null);
  assert.equal(s.coolant, null);
});
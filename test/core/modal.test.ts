import test from "node:test";
import assert from "node:assert/strict";
import {
  MACHINES,
  computeModalSegments,
  stateAtLine,
  emptyState,
  displayValue,
} from "../../src/core/modal";

const fanuc = MACHINES.fanuc;
const okuma = MACHINES.okuma;

// --- 既存テスト ---

test("recognize: 基本運動 + S/F/M", () => {
  const u = fanuc.recognize("N10 G01 X100 Y200 F150 S1000 M8");
  assert.deepEqual(u, { motion: "G01", f: "150", s: "1000", coolant: "M8" });
});

test("recognize: 単位・絶対/相対", () => {
  const u = fanuc.recognize("G21 G90");
  assert.deepEqual(u, { units: "G21", distance: "G90" });
});

test("recognize: 工具長 G43.1 + H", () => {
  const u = fanuc.recognize("G43.1 H5 Z5.");
  assert.equal(u?.toolLength, "G43.1");
  assert.equal(u?.toolLengthH, "5");
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
  assert.equal(s.precision, null);
  assert.equal(s.toolLengthH, null);
  assert.equal(s.cutterCompD, null);
});

// --- 新機能テスト ---

test("recognize: ドット直前の F を認識する (G01Z0.F1000.)", () => {
  const u = fanuc.recognize("G01Z0.F1000.");
  assert.equal(u?.f, "1000");
  assert.equal(u?.motion, "G01");
});

test("recognize: M03 / M08（先頭にゼロ）を主軸/クーラントとして認識", () => {
  const u = fanuc.recognize("M03 M08");
  assert.equal(u?.spindle, "M3");
  assert.equal(u?.coolant, "M8");
});

test("recognize: G43 + H → 工具長補正 + H 番号", () => {
  const u = fanuc.recognize("G43Z50.H13");
  assert.equal(u?.toolLength, "G43");
  assert.equal(u?.toolLengthH, "13");
});

test("recognize: G41 + D → 工具径補正 + D 番号", () => {
  const u = fanuc.recognize("G41D21");
  assert.equal(u?.cutterComp, "G41");
  assert.equal(u?.cutterCompD, "21");
});

test("recognize: G49 → 工具長補正を取消", () => {
  const segs = computeModalSegments(["G43 H5", "G49", "G01"], fanuc);
  assert.equal(segs[1].state.toolLength, null);
  assert.equal(segs[1].state.toolLengthH, null);
});

test("recognize: G40 → 工具径補正 D を取消", () => {
  const segs = computeModalSegments(["G41 D21", "G40", "G01"], fanuc);
  assert.equal(segs[1].state.cutterCompD, null);
});

test("recognize: FANUC M660 → 工具長/主軸/クーラントを取消", () => {
  const segs = computeModalSegments(["G43 H5 M3 M8", "M660", "G01"], fanuc);
  const st = segs[1].state;
  assert.equal(st.toolLength, null);
  assert.equal(st.toolLengthH, null);
  assert.equal(st.spindle, null);
  assert.equal(st.coolant, null);
});

test("recognize: OKUMA M206 → 工具長補正を取消", () => {
  const segs = computeModalSegments(["G43 H5", "M206", "G01"], okuma);
  assert.equal(segs[1].state.toolLength, null);
  assert.equal(segs[1].state.toolLengthH, null);
});

test("recognize: 高精度制御 G8P1 / G5P10000 / G990Q3.", () => {
  assert.equal(fanuc.recognize("G8P1")?.precision, "G8 P1");
  assert.equal(fanuc.recognize("G5P10000")?.precision, "G5 P10000");
  assert.equal(fanuc.recognize("G990Q3.")?.precision, "G990 Q3.");
});

test("displayValue: toolLength + H → 'G43 H13'", () => {
  const st = emptyState();
  st.toolLength = "G43";
  st.toolLengthH = "13";
  assert.equal(displayValue(st, "toolLength"), "G43 H13");
});

test("displayValue: cutterComp + D → 'G41 D21'", () => {
  const st = emptyState();
  st.cutterComp = "G41";
  st.cutterCompD = "21";
  assert.equal(displayValue(st, "cutterComp"), "G41 D21");
});

test("displayValue: H のみ（G なし）→ 'H13'", () => {
  const st = emptyState();
  st.toolLengthH = "13";
  assert.equal(displayValue(st, "toolLength"), "H13");
});

test("displayValue: 通常キーはそのまま", () => {
  const st = emptyState();
  st.motion = "G01";
  assert.equal(displayValue(st, "motion"), "G01");
  assert.equal(displayValue(st, "f"), "");
});
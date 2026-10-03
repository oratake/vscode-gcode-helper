import test from "node:test";
import assert from "node:assert/strict";
import {
  MACHINES,
  computeModalSegments,
  stateAtLine,
  emptyState,
  displayValue,
  normCode,
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

// --- 正規化テスト ---

test("normCode: 先頭ゼロ除去", () => {
  assert.equal(normCode("03"), 3);
  assert.equal(normCode("08"), 8);
  assert.equal(normCode("00"), 0);
  assert.equal(normCode("43"), 43);
  assert.equal(normCode("43.1"), 43.1);
  assert.equal(normCode("990"), 990);
});

test("recognize: G08P1 / G05P10000（先頭ゼロ）→ 高精度制御", () => {
  assert.equal(fanuc.recognize("G08P1")?.precision, "G8 P1");
  assert.equal(fanuc.recognize("G05P10000")?.precision, "G5 P10000");
});

test("recognize: G1（1 桁）→ G01 に正規化", () => {
  const u = fanuc.recognize("G1 X100");
  assert.equal(u?.motion, "G01");
});

test("recognize: G001（3 桁）→ G01 に正規化", () => {
  const u = fanuc.recognize("G001 X100");
  assert.equal(u?.motion, "G01");
});

test("recognize: G2（1 桁）→ G02, G3 → G03", () => {
  assert.equal(fanuc.recognize("G2 X100 Y100")?.motion, "G02");
  assert.equal(fanuc.recognize("G3 X100 Y100 R5")?.motion, "G03");
});

test("recognize: M4 / M5（1 桁）→ 主軸", () => {
  assert.equal(fanuc.recognize("M4")?.spindle, "M4");
  assert.equal(fanuc.recognize("M5")?.spindle, "M5");
});

// --- OKUMA プロファイル ---

test("OKUMA: G56 + H → 工具長補正", () => {
  const u = okuma.recognize("G56 H5");
  assert.equal(u?.toolLength, "G56");
  assert.equal(u?.toolLengthH, "5");
});

test("OKUMA: G15 H1 → ワーク原点（G+H 複合）", () => {
  const u = okuma.recognize("G15 H1");
  assert.equal(u?.workOffset, "G15");
  assert.equal(u?.workOffsetH, "1");
});

test("OKUMA: G43 は無視（FANUC 専用）", () => {
  assert.equal(okuma.recognize("G43"), null);
});

test("OKUMA: G54-G59 は無視（FANUC ワーク原点）", () => {
  assert.equal(okuma.recognize("G54"), null);
  assert.equal(okuma.recognize("G55"), null);
  assert.equal(okuma.recognize("G57"), null);
});

test("OKUMA: G1 + G43 → G43 無視、G01 のみ", () => {
  const u = okuma.recognize("G1 X100 G43");
  assert.equal(u?.motion, "G01");
  assert.equal(u?.toolLength, undefined);
});

test("OKUMA: M206 → 工具長補正を取消", () => {
  const u = okuma.recognize("M206");
  assert.equal(u?.toolLength, null);
  assert.equal(u?.toolLengthH, null);
});

test("displayValue: OKUMA workOffset → 'G15 H1'", () => {
  const st = emptyState();
  st.workOffset = "G15";
  st.workOffsetH = "1";
  assert.equal(displayValue(st, "workOffset"), "G15 H1");
});

test("displayValue: FANUC workOffset → 'G54'（H なし）", () => {
  const st = emptyState();
  st.workOffset = "G54";
  assert.equal(displayValue(st, "workOffset"), "G54");
});

// --- 主軸工具 / 次工具（T / M06） ---

test("T のみ（M06 なし）→ 次工具設定、主軸工具不変", () => {
  const u = fanuc.recognize("T1");
  assert.equal(u?.nextTool, "T1");
  assert.equal(u?.spindleTool, undefined);
});

test("T + M06 同一行 → 主軸工具=T、次工具=null", () => {
  const u = fanuc.recognize("T29 M06");
  assert.equal(u?.spindleTool, "T29");
  assert.equal(u?.nextTool, null);
});

test("M06 のみ（T 先行行）→ nextTool=null（spindleTool は segments で解決）", () => {
  const u = fanuc.recognize("M06");
  assert.equal(u?.nextTool, null);
  assert.equal(u?.spindleTool, undefined);
});

test("computeSegments: T 先行 → M06 で主軸工具確定", () => {
  const segs = computeModalSegments(["T1", "G01 X100", "M06", "G01 X200"], fanuc);
  assert.equal(segs.length, 3);
  assert.equal(segs[0].state.nextTool, "T1");
  assert.equal(segs[0].state.spindleTool, null);
  assert.equal(segs[1].state.nextTool, "T1");
  assert.equal(segs[2].state.spindleTool, "T1");
  assert.equal(segs[2].state.nextTool, null);
  assert.equal(segs[2].endLine, 3);
});

test("computeSegments: T+M06 同一行 → 原子交換", () => {
  const segs = computeModalSegments(["T29 M06", "G01", "T1", "G01"], fanuc);
  assert.equal(segs[0].state.spindleTool, "T29");
  assert.equal(segs[0].state.nextTool, null);
  assert.equal(segs[2].state.nextTool, "T1");
  assert.equal(segs[2].state.spindleTool, "T29");
});

test("computeSegments: 連続 T 先行 → 最後の T が有効", () => {
  const segs = computeModalSegments(["T1", "T2", "M06"], fanuc);
  assert.equal(segs[1].state.nextTool, "T2");
  assert.equal(segs[2].state.spindleTool, "T2");
  assert.equal(segs[2].state.nextTool, null);
});

test("displayValue: spindleTool / nextTool はそのまま", () => {
  const st = emptyState();
  st.spindleTool = "T29";
  st.nextTool = "T1";
  assert.equal(displayValue(st, "spindleTool"), "T29");
  assert.equal(displayValue(st, "nextTool"), "T1");
  st.spindleTool = null;
  st.nextTool = null;
  assert.equal(displayValue(st, "spindleTool"), "");
  assert.equal(displayValue(st, "nextTool"), "");
});
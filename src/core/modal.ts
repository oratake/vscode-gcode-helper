// core/ は vscode import をしない（単体テスト可能な根拠）。
import { stripComment } from "./zscan";

/** カーソル位置で表示するモーダル状態。各グループは 認識済みコード（例 "G01"）または null。 */
export interface ModalState {
  /** 運動 G00/01/02/03 */
  motion: string | null;
  /** 平面 G17/18/19 */
  plane: string | null;
  /** 単位 G20/21 */
  units: string | null;
  /** 絶対/相対 G90/91 */
  distance: string | null;
  /** 工具径補償 G40/41/42 */
  cutterComp: string | null;
  /** 工具径補償 D（例 "21"） */
  cutterCompD: string | null;
  /** 工具長補償 G43/43.1/49 */
  toolLength: string | null;
  /** 工具長補償 H（例 "13"） */
  toolLengthH: string | null;
  /** ワーク原点 G54〜G59 */
  workOffset: string | null;
  /** 回転数 S（例 "1000"） */
  s: string | null;
  /** 送り速度 F（例 "150"） */
  f: string | null;
  /** 工具番号 T（例 "05"） */
  t: string | null;
  /** 主軸回転 M3/M4/M5 */
  spindle: string | null;
  /** クーラント M8/M9 */
  coolant: string | null;
  /** 高精度制御（例 "G8 P1"） */
  precision: string | null;
}

export type ModalGroup = keyof ModalState;

/** 表示するグループ（行ラベル・表示順）。 */
export const GROUPS: { key: ModalGroup; label: string }[] = [
  { key: "motion", label: "早送/切削" },
  { key: "plane", label: "平面" },
  { key: "units", label: "単位" },
  { key: "distance", label: "絶対/相対" },
  { key: "cutterComp", label: "工具径補正" },
  { key: "toolLength", label: "工具長補正" },
  { key: "workOffset", label: "ワーク原点" },
  { key: "s", label: "S 回転数" },
  { key: "f", label: "F 送り速度" },
  { key: "t", label: "T 工具番号" },
  { key: "spindle", label: "主軸回転" },
  { key: "coolant", label: "クーラント" },
  { key: "precision", label: "高精度制御" },
];

/** 状態比較に使う全キー（表示行 + 非表示補助フィールド）。 */
const STATE_KEYS: (keyof ModalState)[] = [
  "motion", "plane", "units", "distance",
  "cutterComp", "cutterCompD", "toolLength", "toolLengthH",
  "workOffset", "s", "f", "t", "spindle", "coolant", "precision",
];

/** 全グループ null の初期状態（何も認識される前の「空」）。デフォルト値は持たない。 */
export function emptyState(): ModalState {
  return {
    motion: null, plane: null, units: null, distance: null,
    cutterComp: null, cutterCompD: null,
    toolLength: null, toolLengthH: null,
    workOffset: null, s: null, f: null, t: null,
    spindle: null, coolant: null, precision: null,
  };
}

/** 状態が変化した地点で区切ったセグメント（同一状態の連続は 1 セグメントにまとめる）。 */
export interface ModalSegment {
  /** 0 起算・両端込み */
  startLine: number;
  endLine: number;
  state: ModalState;
}

/** 機械プロファイル: id / 表示名 / 行認識子 / 取消マクロテーブル。 */
export interface MachineProfile {
  id: string;
  label: string;
  recognize: (line: string) => Partial<ModalState> | null;
  /** M コード（正規化数値の文字列キー）→ 取消対象グループ。例: { "660": ["toolLength", "spindle"] } */
  cancels?: Record<string, ModalGroup[]>;
}

/** G/M コードの数字部分を正規化（先頭ゼロ除去）: "03" → 3, "08" → 8, "43.1" → 43.1 */
export function normCode(raw: string): number {
  return parseFloat(raw);
}

/** G コード dispatch: 正規化番号 → (グループ, 正規化表示値)。 */
const G_DISPATCH: Record<number, { g: ModalGroup; v: string }> = {
  0: { g: "motion", v: "G00" },
  1: { g: "motion", v: "G01" },
  2: { g: "motion", v: "G02" },
  3: { g: "motion", v: "G03" },
  17: { g: "plane", v: "G17" },
  18: { g: "plane", v: "G18" },
  19: { g: "plane", v: "G19" },
  20: { g: "units", v: "G20" },
  21: { g: "units", v: "G21" },
  41: { g: "cutterComp", v: "G41" },
  42: { g: "cutterComp", v: "G42" },
  43: { g: "toolLength", v: "G43" },
  54: { g: "workOffset", v: "G54" },
  55: { g: "workOffset", v: "G55" },
  56: { g: "workOffset", v: "G56" },
  57: { g: "workOffset", v: "G57" },
  58: { g: "workOffset", v: "G58" },
  59: { g: "workOffset", v: "G59" },
  90: { g: "distance", v: "G90" },
  91: { g: "distance", v: "G91" },
};

/** M コード dispatch: 正規化番号 → (グループ, 正規化表示値)。 */
const M_DISPATCH: Record<number, { g: ModalGroup; v: string }> = {
  3: { g: "spindle", v: "M3" },
  4: { g: "spindle", v: "M4" },
  5: { g: "spindle", v: "M5" },
  8: { g: "coolant", v: "M8" },
  9: { g: "coolant", v: "M9" },
};

// --- 取消マクロテーブル（正規化数値の文字列キー） ---
const FANUC_CANCELS: Record<string, ModalGroup[]> = {
  "660": ["toolLength", "toolLengthH", "spindle", "coolant"],
};
const OKUMA_CANCELS: Record<string, ModalGroup[]> = {
  "206": ["toolLength", "toolLengthH"],
};

// --- 共通認識子（FANUC / OKUMA で同一の G/M/S/F/T ルール、取消テーブルのみ差異） ---
const makeRecognize =
  (cancels: Record<string, ModalGroup[]> | undefined) =>
  (line: string): Partial<ModalState> | null => {
    const s = stripComment(line);
    if (!s.trim()) return null;
    const u: Partial<ModalState> = {};

    for (const mm of s.matchAll(/(?<![A-Za-z])G(\d+(?:\.\d+)?)(?!\d)/gi)) {
      const raw = mm[1];
      if (raw.includes(".")) {
        const n = normCode(raw);
        if (n >= 43 && n < 44) u.toolLength = `G${raw}`;
        continue;
      }
      const n = normCode(raw);
      if (n === 49) { u.toolLength = null; u.toolLengthH = null; continue; }
      if (n === 40) { u.cutterComp = "G40"; u.cutterCompD = null; continue; }
      const d = G_DISPATCH[n];
      if (d) u[d.g] = d.v;
    }

    const dm = s.match(/(?<![A-Za-z])D(\d+(?:\.\d+)?)(?!\d)/i);
    if (dm) u.cutterCompD = dm[1];
    const hm = s.match(/(?<![A-Za-z])H(\d+(?:\.\d+)?)(?!\d)/i);
    if (hm) u.toolLengthH = hm[1];

    const sm = s.match(/(?<![A-Za-z])S([+-]?\d+(?:\.\d+)?)/i);
    if (sm) u.s = sm[1];
    const fm = s.match(/(?<![A-Za-z])F([+-]?\d+(?:\.\d+)?)/i);
    if (fm) u.f = fm[1];
    const tm = s.match(/(?<![A-Za-z])T(\d+(?:\.\d+)?)/i);
    if (tm) u.t = tm[1];

    for (const mm of s.matchAll(/(?<![A-Za-z])M(\d{1,4})(?!\d)/gi)) {
      const code = normCode(mm[1]);
      const d = M_DISPATCH[code];
      if (d) u[d.g] = d.v;
      const cl = cancels?.[String(code)];
      if (cl) for (const g of cl) (u as Record<string, string | null>)[g] = null;
    }

    for (const mm of s.matchAll(/(?<![A-Za-z])G0?(8|5)P(\d+(?:\.\d*)?)/gi))
      u.precision = `G${mm[1]} P${mm[2]}`;
    for (const mm of s.matchAll(/(?<![A-Za-z])G990Q(\d+(?:\.\d*)?)/gi))
      u.precision = `G990 Q${mm[1]}`;

    return Object.keys(u).length > 0 ? u : null;
  };

const FANUC: MachineProfile = {
  id: "fanuc",
  label: "FANUC 系",
  cancels: FANUC_CANCELS,
  recognize: makeRecognize(FANUC_CANCELS),
};

const OKUMA: MachineProfile = {
  id: "okuma",
  label: "OKUMA 系",
  cancels: OKUMA_CANCELS,
  recognize: makeRecognize(OKUMA_CANCELS),
};

/** 利用可能な機械。 */
export const MACHINES: Record<string, MachineProfile> = { fanuc: FANUC, okuma: OKUMA };

/** 設定 id から機械プロファイルを取り出す（未登録なら FANUC フォールバック）。 */
export function getMachine(id: string): MachineProfile {
  return MACHINES[id] ?? FANUC;
}

/** 2 つの状態が全キー一致するか。 */
function sameState(a: ModalState, b: ModalState): boolean {
  return STATE_KEYS.every((k) => a[k] === b[k]);
}

/**
 * 全行を先頭から 1 回（O(n)）走査し、状態が変化した地点で区切るセグメント列を返す。
 * 連続する同一状態は 1 セグメントにまとめる（メモリ/描画を節約）。
 */
export function computeModalSegments(lines: string[], machine: MachineProfile): ModalSegment[] {
  const segments: ModalSegment[] = [];
  let state: ModalState = emptyState();
  for (let i = 0; i < lines.length; i++) {
    const u = machine.recognize(lines[i]);
    if (u) state = { ...state, ...u };
    const last = segments[segments.length - 1];
    if (last && sameState(last.state, state)) {
      last.endLine = i;
    } else {
      segments.push({ startLine: i, endLine: i, state: { ...state } });
    }
  }
  return segments;
}

/** 行番号（0 起算）を覆うセグメントの状態を返す。セグメントは startLine 昇順・隙間なし。無ければ null。 */
export function stateAtLine(segments: ModalSegment[], line: number): ModalState | null {
  let lo = 0;
  let hi = segments.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].startLine <= line) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0) return null;
  const seg = segments[ans];
  return line <= seg.endLine ? seg.state : null;
}

/**
 * 表示値を返す。toolLength / cutterComp は補助フィールド（H / D）を組み合わせる。
 * 空文字列 = 未認識（UI 側が "—" に変換）。
 */
export function displayValue(state: ModalState, key: ModalGroup): string {
  if (key === "toolLength") {
    const g = state.toolLength;
    const h = state.toolLengthH;
    if (!g && !h) return "";
    if (!g) return `H${h}`;
    return h ? `${g} H${h}` : g;
  }
  if (key === "cutterComp") {
    const g = state.cutterComp;
    const d = state.cutterCompD;
    if (!g && !d) return "";
    if (!g) return `D${d}`;
    return d ? `${g} D${d}` : g;
  }
  return state[key] ?? "";
}
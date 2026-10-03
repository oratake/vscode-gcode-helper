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
  /** M コード（文字列キー）→ 取消対象グループ。例: { "660": ["toolLength", "spindle"] } */
  cancels?: Record<string, ModalGroup[]>;
}

// --- 取消マクロテーブル ---
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
    let m: RegExpMatchArray | null;

    if ((m = s.match(/(?<![A-Za-z])G(00|01|02|03)(?!\d)/i))) u.motion = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z])G(17|18|19)(?!\d)/i))) u.plane = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z])G(20|21)(?!\d)/i))) u.units = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z])G(90|91)(?!\d)/i))) u.distance = `G${m[1]}`;

    if ((m = s.match(/(?<![A-Za-z])G(40|41|42)(?!\d)/i))) {
      u.cutterComp = `G${m[1]}`;
      if (m[1] === "40") u.cutterCompD = null;
    }
    if ((m = s.match(/(?<![A-Za-z])D(\d+(?:\.\d+)?)(?!\d)/i))) u.cutterCompD = m[1];

    if ((m = s.match(/(?<![A-Za-z])G(43(\.\d+)?)(?!\d)/i))) u.toolLength = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z])G49(?!\d)/i))) {
      u.toolLength = null;
      u.toolLengthH = null;
    }
    if ((m = s.match(/(?<![A-Za-z])H(\d+(?:\.\d+)?)(?!\d)/i))) u.toolLengthH = m[1];

    if ((m = s.match(/(?<![A-Za-z])G(54|55|56|57|58|59)(?!\d)/i))) u.workOffset = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z])S([+-]?\d+(?:\.\d+)?)/i))) u.s = m[1];
    if ((m = s.match(/(?<![A-Za-z])F([+-]?\d+(?:\.\d+)?)/i))) u.f = m[1];
    if ((m = s.match(/(?<![A-Za-z])T(\d+(?:\.\d+)?)/i))) u.t = m[1];

    for (const mm of s.matchAll(/(?<![A-Za-z])M(\d{1,4})(?!\d)/gi)) {
      const code = parseInt(mm[1], 10);
      if (code === 3) u.spindle = "M3";
      else if (code === 4) u.spindle = "M4";
      else if (code === 5) u.spindle = "M5";
      else if (code === 8) u.coolant = "M8";
      else if (code === 9) u.coolant = "M9";
      const cl = cancels?.[mm[1]];
      if (cl) for (const g of cl) (u as Record<string, string | null>)[g] = null;
    }

    for (const mm of s.matchAll(/(?<![A-Za-z])G(8|5)P(\d+(?:\.\d*)?)/gi))
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
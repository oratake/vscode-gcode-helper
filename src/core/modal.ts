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
  /** 工具長補償 G43/43.1/49 */
  toolLength: string | null;
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
}

export type ModalGroup = keyof ModalState;

/** 表示するグループ（行ラベル・表示順）。*/
export const GROUPS: { key: ModalGroup; label: string }[] = [
  { key: "motion", label: "運動" },
  { key: "plane", label: "平面" },
  { key: "units", label: "単位" },
  { key: "distance", label: "絶対/相対" },
  { key: "cutterComp", label: "工具径補償" },
  { key: "toolLength", label: "工具長補償" },
  { key: "workOffset", label: "ワーク原点" },
  { key: "s", label: "S 回転数" },
  { key: "f", label: "F 送り速度" },
  { key: "t", label: "T 工具番号" },
  { key: "spindle", label: "主軸回転" },
  { key: "coolant", label: "クーラント" },
];

/** 全グループ null の初期状態（何も認識される前の「空」）。デフォルト値は持たない。 */
export function emptyState(): ModalState {
  return {
    motion: null,
    plane: null,
    units: null,
    distance: null,
    cutterComp: null,
    toolLength: null,
    workOffset: null,
    s: null,
    f: null,
    t: null,
    spindle: null,
    coolant: null,
  };
}

/** 状態が変化した地点で区切ったセグメント（同一状態の連続は 1 セグメントにまとめる）。 */
export interface ModalSegment {
  /** 0 起算・両端込み */
  startLine: number;
  endLine: number;
  state: ModalState;
}

/** 機械プロファイル: id / 表示名 / 行認識子。機械ごとのルール差は recognize を上書きで表現する。 */
export interface MachineProfile {
  id: string;
  label: string;
  recognize: (line: string) => Partial<ModalState> | null;
}

// --- FANUC 系の認識子（ベース） ---
const FANUC: MachineProfile = {
  id: "fanuc",
  label: "FANUC 系",
  recognize: (line) => {
    const s = stripComment(line);
    if (!s.trim()) return null;
    const u: Partial<ModalState> = {};
    let m: RegExpMatchArray | null;
    if ((m = s.match(/(?<![A-Za-z.])G(00|01|02|03)(?!\d)/i))) u.motion = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])G(17|18|19)(?!\d)/i))) u.plane = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])G(20|21)(?!\d)/i))) u.units = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])G(90|91)(?!\d)/i))) u.distance = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])G(40|41|42)(?!\d)/i))) u.cutterComp = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])G(43(\.\d+)?|49)(?!\d)/i))) u.toolLength = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])G(54|55|56|57|58|59)(?!\d)/i))) u.workOffset = `G${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])S([+-]?\d+(?:\.\d+)?)/i))) u.s = m[1];
    if ((m = s.match(/(?<![A-Za-z.])F([+-]?\d+(?:\.\d+)?)/i))) u.f = m[1];
    if ((m = s.match(/(?<![A-Za-z.])T(\d+(?:\.\d+)?)/i))) u.t = m[1];
    if ((m = s.match(/(?<![A-Za-z.])M(3|4|5)(?!\d)/i))) u.spindle = `M${m[1]}`;
    if ((m = s.match(/(?<![A-Za-z.])M(8|9)(?!\d)/i))) u.coolant = `M${m[1]}`;
    return Object.keys(u).length > 0 ? u : null;
  },
};

/** 利用可能な機械（現在: FANUC のみ。OKUMA 等は別 Issue で追加）。 */
export const MACHINES: Record<string, MachineProfile> = { fanuc: FANUC };

/** 設定 id から機械プロファイルを取り出す（未登録なら FANUC フォールバック）。 */
export function getMachine(id: string): MachineProfile {
  return MACHINES[id] ?? FANUC;
}

/** 2 つの状態が全グループ一致するか。 */
function sameState(a: ModalState, b: ModalState): boolean {
  return GROUPS.every((g) => a[g.key] === b[g.key]);
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
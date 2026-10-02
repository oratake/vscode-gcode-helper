// core/ は vscode import をしない（単体テスト可能な根拠）。

/** 行からコメント（`(...)` ブロック と `;...` 行末）を除去したコード部分。 */
function stripComment(line: string): string {
  const s = line.replace(/\([^)]*\)/g, "");
  const i = s.indexOf(";");
  return i >= 0 ? s.slice(0, i) : s;
}

/**
 * 行から Z 値（数値）を抽出。無ければ null。
 * `Z-29.` / `Z-29.000` / `Z0` / `Z+1.5` を許容。`Z` は語先頭のみ（`XYZ10` は除外）。
 */
export function parseZValue(line: string): number | null {
  const m = stripComment(line).match(/(?<![A-Za-z])Z([+-]?\d+(?:\.\d*)?)/i);
  return m ? Number(m[1]) : null;
}

/** 行範囲の最低 Z とその行（0 起算）。 */
export interface MinZResult {
  value: number;
  line: number;
}

/**
 * 行範囲 [startLine, endLine]（0 起算・両端込み）の最低 Z を探す。無ければ null。
 */
export function findMinZ(lines: string[], startLine: number, endLine: number): MinZResult | null {
  let best: MinZResult | null = null;
  for (let i = startLine; i <= endLine; i++) {
    const v = parseZValue(lines[i]);
    if (v === null) continue;
    if (best === null || v < best.value) best = { value: v, line: i };
  }
  return best;
}

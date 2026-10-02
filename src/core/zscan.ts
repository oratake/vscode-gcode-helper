// core/ は vscode import をしない（単体テスト可能な根拠）。

/** 行からコメント（`(...)` ブロック と `;...` 行末）を除去したコード部分。 */
function stripComment(line: string): string {
  const s = line.replace(/\([^)]*\)/g, "");
  const i = s.indexOf(";");
  return i >= 0 ? s.slice(0, i) : s;
}

/** Z 値トークン（語先頭の Z の数値部分）。`Z` は英字直後のみ除外（`XYZ10` 除外、`X1Y2Z3` 可）。 */
const Z_RE = /(?<![A-Za-z])Z([+-]?\d+(?:\.\d*)?)/i;

/**
 * 行から Z 値を mm に正規化して抽出。無ければ null。
 * G-code の小数規則: 小数点付きは mm、点無しの整数は μm(=0.001mm)。
 * 例: `Z-6.` → -6 mm / `Z-7` → -0.007 mm（`Z-7` は -7μm であり -7mm ではない）。
 */
export function parseZValue(line: string): number | null {
  const m = stripComment(line).match(Z_RE);
  if (!m) return null;
  const raw = m[1];
  return raw.includes(".") ? Number(raw) : Number(raw) / 1000;
}

/** Z 値情報。`value` は比較用の mm 正規化値、`raw` はソースの原文（表示用、例 `Z-6.`）。 */
interface ZValue {
  value: number;
  raw: string;
}

function matchZ(line: string): ZValue | null {
  const m = stripComment(line).match(Z_RE);
  if (!m) return null;
  const raw = m[1];
  return { value: raw.includes(".") ? Number(raw) : Number(raw) / 1000, raw: `Z${raw}` };
}

/** 行範囲の最低 Z。`value`(mm 正規化) / `raw`(表示) / `line`(0 起算)。無ければ null。 */
export interface MinZResult {
  value: number;
  raw: string;
  line: number;
}

/**
 * 行範囲 [startLine, endLine]（0 起算・両端込み）の最低 Z を探す。
 * 比較は mm に正規化された値で行う（`Z-6.` と `Z-7` は -6mm と -0.007mm として比較）。
 */
export function findMinZ(lines: string[], startLine: number, endLine: number): MinZResult | null {
  let best: MinZResult | null = null;
  for (let i = startLine; i <= endLine; i++) {
    const z = matchZ(lines[i]);
    if (!z) continue;
    if (best === null || z.value < best.value) best = { value: z.value, raw: z.raw, line: i };
  }
  return best;
}
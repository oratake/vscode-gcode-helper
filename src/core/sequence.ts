// core/ は vscode import をしない（単体テスト可能な根拠）。

export interface GcodeSettings {
  /** 連続するコメント行を全て表示する（false: 1 行にまとめる） */
  showAllConsecutiveComments: boolean;
}

export interface Sequence {
  /** N 番号（例: "10"） */
  n: string;
  /** N 行のテキストそのもの */
  nLineText: string;
  /** N 行の 0 起算行番号 */
  startLine: number;
  /** このブロックの最終行の 0 起算行番号（次の N 行の手前） */
  endLine: number;
  /** ブロックの物理行数 */
  lineCount: number;
  /** 表示時行数（コメントまとめ設定を反映） */
  displayLineCount: number;
  /** N 行から抽出したコメント（無ければ ""） */
  comment: string;
}

// 行頭の N コードを検出。FANUC 系は行頭 N + 任意の命令。
const N_START = /^\s*N(\d+)(.*)$/i;

/** 行頭の N コードを解析。行頭で N 番号が来る場合のみ返す（それ以外は null）。 */
export function parseNCode(line: string): { n: string; rest: string } | null {
  const m = N_START.exec(line);
  if (!m) return null;
  return { n: m[1], rest: m[2] };
}

/** 行からコメントを抽出。`(...)`（ブロック）優先、次に `;`（行末）。無ければ ""。 */
export function extractComment(line: string): string {
  const block = line.match(/\(([^)]*)\)/);
  if (block) return block[1].trim();
  const semi = line.match(/;(.*)$/);
  if (semi) return semi[1].trim();
  return "";
}

/** コメント行（空行・`;` 始まり・`(` 始まり）かを判定。 */
function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t === "" || t.startsWith(";") || t.startsWith("(");
}

/** 表示時行数を計算（コメントまとめ設定を反映）。 */
function computeDisplayLineCount(
  lines: string[],
  startLine: number,
  endLine: number,
  showAll: boolean,
): number {
  if (showAll) return endLine - startLine + 1;
  let count = 0;
  let prevComment = false;
  for (let i = startLine; i <= endLine; i++) {
    const isComment = isCommentLine(lines[i]);
    if (isComment && prevComment) continue; // 連続コメントを 1 行にまとめる
    count++;
    prevComment = isComment;
  }
  return count;
}

/** 全行からシーケンス（N コードブロック）を抽出する。 */
export function extractSequences(lines: string[], settings: GcodeSettings): Sequence[] {
  const nIndexes: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (parseNCode(lines[i])) nIndexes.push(i);
  }

  const result: Sequence[] = [];
  for (let k = 0; k < nIndexes.length; k++) {
    const startLine = nIndexes[k];
    const endLine = k + 1 < nIndexes.length ? nIndexes[k + 1] - 1 : lines.length - 1;
    const line = lines[startLine];
    const parsed = parseNCode(line);
    if (!parsed) continue;
    result.push({
      n: parsed.n,
      nLineText: line,
      startLine,
      endLine,
      lineCount: endLine - startLine + 1,
      displayLineCount: computeDisplayLineCount(lines, startLine, endLine, settings.showAllConsecutiveComments),
      comment: extractComment(line),
    });
  }
  return result;
}

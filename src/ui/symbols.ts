import * as vscode from "vscode";
import { extractSequences } from "../core/sequence";

/**
 * G-code のシーケンス（N コード先頭行）を DocumentSymbol として提供する。
 * VSCode ネイティブ sticky scroll はデフォルト（defaultModel: 'outlineModel'）で
 * このプロバイダを最優先利用し、現在のシーケンス先頭行を固定表示する。
 */
export function createSequenceSymbolProvider(): vscode.DocumentSymbolProvider {
  return {
    provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
      const showAll = vscode.workspace
        .getConfiguration("gcodeHelper")
        .get<boolean>("showAllConsecutiveComments", false);
      const lines = document.getText().split(/\r?\n/);
      const seqs = extractSequences(lines, { showAllConsecutiveComments: showAll });

      return seqs.map((s) => {
        const range = new vscode.Range(s.startLine, 0, s.endLine, lines[s.endLine].length);
        const selectionRange = new vscode.Range(s.startLine, 0, s.startLine, lines[s.startLine].length);
        return new vscode.DocumentSymbol(
          s.nLineText, // name（アウトライン / ブレッドクラムに表示）
          s.comment, // detail
          vscode.SymbolKind.Function,
          range,
          selectionRange,
        );
      });
    },
  };
}

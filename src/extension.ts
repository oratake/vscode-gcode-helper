import * as vscode from "vscode";
import { createSequenceSymbolProvider } from "./ui/symbols";

/**
 * スティッキーヘッダー（機能1）のエントリ。
 * - `gcodeHelper.stickyHeader.enabled` が on: DocumentSymbolProvider を登録 →
 *   ネイティブ sticky scroll が N コード先頭行を固定表示。
 * - off: プロバイダを解除（sticky scroll は indentation にフォールバックし G-code には表示されない）。
 */
export function activate(context: vscode.ExtensionContext): void {
  let providerDisposable: vscode.Disposable | undefined;

  const syncProvider = (): void => {
    const cfg = vscode.workspace.getConfiguration("gcodeHelper");
    const enabled = cfg.get<boolean>("stickyHeader.enabled", true);
    const languages = cfg.get<string[]>("stickyHeader.languages", ["gcode"]);
    if (enabled && languages.length > 0 && !providerDisposable) {
      providerDisposable = vscode.languages.registerDocumentSymbolProvider(
        languages.map((l) => ({ language: l })),
        createSequenceSymbolProvider(),
      );
      context.subscriptions.push(providerDisposable);
    } else if ((!enabled || languages.length === 0) && providerDisposable) {
      providerDisposable.dispose();
      providerDisposable = undefined;
    }
  };

  syncProvider();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("gcodeHelper")) syncProvider();
    }),
    vscode.commands.registerCommand("gcodeHelper.toggleStickyHeader", () => {
      const cfg = vscode.workspace.getConfiguration("gcodeHelper");
      const current = cfg.get<boolean>("stickyHeader.enabled", true);
      void cfg.update("stickyHeader.enabled", !current, true);
    }),
  );
}

export function deactivate(): void {}

import * as vscode from "vscode";
import { createSequenceSymbolProvider } from "./ui/symbols";
import { SequenceTreeProvider } from "./ui/sidebar";

export function activate(context: vscode.ExtensionContext): void {
  // --- 専用サイドバー: Activity Bar「G-code Helper」 + シーケンス TreeView ---
  const treeProvider = new SequenceTreeProvider();
  // ViewContainer「G-code Helper」は package.json の contributes で宣言済み。
  // ランタイムでは View の id に TreeView を紐付けるだけ。
  const treeView = vscode.window.createTreeView("gcodeHelper.sequences", {
    treeDataProvider: treeProvider,
  });

  const syncTree = (): void => {
    const cfg = vscode.workspace.getConfiguration("gcodeHelper");
    const languages = cfg.get<string[]>("stickyHeader.languages", ["gcode"]);
    const editor = vscode.window.activeTextEditor;
    if (editor && languages.includes(editor.document.languageId)) {
      const showAll = cfg.get<boolean>("showAllConsecutiveComments", false);
      treeProvider.refresh(editor.document.getText().split(/\r?\n/), {
        showAllConsecutiveComments: showAll,
      });
    } else {
      treeProvider.refresh([], { showAllConsecutiveComments: false });
    }
  };

  // --- スティッキーヘッダー（機能1）: DocumentSymbol → ネイティブ sticky scroll ---
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

  // 重量ファイルで打ち込み毎に再計算すると重くなるため、編集のみデバウンスする。
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSync = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      syncTree();
    }, 150);
  };

  const onConfig = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("gcodeHelper")) {
      syncProvider();
      syncTree();
    }
  });

  syncProvider();
  syncTree();

  context.subscriptions.push(
    treeView,
    onConfig,
    vscode.window.onDidChangeActiveTextEditor(() => syncTree()),
    vscode.workspace.onDidChangeTextDocument(scheduleSync),
    vscode.commands.registerCommand("gcodeHelper.toggleStickyHeader", () => {
      const cfg = vscode.workspace.getConfiguration("gcodeHelper");
      const current = cfg.get<boolean>("stickyHeader.enabled", true);
      void cfg.update("stickyHeader.enabled", !current, true);
    }),
    vscode.commands.registerCommand("gcodeHelper.revealLine", (line: number) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const target = Math.max(0, Math.min(line - 1, editor.document.lineCount - 1));
      const pos = new vscode.Position(target, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport,
      );
    }),
  );
}

export function deactivate(): void {}

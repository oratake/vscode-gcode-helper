import * as vscode from "vscode";
import { createSequenceSymbolProvider } from "./ui/symbols";
import { SequenceTreeProvider, ModalTreeProvider } from "./ui/sidebar";
import {
  computeModalSegments,
  stateAtLine,
  getMachine,
  type ModalSegment,
} from "./core/modal";

export function activate(context: vscode.ExtensionContext): void {
  // --- 専用サイドバー: Activity Bar「G-code Helper」 + シーケンス / モーダル TreeView ---
  const treeProvider = new SequenceTreeProvider();
  const modalProvider = new ModalTreeProvider();
  const treeView = vscode.window.createTreeView("gcodeHelper.sequences", {
    treeDataProvider: treeProvider,
  });
  const modalView = vscode.window.createTreeView("gcodeHelper.modal", {
    treeDataProvider: modalProvider,
  });

  const languagesOf = (): string[] =>
    vscode.workspace.getConfiguration("gcodeHelper").get<string[]>("stickyHeader.languages", [
      "gcode",
    ]);

  const syncTree = (): void => {
    const editor = vscode.window.activeTextEditor;
    const showAll = vscode.workspace
      .getConfiguration("gcodeHelper")
      .get<boolean>("showAllConsecutiveComments", false);
    if (editor && languagesOf().includes(editor.document.languageId)) {
      treeProvider.refresh(editor.document.getText().split(/\r?\n/), {
        showAllConsecutiveComments: showAll,
      });
    } else {
      treeProvider.refresh([], { showAllConsecutiveComments: false });
    }
  };

  // --- モーダル管理（機能6）: カーソル位置の状態表示 ---
  // セグメント（状態変化点のみ）は編集時のみ再計算（O(n)）。カーソル移動はキャッシュ参照（軽量）。
  let segments: ModalSegment[] = [];

  const updateModal = (): void => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      modalProvider.setState(null);
      return;
    }
    modalProvider.setState(stateAtLine(segments, editor.selection.active.line));
  };

  const recomputeModal = (): void => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !languagesOf().includes(editor.document.languageId)) {
      segments = [];
      modalProvider.setState(null);
      return;
    }
    const machine = getMachine(
      vscode.workspace.getConfiguration("gcodeHelper").get<string>("machine", "fanuc"),
    );
    segments = computeModalSegments(editor.document.getText().split(/\r?\n/), machine);
    updateModal();
  };

  // --- スティッキーヘッダー（機能1）: DocumentSymbol → ネイティブ sticky scroll ---
  let providerDisposable: vscode.Disposable | undefined;
  const syncProvider = (): void => {
    const cfg = vscode.workspace.getConfiguration("gcodeHelper");
    const enabled = cfg.get<boolean>("stickyHeader.enabled", true);
    const languages = languagesOf();
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

  const syncAll = (): void => {
    syncTree();
    try {
      recomputeModal();
    } catch (err) {
      // 新しい機能（モーダル）の例外で既存のシーケンス表示まで壊さないための隔離
      console.error("[gcode-helper] modal recompute failed", err);
    }
  };

  // 重量ファイルで打ち込み毎に再計算すると重くなるため、編集のみデバウンスする。
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSync = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      syncAll();
    }, 150);
  };

  const onConfig = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("gcodeHelper")) {
      syncProvider();
      syncAll();
    }
  });

  syncProvider();
  syncAll();

  context.subscriptions.push(
    treeView,
    modalView,
    onConfig,
    vscode.window.onDidChangeActiveTextEditor(() => syncAll()),
    vscode.workspace.onDidChangeTextDocument(scheduleSync),
    vscode.window.onDidChangeTextEditorSelection(() => updateModal()),
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
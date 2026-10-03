import * as vscode from "vscode";
import { extractSequences, type GcodeSettings, type Sequence } from "../core/sequence";
import { findMinZ, type MinZResult } from "../core/zscan";
import { GROUPS, emptyState, type ModalGroup, type ModalState } from "../core/modal";

/** シーケンス木のエレメント。`sequence`（N ブロック）と `minZ`（その最低 Z）。 */
class SequenceNode {
  constructor(
    public readonly kind: "sequence" | "minZ",
    public readonly seq: Sequence,
    public readonly minZ: MinZResult | null,
  ) {}
}

/**
 * シーケンス(N ブロック)を主軸にした TreeView のデータ供給。
 * 各シーケンスの子に最低 Z（将来: 工具）を載せる。機能追加 = 子ノードを増やす、で拡張する。
 */
export class SequenceTreeProvider implements vscode.TreeDataProvider<SequenceNode> {
  private _onDidChange = new vscode.EventEmitter<SequenceNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private roots: SequenceNode[] = [];

  refresh(lines: string[], settings: GcodeSettings): void {
    this.roots = extractSequences(lines, settings).map(
      (seq) => new SequenceNode("sequence", seq, findMinZ(lines, seq.startLine, seq.endLine)),
    );
    this._onDidChange.fire(undefined);
  }

  getChildren(node?: SequenceNode): SequenceNode[] {
    if (!node) return this.roots;
    if (node.kind === "sequence") {
      return node.minZ ? [new SequenceNode("minZ", node.seq, node.minZ)] : [];
    }
    return [];
  }

  getTreeItem(node: SequenceNode): vscode.TreeItem {
    if (node.kind === "sequence") {
      const it = new vscode.TreeItem(`N${node.seq.n}`);
      const range = `行 ${node.seq.startLine + 1}–${node.seq.endLine + 1}`;
      it.description = node.minZ ? `${range} · 最低${node.minZ.raw}` : range;
      it.collapsibleState = node.minZ
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
      it.command = {
        command: "gcodeHelper.revealLine",
        title: "N 行へジャンプ",
        arguments: [node.seq.startLine + 1],
      };
      return it;
    }
    const it = new vscode.TreeItem(`最低${node.minZ!.raw}`);
    it.description = `行 ${node.minZ!.line + 1}`;
    it.collapsibleState = vscode.TreeItemCollapsibleState.None;
    it.command = {
      command: "gcodeHelper.revealLine",
      title: "行へジャンプ",
      arguments: [node.minZ!.line + 1],
    };
    return it;
  }
}

/**
 * カーソル位置のモーダル状態を表示する TreeView（機能6・A案）。
 * 全グループ行を常時表示し、値は VSCode が自動で薄く表示する description に載せる。
 * 未認識のグループは "—"（空枠）。
 */
export class ModalTreeProvider implements vscode.TreeDataProvider<ModalGroup> {
  private _onDidChange = new vscode.EventEmitter<ModalGroup | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private state: ModalState = emptyState();

  setState(state: ModalState | null): void {
    this.state = state ?? emptyState();
    this._onDidChange.fire(undefined);
  }

  getChildren(): ModalGroup[] {
    return GROUPS.map((g) => g.key);
  }

  getTreeItem(key: ModalGroup): vscode.TreeItem {
    const def = GROUPS.find((g) => g.key === key)!;
    const it = new vscode.TreeItem(def.label);
    it.description = this.state[key] ?? "—";
    it.collapsibleState = vscode.TreeItemCollapsibleState.None;
    return it;
  }
}
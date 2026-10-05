# vscode-gcode-helper

マシニングセンタで用いる G-code を VSCode で編集する際に便利になる拡張機能です。

## 目的

マシニングセンタで用いる G-code を VSCode で編集しているが、編集の際に便利になるような VSCode 拡張機能を作りたい、という出发点のプロジェクトです。

## 現状ステータス

機能1（スティッキーヘッダー）・機能3（最低Z + サイドバー）・機能4（モーダル管理 FANUC/OKUMA + ATC 工具番号）は実装済み。機能2（工具情報表示）は検討中。

## 使うソフトとの連携

- 基本は **Autodesk Fusion** 向けに特化する想定。
- 一般的な G-code にも当然対応できることを前提とする。
- G-code 方言は **FANUC 系**として扱う想定。

## 機能一覧（進捗）

| # | 機能 | 概要 | 状態 |
|---|---|---|---|
| 1 | スティッキーヘッダー | 現在の N コード先頭行をビューポート上部に固定表示（ネイティブ sticky scroll + DocumentSymbol） | 完了（Issue #2） |
| 3 | 最低Z + 専用サイドバー | Activity Bar に「G-code Helper」を追加。シーケンス(N)を主軸に最低Z を子ノードで表示（クリックでジャンプ） | 完了（Issue #4） |
| 4 | モーダル管理 | カーソル位置のモーダル状態（G90 / G54 / 工具径補正 / ATC 工具番号等）を表示。FANUC・OKUMA 対応、QuickPick で機械切替 | 完了（Issue #6, #8） |
| 2 | 工具情報の表示 | Fusion から工具情報を取得しサイドに表示。成果物は JSON/YAML で機構と読込を分離（取得経路は要調査） | 検討中 |

## 開発の方向性

- **技術スタック**: TypeScript + esbuild（VSCode 拡張の公式テンプレートに準ずる）。
- **構造**: 純粋ロジック（`core/`、vscode 非依存）と VSCode 依存層（`ui/`）を分離し、単体テストできるようにする。
- **ドメイン知識**: VSCode の UI 用語・本拡張固有の事実は `docs/glossary.md` にまとめる。

コーディング LLM 向けの指示は `AGENTS.md` を参照してください。

## ハイライト拡張との併用（競合を避ける設計）

本拡張は G-code の**言語定義・文法（シンタックスハイライト）を提供しません**。ハイライトは既存の拡張（例: [ML.nc-gcode](https://marketplace.visualstudio.com/items?itemName=ML.nc-gcode)、言語 ID は `gcode`）に委ね、本拡張は**スティッキーヘッダーのみ**を追加します。

- 両者は同じ言語 `gcode` に「異なる機能」（ML = 文法、本拡張 = DocumentSymbolProvider）を寄与するだけなので競合しません。
- ヘッダーを付ける対象言語は設定 `gcodeHelper.stickyHeader.languages`（デフォルト `["gcode"]`）で指定します。ML の言語 ID `gcode` が既定で含まれるため、設定を変えなくても ML で色付きのファイルにヘッダーが付きます。
- 他社 / 自前の G-code 拡張を使う場合は、そこの言語 ID をこの配列に追加してください。

## ビルド・導入

### 準備

```bash
npm install
```

### ユニットテスト

```bash
npm test
```

`core` の抽出ロジック（N コード・シーケンス境界・モーダル認識・最低Z）を検証します。

### .vsix パッケージの生成

```bash
npm run build
npx @vscode/vsce package
```

カレントディレクトリに `vscode-gcode-helper-0.0.x.vsix` が生成されます。

### VSCode に導入する

1. 本番 VSCode で **⌘⇧P → `Extensions: Install from VSIX...`**（または拡張機能パレット右上の `...` → 「VSIX からインストール...」）
2. 生成した `.vsix` を選択 → **ウィンドウを再読み込み**
3. G-code ファイル（`.nc` 等）を開く

### 確認できること

G-code ファイルを開いた時点で、以下の機能が動作します:

- **スティッキーヘッダー**: 現在の N コード先頭行がビューポート上部に固定表示
- **最低Z**: サイドバー「G-code Helper」→「シーケンス」に各 N ブロックの最低Z（クリックでジャンプ）
- **モーダル管理**: サイドバー「モーダル状態」にカーソル位置のモーダル値
  - サイドバーヘッダーの機械選択（QuickPick）で **FANUC / OKUMA** を切替可能
  - ⌘⇧P → `G-code: 機械選択` でも切替

設定（`settings.json`）:

| 設定 | デフォルト | 説明 |
|---|---|---|
| `gcodeHelper.stickyHeader.enabled` | `true` | スティッキーヘッダー ON/OFF |
| `gcodeHelper.stickyHeader.languages` | `["gcode"]` | ヘッダー対象言語 |
| `gcodeHelper.showAllConsecutiveComments` | `false` | 連続コメントをまとめる / 全表示 |
| `gcodeHelper.machine` | `"fanuc"` | モーダル認識の機械（`"fanuc"` / `"okuma"`） |

### F5（開発ホスト）

F5（実行とデバッグ → **Run Extension**）は拡張のロード・コマンド登録の確認に使えます。本拡張は G-code 言語定義を提供しないため、クリーンな開発ホストには G-code ファイルが認識されません。全機能の動作確認は上記の `.vsix` 導入が確実です。

> F5 ワークフローの公式ドキュメント（ページ上部で日本語化可）: <https://code.visualstudio.com/api/get-started/your-first-extension>

## 関連

- Issue #1: VSCode で G-code を記述する際に便利になる拡張機能を作る

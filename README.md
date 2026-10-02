# vscode-gcode-helper

マシニングセンタで用いる G-code を VSCode で編集する際に便利になる拡張機能です。

## 目的

マシニングセンタで用いる G-code を VSCode で編集しているが、編集の際に便利になるような VSCode 拡張機能を作りたい、という出发点のプロジェクトです。

## 現状ステータス

開発中です。機能1（スティッキーヘッダー）は実装済み（Issue #2 / PR #3）。以降の機能は個別 Issue 化し、仕様確定後に開発します。

## 使うソフトとの連携

- 基本は **Autodesk Fusion** 向けに特化する想定。
- 一般的な G-code にも当然対応できることを前提とする。
- G-code 方言は **FANUC 系**として扱う想定。

## 機能一覧（進捗）

| # | 機能 | 概要 | 状態 |
|---|---|---|---|
| 1 | スティッキーヘッダー | 現在の N コード先頭行をビューポート上部に固定表示（ネイティブ sticky scroll + DocumentSymbol） | 完了（Issue #2） |
| 3 | 最低Z + 専用サイドバー | Activity Bar に専用のサイドバー「G-code Helper」を追加。シーケンス(N)を主軸に最低Z を子ノードで表示（クリックでジャンプ） | 仕様確定・開発中（Issue #4） |
| 2 | 工具情報の表示 | Fusion から工具情報を取得しサイドに表示。成果物は JSON/YAML で機構と読込を分離（取得経路は要調査） | 検討中 |
| 4 | モーダル管理 | カーソル位置のモーダル状態（G90 / G54 / 工具径補正等）を表示。ルールは設定駆動 | 検討中 |

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

## 開発・デバッグ

### 準備・ユニットテスト

```
npm install
npm run test
```

`core` の抽出ロジック（N コード検出・シーケンス境界・5 万行の重量）を検証します。

### UI（スティッキーヘッダー）の確認

本拡張は言語を提供しないため、クリーンな **Extension Development Host（F5）** には G-code 言語が存在せず、ヘッダーの表示確認には向きません。実際の併用を確認するには、本番 VSCode に `.vsix` を入れて見ます。

1. `npm run build`
2. `npx @vscode/vsce package`（`vscode-gcode-helper-0.0.1.vsix` が生成される）
3. 本番 VSCode（ML.nc-gcode が入っているウィンドウ）で、拡張機能の ⚙ →「VSIX からインストール...」で上記 `.vsix` を入れ、ウィンドウを再読み込み。
4. G-code ファイル（`.nc` 等）を開く:
   - ML のハイライトが有効なまま、現在の N コード先頭行がビューポート上部に固定表示される。
   - ⌘⇧P → `G-code: スティッキーヘッダー切替`、または `gcodeHelper.stickyHeader.enabled` で on/off。

### F5（開発ホスト）で確認できること

F5（実行とデバッグ → **Run Extension**）は拡張のロード・コマンド登録の確認に使えます（左下に G-code Helper、コマンドパレットに切替コマンドが出ること）。ヘッダー本体の表示確認は上記の `.vsix` 経由が確実です。

> F5 ワークフローの公式ドキュメント（ページ上部で日本語化可）: <https://code.visualstudio.com/api/get-started/your-first-extension>

## 関連

- Issue #1: VSCode で G-code を記述する際に便利になる拡張機能を作る
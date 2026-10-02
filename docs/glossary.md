# 用語・ドメイン知識

本拡張（vscode-gcode-helper）を開発する際に、改めて調べたくなりがちな **VSCode の UI / API 用語** と、**本プロジェクト固有の事実** をまとめる。新規参入者（人間も LLM も）が最初に読むことを想定。

## VSCode の UI 領域

| 用語 | 説明 |
|---|---|
| **Activity Bar** | エディタ左端の縦のアイコン列（Explorer / Search / Source Control / Extensions 等が並ぶ列）。拡張はここに独自のアイコンを 1 つ追加できる。 |
| **ViewContainer（ビューコンテナ）** | Activity Bar のアイコン＋そのパネル（サイドバー領域）の単位。アイコンをクリックすると右にそのパネルが広がる。 |
| **Sidebar / Side Bar** | Activity Bar のアイコンをクリックしたときに出るパネル領域。ViewContainer が提供する。 |
| **View** | 1 つの ViewContainer の中に複数積むことのできる表示単位。実体は多くの場合 **TreeView**（階層リスト）。各 View は独立して折りたたみ可能。 |
| **TreeView** | 階層型の View。`TreeDataProvider`（`getChildren` / `getTreeItem`）でデータを供給する。 |
| **Outline（アウトライン）** | 内蔵 View。ドキュメントの **DocumentSymbol**（シンボル）を階層表示。Explorer の下に出る。 |
| **Explorer** | 内蔵 ViewContainer（ファイルツリー / Open Editors / Outline が積まれている）。 |
| **sticky scroll（スティッキースクロール）** | エディタ内蔵機能。現在の位置の「見出し行」をビューポート上部に固定表示。**Outline の DocumentSymbol**（或いは indent）を元にする。 |

## 本拡張の固有の事実

- 本拡張は G-code の**言語定義・文法（シンタックスハイライト）を提供しない**。ハイライトは別の拡張（例: `ML.nc-gcode`、言語 ID は `gcode`）が担当。両者は同じ言語 `gcode` に「別機能」を寄与するので競合しない。
- 本拡張が **Activity Bar に追加するアイコンは 1 つ**で、名前は **`G-code Helper`**（ViewContainer id: `gcodeHelper`）。
- 機能1（スティッキーヘッダー）はネイティブ **sticky scroll** が **Outline（DocumentSymbol）** を読む仕組みを利用する。Sidebar の TreeView を sticky scroll は読まない、に注意。
- 機能3 以降の**専用サイドバー**は、上記 ViewContainer `gcodeHelper` 内の **TreeView**（シーケンスを主軸にし、工具 / 最低Z を子ノードにする）。
- `core/` は **vscode を import しない**（単体テスト可能な根拠）。`ui/` は vscode 依存層。

## 使う API（概論）

| API | 用途 |
|---|---|
| `window.createViewContainer(id, title, ViewLocation.Sidebar)` | Activity Bar にアイコン＋パネルを作る（package.json の `viewsContainers` と id を一致させる）。 |
| `container.createTreeView(viewId, { treeDataProvider })` | コンテナ内に TreeView を 1 つ積む（package.json の `views` と一致させる）。 |
| `window.registerTreeDataProvider(viewId, provider)` | TreeView のデータソースを登録。 |
| `languages.registerDocumentSymbolProvider(selectors, provider)` | DocumentSymbol（Outline / sticky scroll 向け）を登録。 |
| `TreeItem.command` | ノードクリック時のコマンド（行ジャンプ等に使う）。 |
| `TextEditor.revealRange` / `selection` | 指定行を表示・カーソル移動。 |

> 公式参照: <https://code.visualstudio.com/api/ux-guidelines/extensions-view-contribution-guidelines>
# gas/ — Google Apps Script（スプレッドシート側の本体）

## 大原則：このフォルダの `.js` が唯一の正本

**ここに `.ts`（TypeScript）を置かないこと。**

以前は `.ts` を設計図、`.js` を実物として両方置いていた。しかし `tsc` を走らせる手順が
どこにも組まれていなかったため、`.ts` に書いた修正が `.js` に反映されないまま放置され、
両者が別々に育ってしまった。

2026-08-15、その結果として本番に以下の状態が生まれていた。

- `Code.ts` には管理者チェック（`ADMIN_ACTIONS` ゲート）が書かれていたが `.js` に無く、
  本番では `line_id` を名乗るだけで管理系 API が実行できた
- `Code.ts` には `getVenues` から `line_channel_access_token` を除外する処理が
  書かれていたが `.js` に無かった

逆に `.js` にしか無い機能もあった（`reminders` の挙式後タスク、`doGetLiff` の
`getTasksAndUser` 応答）。つまりドリフトは双方向で、どちらかを正とする単純な統合が
できない状態だった。

突き合わせの結果 `.js` がすべて新しいか同等だったため、`.ts` を削除して一本化した。

## 編集の手順

1. `.js` を直接編集する
2. `node --check <file>.js` で構文を確認する
3. `npx clasp push --force` でエディタへ反映（この時点では公開中の版は変わらない）
4. `npx clasp deploy -i <公開中のデプロイID> -d "説明"` で公開

**デプロイIDは必ず既存のものを指定すること。** 省略すると新しい URL が発行され、
LINE の LIFF エンドポイントと Next.js 側の `NEXT_PUBLIC_GAS_ENDPOINT` が
すべて繋がらなくなる。

現在の公開中デプロイは `npx clasp deployments` で確認できる。

## ファイルの役割

| ファイル | 役割 |
|---|---|
| `Code.js` | Web App の入口。`doPost`（JSON API）と `doGetLiff`（GET用JSON API） |
| `dashboard-server.js` | 管理ダッシュボードの `doGet` とサーバー関数群 |
| `dashboard.html` | 管理ダッシュボードの画面本体 |
| `sheets.js` | スプレッドシート読み書きの共通処理 |
| `reminders.js` | 毎朝のリマインド配信 |
| `setup.js` | シート初期化・base タスクの式場展開 |
| `claude.js` / `gemini.js` | AI によるメッセージ生成 |
| `webhook.js` | LINE Webhook |

## 注意点

- Apps Script は**全ファイルが同じグローバル空間**を共有する。`dashboard-server.js` の
  関数を `Code.js` から直接呼べる（実際に呼んでいる）。同名関数を作ると衝突するので注意。
- Web App の GET 入口は `dashboard-server.js` の `doGet(e)` **ひとつだけ**。
  `action` パラメータが付いていれば `Code.js` の `doGetLiff(e)` に委譲している。
  この振り分けを消すと LIFF と管理画面の GET が全部 HTML を受け取って壊れる。
- `task_master` の列はヘッダー名で解決すること（`_colMap`）。列番号の直書きは禁止。
  過去に固定列番号で書き込んで `venue_id` を破壊するコードが混入していた。

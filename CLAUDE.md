# roots-customer

## gstack

Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills:
- /office-hours — アイデアのリフレーミングと設計ドキュメント作成
- /plan-ceo-review — プロダクト戦略レビュー
- /plan-eng-review — アーキテクチャ・技術設計レビュー
- /plan-design-review — デザインレビュー（計画フェーズ）
- /design-consultation — デザインシステム構築
- /review — PRコードレビュー（バグ・完成度チェック）
- /investigate — 体系的なデバッグ・根本原因分析
- /design-review — デザイン監査＋修正
- /qa — ブラウザでアプリをテスト・バグ修正
- /qa-only — バグレポートのみ（修正なし）
- /ship — テスト実行・PR作成
- /land-and-deploy — PRマージ→デプロイ→本番確認
- /canary — デプロイ後のモニタリング
- /benchmark — ページパフォーマンス計測
- /document-release — リリース後ドキュメント更新
- /retro — 週次振り返り
- /browse — ヘッドレスブラウザ操作（※bunのインストールが必要）
- /setup-browser-cookies — ブラウザCookieのインポート
- /codex — Codex CLIによるセカンドオピニオンレビュー
- /careful — 破壊的コマンドの警告
- /freeze — 編集範囲をディレクトリに限定
- /guard — /careful + /freeze の組み合わせ
- /unfreeze — /freeze の解除
- /gstack-upgrade — gstackを最新版に更新

If gstack skills aren't working, run: `cd .claude/skills/gstack && ./setup`

Note: /browse and browse-dependent skills (/qa, /canary, /benchmark, /design-review) require bun to be installed.
Install bun: curl -fsSL https://bun.sh/install | bash

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

---
version: alpha
name: Roots Customer — Refined Wedding Companion
description: 結婚式準備を支える、清潔感と式場らしい格式を両立させたモバイルWebデザインシステム。LINE LIFF WebView (440px) を主な配信先とする。
colors:
  # Primary — Forest Sage (深いセージグリーン。自然・安心・信頼)
  primary-95: "#0F2118"
  primary-80: "#1F3A2A"
  primary-70: "#2F5A40"
  primary-60: "#3F7556"
  primary-50: "#5A8E6E"
  primary-30: "#A7C5B2"
  primary-20: "#CFE0D5"
  primary-10: "#E7F0EA"
  primary-05: "#F2F7F3"

  # Tertiary — Champagne Gold (アクセント。特別感)
  tertiary-70: "#9A6E2F"
  tertiary-60: "#B8884E"
  tertiary-50: "#D4A853"
  tertiary-40: "#E2C079"
  tertiary-20: "#F2DEAB"
  tertiary-10: "#FAEFD2"

  # Neutral — Warm Ivory (温かみのあるニュートラル)
  neutral-100: "#FFFFFF"
  neutral-98: "#FBFAF6"
  neutral-95: "#F5F1EA"
  neutral-90: "#EFE8DC"
  neutral-80: "#DDD3C2"
  neutral-60: "#9E9484"
  neutral-50: "#7A7268"
  neutral-30: "#4A4540"
  neutral-20: "#2C2925"
  neutral-10: "#1A1815"

  # Semantic
  success: "#2F8A4E"
  warning: "#D88B2C"
  error: "#B5402F"
  info: "#3F6E92"

  # Aliases (semantic roles)
  primary: "{colors.primary-70}"
  secondary: "{colors.tertiary-50}"
  surface: "{colors.neutral-100}"
  surface-muted: "{colors.neutral-95}"
  surface-page: "{colors.neutral-98}"
  on-surface: "{colors.neutral-20}"
  on-surface-muted: "{colors.neutral-50}"
  border: "{colors.neutral-90}"
  border-strong: "{colors.neutral-80}"

typography:
  display-lg:
    fontFamily: Shippori Mincho
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0.02em
  display-md:
    fontFamily: Shippori Mincho
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Noto Sans JP
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: 0.01em
  headline-md:
    fontFamily: Noto Sans JP
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.4
  headline-sm:
    fontFamily: Noto Sans JP
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.45
  body-lg:
    fontFamily: Noto Sans JP
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.65
  body-md:
    fontFamily: Noto Sans JP
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Noto Sans JP
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Noto Sans JP
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  label-caps:
    fontFamily: Noto Sans JP
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.22em
  numeric-display:
    fontFamily: Shippori Mincho
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1
    fontFeature: '"tnum" 1'

spacing:
  base: 8px
  3xs: 2px
  2xs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  gutter: 16px
  page-padding: 20px
  max-width: 440px

rounded:
  none: 0px
  xs: 4px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px

components:
  button-primary:
    backgroundColor: "{colors.primary-70}"
    textColor: "{colors.neutral-100}"
    typography: "{typography.headline-sm}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-80}"
  button-primary-disabled:
    backgroundColor: "{colors.neutral-80}"
    textColor: "{colors.neutral-100}"
  button-secondary:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.primary-70}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 16px
  button-tertiary:
    backgroundColor: "{colors.tertiary-50}"
    textColor: "{colors.neutral-10}"
    rounded: "{rounded.full}"
    height: 32px
    padding: 12px

  card:
    backgroundColor: "{colors.neutral-100}"
    rounded: "{rounded.lg}"
    padding: 16px

  input-text:
    backgroundColor: "{colors.neutral-98}"
    textColor: "{colors.neutral-20}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 48px

  chip:
    backgroundColor: "{colors.primary-10}"
    textColor: "{colors.primary-70}"
    rounded: "{rounded.xs}"
    typography: "{typography.label-caps}"
    padding: 4px

  checkbox-checked:
    backgroundColor: "{colors.primary-70}"
    textColor: "{colors.neutral-100}"
    rounded: "{rounded.xs}"
    size: 24px
  checkbox-unchecked:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-60}"
    rounded: "{rounded.xs}"
    size: 24px

  tab-active:
    textColor: "{colors.primary-70}"
    backgroundColor: "{colors.neutral-100}"
  tab-inactive:
    textColor: "{colors.neutral-50}"
    backgroundColor: "{colors.neutral-100}"
---

# Roots Customer — Refined Wedding Companion

## Overview

Roots Customer は結婚式の準備期間を花嫁/花婿に寄り添うコンパニオンアプリ。LINE のミニアプリ（LIFF WebView, 幅440px）として配信される。

**ブランドパーソナリティ**: 「**清潔感のある結婚式らしさ**」と「**LINEの軽快さ**」の融合。日本の式場が持つ格式と落ち着き、和モダンの上品さを基調にしながら、忙しい時期に使う実用ツールとして「迷わない・疲れない・速い」を最優先する。

**ターゲット**: 挙式予定の新郎新婦（20代後半〜30代後半）、および式場プランナー（管理画面を使う）。

**呼び起こしたい感情**: 「丁寧に準備が進んでいる」という安心感。慶事らしい控えめな華やかさ。情報過多にならない静けさ。

**避けるトーン**: 派手なグラデーション、ポップで子供っぽい配色、シリコンバレー的なミニマリズム。

## Colors

パレットの中心は **Forest Sage（深いセージグリーン）** と **Champagne Gold（シャンパンゴールド）**。前者は和装の松や苔を想起させる落ち着いた緑で、ブランドの主軸を担う。後者は金屏風や水引のような格式を、控えめなアクセントとして添える。背景は純白ではなく **Warm Ivory** にすることで、写真や数字（カウントダウン）が浮き立ち、目に優しい紙のような肌触りを生む。

- **Primary（{colors.primary-70} = #2F5A40）**: メインアクション、見出しの一部、選択状態。深さがあり、信頼の柱になる色。
- **Tertiary（{colors.tertiary-50} = #D4A853）**: カウントダウン数字、特別感を伝える要素にだけ使う。乱用は禁物。
- **Neutral（{colors.neutral-95} = #F5F1EA）**: ページ背景の温かみ、カード周辺の余白。
- **Surface（{colors.neutral-100} = #FFFFFF）**: カード本体、入力欄。情報が乗る面は常に純白。
- **Semantic**: success（#2F8A4E）/ warning（#D88B2C）/ error（#B5402F）/ info（#3F6E92）。彩度を抑え、ブランドトーンと共存させる。

### Palette Roles

色は **70/50/30/10** の段階で展開する。70 が主役、50 がホバー/強調、30 がチップ背景、10 が極淡い面（バッジ、選択行）として機能する。

## Typography

タイポグラフィは **2 ファミリー構成**：

- **Shippori Mincho**（ディスプレイ・カウントダウン数字）— 和の慶事らしさを担う明朝体。挙式名、カウントダウン、ヒーロータイトルにのみ使う。装飾的なフォントなので本文には絶対に使わない。
- **Noto Sans JP**（本文・UI）— 高い可読性と日本語への最適化。Weight は 400/600/700 のみ使用。

### スケールと役割

| レベル | サイズ | 用途 |
|---|---|---|
| display-lg | 28px / Mincho 600 | 招待状風ヒーロー（カバー画面のお名前）|
| display-md | 22px / Mincho 600 | サブヒーロー、空状態のアイキャッチ |
| numeric-display | 40px / Mincho tnum | カウントダウン数字（あと**◯◯**日）|
| headline-lg | 20px / Sans 700 | ページタイトル |
| headline-md | 17px / Sans 700 | カードタイトル、セクション見出し |
| headline-sm | 15px / Sans 600 | タスクタイトル、ボタンラベル |
| body-lg | 16px / Sans 400 | 本文（最重要本文）|
| body-md | 14px / Sans 400 | サブ本文、説明文 |
| body-sm | 12px / Sans 400 | メタ情報、注釈 |
| label-md | 13px / Sans 600 | フォームラベル |
| label-caps | 10px / Sans 700 0.22em | 上部キャプション "WEDDING PLANNER" 等 |

ルール: **1画面で2フォントウェイトを超えない**こと。ウェイトを増やすほど画面は雑然と見える。

## Layout

LINE LIFF を主たる配信先とするため、コンテンツは **max-width 440px の中央寄せ単一カラム** に統一する。Desktop で開かれた場合も同じ枠で表示し、両脇に温かみのある背景を見せる。

**スペーシング**: 8px ベースグリッド。`xs(8) / sm(12) / md(16) / lg(20) / xl(24) / 2xl(32) / 3xl(48)`。**ページ左右パディングは 20px**、カード内パディングは 16px、要素間は 12〜16px を基本。

**タッチ領域**: すべての操作対象は最小 44×44px を確保（Apple HIG 準拠）。

**Safe Area**: iOS の `env(safe-area-inset-*)` に対応。スクロールはコンテンツ領域のみ、ヘッダー/タブは sticky。

## Elevation & Depth

シャドウは **控えめな階調** に留める。式場のメインビジュアルが「光に満ちた挙式会場」のような柔らかい光である一方、シャドウはドラマチックではいけない。

- **Tonal Layer 1（ページ）**: `neutral-98 (#FBFAF6)` の温かい背景
- **Tonal Layer 2（カード/シート）**: `neutral-100 (white)` ＋ `0 1px 2px rgba(26,24,21,0.04), 0 4px 12px rgba(26,24,21,0.04)`
- **Tonal Layer 3（モーダル/トースト）**: `0 8px 24px rgba(26,24,21,0.10)`

シャドウより **境界線（{colors.border} = #EFE8DC）** で関係性を示す方がブランドに合う。多層シャドウは禁止。

## Shapes

**柔らかい曲線** だが、ぽっぷさには寄せない。

- 入力欄/ボタン: `rounded.md (10px)`
- カード/シート: `rounded.lg (14px)`
- モーダル: `rounded.xl (20px)`
- バッジ/チップ: `rounded.xs (4px)` または `rounded.full`
- アバター/丸インジケータ: `rounded.full`

ルール: 同じ階層内で複数の角丸スケールを混在させない。カードが 14px ならその中のボタンは 10px、入れ子の最深部のチップは 4px、というふうに **階層が深くなるほど角丸を減らす**。

## Components

### Button

- **Primary**: `bg primary-70`, `text white`, `height 48px`, `rounded.md`, `headline-sm`。タップ時 `active:scale-[0.98]` と `bg primary-80`。disabled は `bg neutral-80`。1画面に Primary は最大 2 つまで。
- **Secondary**: `bg white`, `text primary-70`, `border primary-30`, 同サイズ。
- **Tertiary（管理者画面遷移など）**: `bg tertiary-50`, `text neutral-10`, `rounded.full`, height 32px, 小さく上部に置く。
- **Ghost**: 背景なし、`text primary-70`。リンク的に使う。

### Input Field

- 高さ 48px、`bg neutral-98`、border `neutral-80`、focus 時 `ring 2px primary-30` + border `primary-50`。
- ラベルは `label-md`、`mb 8px`。
- エラー時はボーダーを `error` に切り替え、下に `body-sm` で文言を出す。

### Card

- `bg white`, `rounded.lg (14px)`, `padding 16px`, border `neutral-90`。
- インタラクティブカードは active 時に `bg primary-05` に。

### Task Card (専用)

- 上部に **カテゴリーチップ**（`primary-10` 背景 + `primary-70` テキスト + `label-caps`）。
- メインタイトル（`headline-sm`）、期限日（`body-md`）と残日数（`body-sm` + 強調色）。
- 期限超過は `error`、7日以内は `warning`、それ以外は `primary-70`。
- 完了済みは打ち消し線 + テキスト `neutral-50`。

### Checkbox

- 24×24px、未チェック: 白背景 + `neutral-60` ボーダー、`scale-95`。
- チェック済み: `primary-70` 塗りつぶし + 白チェック、`scale-100`。
- アニメーション 150ms、楽観的UI。

### Tabs（ダッシュボード）

- アクティブ: 下線 3px `primary-70`、テキスト `primary-70`、weight 600。
- 非アクティブ: 下線なし、テキスト `neutral-50`。

### Header（ダッシュボード）

- 上部 sticky。背景は `neutral-95` から `tertiary-10` への極めて緩いリニアグラデーション（角度135deg、彩度低め）。
- ラベルキャップス "WEDDING PLANNER" を `primary-70` で。
- お名前は **display-md (Mincho)**、その下にカウントダウン (numeric-display)。

### Empty State

- 中央配置、`primary-10` 円形コンテナ + `primary-70` アイコン、`body-md` の親しみあるコピー。

### Toast / ErrorMessage

- 画面下部から 200ms スライドイン、`bg neutral-20` + `text white` + `rounded.md`、3秒で自動消滅。

## Do's and Don'ts

- **Do** Primary（フォレストセージ）と Tertiary（ゴールド）の役割を厳密に分ける。ゴールドは「特別感」を伝える要素にだけ使う（カウントダウンの数字、お名前周辺の極小アクセント）。
- **Do** カウントダウン数字には Shippori Mincho を、本文には Noto Sans JP を使う。**この境界を絶対に混ぜない**。
- **Do** ページ背景は純白ではなく `neutral-98` を使う。写真と数字を浮かせる温かい紙のような肌触りに。
- **Do** すべてのタップ要素は 44×44px を確保する（HIG 準拠）。
- **Do** 完了アクションには楽観的UIを使う。チェックは即座に反映し、失敗時のみ戻す。
- **Don't** 紫やピンクのグラデーションは使わない（AIスロップ・ウェディングっぽさを損なう）。
- **Don't** 多層シャドウを重ねない。階層は色のトーンと境界線で示す。
- **Don't** カードもボタンも全部同じ角丸にしない。階層が深くなるほど角丸を減らす。
- **Don't** Mincho を本文で使わない。可読性を犠牲にする。
- **Don't** 1画面に Primary ボタンを 3 つ以上置かない。意思決定が拡散する。
- **Don't** 英語UI文言を画面に出さない（"Loading..." → "読み込み中..."）。アクセントとしての英大文字キャプション（"WEDDING PLANNER"）は例外。
- **Don't** 角丸とシャープな角を同一ビューで混在させない。
- **Don't** WCAG AA（4.5:1）を下回るコントラストにしない。`tertiary-50` の上に白テキストを置くのは禁止。

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-01 | DESIGN.md を新規作成（google-labs-code/design.md alpha 仕様準拠）| 既存の `docs/design.md` を機械可読なデザイントークン形式に昇格。Tailwind 設定と単一ソース化。 |
| 2026-05-01 | プライマリを #4A7C59 → #2F5A40 (primary-70) に深化 | より格式のある印象に。tertiary-50 (gold) との対比を強める。 |
| 2026-05-01 | タイポグラフィに Shippori Mincho を追加 | 慶事らしい和の格式を、装飾語（数字・お名前）に限定して付与する。 |
| 2026-05-01 | 角丸を階層化（4/10/14/20）| 同サイズの混在によるノイズ感を排除。 |
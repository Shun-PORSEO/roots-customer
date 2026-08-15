"use client";

import Link from "next/link";

/* ──────────────────────────────────────────────────────────
   Reusable presentation primitives — kept inline to make this
   page self-contained and easy to edit copy in one place.
   ────────────────────────────────────────────────────────── */

function PageHeader() {
  return (
    <div className="mb-8">
      <p
        className="text-[11px] font-bold tracking-[0.2em] uppercase mb-1"
        style={{ color: "var(--colorPrimary)" }}
      >
        Help & Guide
      </p>
      <h2
        className="text-2xl font-bold mb-2"
        style={{ color: "var(--colorText)" }}
      >
        使い方ガイド
      </h2>
      <p className="text-[13px] text-gray-500 leading-relaxed max-w-2xl">
        各タブの役割と具体的な操作手順、運用ルール、よくある質問をまとめました。
        左の目次から目的の章にジャンプできます。
      </p>
    </div>
  );
}

const TOC: { id: string; emoji: string; label: string }[] = [
  { id: "overview", emoji: "🎯", label: "このアプリは何をするもの？" },
  { id: "couples", emoji: "💍", label: "💍 お客様タブの使い方" },
  { id: "venues", emoji: "🏛", label: "🏛 式場タブの使い方" },
  { id: "tasks", emoji: "📋", label: "📋 タスク雛形タブの使い方" },
  { id: "messages", emoji: "💬", label: "💬 配信ログタブの使い方" },
  { id: "rules", emoji: "📐", label: "運用ルール（停止 / 編集の順序）" },
  { id: "faq", emoji: "🆘", label: "よくある質問・困ったときは" },
];

function TocSidebar() {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div
        className="bg-white border rounded-xl p-4"
        style={{ borderColor: "#E5E7EB" }}
      >
        <p
          className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-3 px-2"
        >
          目次
        </p>
        <nav>
          <ul className="flex flex-col gap-0.5">
            {TOC.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <span className="w-4 text-center text-[11px]">{t.emoji}</span>
                  {t.label.replace(/^[^ ]+ /, "")}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

function Section({
  id,
  emoji,
  title,
  subtitle,
  children,
}: {
  id: string;
  emoji: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <header className="mb-4 pb-3 border-b" style={{ borderColor: "#E5E7EB" }}>
        <h3
          className="text-xl font-bold flex items-center gap-2.5"
          style={{ color: "var(--colorText)" }}
        >
          <span className="text-2xl leading-none">{emoji}</span>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[12px] text-gray-500 mt-1.5 pl-9">{subtitle}</p>
        )}
      </header>
      <div className="prose-roots text-[13.5px] leading-7 text-gray-700">
        {children}
      </div>
    </section>
  );
}

function Card({
  variant = "default",
  children,
  title,
}: {
  variant?: "default" | "tip" | "warn" | "info";
  title?: string;
  children: React.ReactNode;
}) {
  const palette = {
    default: { bg: "white", border: "#E5E7EB", color: "var(--colorText)" },
    tip: { bg: "#F0F9F2", border: "#BBE3C5", color: "#2E7D32" },
    warn: { bg: "#FEF3C7", border: "#FCD34D", color: "#92400E" },
    info: {
      bg: "var(--colorSecondary)",
      border: "var(--colorBorder)",
      color: "var(--colorPrimary)",
    },
  }[variant];

  return (
    <div
      className="rounded-lg p-4 my-3"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
      }}
    >
      {title && (
        <p
          className="text-[12px] font-bold mb-1.5 tracking-wide"
          style={{ color: palette.color }}
        >
          {title}
        </p>
      )}
      <div className="text-[13px] leading-7" style={{ color: palette.color }}>
        {children}
      </div>
    </div>
  );
}

function Steps({ items }: { items: { title: string; body?: React.ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-2 my-3">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex gap-3 p-3 rounded-lg border bg-white"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-[12px]"
            style={{ background: "var(--colorPrimary)" }}
          >
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-bold text-[13.5px] mb-1"
              style={{ color: "var(--colorText)" }}
            >
              {it.title}
            </p>
            {it.body && (
              <div className="text-[13px] text-gray-600 leading-relaxed">
                {it.body}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Highlight a UI element name as it appears in the actual product. */
function UI({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[11.5px] font-bold mx-0.5"
      style={{
        background: "var(--colorSecondary)",
        color: "var(--colorPrimary)",
      }}
    >
      {children}
    </span>
  );
}

/** Highlight a key term inline. */
function K({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-bold" style={{ color: "var(--colorText)" }}>
      {children}
    </strong>
  );
}

function MessagePreview({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 flex items-end gap-2">
      <div
        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-[14px]"
        style={{
          background:
            "linear-gradient(135deg, var(--colorPrimary), var(--colorAccent))",
        }}
      >
        R
      </div>
      <div
        className="rounded-2xl rounded-bl-md px-4 py-3 text-[13px] leading-relaxed max-w-md whitespace-pre-wrap"
        style={{ background: "#E8F5E9", color: "#1B5E20" }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────  PAGE  ───────────────────── */

export default function HelpPage() {
  return (
    <div className="pb-24">
      <PageHeader />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <TocSidebar />

        <div className="flex flex-col gap-10 min-w-0">
          {/* Overview */}
          <Section
            id="overview"
            emoji="🎯"
            title="このアプリは何をするもの？"
            subtitle="スプレッドシートを直接触らなくても、必要な編集がここで完結します。"
          >
            <p>
              Roots AI Planner Dashboard は、ウェディング式場のプランナーが運営に必要なデータを
              <K>1 つの画面から編集</K>するための管理ツールです。スプレッドシートを開く必要はありません。
            </p>
            <p>
              編集対象は <K>式場 / お客様 / タスク雛形 / 配信ログ</K> の 4 つ。それぞれ左サイドバーのタブに対応しています。
            </p>
            <Card variant="tip" title="運営は止まりません">
              毎朝 9 時の自動リマインド配信は <K>裏で勝手に動いています</K>。
              この画面で何も触らない日でも配信は届きます。だから完璧に整えてから稼働するのではなく、
              使いながら 1 つずつ整えていくスタイルでOKです。
            </Card>
          </Section>

          {/* お客様 */}
          <Section
            id="couples"
            emoji="💍"
            title="お客様タブの使い方"
            subtitle="登録されているカップル一覧 + 個別のタスク管理"
          >
            <p>
              <UI>💍 お客様</UI> はトップ画面でもあります。登録カップルの一覧と全体の進捗が一目で見えます。
            </p>

            <h4 className="font-bold mt-5 mb-2">この画面でできること</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>登録ペア数・平均完了率などの<K>サマリ 4 枚</K>を一覧</li>
              <li>
                <K>フィルタ</K>: すべて / 挙式予定 / 挙式済 で絞り込み
              </li>
              <li>
                <K>並び順</K>: 挙式日 ↔ 進捗 で切替
              </li>
              <li>カップル名・LINE ID で<K>検索</K></li>
              <li>
                行をクリック → そのカップルの<K>個別タスク管理画面</K>へ
              </li>
            </ul>

            <h4 className="font-bold mt-5 mb-2">個別タスク管理画面（行クリック後）</h4>
            <p>選んだカップル1組に対して以下ができます:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>そのカップルだけに見せる<K>個別タスクを追加</K>（例: リングドッグの手配）</li>
              <li>共通タスクのうち<K>このカップルには表示しない</K>もののトグル</li>
              <li>
                各タスクを開いて<K>手配物（発注するもの）を登録</K> — 名前と数量だけで OK。完了したらチェック
              </li>
            </ul>
            <Card variant="info">
              <K>個別タスクの追加</K>は、相手によって違う依頼事項を出したいときに使います。
              全式場・全カップル共通の編集は <UI>📋 タスク雛形</UI> 側でやります。
            </Card>

            <h4 className="font-bold mt-5 mb-2">タスクの下に手配物（発注リスト）</h4>
            <p>
              各タスクの行をクリックして開くと、そのタスクで<K>発注しなければならない物</K>を 1 件ずつ登録できます。
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>例: 「ドレス試着」を開く → 「メインドレス × 1」「お色直し用 × 1」「小物セット × 1」を追加</li>
              <li>例: 「招待状の準備」を開く → 「招待状 × 60」「席次表 × 60」を追加</li>
              <li>
                数量は「ー / ＋」で調整。<K>完了したらチェック</K>で線が引かれます
              </li>
              <li>
                タスク行の右側に<K>「🛍 N / M」</K>のように進捗が表示されます
              </li>
            </ul>
            <Card variant="tip">
              金額や業者の入力欄はあえて省いています。「発注しなきゃいけないものを忘れない」だけが目的。
              詳細メモが必要なら個別タスク自体の<K>メモ欄</K>に書いておくのが楽です。
            </Card>
          </Section>

          {/* 式場 */}
          <Section
            id="venues"
            emoji="🏛"
            title="式場タブの使い方"
            subtitle="新式場を立ち上げる / 既存式場の情報を編集する"
          >
            <h4 className="font-bold mb-2">新式場を 1 件追加する手順</h4>
            <Steps
              items={[
                {
                  title: "右上の「＋ 新しい式場」を押す",
                  body: "ダイアログが開きます。",
                },
                {
                  title: "式場名を入力する",
                  body: (
                    <>
                      例: <K>ヒルトン札幌</K>。
                      ID（RC003 など）は<K>自動で割り当て</K>られます。
                      LIFF ID やプランナー LINE ID は<K>後からでも入れられます</K>。
                    </>
                  ),
                },
                {
                  title: "「追加する」を押す",
                  body: (
                    <>
                      → <K>共通の 16 タスクが自動でコピー</K>されます。
                      → 翌朝 9 時から自動配信が開始されます。
                    </>
                  ),
                },
                {
                  title: "（任意）案内文をあとから整える",
                  body: (
                    <>
                      <UI>📋 タスク雛形</UI> → 上部の<K>式場タブ</K>で追加した式場を選択 → 各タスクの本文を 1 件ずつ書き換え。
                      空欄でも fallback で配信は動きます（後述）。
                    </>
                  ),
                },
              ]}
            />

            <h4 className="font-bold mt-5 mb-2">既存式場の編集</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <UI>編集</UI> ボタン → 式場名 / プランナー LINE ID / LIFF ID を更新
              </li>
              <li>
                <UI>📋 タスクを見る</UI> →
                その式場のタスク雛形を直接編集する画面へジャンプ
              </li>
              <li>
                <UI>停止</UI> → 配信から除外（削除ではなく停止）
              </li>
            </ul>
          </Section>

          {/* タスク雛形 */}
          <Section
            id="tasks"
            emoji="📋"
            title="タスク雛形タブの使い方"
            subtitle="リマインド本文・期限・マニュアル URL を整える、編集の主戦場"
          >
            <Card variant="info" title="ここが一番触る場所">
              タスク雛形 = カップルに送る<K>リマインド本文の元データ</K>です。
              ここの本文を書き換えると、翌朝の配信から反映されます。
            </Card>

            <h4 className="font-bold mt-5 mb-2">画面の見方</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                上部の<K>式場タブ</K>で「base（共通雛形）」または各式場を選ぶ
              </li>
              <li>左: タスクの一覧 / 右: 選択中のタスクの編集パネル</li>
              <li>
                <UI>🔍 リマインド未設定</UI> フィルタで、本文が空のものだけ絞れる
              </li>
            </ul>

            <h4 className="font-bold mt-5 mb-2">1 つ書き換えるフロー（5 秒）</h4>
            <Steps
              items={[
                {
                  title: "左のタスク一覧から 1 つクリック",
                  body: "右側に編集パネルが開きます。",
                },
                {
                  title: "右パネルで「リマインド本文」を編集",
                  body: (
                    <>
                      日時の自動挿入は不要です。タスク名は枠の上部に表示されるので、本文は
                      <K>「これをやってください」</K>だけ書けば伝わります。
                    </>
                  ),
                },
                {
                  title: "「💾 保存」",
                  body: "翌朝 9 時の配信から反映されます。",
                },
              ]}
            />

            <h4 className="font-bold mt-5 mb-2">「マニュアル不要モード」とは</h4>
            <p>
              リマインド本文を<K>空欄のままにしておいても</K>、配信は止まりません。代わりに自動で次のような汎用文が届きます:
            </p>
            <MessagePreview>
              {`【あと 3 日です】あやか＆ひでき様

「ドレス試着のご案内」のご案内です。
お手隙の際にご確認・ご対応をお願いいたします🙇

📋 メニューからタスク管理表をご確認いただけます。`}
            </MessagePreview>
            <Card variant="tip">
              つまり、立ち上げ時に <K>16 タスク全部の本文を書く必要はありません</K>。
              気が向いたタスクから 1 つずつ書き換える、で運用が回ります。
            </Card>

            <h4 className="font-bold mt-5 mb-2">base 雛形と式場別の 2 層構造</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <K>base（共通雛形）</K> — 新式場立ち上げ時に
                <K>自動コピー元</K>になる雛形。ここを直すと既存式場には影響しないが、新規追加した式場には反映される
              </li>
              <li>
                <K>式場別タスク</K> — 各式場用に独立したコピー。ここを書き換えても他式場には影響しない
              </li>
            </ul>

            <h4 className="font-bold mt-5 mb-2">タスクの追加 / 停止</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                右上 <UI>＋ タスクを追加</UI> — 選択中の式場（または base）に新規タスクを追加
              </li>
              <li>
                編集パネル下部の<UI>🚫 このタスクを停止する</UI> —
                配信から外す（履歴は残る）
              </li>
            </ul>
          </Section>

          {/* 配信ログ */}
          <Section
            id="messages"
            emoji="💬"
            title="配信ログタブの使い方"
            subtitle="今朝・過去に実際に LINE に届いた本文を確認できる"
          >
            <p>
              <K>configure ではなく audit のための画面</K>です。「ちゃんと送られたか」「何が送られたか」を見るとき用。
            </p>

            <h4 className="font-bold mt-5 mb-2">画面の見方</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                上部のサマリ: 今日の配信件数 / 表示中合計 / 期限切れまとめ件数
              </li>
              <li>
                <K>式場フィルタ</K>で式場ごとに絞れる
              </li>
              <li>本文・task_id・カップル ID で<K>検索</K></li>
              <li>
                行をクリック → 右側パネルで<K>本文全体</K>を確認
              </li>
            </ul>

            <Card variant="info">
              「期限切れまとめ」は、複数の期限切れタスクを 1 通にまとめて送った印です（毎朝 9 時の配信ルール）。
            </Card>
          </Section>

          {/* 運用ルール */}
          <Section
            id="rules"
            emoji="📐"
            title="運用ルール"
            subtitle="覚えておくとずれない原則"
          >
            <h4 className="font-bold mb-2">削除より「停止」を使う</h4>
            <p>
              不要になった式場・タスクは、消すのではなく<UI>停止</UI>します。
              履歴を残せるので<K>後で気が変わったときに復元</K>できます。
            </p>

            <h4 className="font-bold mt-5 mb-2">最初に全部完璧に揃えない</h4>
            <p>
              立ち上げ時にやるのは「式場を追加」「最低限の名前を入れる」だけで OK。
              リマインド本文は<K>使いながら 1 つずつ整える</K>のが推奨です。
            </p>

            <h4 className="font-bold mt-5 mb-2">変更は翌朝の配信に反映</h4>
            <p>
              本文を編集して保存しても、すぐに既存のお客様に再配信されるわけではありません。
              <K>翌朝 9 時の配信から反映</K>されます。
            </p>
          </Section>

          {/* FAQ */}
          <Section
            id="faq"
            emoji="🆘"
            title="よくある質問・困ったときは"
          >
            <h4 className="font-bold mb-2">Q. 配信が止まることはありますか？</h4>
            <p>
              次のいずれかに該当すると配信されません。
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>式場が<K>停止中</K></li>
              <li>タスクが<K>停止中</K></li>
              <li>当日中に同じカップル × 同じタスクに既に送ったことがある（重複防止）</li>
            </ul>

            <h4 className="font-bold mt-5 mb-2">Q. 文面を間違えて送ってしまった</h4>
            <p>
              タスク雛形で本文を書き直してください。翌朝の配信から訂正版になります。
              すでに届いた誤った文面は LINE 側の仕様で取り消せませんが、訂正配信は次タイミングで自動的に行われます。
            </p>

            <h4 className="font-bold mt-5 mb-2">Q. 配信時刻を変えたい</h4>
            <p>
              現在は<K>毎朝 9:00 (Asia/Tokyo) 固定</K>です。変更したい場合は shun に連絡してください。
            </p>

            <h4 className="font-bold mt-5 mb-2">Q. 動かない・おかしい</h4>
            <p>
              まず <UI>💬 配信ログ</UI> で実際に何が送られているか確認 → それでも分からなければ shun に
              <K>「今日の配信ログを見てください」</K>と LINE で連絡。
            </p>

            <div className="mt-8">
              <Link
                href="/admin"
                className="text-[12px] font-bold"
                style={{ color: "var(--colorPrimary)" }}
              >
                ← ダッシュボードに戻る
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

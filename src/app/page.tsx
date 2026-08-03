import type { Metadata } from "next";
import Link from "next/link";
import { PRICING, formatJpy } from "@/lib/pricing";
import { LegacyLiffRedirect } from "@/components/lp/LegacyLiffRedirect";

// 式場向けLP（SaaS化 C6）。認証不要の公開ページ。
// 旧LIFF入口（ユーザー存在チェック→振り分け）は /liff へ移設済み。
// 旧LIFF設定が / を指したまま開かれた場合は LegacyLiffRedirect が /liff へ逃がす。

export const metadata: Metadata = {
  title: "Roots AI Planner | 式場向け 結婚式準備のLINE伴走ツール",
  description:
    "カップルの結婚式準備タスクをLINEで自動フォロー。毎朝の自動リマインドとAIメッセージ生成で、プランナーの進行管理を軽くする式場向けSaaSです。14日間無料トライアル。",
};

const FEATURES = [
  {
    title: "カップルはLINEだけで完結",
    body: "アプリのインストールは不要。式場の公式LINEからミニアプリを開き、準備タスクの確認・完了チェック・コメントまでLINEの中で済みます。",
  },
  {
    title: "毎朝9時の自動リマインド",
    body: "挙式日から逆算した期日どおりに、その日フォローすべきカップルへ自動で配信。管理画面を開かない日でも進行は止まりません。",
  },
  {
    title: "AIがメッセージを下書き",
    body: "リマインド文面はAIがカップルごとに自動生成。プランナーは確認して送るだけ。定型文の使い回しから卒業できます。",
  },
  {
    title: "プランナー向けダッシュボード",
    body: "カップルごとの進捗率・滞りタスク・コメントを1画面で把握。検索・絞り込みで「今日連絡すべき組」がすぐ見つかります。",
  },
  {
    title: "タスク雛形で運用を標準化",
    body: "式場共通のタスク雛形をもとに、カップルごとの追加・非表示も自由。会場ごとの進行の違いにも対応できます。",
  },
  {
    title: "自分たちだけで導入完了",
    body: "4ステップのオンボーディングとスクショ付きマニュアルを用意。LINE公式アカウントの接続テストが全部緑になれば運用開始です。",
  },
] as const;

const STEPS = [
  { title: "アカウント登録", body: "会社名とメールアドレスだけで登録。その日から使えます。" },
  { title: "LINE公式アカウントを接続", body: "スクショ付きマニュアルに沿ってキーを入力するだけ。" },
  { title: "接続テスト", body: "ワンクリックで全項目を自動チェック。全部緑になれば準備完了。" },
  { title: "カップルを招待", body: "QRコードを案内するだけで、カップルのLINEに準備タスクが届きます。" },
] as const;

const FAQS = [
  {
    q: "LINE公式アカウントが必要ですか？",
    a: "はい。式場（会場）ごとのLINE公式アカウントを利用します。お持ちでない場合も、オンボーディングのスクショ付きマニュアルに沿って無料で作成できます。",
  },
  {
    q: "導入にどのくらいかかりますか？",
    a: "アカウント登録からカップル招待まで、LINE公式アカウントの設定を含めて最短1時間程度です。専任のエンジニアは不要で、接続テストが全部緑になれば運用を開始できます。",
  },
  {
    q: "カップルの組数やタスク数に上限はありますか？",
    a: `ありません。1プランで組数・タスク数とも無制限にご利用いただけます（月額 ${formatJpy(PRICING.monthlyPriceJpy)}円・${PRICING.priceNote}）。`,
  },
  {
    q: "無料トライアル終了後はどうなりますか？",
    a: `${PRICING.trialDays}日間のトライアル終了前にお支払い方法の登録をご案内します。登録がない場合も、データは保持したまま管理画面の利用のみ一時停止となります。`,
  },
  {
    q: "カップル側に費用や登録の手間はありますか？",
    a: "ありません。カップルは式場の公式LINEを友だち追加して、お名前と挙式日を入力するだけです。費用は式場側の月額のみです。",
  },
  {
    q: "他の式場からデータが見えてしまうことはありませんか？",
    a: "ありません。データベースの行レベルセキュリティ（RLS）でテナントごとに完全に分離しており、他社・他式場のデータには一切アクセスできない設計です。",
  },
] as const;

function CtaButton({ className = "" }: { className?: string }) {
  return (
    <Link href="/signup" className={`btn-primary ${className}`}>
      無料で{PRICING.trialDays}日間ためす
    </Link>
  );
}

function Logo() {
  return (
    <span className="inline-flex items-center gap-xs">
      <span
        className="w-9 h-9 rounded-md flex items-center justify-center text-white font-bold text-lg shrink-0"
        style={{ background: "linear-gradient(135deg, var(--cp), var(--ca))" }}
      >
        R
      </span>
      <span className="font-bold text-on-surface">Roots AI Planner</span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <LegacyLiffRedirect />

      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-10 bg-surface-page/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-md md:px-xl h-16 flex items-center justify-between gap-md">
          <Logo />
          <nav className="hidden md:flex items-center gap-lg text-body-md text-neutral-30">
            <a href="#features" className="hover:text-primary-70">機能</a>
            <a href="#pricing" className="hover:text-primary-70">料金</a>
            <a href="#faq" className="hover:text-primary-70">よくある質問</a>
          </nav>
          <div className="flex items-center gap-sm shrink-0">
            <Link href="/login" className="text-body-md font-semibold text-primary-70 px-sm py-xs hover:underline">
              ログイン
            </Link>
            <Link href="/signup" className="btn-primary hidden sm:inline-flex !py-2.5">
              無料ではじめる
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── ヒーロー ── */}
        <section className="max-w-5xl mx-auto px-md md:px-xl pt-3xl pb-2xl md:pt-4xl md:pb-3xl text-center">
          <p className="text-label-caps text-tertiary-70">FOR WEDDING VENUES</p>
          <h1 className="font-display text-display-lg md:text-[40px] md:leading-[1.35] text-on-surface mt-sm text-balance">
            結婚式の準備を、
            <br className="md:hidden" />
            カップルのLINEで伴走する。
          </h1>
          <p className="text-body-lg text-neutral-50 mt-md max-w-2xl mx-auto leading-relaxed">
            Roots AI Planner は式場のための進行管理ツールです。準備タスクをカップルのLINEに届け、
            毎朝の自動リマインドとAIメッセージ生成で、プランナーの「追いかける仕事」を減らします。
          </p>
          <div className="mt-xl flex flex-col sm:flex-row items-center justify-center gap-sm">
            <CtaButton className="w-full sm:w-auto md:px-2xl" />
            <a href="#pricing" className="btn-secondary w-full sm:w-auto md:px-xl">
              料金を見る
            </a>
          </div>
          <p className="text-body-sm text-neutral-50 mt-sm">
            {PRICING.trialDays}日間無料・クレジットカード登録なしで開始できます
          </p>
        </section>

        {/* ── 課題 ── */}
        <section className="bg-white border-y border-border">
          <div className="max-w-5xl mx-auto px-md md:px-xl py-2xl md:py-3xl">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-display text-display-md text-on-surface">
                「あのカップル、いま何が止まってる？」
              </h2>
              <p className="text-body-md text-neutral-50 mt-md leading-relaxed">
                紙のしおりやスプレッドシートでの進行管理は、確認と催促の連絡だけで1日が終わりがちです。
                カップルからの「次は何をすればいいですか？」に、システムが先回りして答える状態をつくります。
              </p>
            </div>
          </div>
        </section>

        {/* ── 機能 ── */}
        <section id="features" className="max-w-5xl mx-auto px-md md:px-xl py-2xl md:py-3xl scroll-mt-16">
          <div className="text-center">
            <p className="text-label-caps text-tertiary-70">FEATURES</p>
            <h2 className="font-display text-display-md text-on-surface mt-2xs">
              式場の進行管理を軽くする6つの機能
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-md mt-xl">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="card-base p-lg">
                <p className="chip-category">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="text-headline-sm font-semibold text-on-surface mt-sm">{f.title}</h3>
                <p className="text-body-md text-neutral-50 mt-xs leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 導入の流れ ── */}
        <section className="bg-white border-y border-border">
          <div className="max-w-5xl mx-auto px-md md:px-xl py-2xl md:py-3xl">
            <div className="text-center">
              <p className="text-label-caps text-tertiary-70">HOW IT WORKS</p>
              <h2 className="font-display text-display-md text-on-surface mt-2xs">
                導入は4ステップ、自分たちだけで完了
              </h2>
            </div>
            <ol className="grid md:grid-cols-4 gap-md mt-xl">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-lg border border-primary-20 bg-primary-5 p-lg">
                  <p className="font-display text-display-md text-primary-70">{i + 1}</p>
                  <h3 className="text-body-lg font-semibold text-on-surface mt-xs">{s.title}</h3>
                  <p className="text-body-sm text-neutral-50 mt-2xs leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 料金 ── */}
        <section id="pricing" className="max-w-5xl mx-auto px-md md:px-xl py-2xl md:py-3xl scroll-mt-16">
          <div className="text-center">
            <p className="text-label-caps text-tertiary-70">PRICING</p>
            <h2 className="font-display text-display-md text-on-surface mt-2xs">
              迷わないシンプルな料金
            </h2>
          </div>
          <div className="card-base p-xl max-w-md mx-auto mt-xl text-center">
            <p className="text-label-caps text-tertiary-70">PLAN</p>
            <p className="font-display text-on-surface mt-xs">
              <span className="text-numeric-display">{formatJpy(PRICING.monthlyPriceJpy)}</span>
              <span className="text-body-lg text-neutral-50">円 / 月（{PRICING.priceNote}）</span>
            </p>
            <ul className="text-body-md text-on-surface mt-md flex flex-col gap-xs text-left max-w-xs mx-auto">
              <li className="flex gap-xs">
                <span className="text-success shrink-0" aria-hidden="true">✓</span>
                {PRICING.trialDays}日間の無料トライアル
              </li>
              {PRICING.features.map((f) => (
                <li key={f} className="flex gap-xs">
                  <span className="text-success shrink-0" aria-hidden="true">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <CtaButton className="w-full mt-lg" />
            <p className="text-body-sm text-neutral-50 mt-sm">
              トライアル中の解約に費用はかかりません
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="bg-white border-y border-border scroll-mt-16">
          <div className="max-w-3xl mx-auto px-md md:px-xl py-2xl md:py-3xl">
            <div className="text-center">
              <p className="text-label-caps text-tertiary-70">FAQ</p>
              <h2 className="font-display text-display-md text-on-surface mt-2xs">よくある質問</h2>
            </div>
            <div className="mt-xl flex flex-col gap-sm">
              {FAQS.map((item) => (
                <details key={item.q} className="card-base group">
                  <summary className="cursor-pointer list-none p-lg flex items-center justify-between gap-sm">
                    <span className="text-body-lg font-semibold text-on-surface">{item.q}</span>
                    <span
                      className="text-primary-70 shrink-0 transition-transform group-open:rotate-45 text-xl leading-none"
                      aria-hidden="true"
                    >
                      ＋
                    </span>
                  </summary>
                  <p className="text-body-md text-neutral-50 leading-relaxed px-lg pb-lg">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 最終CTA ── */}
        <section className="max-w-5xl mx-auto px-md md:px-xl py-3xl text-center">
          <h2 className="font-display text-display-md md:text-display-lg text-on-surface text-balance">
            次の見学会シーズンの前に、
            <br className="md:hidden" />
            進行管理を仕組みにしませんか。
          </h2>
          <p className="text-body-md text-neutral-50 mt-sm">
            登録は1分。{PRICING.trialDays}日間、すべての機能を無料で試せます。
          </p>
          <div className="mt-lg flex justify-center">
            <CtaButton className="md:px-2xl" />
          </div>
        </section>
      </main>

      {/* ── フッター ── */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-md md:px-xl py-xl flex flex-col md:flex-row items-center justify-between gap-md">
          <Logo />
          <nav className="flex items-center gap-lg text-body-sm text-neutral-50">
            <a href="#features" className="hover:text-primary-70">機能</a>
            <a href="#pricing" className="hover:text-primary-70">料金</a>
            <a href="#faq" className="hover:text-primary-70">よくある質問</a>
            <Link href="/login" className="hover:text-primary-70">ログイン</Link>
          </nav>
          <p className="text-body-sm text-neutral-50">© Roots AI Planner</p>
        </div>
      </footer>
    </div>
  );
}

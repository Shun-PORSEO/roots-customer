"use client";

import { useState } from "react";

// LINE 公式アカウント作成〜キー4点取得のステップバイステップマニュアル（SaaS化 C3）。
// 画面イメージは LINE Developers の実スクショではなく模式図（コンポーネント描画）。
// 実スクショ撮影後は各 ConsoleFigure を <img> に差し替えるだけでよい構造にしてある。

type FigureRow = {
  label: string;
  value: string;
  highlight?: boolean; // コピー対象（枠を強調して「これをコピー」と示す）
  toggle?: "on" | "off";
};

function ConsoleFigure({
  app,
  tabs,
  activeTab,
  rows,
}: {
  app: string; // 画面上部に出すサービス名（LINE Developers など）
  tabs?: string[];
  activeTab?: string;
  rows: FigureRow[];
}) {
  return (
    <figure className="my-sm">
      <div className="rounded-lg border border-border overflow-hidden bg-white shadow-sm">
        {/* ブラウザ風タイトルバー */}
        <div className="flex items-center gap-2 px-sm py-2 bg-neutral-95 border-b border-border">
          <span className="flex gap-1" aria-hidden="true">
            <i className="w-2.5 h-2.5 rounded-full bg-neutral-80 block" />
            <i className="w-2.5 h-2.5 rounded-full bg-neutral-80 block" />
            <i className="w-2.5 h-2.5 rounded-full bg-neutral-80 block" />
          </span>
          <span className="text-body-sm text-neutral-50 truncate">{app}</span>
        </div>
        {/* タブバー */}
        {tabs && tabs.length > 0 ? (
          <div className="flex gap-0.5 px-sm pt-2 bg-white border-b border-border overflow-x-auto">
            {tabs.map((t) => (
              <span
                key={t}
                className={[
                  "px-sm py-1.5 text-body-sm rounded-t-md border-b-2 whitespace-nowrap",
                  t === activeTab
                    ? "border-primary-70 text-primary-70 font-bold bg-primary-5"
                    : "border-transparent text-neutral-50",
                ].join(" ")}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {/* フィールド行 */}
        <div className="p-sm flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className={[
                "flex items-center gap-sm rounded-md px-sm py-2 text-body-sm",
                r.highlight
                  ? "border-2 border-primary-70 bg-primary-5"
                  : "border border-border bg-neutral-98",
              ].join(" ")}
            >
              <span className="text-neutral-50 w-40 shrink-0 truncate">{r.label}</span>
              {r.toggle ? (
                <span
                  className={[
                    "text-[11px] font-bold px-2 py-0.5 rounded-full",
                    r.toggle === "on"
                      ? "bg-success/15 text-success"
                      : "bg-neutral-90 text-neutral-50",
                  ].join(" ")}
                >
                  {r.toggle === "on" ? "オン" : "オフ"}
                </span>
              ) : (
                <span className="font-mono text-on-surface truncate flex-1">{r.value}</span>
              )}
              {r.highlight ? (
                <span className="text-[11px] font-bold text-primary-70 shrink-0">
                  ← これをコピー
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="text-body-sm text-neutral-50 mt-2xs">
        ※ 画面イメージ（模式図）。実際の画面と文言・並びが多少異なる場合があります。
      </figcaption>
    </figure>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-primary-20 bg-primary-5 p-sm my-sm">
      <p className="text-body-sm font-bold text-primary-80 mb-2xs">{label}</p>
      <div className="flex items-center gap-xs flex-wrap">
        <code className="font-mono text-body-sm text-on-surface break-all flex-1 min-w-[200px]">
          {value}
        </code>
        <button
          type="button"
          className="btn-secondary !py-1.5 !px-3 text-body-sm shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard 不可の環境では手動コピーしてもらう */
            }
          }}
        >
          {copied ? "コピー済み✓" : "コピー"}
        </button>
      </div>
    </div>
  );
}

type ManualSection = {
  title: string;
  body: React.ReactNode;
};

export function LineSetupManual({
  webhookUrl,
  liffEndpointUrl,
}: {
  webhookUrl: string;
  liffEndpointUrl: string;
}) {
  const [open, setOpen] = useState(0);

  const sections: ManualSection[] = [
    {
      title: "LINE公式アカウントを作成する",
      body: (
        <>
          <p>
            <a
              href="https://entry.line.biz/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary-70 font-bold"
            >
              LINE公式アカウントの開設ページ
            </a>
            から、式場のビジネス用 LINE アカウントを無料で作成します（すでにお持ちの場合はこのステップは不要です）。
          </p>
          <ol className="list-decimal pl-lg flex flex-col gap-2xs mt-xs">
            <li>「アカウントを作成」からメールアドレスまたは LINE アカウントで登録</li>
            <li>アカウント名（式場名）・業種（ブライダル）などを入力して開設</li>
            <li>
              開設後、
              <a
                href="https://manager.line.biz/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary-70 font-bold"
              >
                LINE Official Account Manager
              </a>
              にログインできることを確認
            </li>
          </ol>
        </>
      ),
    },
    {
      title: "Messaging API を有効化する",
      body: (
        <>
          <p>
            LINE Official Account Manager の<b>「設定」→「Messaging API」</b>
            で「Messaging APIを利用する」を押します。プロバイダー（開発者名義。式場運営会社名でOK）を新規作成して進めると、
            <b>LINE Developers</b> に Messaging API チャネルが自動で作成されます。
          </p>
          <ConsoleFigure
            app="LINE Official Account Manager — 設定"
            tabs={["アカウント設定", "応答設定", "Messaging API"]}
            activeTab="Messaging API"
            rows={[
              { label: "ステータス", value: "未利用 → 「Messaging APIを利用する」を押す", highlight: true },
              { label: "プロバイダー", value: "（式場運営会社名で新規作成）" },
            ]}
          />
          <p>
            以降のキーのコピーは
            <a
              href="https://developers.line.biz/console/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary-70 font-bold"
            >
              LINE Developers コンソール
            </a>
            で行います。
          </p>
        </>
      ),
    },
    {
      title: "チャネルシークレットを取得する",
      body: (
        <>
          <p>
            LINE Developers コンソールで先ほどの <b>Messaging API チャネル</b>を開き、
            <b>「チャネル基本設定」タブ</b>の「チャネルシークレット」をコピーします。
          </p>
          <ConsoleFigure
            app="LINE Developers — Messaging APIチャネル"
            tabs={["チャネル基本設定", "Messaging API設定", "セキュリティ"]}
            activeTab="チャネル基本設定"
            rows={[
              { label: "チャネルID", value: "1234567890" },
              { label: "チャネルシークレット", value: "d41d8cd98f00b204e980…", highlight: true },
            ]}
          />
        </>
      ),
    },
    {
      title: "チャネルアクセストークンを発行する",
      body: (
        <>
          <p>
            同じチャネルの<b>「Messaging API設定」タブ</b>の一番下、「チャネルアクセストークン（長期）」の
            <b>「発行」</b>を押してコピーします。
          </p>
          <ConsoleFigure
            app="LINE Developers — Messaging APIチャネル"
            tabs={["チャネル基本設定", "Messaging API設定", "セキュリティ"]}
            activeTab="Messaging API設定"
            rows={[
              { label: "Bot情報", value: "@your-venue（ベーシックID）" },
              { label: "チャネルアクセストークン（長期）", value: "「発行」→ 表示された文字列", highlight: true },
            ]}
          />
        </>
      ),
    },
    {
      title: "Webhook URL を設定し、応答メッセージをオフにする",
      body: (
        <>
          <p>
            同じ<b>「Messaging API設定」タブ</b>で Webhook を設定します。この式場専用の Webhook URL は以下です。
          </p>
          <CopyField label="この式場の Webhook URL" value={webhookUrl} />
          <ol className="list-decimal pl-lg flex flex-col gap-2xs">
            <li>「Webhook URL」に上の URL を貼り付けて「更新」</li>
            <li>「Webhookの利用」を<b>オン</b>にする</li>
            <li>
              「応答メッセージ」は<b>オフ</b>にする（オンのままだとカップルへの自動応答が二重になります。リンク先の
              LINE Official Account Manager の応答設定画面で変更）
            </li>
          </ol>
          <ConsoleFigure
            app="LINE Developers — Messaging API設定"
            tabs={["チャネル基本設定", "Messaging API設定"]}
            activeTab="Messaging API設定"
            rows={[
              { label: "Webhook URL", value: webhookUrl, highlight: true },
              { label: "Webhookの利用", value: "", toggle: "on" },
              { label: "応答メッセージ", value: "", toggle: "off" },
            ]}
          />
        </>
      ),
    },
    {
      title: "LINE Login チャネルと LIFF アプリを作成する",
      body: (
        <>
          <p>
            カップルが LINE からアプリを開くための <b>LINE Login チャネル</b>を、
            <b>同じプロバイダー</b>の配下に新規作成します（LINE Developers コンソール → プロバイダー →「新規チャネル作成」→「LINE Login」）。
          </p>
          <ConsoleFigure
            app="LINE Developers — LINE Loginチャネル"
            tabs={["チャネル基本設定", "LIFF"]}
            activeTab="チャネル基本設定"
            rows={[
              { label: "チャネルID", value: "2001234567", highlight: true },
              { label: "チャネルの種類", value: "LINE Login" },
            ]}
          />
          <p>
            「チャネル基本設定」タブの<b>「チャネルID」（数字）</b>が下のフォームの「LINE Login チャネルID」です。続いて
            <b>「LIFF」タブ</b>で「追加」から LIFF アプリを作成します。
          </p>
          <CopyField label="LIFF のエンドポイントURL（作成時に入力）" value={liffEndpointUrl} />
          <ol className="list-decimal pl-lg flex flex-col gap-2xs">
            <li>LIFFアプリ名: 任意（例: 式場名）／サイズ: <b>Full</b></li>
            <li>エンドポイントURL: 上の URL を貼り付け</li>
            <li>Scope: <b>profile</b> と <b>openid</b> にチェック</li>
            <li>作成後に表示される <b>LIFF ID</b>（例: 2001234567-AbcdEfgh）をコピー</li>
          </ol>
          <ConsoleFigure
            app="LINE Developers — LINE Loginチャネル"
            tabs={["チャネル基本設定", "LIFF"]}
            activeTab="LIFF"
            rows={[
              { label: "LIFFアプリ名", value: "式場カップル向けアプリ" },
              { label: "LIFF ID", value: "2001234567-AbcdEfgh", highlight: true },
              { label: "エンドポイントURL", value: liffEndpointUrl },
            ]}
          />
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-xs">
      {sections.map((s, i) => {
        const isOpen = open === i;
        return (
          <div key={s.title} className="card-base overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-sm px-md py-sm text-left"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
            >
              <span
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center text-body-sm font-bold shrink-0",
                  isOpen ? "bg-primary-70 text-white" : "bg-neutral-95 text-neutral-50",
                ].join(" ")}
              >
                {i + 1}
              </span>
              <span className="text-headline-sm text-on-surface flex-1">{s.title}</span>
              <span className="text-neutral-50" aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen ? (
              <div className="px-md pb-md text-body-md text-on-surface leading-relaxed border-t border-border pt-sm">
                {s.body}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

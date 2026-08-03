// 料金表示の単一ソース（SaaS化 C6）。
// LP（src/app/page.tsx）とオンボーディング Step4 の両方がここを参照する。
// 金額・トライアル日数を変えるときはこのファイルだけを更新すればよい。
// 金額は M3 時点の仮値（Stripe 正式導入 = C4 で Price ID と整合させる）。

export const PRICING = {
  /** 月額（税込・円） */
  monthlyPriceJpy: 9_800,
  /** 補足ラベル（税込・プラン数） */
  priceNote: "税込・1プラン",
  /** 無料トライアル日数 */
  trialDays: 14,
  /** プランに含まれるもの（LP 料金セクション / オンボーディング Step4 共通） */
  features: [
    "カップル数・タスク数は無制限",
    "LINE 自動リマインド・AI メッセージ生成つき",
    "プランナー向け管理ダッシュボード",
  ],
} as const;

/** 9800 → "9,800" のような表示用文字列にする */
export function formatJpy(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

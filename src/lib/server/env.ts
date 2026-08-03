import "server-only";
import { z } from "zod";

// local 必須 / prod 必須 を分けて検証（autoplan DX）。
// 欠落時は起動時に「どのキーをどこで取るか」を hint 付きで落とす。
const schema = z.object({
  // app_couple 非特権ロールでの接続文字列（RLS を必ず通す）
  DATABASE_URL_APP_COUPLE: z
    .string()
    .url()
    .describe("postgres://app_couple:...@host:5432/postgres — 非特権ロール接続"),
  // LINE Login チャネル ID のフォールバック（SaaS化 C2 で venue 別
  // venues.line_login_channel_id が正になった。venue 未特定時の後方互換用に optional）
  LINE_LOGIN_CHANNEL_ID: z.string().min(1).optional(),
  // Supabase Auth（テナント管理者のメールログイン）。未設定でもカップル経路は動くため
  // optional にし、管理者認証エンドポイントの利用時に不足を fail-fast で伝える。
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  // セッション Cookie 署名鍵（32byte 以上推奨）
  SESSION_SECRET: z.string().min(32),
  // ─── Stripe 課金（SaaS化 C4）。未設定でも他経路は動く（ローカルトライアル運用）。
  // 3点セットで設定する: Secret Key / Webhook 署名シークレット / 月額プランの Price ID。
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_ID: z.string().min(1).optional(),
  // ─── Vercel Cron（SaaS化 C5）。/api/cron/* の Bearer 認証シークレット。
  CRON_SECRET: z.string().min(1).optional(),
  // ─── AI 生成（SaaS化 C5）。運営者の Claude API キーで全テナント共通提供。
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // 生成モデル（既定は旧 GAS 実装と同じ Haiku。運用で差し替え可能）
  AI_MODEL: z.string().min(1).default("claude-haiku-4-5"),
  // テナント別の 1 日あたり AI 生成回数上限（ai_usage で計数）
  AI_DAILY_LIMIT: z.coerce.number().int().positive().default(50),
  // dev 専用 ID Token バイパス。本番ビルドでは必ず false。
  ALLOW_DEV_LINE_BYPASS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[env] 必須環境変数が未設定/不正です。\n${missing}\n` +
        `→ .env.example を参照。Supabase は 'supabase status' の接続情報、` +
        `LINE_LOGIN_CHANNEL_ID は LINE Developers の Login チャネル ID。`
    );
  }
  const env = parsed.data;
  // 本番混入ガード: 本番ビルドで dev バイパスが有効なら即落とす（CI grep と二重防御）
  if (env.NODE_ENV === "production" && env.ALLOW_DEV_LINE_BYPASS) {
    throw new Error("[env] ALLOW_DEV_LINE_BYPASS は本番で有効化できません");
  }
  return env;
}

// 遅延評価。next build の "Collecting page data" は route を import するだけなので、
// モジュール評価時に検証すると「シークレット無しではビルドすら通らない」状態になる
// （Vercel の Preview が env 未設定で必ず失敗する）。
// 検証は捨てず、最初に env を読んだ時点＝リクエスト処理時に fail-fast させる。
let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = load();
  return cached;
}

// 呼び出し側は従来どおり `env.X` で読める（初回アクセスで load() が走る）。
export const env: Env = new Proxy({} as Env, {
  get: (_target, prop) => getEnv()[prop as keyof Env],
});

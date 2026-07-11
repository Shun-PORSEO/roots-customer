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
  // LINE Login チャネル ID（ID Token の aud 検証に使う）
  LINE_LOGIN_CHANNEL_ID: z.string().min(1),
  // セッション Cookie 署名鍵（32byte 以上推奨）
  SESSION_SECRET: z.string().min(32),
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

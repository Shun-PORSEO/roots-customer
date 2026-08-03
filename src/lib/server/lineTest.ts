import "server-only";

// LINE 接続テスト（SaaS化 C2）。式場に設定されたキー4点をそれぞれ実検証し、
// 「✓ 接続OK / ✗ エラーと直し方」を式場担当者が自己解決できる文言で返す。
//   channel_access_token → GET /v2/bot/info（トークン実在確認 + Bot 名取得）
//   channel_secret       → LINE の Webhook endpoint 検証 API（署名検証まで end-to-end）
//   login_channel_id     → 形式チェック（数字のチャネルID）
//   liff_id              → 形式 + login_channel_id との整合（LIFF ID の先頭は所属チャネルID）

const BOT_INFO_URL = "https://api.line.me/v2/bot/info";
const WEBHOOK_ENDPOINT_URL = "https://api.line.me/v2/bot/channel/webhook/endpoint";
const WEBHOOK_TEST_URL = "https://api.line.me/v2/bot/channel/webhook/test";

export type LineKeyCheck = {
  key: "channel_access_token" | "channel_secret" | "login_channel_id" | "liff_id";
  label: string;
  ok: boolean;
  message: string; // "✓ 接続OK ..." / "✗ <何が起きたか>"
  fix?: string; // ✗ のときの直し方（式場担当者向け）
};

export type LineTestInput = {
  channelAccessToken: string;
  channelSecret: string;
  loginChannelId: string;
  liffId: string;
  // このアプリ側で venue に割り当てられる Webhook URL（LINE Developers に登録すべき値）
  expectedWebhookUrl: string;
};

async function lineGet(url: string, token: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* noop */
  }
  return { status: res.status, body };
}

async function checkAccessToken(token: string): Promise<LineKeyCheck> {
  const base: Pick<LineKeyCheck, "key" | "label"> = {
    key: "channel_access_token",
    label: "チャネルアクセストークン（Messaging API）",
  };
  if (!token) {
    return {
      ...base,
      ok: false,
      message: "✗ 未設定です",
      fix: "LINE Developers → Messaging API チャネル →「Messaging API設定」タブで「チャネルアクセストークン（長期）」を発行し、式場設定に貼り付けてください。",
    };
  }
  try {
    const { status, body } = await lineGet(BOT_INFO_URL, token);
    if (status === 200) {
      const name = body?.displayName ? `（Bot: ${body.displayName}）` : "";
      return { ...base, ok: true, message: `✓ 接続OK${name}` };
    }
    if (status === 401) {
      return {
        ...base,
        ok: false,
        message: "✗ トークンが無効です（LINE に拒否されました）",
        fix: "トークンの期限切れ・再発行・コピーミスの可能性があります。LINE Developers で新しい長期トークンを発行し、貼り替えてください（前後の空白にも注意）。",
      };
    }
    return {
      ...base,
      ok: false,
      message: `✗ LINE API がエラーを返しました（HTTP ${status}）`,
      fix: "時間をおいて再度お試しください。繰り返す場合はトークンを再発行してください。",
    };
  } catch {
    return {
      ...base,
      ok: false,
      message: "✗ LINE API に接続できませんでした",
      fix: "ネットワークの問題の可能性があります。時間をおいて再度お試しください。",
    };
  }
}

async function checkWebhook(
  token: string,
  tokenOk: boolean,
  channelSecret: string,
  expectedWebhookUrl: string
): Promise<LineKeyCheck> {
  const base: Pick<LineKeyCheck, "key" | "label"> = {
    key: "channel_secret",
    label: "チャネルシークレット / Webhook",
  };
  if (!channelSecret) {
    return {
      ...base,
      ok: false,
      message: "✗ チャネルシークレットが未設定です",
      fix: "LINE Developers → Messaging API チャネル →「チャネル基本設定」タブの「チャネルシークレット」をコピーし、式場設定に貼り付けてください。",
    };
  }
  if (!tokenOk) {
    return {
      ...base,
      ok: false,
      message: "✗ チャネルアクセストークンが無効のため確認できません",
      fix: "先にチャネルアクセストークンのエラーを解消してから、もう一度テストしてください。",
    };
  }
  try {
    // 1) LINE Developers に登録済みの Webhook URL を取得し、期待 URL と突き合わせる
    const ep = await lineGet(WEBHOOK_ENDPOINT_URL, token);
    if (ep.status === 404 || !ep.body?.endpoint) {
      return {
        ...base,
        ok: false,
        message: "✗ Webhook URL が LINE Developers に未設定です",
        fix: `LINE Developers →「Messaging API設定」タブの Webhook URL に ${expectedWebhookUrl} を設定し、「Webhookの利用」を ON にしてください。`,
      };
    }
    const registered: string = ep.body.endpoint;
    if (registered !== expectedWebhookUrl) {
      return {
        ...base,
        ok: false,
        message: `✗ 登録済み Webhook URL がこの式場の URL と一致しません（登録値: ${registered}）`,
        fix: `Webhook URL を ${expectedWebhookUrl} に変更してください（式場IDまで含めて一致させる必要があります）。`,
      };
    }
    // 2) LINE 側から実リクエストを送らせて、署名検証（= シークレット一致）まで確認する
    const res = await fetch(WEBHOOK_TEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* noop */
    }
    if (res.ok && body?.success) {
      return { ...base, ok: true, message: "✓ 接続OK（署名検証まで確認済み）" };
    }
    const reason: string = body?.reason ?? "";
    const statusCode: number | undefined = body?.statusCode;
    if (reason === "ERROR_STATUS_CODE" && statusCode === 401) {
      return {
        ...base,
        ok: false,
        message: "✗ Webhook は届きましたが署名検証で拒否されました（401）",
        fix: "設定されたチャネルシークレットが Messaging API チャネルのものと一致していません。「チャネル基本設定」タブのチャネルシークレットをコピーし直して貼り替えてください。",
      };
    }
    if (reason === "ERROR_STATUS_CODE" && statusCode === 404) {
      return {
        ...base,
        ok: false,
        message: "✗ Webhook URL の式場IDが正しくありません（404）",
        fix: `Webhook URL が ${expectedWebhookUrl} と完全一致しているか確認してください。`,
      };
    }
    if (reason === "COULD_NOT_CONNECT" || reason === "REQUEST_TIMEOUT") {
      return {
        ...base,
        ok: false,
        message: "✗ LINE からこのサーバーに接続できませんでした",
        fix: "Webhook URL が公開された https の URL か（ローカル環境の URL は不可）、サーバーが稼働中かを確認してください。",
      };
    }
    return {
      ...base,
      ok: false,
      message: `✗ Webhook 検証に失敗しました（${reason || `HTTP ${res.status}`}）`,
      fix: "時間をおいて再度お試しください。繰り返す場合は Webhook URL とチャネルシークレットを再確認してください。",
    };
  } catch {
    return {
      ...base,
      ok: false,
      message: "✗ LINE API に接続できませんでした",
      fix: "ネットワークの問題の可能性があります。時間をおいて再度お試しください。",
    };
  }
}

function checkLoginChannelId(loginChannelId: string): LineKeyCheck {
  const base: Pick<LineKeyCheck, "key" | "label"> = {
    key: "login_channel_id",
    label: "LINE Login チャネルID",
  };
  if (!loginChannelId) {
    return {
      ...base,
      ok: false,
      message: "✗ 未設定です（カップルの LINE ログインができません）",
      fix: "LINE Developers → LINE Login チャネル →「チャネル基本設定」タブの「チャネルID」（数字）を式場設定に登録してください。",
    };
  }
  if (!/^\d+$/.test(loginChannelId)) {
    return {
      ...base,
      ok: false,
      message: "✗ 形式が正しくありません（数字のチャネルIDではありません）",
      fix: "チャネルシークレット等ではなく、LINE Login チャネルの「チャネルID」（数字のみ）を登録してください。",
    };
  }
  return { ...base, ok: true, message: "✓ 形式OK（実際の検証はカップルのログイン時に行われます）" };
}

function checkLiffId(liffId: string, loginChannelId: string): LineKeyCheck {
  const base: Pick<LineKeyCheck, "key" | "label"> = { key: "liff_id", label: "LIFF ID" };
  if (!liffId) {
    return {
      ...base,
      ok: false,
      message: "✗ 未設定です",
      fix: "LINE Developers → LINE Login チャネル →「LIFF」タブで LIFF アプリを追加し、LIFF ID（例: 1234567890-AbcdEfgh）を式場設定に登録してください。",
    };
  }
  const m = liffId.match(/^(\d+)-\w+$/);
  if (!m) {
    return {
      ...base,
      ok: false,
      message: "✗ 形式が正しくありません（例: 1234567890-AbcdEfgh）",
      fix: "LIFF URL（https://liff.line.me/...）ではなく、「LIFF ID」そのものを登録してください。",
    };
  }
  if (loginChannelId && m[1] !== loginChannelId) {
    return {
      ...base,
      ok: false,
      message: `✗ この LIFF ID は LINE Login チャネル ${loginChannelId} のものではありません`,
      fix: "LIFF ID の先頭の数字は所属する LINE Login チャネルの ID です。同じ Login チャネルの「LIFF」タブで作成した LIFF ID を登録してください。",
    };
  }
  return { ...base, ok: true, message: "✓ 整合OK（LINE Login チャネルと一致しています）" };
}

// dev バイパス（SaaS化 C9・E2E/ローカル用）。ALLOW_DEV_LINE_BYPASS=true かつ
// チャネルアクセストークンが "dev-" で始まる式場に限り、外部 LINE API を呼ぶ
// token/webhook の2点を ✓ 扱いにする（env 側のガードで本番では有効化できない）。
// login_channel_id / liff_id の形式検査はオフラインの実検査のまま通す —
// 形式不正ならバイパス中でも ✗ になり、全緑ゲートの意味を保つ。
export function isDevLineTestTarget(channelAccessToken: string): boolean {
  return channelAccessToken.startsWith("dev-");
}

export function runDevBypassLineTest(input: LineTestInput): LineKeyCheck[] {
  return [
    {
      key: "channel_access_token",
      label: "チャネルアクセストークン（Messaging API）",
      ok: true,
      message: "✓ 接続OK（開発バイパス・実検証なし）",
    },
    {
      key: "channel_secret",
      label: "チャネルシークレット / Webhook",
      ok: true,
      message: "✓ 接続OK（開発バイパス・実検証なし）",
    },
    checkLoginChannelId(input.loginChannelId),
    checkLiffId(input.liffId, input.loginChannelId),
  ];
}

export async function runLineConnectionTest(input: LineTestInput): Promise<LineKeyCheck[]> {
  const tokenCheck = await checkAccessToken(input.channelAccessToken);
  const webhookCheck = await checkWebhook(
    input.channelAccessToken,
    tokenCheck.ok,
    input.channelSecret,
    input.expectedWebhookUrl
  );
  return [
    tokenCheck,
    webhookCheck,
    checkLoginChannelId(input.loginChannelId),
    checkLiffId(input.liffId, input.loginChannelId),
  ];
}

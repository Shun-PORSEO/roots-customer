import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";

// AI メッセージ生成（SaaS化 C5 / roots-concierge#6）。旧 gas/claude.ts の移植。
// 運営者の Claude API キー（ANTHROPIC_API_KEY）で全テナント共通提供し、
// テナント別のレート制限は呼び出し側（/api/admin generateAiDraft）が ai_usage で掛ける。
//
// GAS 版はカップル個別のリマインド文を生成していたが、リマインド送信は固定文
// （task_master.reminder_message）を使う設計（gas/reminders.ts 以来）のため、
// ここでは「その定型文の下書き」を生成する。宛名・残日数はリマインドエンジンが
// 送信時に自動で付けるので本文だけを書かせる。

export function aiEnabled(): boolean {
  return !!getEnv().ANTHROPIC_API_KEY;
}

let cachedClient: Anthropic | null = null;

function client(): Anthropic {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("[ai] ANTHROPIC_API_KEY が未設定です");
  if (!cachedClient) cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export async function generateReminderMessage(opts: {
  taskContent: string;
  venueName?: string;
  category?: string;
}): Promise<string> {
  const prompt = `ウェディング式場のプランナーとして、結婚式準備タスクのリマインド定型文を1通書いてください。
${opts.venueName ? `式場名: ${opts.venueName}\n` : ""}${opts.category ? `カテゴリ: ${opts.category}\n` : ""}タスク: ${opts.taskContent}

条件:
- 200文字以内・丁寧語・絵文字1〜2個・式場担当者らしい温かみのある文体
- 宛名（〇〇様）や期限までの日数は書かない（送信時にシステムが自動で付けます）
- 前置きや説明は不要。メッセージ本文のみを出力`;

  const response = await client().messages.create({
    model: getEnv().AI_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("[ai] 生成結果が空でした");
  return text;
}

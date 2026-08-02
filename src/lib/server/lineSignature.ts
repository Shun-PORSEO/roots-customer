import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// LINE Webhook の署名検証（SaaS化 C2）。
// LINE Platform はリクエストボディを channel secret で HMAC-SHA256 署名し、
// base64 を x-line-signature ヘッダに載せてくる。venue 別の secret で照合する。
// 比較は timingSafeEqual（タイミング攻撃対策）。

export function verifyLineSignature(
  rawBody: string,
  channelSecret: string,
  signature: string | null
): boolean {
  if (!channelSecret || !signature) return false;
  const expected = createHmac("sha256", channelSecret).update(rawBody, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  if (given.length !== expected.length) return false;
  return timingSafeEqual(expected, given);
}

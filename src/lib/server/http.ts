import "server-only";
import { NextResponse } from "next/server";

// 統一エラー DTO（autoplan DX）: { error: { code, message, hint, request_id } }
// code は enum で単一ソース化。各 code に既定 hint を持たせ「problem=message / cause=code / fix=hint」を固定。
export type ErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN_IDOR"
  | "VALIDATION"
  | "NOT_FOUND"
  | "LINE_UPSTREAM"
  | "INTERNAL";

const DEFAULT_HINT: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "LINE でログインし直してください。",
  FORBIDDEN_IDOR: "この操作を行う権限がありません。",
  VALIDATION: "入力内容を確認してください。",
  NOT_FOUND: "対象が見つかりませんでした。",
  LINE_UPSTREAM: "LINE との通信に失敗しました。時間をおいて再度お試しください。",
  INTERNAL: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
};

const STATUS: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN_IDOR: 403,
  VALIDATION: 400,
  NOT_FOUND: 404,
  LINE_UPSTREAM: 502,
  INTERNAL: 500,
};

// リクエスト 1 本につき 1 ID。ログ行・Sentry スコープ・レスポンス DTO に同じ ID を刻む（autoplan DX）。
export function newRequestId(): string {
  return crypto.randomUUID();
}

export function ok<T>(data: T, requestId: string) {
  return NextResponse.json(data, { headers: { "x-request-id": requestId } });
}

export function fail(
  code: ErrorCode,
  requestId: string,
  opts?: { message?: string; hint?: string; cause?: unknown }
) {
  // 生の例外は返さずログにのみ残す（本番の生エラー抑止）
  if (opts?.cause) {
    console.error(`[${requestId}] ${code}:`, opts.cause);
  }
  return NextResponse.json(
    {
      error: {
        code,
        message: opts?.message ?? DEFAULT_HINT[code],
        hint: opts?.hint ?? DEFAULT_HINT[code],
        request_id: requestId,
      },
    },
    { status: STATUS[code], headers: { "x-request-id": requestId } }
  );
}

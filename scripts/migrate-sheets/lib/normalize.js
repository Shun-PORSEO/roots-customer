// Sheets セル値の正規化（依存ゼロ・純関数）。
// GAS 側の読み取り規約（gas/sheets.ts）を CSV 経由でも再現する:
//   - boolean は "TRUE"/"true" のみ真（gas/sheets.ts の String(v).toLowerCase() === "true" 相当）
//   - 日付セルは CSV では表示形式（例 2026/08/02）になるため複数形式を受ける
//   - タイムスタンプは GAS が toISOString() で書いた文字列が基本だが、
//     Sheets がセルを日付型に自動変換した場合はロケール形式になるため両方受ける

export function toBool(v) {
  return String(v ?? "").trim().toLowerCase() === "true";
}

// task_progress.is_visible 専用: 空文字も true（表示）扱い（gas/sheets.ts:314）
export function toVisibleBool(v) {
  const s = String(v ?? "").trim();
  return s === "" || s.toLowerCase() === "true";
}

const RE_ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const RE_SLASH_YMD = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const RE_SLASH_MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
// 例: 2026/08/02 9:05:00 / 2026-08-02 9:05 （Sheets のロケール表示）
const RE_DATETIME =
  /^(?:(\d{4})[/-](\d{1,2})[/-](\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function pad(n) {
  return String(n).padStart(2, "0");
}

function ymd(y, m, d) {
  const mi = Number(m);
  const di = Number(d);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
  return `${y}-${pad(mi)}-${pad(di)}`;
}

// 日付のみ（wedding_date）→ "YYYY-MM-DD" / 空は null / 解釈不能は undefined
export function toDateOnly(v) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  let m;
  if ((m = s.match(RE_ISO_DATE)) || (m = s.match(RE_SLASH_YMD))) return ymd(m[1], m[2], m[3]);
  if ((m = s.match(RE_SLASH_MDY))) return ymd(m[3], m[1], m[2]);
  // ISO datetime で入っていた場合は日付部分だけ使う（GAS は日付のみで書くため稀）
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return undefined;
}

// タイムスタンプ → ISO 8601 文字列 / 空は null / 解釈不能は undefined。
// ロケール形式（TZ情報なし）はスプレッドシートの TZ = Asia/Tokyo（gas/appsscript.json）として扱う。
export function toTimestamp(v) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s))) return s;
  let m;
  if ((m = s.match(RE_DATETIME))) {
    const [y, mo, d] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[4], m[5]];
    const date = ymd(y, mo, d);
    if (!date) return undefined;
    return `${date}T${pad(Number(m[7]))}:${m[8]}:${m[9] ?? "00"}+09:00`;
  }
  const dateOnly = toDateOnly(s);
  if (dateOnly) return `${dateOnly}T00:00:00+09:00`;
  return undefined;
}

// 重複解決の新旧比較用。GAS は ISO 文字列の辞書順比較だが、
// CSV では形式が混在しうるため epoch に正規化して比較する（不明は最古扱い）。
export function timestampSortKey(v) {
  const ts = toTimestamp(v);
  if (!ts) return 0;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? 0 : t;
}

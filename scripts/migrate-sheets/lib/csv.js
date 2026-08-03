// RFC 4180 準拠の CSV パーサ（依存ゼロ）。
// Google Sheets の「ファイル > ダウンロード > CSV」出力を想定:
//   - ダブルクォート内の改行・カンマ・"" エスケープを扱う
//   - CRLF / LF 両対応、先頭 BOM 除去
// reminder_message などに改行入りセルが実在するため、split(",") では代替できない。

export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r") {
      i += 1; // CRLF は LF 側で行を確定する
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (inQuotes) {
    throw new Error("CSV が壊れています: 閉じられていないダブルクォートがあります");
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 末尾の完全な空行（["", ...] のみ）は捨てる
  return rows.filter((r) => r.some((c) => c !== ""));
}

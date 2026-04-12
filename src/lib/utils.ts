const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * "挙式日 - 180日" や "挙式日 - 6ヶ月" を解析して期限日を返す
 */
export function parseDueDate(formula: string, weddingDateStr: string): Date | null {
  if (!formula || !weddingDateStr) return null;

  // "YYYY-MM-DD" をローカル日付として解釈
  const [y, m, d] = weddingDateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const wedding = new Date(y, m - 1, d);

  // "挙式日 - 180日"
  const dayMatch = formula.match(/挙式日\s*[-−]\s*(\d+)\s*日/);
  if (dayMatch) {
    const result = new Date(wedding);
    result.setDate(result.getDate() - parseInt(dayMatch[1]));
    return result;
  }

  // "挙式日 - 6ヶ月" / "挙式日 - 6か月"
  const monthMatch = formula.match(/挙式日\s*[-−]\s*(\d+)\s*[ヶか]月/);
  if (monthMatch) {
    const result = new Date(wedding);
    result.setMonth(result.getMonth() - parseInt(monthMatch[1]));
    return result;
  }

  // "挙式日" のみ → 当日
  if (formula.trim() === "挙式日") return new Date(wedding);

  return null;
}

/** Date → "2026年10月10日（土）" */
export function formatJapaneseDate(date: Date): string {
  const dow = DOW_JP[date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${dow}）`;
}

/** 今日から date までの日数（過去なら負値） */
export function getDaysFromToday(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

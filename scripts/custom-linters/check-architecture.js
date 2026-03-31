#!/usr/bin/env node
/**
 * check-architecture.js
 * アーキテクチャ違反チェッカー
 *
 * 使い方: node scripts/custom-linters/check-architecture.js
 *
 * チェック内容:
 *   1. src/app/ が src/lib/api.ts を経由せず直接 fetch() を呼んでいないか
 *   2. src/components/ にビジネスロジック（fetch/axios）がないか
 *   3. gas/ の doGet/doPost が Code.ts 以外で定義されていないか
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let hasError = false;

// ── ユーティリティ ──────────────────────────────────────────
function readFilesRecursively(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...readFilesRecursively(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      result.push(fullPath);
    }
  }
  return result;
}

function report(file, line, message, fix) {
  hasError = true;
  console.error(`\n[ERROR] ${file}:${line}`);
  console.error(`  問題: ${message}`);
  console.error(`  修正方法: ${fix}`);
}

// ── チェック1: src/app/ の直接 fetch 呼び出し ─────────────
const appFiles = readFilesRecursively("src/app", ".tsx").concat(
  readFilesRecursively("src/app", ".ts")
);

for (const file of appFiles) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    // fetch( または axios. の直接呼び出しを検出（import文を除外）
    if (/(?<!\/\/.*)(?:fetch\s*\(|axios\.)/.test(line) && !/^import/.test(line.trim())) {
      report(
        file,
        idx + 1,
        `src/app/ 内で直接 fetch() / axios を呼び出しています。`,
        `src/lib/api.ts に API呼び出し関数を定義し、そちらを呼ぶように変更してください。\n` +
        `  例: import { getTasks } from "@/lib/api";\n` +
        `      const tasks = await getTasks(lineId);`
      );
    }
  });
}

// ── チェック2: src/components/ のビジネスロジック ───────────
const componentFiles = readFilesRecursively("src/components", ".tsx").concat(
  readFilesRecursively("src/components", ".ts")
);

for (const file of componentFiles) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    if (/(?<!\/\/.*)(?:fetch\s*\(|axios\.|useEffect.*fetch)/.test(line) && !/^import/.test(line.trim())) {
      report(
        file,
        idx + 1,
        `src/components/ 内でAPIアクセスが検出されました。コンポーネントはUIのみを担当すべきです。`,
        `API呼び出しは src/hooks/ にカスタムフックとして切り出してください。\n` +
        `  例: src/hooks/useTaskList.ts を作成し、そこで fetch を行い、コンポーネントは\n` +
        `      const { tasks, loading, error } = useTaskList(); のように呼び出してください。`
      );
    }
  });
}

// ── チェック3: gas/ の doGet/doPost が Code.ts 以外にある ──
const gasFiles = readFilesRecursively("gas", ".ts");

for (const file of gasFiles) {
  if (file.endsWith("Code.ts")) continue; // Code.ts は許可
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    if (/function\s+(doGet|doPost)\s*\(/.test(line)) {
      report(
        file,
        idx + 1,
        `gas/Code.ts 以外で doGet / doPost が定義されています。`,
        `doGet / doPost は gas/Code.ts のみで定義し、ロジックは別ファイルの関数に委譲してください。\n` +
        `  例: gas/sheets.ts に getTasksByLineId() を定義 → gas/Code.ts の doGet から呼ぶ`
      );
    }
  });
}

// ── 結果出力 ────────────────────────────────────────────────
if (hasError) {
  console.error("\n======================================");
  console.error("  アーキテクチャ違反が検出されました");
  console.error("  上記の修正方法に従って修正してください");
  console.error("======================================\n");
  process.exit(1);
} else {
  console.log("OK: アーキテクチャ違反は検出されませんでした。");
}

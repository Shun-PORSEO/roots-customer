#!/usr/bin/env node
/**
 * check-naming.js
 * 命名規則違反チェッカー
 *
 * 使い方: node scripts/custom-linters/check-naming.js
 *
 * チェック内容:
 *   1. src/components/ のファイルが PascalCase になっているか
 *   2. src/hooks/ のファイルが use で始まっているか
 *   3. src/lib/ のファイルが camelCase になっているか（index除く）
 */

const fs = require("fs");
const path = require("path");

let hasError = false;

function report(file, message, fix) {
  hasError = true;
  console.error(`\n[ERROR] ${file}`);
  console.error(`  問題: ${message}`);
  console.error(`  修正方法: ${fix}`);
}

function getBasename(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function isPascalCase(name) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

function isCamelCase(name) {
  return /^[a-z][a-zA-Z0-9]*$/.test(name);
}

// ── チェック1: src/components/ → PascalCase ─────────────────
if (fs.existsSync("src/components")) {
  for (const entry of fs.readdirSync("src/components", { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      const base = getBasename(entry.name);
      if (!isPascalCase(base)) {
        report(
          `src/components/${entry.name}`,
          `コンポーネントファイル名が PascalCase になっていません（現在: ${base}）`,
          `ファイル名を PascalCase に変更してください。\n` +
          `  例: task-card.tsx → TaskCard.tsx\n` +
          `  ※ PascalCase = 各単語の先頭を大文字にして繋げる形式（スペースやハイフンなし）`
        );
      }
    }
  }
}

// ── チェック2: src/hooks/ → use で始まる ────────────────────
if (fs.existsSync("src/hooks")) {
  for (const entry of fs.readdirSync("src/hooks", { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      const base = getBasename(entry.name);
      if (!base.startsWith("use")) {
        report(
          `src/hooks/${entry.name}`,
          `フックファイル名が "use" で始まっていません（現在: ${base}）`,
          `ファイル名を "use" + PascalCase の形式に変更してください。\n` +
          `  例: taskList.ts → useTaskList.ts`
        );
      }
    }
  }
}

// ── チェック3: src/lib/ → camelCase ─────────────────────────
if (fs.existsSync("src/lib")) {
  for (const entry of fs.readdirSync("src/lib", { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      const base = getBasename(entry.name);
      if (base === "index") continue; // index は除外
      if (!isCamelCase(base)) {
        report(
          `src/lib/${entry.name}`,
          `ライブラリファイル名が camelCase になっていません（現在: ${base}）`,
          `ファイル名を camelCase に変更してください。\n` +
          `  例: API-client.ts → apiClient.ts\n` +
          `  ※ camelCase = 最初の単語は小文字、以降の単語の先頭を大文字（スペースやハイフンなし）`
        );
      }
    }
  }
}

// ── 結果出力 ────────────────────────────────────────────────
if (hasError) {
  console.error("\n======================================");
  console.error("  命名規則違反が検出されました");
  console.error("  上記の修正方法に従って修正してください");
  console.error("======================================\n");
  process.exit(1);
} else {
  console.log("OK: 命名規則違反は検出されませんでした。");
}

#!/usr/bin/env bash
# init.sh — 開発環境セットアップスクリプト
# 使い方: bash init.sh

set -e

echo "======================================"
echo "  roots-customer 開発環境セットアップ"
echo "======================================"

# ── 1. Node.js バージョン確認 ──────────────────────────────
echo ""
echo "[1/5] Node.js バージョン確認..."
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js が見つかりません。https://nodejs.org からインストールしてください。"
  exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js 18 以上が必要です（現在: $(node -v)）"
  exit 1
fi
echo "OK: Node.js $(node -v)"

# ── 2. .env.local ファイルの生成 ────────────────────────────
echo ""
echo "[2/5] 環境変数ファイルの確認..."
if [ ! -f "src/.env.local" ]; then
  cat > src/.env.local << 'EOF'
# LINE LIFF
NEXT_PUBLIC_LIFF_ID=YOUR_LIFF_ID_HERE

# GAS (Google Apps Script) エンドポイント
NEXT_PUBLIC_GAS_ENDPOINT=YOUR_GAS_WEB_APP_URL_HERE
EOF
  echo "CREATED: src/.env.local （YOUR_LIFF_ID_HERE と YOUR_GAS_WEB_APP_URL_HERE を実際の値に書き換えてください）"
else
  echo "SKIP: src/.env.local はすでに存在します"
fi

# ── 3. フロントエンド依存関係インストール ────────────────────
echo ""
echo "[3/5] フロントエンド依存関係をインストール中..."
if [ -f "src/package.json" ]; then
  cd src && npm install && cd ..
  echo "OK: npm install 完了"
else
  echo "SKIP: src/package.json が見つかりません（後で実装後に再実行してください）"
fi

# ── 4. clasp (GAS デプロイツール) のインストール確認 ─────────
echo ""
echo "[4/5] clasp (Google Apps Script デプロイツール) 確認..."
if ! command -v clasp &>/dev/null; then
  echo "INFO: clasp をグローバルインストールします..."
  npm install -g @google/clasp
  echo "OK: clasp インストール完了"
else
  echo "OK: clasp はすでにインストール済みです ($(clasp -v))"
fi

# ── 5. E2E テスト依存関係インストール ───────────────────────
echo ""
echo "[5/5] E2Eテスト依存関係の確認..."
if [ -f "scripts/e2e-tests/package.json" ]; then
  cd scripts/e2e-tests && npm install && npx playwright install --with-deps && cd ../..
  echo "OK: Playwright インストール完了"
else
  echo "SKIP: scripts/e2e-tests/package.json が見つかりません"
fi

echo ""
echo "======================================"
echo "  セットアップ完了!"
echo "======================================"
echo ""
echo "次のステップ:"
echo "  1. src/.env.local の YOUR_LIFF_ID_HERE を LINE Developer Console で発行したLIFF IDに書き換える"
echo "  2. src/.env.local の YOUR_GAS_WEB_APP_URL_HERE を GAS デプロイ後のURLに書き換える"
echo "  3. cd src && npm run dev  でフロントエンドを起動する"
echo ""

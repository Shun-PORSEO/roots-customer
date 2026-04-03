import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "結婚式準備ダッシュボード",
  description: "結婚式準備タスクを管理するアプリです",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="max-w-app mx-auto min-h-screen">{children}</div>
      </body>
    </html>
  );
}

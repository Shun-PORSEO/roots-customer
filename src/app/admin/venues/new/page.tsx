"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

export default function NewVenuePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    venue_id: "",
    venue_name: "",
    planner_line_user_id: "",
    line_channel_access_token: "",
    line_liff_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.venue_id || !form.venue_name) {
      setError("式場IDと式場名は必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post({ action: "createVenue", line_id: "admin", ...form });
      router.push("/admin/venues");
    } catch (err: any) {
      setError(err.message || "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-16">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push("/admin/venues")} className="text-gray-500 hover:text-gray-800">
          &larr; 式場一覧へ
        </button>
        <h2 className="text-2xl font-bold text-[var(--colorText)]">新規式場登録</h2>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">
        登録すると、RC仕様のデフォルトタスクが自動でセットアップされます。
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">式場ID <span className="text-red-500">*</span></label>
          <input
            value={form.venue_id}
            onChange={e => setForm({ ...form, venue_id: e.target.value })}
            placeholder="例: RC003"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[var(--colorPrimary)] bg-gray-50 font-mono text-sm"
          />
          <p className="text-[11px] text-gray-400 mt-1">半角英数字（RC001 形式を推奨）</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">式場名 <span className="text-red-500">*</span></label>
          <input
            value={form.venue_name}
            onChange={e => setForm({ ...form, venue_name: e.target.value })}
            placeholder="例: グランドホテル〇〇"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[var(--colorPrimary)] bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">プランナー LINE USER ID</label>
          <input
            value={form.planner_line_user_id}
            onChange={e => setForm({ ...form, planner_line_user_id: e.target.value })}
            placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[var(--colorPrimary)] bg-gray-50 font-mono text-sm"
          />
          <p className="text-[11px] text-gray-400 mt-1">承認通知の送信先</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">LINE チャネルアクセストークン</label>
          <input
            value={form.line_channel_access_token}
            onChange={e => setForm({ ...form, line_channel_access_token: e.target.value })}
            placeholder="LINE Messaging API のトークン"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[var(--colorPrimary)] bg-gray-50 font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">LIFF ID</label>
          <input
            value={form.line_liff_id}
            onChange={e => setForm({ ...form, line_liff_id: e.target.value })}
            placeholder="1234567890-xxxxxxxx"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[var(--colorPrimary)] bg-gray-50 font-mono text-sm"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm font-medium">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/admin/venues")}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-3 bg-[var(--colorPrimary)] text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? "登録中..." : "式場を登録する"}
          </button>
        </div>
      </form>
    </div>
  );
}

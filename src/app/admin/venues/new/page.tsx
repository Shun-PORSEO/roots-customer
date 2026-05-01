"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { InlineApiError } from "@/components/ErrorMessage";

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
  const [error, setError] = useState<unknown>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.venue_id || !form.venue_name) {
      setError(new Error("式場IDと式場名は必須です"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post({ action: "createVenue", line_id: "admin", ...form });
      router.push("/admin/venues");
    } catch (err) {
      // ApiError が来れば InlineApiError 内で対処法も自動表示される
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-2xl animate-fade-in">
      <div className="flex items-center gap-sm mb-lg">
        <button
          onClick={() => router.push("/admin/venues")}
          className="w-10 h-10 -ml-xs flex items-center justify-center text-neutral-50 hover:bg-neutral-95 rounded-full active:bg-neutral-90 transition-colors"
          aria-label="式場一覧へ戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-display-md text-on-surface">新規式場登録</h2>
      </div>

      <div className="bg-primary-5 border border-primary-20 rounded-md p-md mb-lg">
        <div className="flex items-start gap-xs">
          <svg className="w-4 h-4 text-primary-70 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-body-md text-primary-80">
            登録すると、RC仕様のデフォルトタスクが自動でセットアップされます。
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card-base p-lg flex flex-col gap-md"
      >
        <div>
          <label className="label-form">
            式場ID <span className="text-error">*</span>
          </label>
          <input
            value={form.venue_id}
            onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
            placeholder="例: RC003"
            className="input-base font-mono"
          />
          <p className="text-body-sm text-neutral-50 mt-2xs">
            半角英数字（RC001 形式を推奨）
          </p>
        </div>

        <div>
          <label className="label-form">
            式場名 <span className="text-error">*</span>
          </label>
          <input
            value={form.venue_name}
            onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
            placeholder="例: グランドホテル〇〇"
            className="input-base"
          />
        </div>

        <div>
          <label className="label-form">プランナー LINE USER ID</label>
          <input
            value={form.planner_line_user_id}
            onChange={(e) => setForm({ ...form, planner_line_user_id: e.target.value })}
            placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="input-base font-mono text-body-sm"
          />
          <p className="text-body-sm text-neutral-50 mt-2xs">承認通知の送信先</p>
        </div>

        <div>
          <label className="label-form">LINE チャネルアクセストークン</label>
          <input
            value={form.line_channel_access_token}
            onChange={(e) => setForm({ ...form, line_channel_access_token: e.target.value })}
            placeholder="LINE Messaging API のトークン"
            className="input-base font-mono text-body-sm"
          />
        </div>

        <div>
          <label className="label-form">LIFF ID</label>
          <input
            value={form.line_liff_id}
            onChange={(e) => setForm({ ...form, line_liff_id: e.target.value })}
            placeholder="1234567890-xxxxxxxx"
            className="input-base font-mono text-body-sm"
          />
        </div>

        {error ? <InlineApiError error={error} /> : null}

        <div className="flex gap-sm pt-xs">
          <button
            type="button"
            onClick={() => router.push("/admin/venues")}
            className="btn-secondary flex-1"
          >
            キャンセル
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "式場を登録する"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

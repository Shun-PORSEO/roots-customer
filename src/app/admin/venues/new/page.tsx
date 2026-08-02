"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { getAdminLineId } from "@/hooks/useAdminAuth";
import { InlineApiError } from "@/components/ErrorMessage";
import { useAdminGate } from "@/hooks/useAdminGate";
import { Spinner } from "@/components/Spinner";
import { AdminAccessDenied } from "@/components/AdminAccessDenied";

export default function NewVenuePage() {
  const router = useRouter();
  const { authorized, authChecked } = useAdminGate();
  const [form, setForm] = useState({
    venue_id: "",
    venue_name: "",
    planner_line_user_id: "",
    line_channel_access_token: "",
    line_channel_secret: "",
    line_login_channel_id: "",
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
      await apiClient.post({ action: "createVenue", line_id: getAdminLineId(), ...form });
      router.push("/admin/venues");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked) return <Spinner fullScreen />;
  if (!authorized) return <AdminAccessDenied />;

  return (
    <div className="pb-2xl animate-fade-in">
      <div className="flex items-center gap-sm mb-xl">
        <button
          onClick={() => router.push("/admin/venues")}
          className="w-10 h-10 -ml-xs flex items-center justify-center text-neutral-50 hover:bg-neutral-95 rounded-full active:bg-neutral-90 transition-colors"
          aria-label="式場一覧へ戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="text-label-caps text-tertiary-70">VENUES&nbsp;/&nbsp;NEW</p>
          <h2 className="font-display text-display-lg text-on-surface mt-2xs">新規式場登録</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-lg lg:gap-xl items-start">
        <form onSubmit={handleSubmit} className="card-base p-xl flex flex-col gap-xl">
          {/* 必須情報セクション */}
          <section>
            <div className="flex items-baseline justify-between mb-md pb-sm border-b border-border">
              <h3 className="text-headline-md text-on-surface">基本情報</h3>
              <span className="text-body-sm text-error">* 必須</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div>
                <label className="label-form" htmlFor="venue_id">
                  式場ID <span className="text-error">*</span>
                </label>
                <input
                  id="venue_id"
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
                <label className="label-form" htmlFor="venue_name">
                  式場名 <span className="text-error">*</span>
                </label>
                <input
                  id="venue_name"
                  value={form.venue_name}
                  onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
                  placeholder="例: グランドホテル〇〇"
                  className="input-base"
                />
                <p className="text-body-sm text-neutral-50 mt-2xs">
                  ペアの画面に表示される名称
                </p>
              </div>
            </div>
          </section>

          {/* LINE 連携セクション */}
          <section>
            <div className="flex items-baseline justify-between mb-md pb-sm border-b border-border">
              <h3 className="text-headline-md text-on-surface">LINE 連携設定</h3>
              <span className="text-body-sm text-neutral-50">任意（後から設定可）</span>
            </div>

            <div className="flex flex-col gap-md">
              <div>
                <label className="label-form" htmlFor="planner_line_user_id">
                  プランナー LINE USER ID
                </label>
                <input
                  id="planner_line_user_id"
                  value={form.planner_line_user_id}
                  onChange={(e) => setForm({ ...form, planner_line_user_id: e.target.value })}
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="input-base font-mono text-body-sm"
                />
                <p className="text-body-sm text-neutral-50 mt-2xs">承認待ちメッセージの通知先</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div>
                  <label className="label-form" htmlFor="line_channel_access_token">
                    LINE チャネルアクセストークン
                  </label>
                  <input
                    id="line_channel_access_token"
                    value={form.line_channel_access_token}
                    onChange={(e) => setForm({ ...form, line_channel_access_token: e.target.value })}
                    placeholder="LINE Messaging API のトークン"
                    className="input-base font-mono text-body-sm"
                  />
                </div>

                <div>
                  <label className="label-form" htmlFor="line_channel_secret">
                    LINE チャネルシークレット
                  </label>
                  <input
                    id="line_channel_secret"
                    value={form.line_channel_secret}
                    onChange={(e) => setForm({ ...form, line_channel_secret: e.target.value })}
                    placeholder="Messaging API のチャネルシークレット"
                    className="input-base font-mono text-body-sm"
                  />
                  <p className="text-body-sm text-neutral-50 mt-2xs">Webhook の署名検証に使用</p>
                </div>

                <div>
                  <label className="label-form" htmlFor="line_login_channel_id">
                    LINE Login チャネルID
                  </label>
                  <input
                    id="line_login_channel_id"
                    value={form.line_login_channel_id}
                    onChange={(e) => setForm({ ...form, line_login_channel_id: e.target.value })}
                    placeholder="1234567890"
                    className="input-base font-mono text-body-sm"
                  />
                  <p className="text-body-sm text-neutral-50 mt-2xs">
                    ペアのログイン検証に使用（数字のみ）
                  </p>
                </div>

                <div>
                  <label className="label-form" htmlFor="line_liff_id">
                    LIFF ID
                  </label>
                  <input
                    id="line_liff_id"
                    value={form.line_liff_id}
                    onChange={(e) => setForm({ ...form, line_liff_id: e.target.value })}
                    placeholder="1234567890-xxxxxxxx"
                    className="input-base font-mono text-body-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {error ? <InlineApiError error={error} /> : null}

          <div className="flex flex-col-reverse md:flex-row gap-sm md:justify-end pt-sm border-t border-border">
            <button
              type="button"
              onClick={() => router.push("/admin/venues")}
              className="btn-secondary md:flex-none md:px-xl"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary md:flex-none md:px-xl"
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "式場を登録する"
              )}
            </button>
          </div>
        </form>

        {/* 補足情報サイドバー（lg 以上で右に表示） */}
        <aside className="flex flex-col gap-md">
          <div className="bg-primary-5 border border-primary-20 rounded-lg p-md">
            <div className="flex items-start gap-xs">
              <svg className="w-4 h-4 text-primary-70 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-headline-sm text-primary-80 mb-2xs">登録時の自動セットアップ</p>
                <p className="text-body-sm text-primary-80 leading-relaxed">
                  登録すると、RC仕様のデフォルトタスクが自動でセットアップされます。
                </p>
              </div>
            </div>
          </div>

          <div className="card-base p-md">
            <p className="text-headline-sm text-on-surface mb-xs">入力のヒント</p>
            <ul className="text-body-sm text-neutral-50 leading-relaxed flex flex-col gap-2xs list-disc pl-md">
              <li>式場IDは登録後に変更できません</li>
              <li>LINE連携の各項目は後から編集できます</li>
              <li>式場名はペアの画面に表示されます</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

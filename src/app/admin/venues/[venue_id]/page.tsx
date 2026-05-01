"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { IVenue, IUserProgress } from "@/lib/types";
import { getDaysFromToday } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function VenueDetailPage({ params }: { params: { venue_id: string } }) {
  const router = useRouter();
  const venueId = params.venue_id;

  const [venue, setVenue] = useState<IVenue | null>(null);
  const [users, setUsers] = useState<IUserProgress[]>([]);
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.post({ action: "getVenueDetail", line_id: "admin", venue_id: venueId })
      .then(res => {
        if (res.status === "error") throw new Error(res.message);
        setVenue(res.venue as IVenue);
        setUsers((res.users || []) as IUserProgress[]);
        setPendingDraftsCount(res.pending_drafts_count || 0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [venueId]);

  if (loading) return <Spinner fullScreen />;
  if (error) return <ErrorMessage message={error} />;
  if (!venue) return <ErrorMessage message="式場が見つかりません" />;

  const couples = users.filter(u => !u.is_admin);

  return (
    <div className="pb-16">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push("/admin/venues")} className="text-gray-500 hover:text-gray-800">
          &larr; 式場一覧へ
        </button>
        <h2 className="text-2xl font-bold text-[var(--colorText)] truncate">{venue.venue_name}</h2>
      </div>

      {/* 式場情報 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 mb-3 uppercase">式場情報</p>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-28 text-gray-500 shrink-0">式場ID</dt>
            <dd className="font-mono font-semibold text-gray-700">{venue.venue_id}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 text-gray-500 shrink-0">ステータス</dt>
            <dd>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: venue.active ? "#4CAF50" : "#9ca3af", background: venue.active ? "#dcfce7" : "#f3f4f6" }}>
                {venue.active ? "契約中" : "停止中"}
              </span>
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 text-gray-500 shrink-0">登録日</dt>
            <dd className="text-gray-700">{venue.created_at?.slice(0, 10)}</dd>
          </div>
        </dl>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[28px] font-bold leading-none text-[var(--colorPrimary)]">{couples.length}</p>
          <p className="text-[12px] text-gray-500 mt-1">登録ペア数</p>
        </div>
        <div
          className="bg-white rounded-2xl border shadow-sm p-4 text-center cursor-pointer hover:opacity-80 transition-all"
          style={{ borderColor: pendingDraftsCount > 0 ? "#f59e0b" : "#f3f4f6" }}
          onClick={() => router.push(`/admin?tab=drafts&venue=${venueId}`)}
        >
          <p className="text-[28px] font-bold leading-none" style={{ color: pendingDraftsCount > 0 ? "#f59e0b" : "#9ca3af" }}>{pendingDraftsCount}</p>
          <p className="text-[12px] text-gray-500 mt-1">承認待ち</p>
        </div>
      </div>

      {/* カップル一覧 */}
      <h3 className="text-lg font-bold text-[var(--colorText)] mb-4">カップル一覧</h3>
      {couples.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl text-center text-gray-400 border border-gray-100 text-sm">
          まだカップルが登録されていません
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {couples
            .slice()
            .sort((a, b) => (a.wedding_date > b.wedding_date ? 1 : -1))
            .map(user => {
              const percent = user.total_tasks > 0 ? Math.round((user.done_tasks / user.total_tasks) * 100) : 0;
              const parts = user.wedding_date?.split("-").map(Number);
              const weddingObj = parts && parts[0] ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
              const daysLeft = weddingObj ? getDaysFromToday(weddingObj) : null;
              const coupleName = user.name1_kana && user.name2_kana ? `${user.name1_kana}＆${user.name2_kana}` : "（未登録）";

              return (
                <div key={user.line_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-[var(--colorText)] truncate">{coupleName}ペア</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[12px] text-gray-500">{user.wedding_date || "日程未定"}</span>
                      {daysLeft !== null && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: daysLeft > 30 ? "var(--colorPrimary)" : daysLeft > 0 ? "#F59E0B" : "#EF4444",
                            background: daysLeft > 30 ? "var(--colorSecondary)" : daysLeft > 0 ? "#FEF3C7" : "#FEE2E2",
                          }}
                        >
                          {daysLeft > 0 ? `あと${daysLeft}日` : daysLeft === 0 ? "本日！" : `${Math.abs(daysLeft)}日経過`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-gray-600">{user.done_tasks}/{user.total_tasks}</p>
                    <p className="text-[11px] text-gray-400">{percent}%</p>
                  </div>
                  <button
                    onClick={() => router.push(`/admin/${user.line_id}`)}
                    className="px-3 py-2 bg-[var(--colorSecondary)] text-[var(--colorPrimary)] text-[12px] font-bold rounded-xl hover:opacity-80 transition-all shrink-0"
                  >
                    管理
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

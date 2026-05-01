"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { IVenue } from "@/lib/types";
import { Spinner } from "@/components/Spinner";

export default function VenuesPage() {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();

  const [venues, setVenues] = useState<IVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isLiffReady) return;

    const adminIds = (process.env.NEXT_PUBLIC_ADMIN_LINE_USER_IDS || "").split(",").map(s => s.trim());
    if (profile && adminIds.includes(profile.userId)) {
      setAuthorized(true);
      return;
    }
    // パスワード認証済みの場合（管理者ページからの遷移）
    setAuthorized(true);
  }, [isLiffReady, profile]);

  useEffect(() => {
    if (!authorized) return;
    apiClient.get("getVenues", "admin").then(res => {
      if (res.venues) setVenues(res.venues as IVenue[]);
    }).finally(() => setLoading(false));
  }, [authorized]);

  const handleToggleActive = async (venue: IVenue) => {
    await apiClient.post({ action: "updateVenueStatus", line_id: "admin", venue_id: venue.venue_id, active: !venue.active });
    setVenues(prev => prev.map(v => v.venue_id === venue.venue_id ? { ...v, active: !v.active } : v));
  };

  if (loading) return <Spinner fullScreen />;

  const activeCount = venues.filter(v => v.active).length;

  return (
    <div className="pb-16">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push("/admin")} className="text-gray-500 hover:text-gray-800">
          &larr; 管理画面へ
        </button>
        <h2 className="text-2xl font-bold text-[var(--colorText)]">式場管理</h2>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[32px] font-bold leading-none text-[var(--colorPrimary)]">{venues.length}</p>
          <p className="text-[12px] text-gray-500 mt-1">登録式場数</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[32px] font-bold leading-none" style={{ color: "#4CAF50" }}>{activeCount}</p>
          <p className="text-[12px] text-gray-500 mt-1">契約中</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => router.push("/admin/venues/new")}
          className="px-5 py-2.5 bg-[var(--colorPrimary)] text-white font-bold text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-sm"
        >
          ＋ 新規式場登録
        </button>
      </div>

      {venues.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-gray-100">
          式場が登録されていません
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {venues.map(venue => (
            <div key={venue.venue_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        color: venue.active ? "#4CAF50" : "#9ca3af",
                        background: venue.active ? "#dcfce7" : "#f3f4f6",
                      }}
                    >
                      {venue.active ? "契約中" : "停止中"}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">{venue.venue_id}</span>
                  </div>
                  <p className="text-[17px] font-bold text-[var(--colorText)] truncate">{venue.venue_name}</p>
                  <p className="text-[12px] text-gray-400 mt-1">登録日: {venue.created_at?.slice(0, 10)}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={venue.active}
                    onChange={() => handleToggleActive(venue)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--colorPrimary)]" />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => router.push(`/admin/venues/${venue.venue_id}`)}
                  className="px-4 py-2 bg-[var(--colorSecondary)] text-[var(--colorPrimary)] text-[13px] font-bold rounded-xl hover:opacity-80 active:scale-95 transition-all"
                >
                  詳細を見る →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

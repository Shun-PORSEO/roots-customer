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
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!isLiffReady) return;

    const adminIds = (process.env.NEXT_PUBLIC_ADMIN_LINE_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (profile && adminIds.includes(profile.userId)) {
      setAuthorized(true);
    }
    setAuthChecked(true);
  }, [isLiffReady, profile]);

  useEffect(() => {
    if (!authorized) return;
    apiClient
      .get("getVenues", "admin")
      .then((res) => {
        if (res.venues) setVenues(res.venues as IVenue[]);
      })
      .finally(() => setLoading(false));
  }, [authorized]);

  const handleToggleActive = async (venue: IVenue) => {
    await apiClient.post({
      action: "updateVenueStatus",
      line_id: "admin",
      venue_id: venue.venue_id,
      active: !venue.active,
    });
    setVenues((prev) =>
      prev.map((v) => (v.venue_id === venue.venue_id ? { ...v, active: !v.active } : v))
    );
  };

  if (!authChecked || (authorized && loading)) return <Spinner fullScreen />;

  if (!authorized) {
    return (
      <div className="pb-2xl animate-fade-in p-lg text-center">
        <h2 className="font-display text-display-md text-on-surface mb-sm">アクセス権がありません</h2>
        <p className="text-body-md text-neutral-50">
          式場管理は管理者のみ利用できます。<br />
          管理者権限が必要な場合は担当者にお問い合わせください。
        </p>
      </div>
    );
  }

  const activeCount = venues.filter((v) => v.active).length;

  return (
    <div className="pb-2xl animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-md mb-xl">
        <div className="flex items-center gap-sm">
          <button
            onClick={() => router.push("/admin")}
            className="w-10 h-10 -ml-xs flex items-center justify-center text-neutral-50 hover:bg-neutral-95 rounded-full active:bg-neutral-90 transition-colors"
            aria-label="管理画面へ戻る"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-label-caps text-tertiary-70">VENUES</p>
            <h2 className="font-display text-display-lg text-on-surface mt-2xs">式場管理</h2>
          </div>
        </div>
        <button
          onClick={() => router.push("/admin/venues/new")}
          className="btn-primary md:px-lg"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          新規式場登録
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-sm md:gap-md mb-xl">
        <div className="card-base p-md md:p-lg text-center">
          <p className="font-display text-[32px] tabular-nums leading-none text-primary-70">
            {venues.length}
          </p>
          <p className="text-body-sm text-neutral-50 mt-2xs">登録式場数</p>
        </div>
        <div className="card-base p-md md:p-lg text-center">
          <p className="font-display text-[32px] tabular-nums leading-none text-success">
            {activeCount}
          </p>
          <p className="text-body-sm text-neutral-50 mt-2xs">契約中</p>
        </div>
        <div className="card-base p-md md:p-lg text-center">
          <p className="font-display text-[32px] tabular-nums leading-none text-neutral-60">
            {venues.length - activeCount}
          </p>
          <p className="text-body-sm text-neutral-50 mt-2xs">停止中</p>
        </div>
        <div className="card-base p-md md:p-lg text-center hidden md:block">
          <p className="font-display text-[32px] tabular-nums leading-none text-tertiary-60">
            {venues.length > 0 ? Math.round((activeCount / venues.length) * 100) : 0}%
          </p>
          <p className="text-body-sm text-neutral-50 mt-2xs">稼働率</p>
        </div>
      </div>

      {venues.length === 0 ? (
        <div className="card-base p-2xl text-center text-body-md text-neutral-50">
          式場が登録されていません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
          {venues.map((venue) => (
            <div
              key={venue.venue_id}
              className="card-base p-lg flex flex-col"
            >
              <div className="flex items-start justify-between gap-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-xs mb-xs flex-wrap">
                    <span
                      className={[
                        "text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums",
                        venue.active
                          ? "bg-success/15 text-success"
                          : "bg-neutral-95 text-neutral-50",
                      ].join(" ")}
                    >
                      {venue.active ? "契約中" : "停止中"}
                    </span>
                    <span className="text-[11px] text-neutral-60 font-mono">
                      {venue.venue_id}
                    </span>
                  </div>
                  <p className="text-headline-md text-on-surface truncate">{venue.venue_name}</p>
                  <p className="text-body-sm text-neutral-60 mt-2xs tabular-nums">
                    登録日: {venue.created_at?.slice(0, 10)}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={venue.active}
                    onChange={() => handleToggleActive(venue)}
                    aria-label={venue.active ? "契約停止" : "契約再開"}
                  />
                  <div className="w-11 h-6 bg-neutral-90 rounded-full peer peer-checked:bg-primary-70 transition-colors duration-short after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-neutral-80 after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-primary-70" />
                </label>
              </div>
              <div className="mt-auto pt-md flex justify-end">
                <button
                  onClick={() => router.push(`/admin/venues/${venue.venue_id}`)}
                  className="btn-ghost"
                >
                  詳細を見る
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { IVenue } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function RegisterPage() {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlVenueId = searchParams.get("venue") || "";

  const [weddingDate, setWeddingDate] = useState("");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [venueId, setVenueId] = useState(urlVenueId);
  const [venues, setVenues] = useState<IVenue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL クエリで式場が指定されていない場合のみ、ドロップダウン用に式場一覧を取得する
  useEffect(() => {
    if (urlVenueId) return;
    apiClient
      .get("getVenues", "guest")
      .then((res) => {
        if (res.venues) setVenues((res.venues as IVenue[]).filter((v) => v.active));
      })
      .catch(() => {});
  }, [urlVenueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weddingDate || !name1 || !name2 || !profile) return;

    setLoading(true);
    setError(null);
    try {
      await apiClient.post({
        action: "register",
        line_id: profile.userId,
        venue_id: venueId,
        wedding_date: weddingDate,
        name1_kana: name1,
        name2_kana: name2,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "エラーが発生しました");
      setLoading(false);
    }
  };

  if (!isLiffReady || !profile) {
    return <Spinner fullScreen />;
  }

  // URLでvenueが指定されていない場合はドロップダウンで必ず1つ選んでもらう
  const needsVenueSelection = !urlVenueId && venues.length > 0;
  const isFormValid = weddingDate && name1 && name2 && (!needsVenueSelection || venueId);

  return (
    <div className="min-h-screen flex flex-col bg-surface-page animate-fade-in">
      <div
        className="relative px-lg pt-3xl pb-xl text-center"
        style={{
          background:
            "linear-gradient(160deg, #FBFAF6 0%, #F5F1EA 55%, #FAEFD2 100%)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-tertiary-50 to-transparent" />
        <p className="text-label-caps text-primary-70 mb-2xs">FOR YOUR&nbsp;BIG&nbsp;DAY</p>
        <h1 className="font-display text-display-lg text-neutral-20">はじめまして</h1>
        <p className="text-body-md text-neutral-50 mt-xs">
          おふたりの情報を教えてください。<br />
          結婚式まで、丁寧にご一緒します。
        </p>
      </div>

      <div className="flex-1 px-lg pt-xl pb-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          {needsVenueSelection && (
            <div>
              <label className="label-form">ご利用の式場</label>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                required
                aria-label="ご利用の式場"
                className="input-base"
              >
                <option value="">式場をお選びください</option>
                {venues.map((v) => (
                  <option key={v.venue_id} value={v.venue_id}>
                    {v.venue_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label-form">お二人のお名前（ひらがな）</label>
            <div className="flex items-center gap-xs">
              <input
                type="text"
                placeholder="さくら"
                value={name1}
                onChange={(e) => setName1(e.target.value)}
                required
                aria-label="お名前 1"
                className="input-base flex-1 min-w-0 text-center"
              />
              <span
                className="font-display text-tertiary-50 text-2xl shrink-0 leading-none"
                aria-hidden="true"
              >
                ＆
              </span>
              <input
                type="text"
                placeholder="たろう"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                required
                aria-label="お名前 2"
                className="input-base flex-1 min-w-0 text-center"
              />
            </div>
          </div>

          <div>
            <label className="label-form">挙式日</label>
            <input
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              required
              aria-label="挙式日"
              className="input-base"
            />
            <p className="text-body-sm text-neutral-50 mt-2xs">
              当日までの日数を画面上部に表示します。
            </p>
          </div>

          <button type="submit" disabled={!isFormValid || loading} className="btn-primary mt-md">
            {loading ? (
              <span
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                aria-label="送信中"
              />
            ) : (
              <>
                はじめる
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="text-body-sm text-neutral-50 text-center mt-xl">
          登録後、担当プランナーが順次タスクを共有します。
        </p>
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}

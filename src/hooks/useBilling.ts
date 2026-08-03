"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { IBilling } from "@/lib/types";

/**
 * 課金状態フック（SaaS化 C4）。getBilling で自社の契約状態を取得する。
 * blocked=true（trialing/active 以外）のとき管理画面は BillingGate がブロックする。
 * getBilling 自体は課金ゲートの対象外なのでブロック中でも取得できる。
 */
export function useBilling() {
  const [billing, setBilling] = useState<IBilling | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    try {
      const res = await apiClient.post({ action: "getBilling" });
      setBilling((res.billing as IBilling) ?? null);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { billing, checked, error, reload, blocked: !!billing && !billing.active };
}

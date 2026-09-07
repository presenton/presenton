"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

import {
  fetchQuotaStatus,
  formatQuotaSummary,
  QuotaStatus,
} from "@/utils/quota";

type LoadState = "loading" | "ready" | "unavailable";

export default function UserQuotaSection() {
  const [status, setStatus] = useState<QuotaStatus | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetchQuotaStatus().then((result) => {
      if (cancelled) {
        return;
      }
      if (result) {
        setStatus(result);
        setState("ready");
      } else {
        setState("unavailable");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-6 border-t border-[#EDEEEF] pt-6">
      <h2 className="text-sm font-semibold text-[#191919]">
        Generation quota
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
        How many presentations you can generate in the current 24-hour
        window.
      </p>

      <div className="mt-6 rounded-[12px] border border-[#EDEEEF] bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] bg-[#EFF6FF]">
            <Zap className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#77787C]">
              {state === "ready" && status && status.remaining !== null
                ? "Rolling 24-hour window"
                : "Generations"}
            </p>
            {state === "loading" && (
              <p className="mt-1 text-sm font-semibold text-[#191919]">
                Loading…
              </p>
            )}
            {state === "unavailable" && (
              <p className="mt-1 text-sm font-semibold text-[#6B7280]">
                Quota information is unavailable right now
              </p>
            )}
            {state === "ready" && status && (
              <p className="mt-1 text-sm font-semibold text-[#191919]">
                {formatQuotaSummary(status)}
              </p>
            )}
          </div>
        </div>

        {state === "ready" && status && status.remaining !== null && (
          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#EDEEEF]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={status.limit}
            aria-valuenow={status.used}
            aria-label="Generations used"
          >
            <div
              className="h-full rounded-full bg-[#2563EB]"
              style={{
                width: `${Math.min(100, status.limit > 0 ? (status.used / status.limit) * 100 : 0)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

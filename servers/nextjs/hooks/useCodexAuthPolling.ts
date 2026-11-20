"use client";

import { useCallback, useEffect, useRef } from "react";
import { getApiUrl } from "@/utils/api";

export interface CodexAuthStatus {
  status: string;
  account_id?: string;
  username?: string;
  email?: string;
  is_pro?: boolean;
  detail?: string;
}

type PollResult =
  | { status: "connected"; profile: CodexAuthStatus; recovered: boolean }
  | { status: "failed"; message: string };

const AUTH_PATH = "/api/v1/ppt/codex/auth/status";
const POLL_INTERVAL = 2000;
const SIGN_IN_AGAIN = "Authentication did not complete. Please try signing in again.";
const STATUS_ERROR = "Could not verify the ChatGPT connection. Please try signing in again.";

export function useCodexAuthPolling() {
  const cancel = useRef<(() => void) | null>(null);
  const stopPolling = useCallback(() => {
    cancel.current?.();
    cancel.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback((sessionId: string, onResult: (result: PollResult) => void) => {
    stopPolling();
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout>;
    cancel.current = () => {
      clearTimeout(timer);
      controller.abort();
    };

    const finish = (result: PollResult) => {
      if (signal.aborted) return;
      stopPolling();
      onResult(result);
    };

    const readCurrentConnection = async () => {
      try {
        const response = await fetch(getApiUrl(AUTH_PATH), { signal, cache: "no-store" });
        if (!response.ok) throw new Error("Unable to read auth status");
        const profile: CodexAuthStatus = await response.json();
        return profile.status === "authenticated"
          ? { status: "connected", profile, recovered: true } as const
          : { status: "failed", message: "This sign-in attempt has ended. Please sign in again." } as const;
      } catch {
        return { status: "failed", message: STATUS_ERROR } as const;
      }
    };

    const poll = async () => {
      let response: Response;
      try {
        response = await fetch(getApiUrl(`${AUTH_PATH}/${encodeURIComponent(sessionId)}`), {
          signal, cache: "no-store",
        });
      } catch {
        schedule();
        return;
      }
      if (signal.aborted) return;
      if (response.status === 404 || response.status === 409) {
        finish(await readCurrentConnection());
        return;
      }
      if (response.status === 429 || response.status >= 500) {
        schedule();
        return;
      }
      if (!response.ok) {
        finish({ status: "failed", message: STATUS_ERROR });
        return;
      }
      const profile: CodexAuthStatus | null = await response.json().catch(() => null);
      if (profile?.status === "pending") {
        schedule();
      } else if (profile?.status === "success") {
        finish({ status: "connected", profile, recovered: false });
      } else {
        finish({ status: "failed", message: profile?.status === "failed" ? SIGN_IN_AGAIN : STATUS_ERROR });
      }
    };

    function schedule() {
      if (!signal.aborted) timer = setTimeout(() => void poll(), POLL_INTERVAL);
    }
    schedule();
  }, [stopPolling]);

  return { startPolling, stopPolling };
}

"use client";

import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { notify } from "@/components/ui/sonner";
import { getApiUrl } from "@/utils/api";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

export type PresentonStatus = {
  enabled: boolean;
  linked: boolean;
  email: string | null;
  canManage: boolean;
};

type PresentonStatusResponse = Partial<PresentonStatus> & {
  can_manage?: boolean;
};

type DeviceFlow = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
};

const initialStatus: PresentonStatus = {
  enabled: false,
  linked: false,
  email: null,
  canManage: false,
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return payload.detail;
  }
  return fallback;
}

export default function OnboardingPresentonAccount({
  onContinue,
  variant = "onboarding",
  onStatusChange,
  onDisconnect,
}: {
  onContinue?: () => void | Promise<void>;
  variant?: "onboarding" | "settings";
  onStatusChange?: (status: PresentonStatus) => void;
  onDisconnect?: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<PresentonStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [flow, setFlow] = useState<DeviceFlow | null>(null);
  const [pollDelay, setPollDelay] = useState(5);
  const [pollAttempt, setPollAttempt] = useState(0);
  const approvalWindowRef = useRef<Window | null>(null);
  const onContinueRef = useRef(onContinue);

  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl("/api/v1/auth/presenton/status"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as PresentonStatusResponse;
      const nextStatus = {
        enabled: Boolean(payload.enabled),
        linked: Boolean(payload.linked),
        email: typeof payload.email === "string" ? payload.email : null,
        canManage: Boolean(payload.canManage ?? payload.can_manage),
      };
      setStatus(nextStatus);
      onStatusChange?.(nextStatus);
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadStatus]);

  useEffect(() => {
    return () => approvalWindowRef.current?.close();
  }, []);

  const startLink = async () => {
    if (isStarting) return;
    trackEvent(MixpanelEvent.Provider_Login_Clicked, {
      provider: "presenton",
      source: variant,
    });
    setIsStarting(true);

    // Electron denies child windows and sends http(s) targets to the system
    // browser. Do not ask it to open the unsupported about:blank placeholder.
    const isElectron = Boolean(window.electron);
    const approvalWindow = isElectron
      ? null
      : window.open("about:blank", "_blank");
    approvalWindowRef.current = approvalWindow;
    if (approvalWindow) {
      approvalWindow.opener = null;
      approvalWindow.document.title = "Connecting to Presenton…";
    }

    try {
      const response = await fetch(
        getApiUrl("/api/v1/auth/presenton/device/start"),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_name:
              variant === "settings"
                ? "Presenton settings"
                : "Presenton onboarding",
          }),
        },
      );
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error(
          getErrorMessage(payload, "Could not start Presenton authorization."),
        );
      }

      const responseData = payload as Record<string, unknown>;
      const interval = Math.max(1, Number(responseData.interval) || 5);
      const expiresIn = Math.max(1, Number(responseData.expires_in) || 900);
      const nextFlow: DeviceFlow = {
        deviceCode: String(responseData.device_code),
        userCode: String(responseData.user_code),
        verificationUri: String(responseData.verification_uri),
        expiresAt: Date.now() + expiresIn * 1000,
      };
      setFlow(nextFlow);
      setPollDelay(interval);
      setPollAttempt(0);
      if (approvalWindow) {
        approvalWindow.location.replace(nextFlow.verificationUri);
      } else if (isElectron) {
        window.open(
          nextFlow.verificationUri,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (error) {
      approvalWindow?.close();
      notify.error(
        "Could not connect Presenton",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const signOut = async () => {
    if (isLoggingOut) return;
    trackEvent(MixpanelEvent.Provider_Logout_Clicked, {
      provider: "presenton",
      source: variant,
    });
    setIsLoggingOut(true);
    try {
      const response = await fetch(
        getApiUrl("/api/v1/auth/presenton/logout"),
        {
          method: "POST",
          credentials: "include",
        },
      );
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Could not disconnect Presenton."),
        );
      }

      trackEvent(MixpanelEvent.Provider_Connection_Deleted, {
        provider: "presenton",
        source: variant,
      });

      setFlow(null);
      approvalWindowRef.current?.close();
      approvalWindowRef.current = null;
      await loadStatus();
      await onDisconnect?.();
      notify.success(
        "Presenton Cloud disconnected",
        variant === "settings"
          ? "Choose a text provider and save the configuration to continue."
          : "The global provider has been disconnected from this workspace.",
      );
    } catch (error) {
      notify.error(
        "Sign-out failed",
        error instanceof Error
          ? error.message
          : "Could not disconnect from Presenton. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const copyDeviceCode = async () => {
    if (!flow) return;
    try {
      await navigator.clipboard.writeText(flow.userCode);
      notify.success("Code copied", "Paste it in the Presenton approval page.");
    } catch {
      notify.error("Could not copy code", "Select and copy the code manually.");
    }
  };

  useEffect(() => {
    if (!flow) return;

    const timeout = window.setTimeout(async () => {
      if (Date.now() >= flow.expiresAt) {
        setFlow(null);
        notify.error(
          "Authorization expired",
          "Start again to connect your Presenton account.",
        );
        return;
      }

      try {
        const response = await fetch(
          getApiUrl("/api/v1/auth/presenton/device/poll"),
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              device_code: flow.deviceCode,
            }),
          },
        );
        const payload: unknown = await response.json().catch(() => ({}));
        if (response.status === 202) {
          if (
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            payload.error === "slow_down"
          ) {
            setPollDelay((delay) => delay + 5);
          }
          setPollAttempt((attempt) => attempt + 1);
          return;
        }
        if (!response.ok) {
          throw new Error(
            getErrorMessage(payload, "Could not connect Presenton Cloud."),
          );
        }

        trackEvent(MixpanelEvent.Provider_Connection_Completed, {
          provider: "presenton",
          source: variant,
          method: "device_flow",
        });

        setFlow(null);
        approvalWindowRef.current?.close();
        approvalWindowRef.current = null;
        await loadStatus();
        notify.success(
          "Presenton Cloud connected",
          "Presenton is now available as a workspace provider.",
        );
        if (variant === "onboarding") {
          await onContinueRef.current?.();
        }
      } catch (error) {
        setFlow(null);
        notify.error(
          "Presenton connection failed",
          error instanceof Error ? error.message : "Please try again.",
        );
      }
    }, pollDelay * 1000);

    return () => window.clearTimeout(timeout);
  }, [flow, loadStatus, pollAttempt, pollDelay, variant]);

  if (isLoading) {
    return (
      <section
        aria-label="Loading Presenton account connection"
        className="h-[82px] animate-pulse rounded-[12px] border border-[#EDEEEF] bg-[#FAFAFC]"
      />
    );
  }

  return (
      <section
        aria-label="Presenton Cloud connection"
        className="relative isolate font-syne"
      >
        <div className="relative z-10 overflow-hidden rounded-[12px] border border-[#EDEEEF] bg-white">
          <button
            type="button"
            onClick={() => {
              if (!status.linked && status.canManage && !flow) {
                void startLink();
              }
            }}
            disabled={
              status.linked || !status.canManage || Boolean(flow) || isStarting
            }
            className={`flex min-h-[78px] w-full items-center gap-3 p-5 text-left transition-colors enabled:hover:bg-[#FAFAFC] disabled:cursor-default ${
              variant === "settings" && status.linked ? "pr-[76px]" : ""
            }`}
          >
            <Image
              src="/providers/presenton.png"
              alt=""
              width={39}
              height={39}
              className="h-[39px] w-[39px] shrink-0 object-contain"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-medium leading-normal tracking-[-0.32px] text-[#191919]">
                  Presenton Cloud
                </span>
                {status.linked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F8EF] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#238553]">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-[14px] font-normal leading-normal text-[#4C4C4C]">
                {status.linked
                  ? status.email || "Presenton Cloud is ready for this workspace."
                  : status.canManage
                    ? "Use Presenton as provider for AI Presentations"
                    : "A workspace administrator must connect Presenton Cloud."}
              </span>
            </span>
            {isStarting ? (
              <Loader2 className="h-[22px] w-[22px] shrink-0 animate-spin text-[#4C4C4C]" />
            ) : !status.linked && status.canManage ? (
              <ArrowRight className="h-[22px] w-[22px] shrink-0 text-[#4C4C4C]" />
            ) : null}
          </button>

          {status.linked && variant === "settings" && status.canManage ? (
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={isLoggingOut}
              title="Disconnect Presenton Cloud"
              aria-label="Disconnect Presenton Cloud"
              className="absolute right-5 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#EDEEEF] bg-white text-[#4C4C4C] shadow-[0_3px_10px_rgba(16,24,40,0.04)] transition hover:border-[#DDD9E8] hover:bg-[#F7F6F9] disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          ) : null}

          {status.linked && variant === "onboarding" ? (
            <div className="flex items-center justify-between gap-3 border-t border-[#EDEEEF] px-[15px] py-3">
              {onContinue ? (
                <button
                  type="button"
                  onClick={() => void onContinue()}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#7C51F8] px-4 text-[11px] font-semibold text-white transition hover:bg-[#6D46E6]"
                >
                  Continue with Presenton
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span />
              )}
              {status.canManage ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={isLoggingOut}
                  title="Disconnect Presenton Cloud"
                  aria-label="Disconnect Presenton Cloud"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#4C4C4C] transition hover:bg-[#F7F6F9] disabled:opacity-50"
                >
                  {isLoggingOut ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {flow ? (
          <div className="relative z-0 -mt-[10px] rounded-b-[12px] border border-[#EDEEEF] bg-white px-5 pb-5 pt-[30px]">
            <div className="flex items-end justify-between gap-3">
              <p className="min-w-0 truncate font-manrope text-[14px] font-normal leading-normal tracking-[-0.14px] text-[#333333]">
                Approve this code in the Presenton window
              </p>
              <a
                href={flow.verificationUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-end gap-0.5 text-[12px] font-normal leading-normal tracking-[-0.36px] text-[#7A5AF8] transition-colors hover:text-[#5F3BD0]"
              >
                Approval Page <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="mt-3 flex h-[50px] items-center gap-2.5 rounded-[6px] border border-[#F6F6F9] bg-[#F9FAFB] p-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-[9px]">
                <div
                  className="flex items-center font-manrope text-[14px] font-semibold leading-normal tracking-[0.7px] text-[#333333]"
                  aria-label={`Authorization code ${flow.userCode}`}
                >
                  {flow.userCode
                    .replace(/[^A-Z0-9]/gi, "")
                    .slice(0, 4)
                    .split("")
                    .map((character, index) => (
                      <span
                        key={`first-${index}`}
                        className="flex h-[30px] min-w-[24px] items-center justify-center rounded-[8px] px-1.5"
                      >
                        {character}
                      </span>
                    ))}
                  <span aria-hidden="true" className="mx-[3px] text-[12px]">
                    •
                  </span>
                  {flow.userCode
                    .replace(/[^A-Z0-9]/gi, "")
                    .slice(4, 8)
                    .split("")
                    .map((character, index) => (
                      <span
                        key={`second-${index}`}
                        className="flex h-[30px] min-w-[24px] items-center justify-center rounded-[8px] px-1.5"
                      >
                        {character}
                      </span>
                    ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyDeviceCode()}
                aria-label="Copy authorization code"
                title="Copy authorization code"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[#333333] transition-colors hover:bg-[#EDEEEF]"
              >
                <Copy className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <div
              className="mt-3 flex items-center gap-2 font-manrope text-[12px] text-[#77727F]"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7A5AF8]" />
              Waiting for authorization…
            </div>
          </div>
        ) : null}
      </section>
  );
}

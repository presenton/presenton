"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getApiUrl } from "@/utils/api";
import { isAuthDisabled } from "@/utils/auth";
import { formatFastApiDetail, UNAUTHORIZED_DETAIL } from "@/utils/authErrors";
import {
  PRESENTON_SPLASH_MIN_DURATION_MS,
  PresentonSplashLoader,
} from "@/components/ui/presenton-splash-loader";
import { notify } from "@/components/ui/sonner";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { useTranslations } from "next-intl";
import LocaleMenu from "@/components/LocaleMenu";

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  role?: "admin" | "user" | null;
};

const initialStatus: AuthStatus = {
  configured: false,
  authenticated: false,
  username: null,
  role: null,
};

export default function AuthGate() {
  const t = useTranslations("auth");
  const tLoading = useTranslations("loading");
  const [status, setStatus] = useState<AuthStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMetSplashDuration, setHasMetSplashDuration] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isSetupMode = useMemo(() => !status.configured, [status.configured]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHasMetSplashDuration(true);
    }, PRESENTON_SPLASH_MIN_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (isAuthDisabled()) {
      trackEvent(MixpanelEvent.Auth_Status_Checked, {
        configured: true,
        authenticated: true,
        auth_disabled: true,
      });
      setStatus({
        configured: true,
        authenticated: true,
        username: "electron",
        role: "admin",
      });
      setIsLoading(false);
      return;
    }

    void refreshStatus();
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      isLoading ||
      !status.authenticated ||
      isRedirecting
    ) {
      return;
    }

    setIsRedirecting(true);
    window.location.replace("/");
  }, [isLoading, isRedirecting, status.authenticated]);

  useEffect(() => {
    if (typeof window === "undefined" || isLoading) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "unauthorized") {
      if (status.configured && !status.authenticated) {
        trackEvent(MixpanelEvent.Auth_Unauthorized_Redirect, {
          configured: true,
        });
        notify.error(t("toast.unauthorizedTitle"), t("toast.unauthorizedBody"), {
          id: "auth-unauthorized-redirect",
          duration: 5000,
        });
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isLoading, status.authenticated, status.configured, t]);

  const refreshStatus = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl("/api/v1/auth/status"), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Could not load login state");
      }

      const data = (await response.json()) as AuthStatus;
      trackEvent(MixpanelEvent.Auth_Status_Checked, {
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        auth_disabled: false,
        role: data.role ?? null,
      });
      setStatus({
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        username: data.username ?? null,
        role: data.role ?? null,
      });
    } catch (fetchError) {
      console.error(fetchError);
      trackEvent(MixpanelEvent.Auth_Status_Checked, {
        configured: false,
        authenticated: false,
        auth_disabled: false,
        error_message: sanitizeAnalyticsError(
          fetchError,
          "Could not load login state"
        ),
      });
      notify.error(
        t("toast.loadErrorTitle"),
        t("toast.loadErrorBody")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (
      isLoading ||
      isRedirecting ||
      status.authenticated ||
      !hasMetSplashDuration
    ) {
      return;
    }

    trackEvent(MixpanelEvent.Auth_Gate_Viewed, {
      flow: status.configured ? "sign_in" : "setup",
    });
  }, [
    hasMetSplashDuration,
    isLoading,
    isRedirecting,
    status.authenticated,
    status.configured,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanedUsername = username.trim();
    if (cleanedUsername.length < 3) {
      trackEvent(MixpanelEvent.Auth_Validation_Failed, {
        flow: isSetupMode ? "setup" : "sign_in",
        reason: "username_too_short",
      });
      notify.warning(
        t("toast.usernameShortTitle"),
        t("toast.usernameShortBody")
      );
      return;
    }

    const minimumPasswordLength = isSetupMode ? 8 : 6;
    if (password.length < minimumPasswordLength) {
      trackEvent(MixpanelEvent.Auth_Validation_Failed, {
        flow: isSetupMode ? "setup" : "sign_in",
        reason: "password_too_short",
      });
      notify.warning(
        t("toast.passwordShortTitle"),
        t("toast.passwordShortBody", { count: minimumPasswordLength })
      );
      return;
    }

    if (isSetupMode && password !== confirmPassword) {
      trackEvent(MixpanelEvent.Auth_Validation_Failed, {
        flow: "setup",
        reason: "passwords_do_not_match",
      });
      notify.warning(
        t("toast.passwordMismatchTitle"),
        t("toast.passwordMismatchBody")
      );
      return;
    }

    setIsSubmitting(true);
    trackEvent(
      isSetupMode
        ? MixpanelEvent.Auth_Setup_Started
        : MixpanelEvent.Auth_SignIn_Started,
      {
        username_length: cleanedUsername.length,
      }
    );

    try {
      const response = await fetch(
        getApiUrl(isSetupMode ? "/api/v1/auth/setup" : "/api/v1/auth/login"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: cleanedUsername,
            password,
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        const detail = formatFastApiDetail(payload?.detail);
        trackEvent(
          isSetupMode
            ? MixpanelEvent.Auth_Setup_Failed
            : MixpanelEvent.Auth_SignIn_Failed,
          {
            status_code: response.status,
            error_message: sanitizeAnalyticsError(
              detail,
              isSetupMode ? "Could not create account" : "Sign-in failed"
            ),
          }
        );
        if (response.status === 401) {
          notify.error(
            t("toast.signInFailedTitle"),
            detail === UNAUTHORIZED_DETAIL
              ? t("toast.invalidCredentials")
              : detail
          );
        } else {
          notify.error(
            isSetupMode ? t("toast.createAccountError") : t("toast.signInFailedTitle"),
            detail || t("toast.genericError")
          );
        }
        return;
      }

      if (isSetupMode) {
        trackEvent(MixpanelEvent.Auth_Setup_Completed, {
          username_length: cleanedUsername.length,
        });
        setStatus({
          configured: true,
          authenticated: false,
          username: (payload as AuthStatus).username ?? cleanedUsername,
          role: (payload as AuthStatus).role ?? "admin",
        });
        setPassword("");
        setConfirmPassword("");
        notify.success(t("toast.accountCreatedTitle"), t("toast.accountCreatedBody"), {
          duration: 6000,
        });
        return;
      }

      setStatus({
        configured: Boolean((payload as AuthStatus).configured),
        authenticated: Boolean((payload as AuthStatus).authenticated),
        username: (payload as AuthStatus).username ?? cleanedUsername,
        role: (payload as AuthStatus).role ?? null,
      });
      trackEvent(MixpanelEvent.Auth_SignIn_Completed, {
        username_length: cleanedUsername.length,
        role: (payload as AuthStatus).role ?? null,
      });
      setPassword("");
      setConfirmPassword("");
      notify.success(
        t("toast.signedInTitle"),
        t("toast.signedInBody")
      );
    } catch (submitError) {
      console.error(submitError);
      trackEvent(
        isSetupMode
          ? MixpanelEvent.Auth_Setup_Failed
          : MixpanelEvent.Auth_SignIn_Failed,
        {
          status_code: null,
          error_message: sanitizeAnalyticsError(
            submitError,
            isSetupMode ? "Could not create account" : "Login unavailable"
          ),
        }
      );
      notify.error(
        t("toast.loginUnavailableTitle"),
        t("toast.loginUnavailableBody")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (
    isLoading ||
    isRedirecting ||
    status.authenticated ||
    !hasMetSplashDuration
  ) {
    return <PresentonSplashLoader message={tLoading("workspace")} />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-6 font-syne">
      <div className="absolute end-4 top-4 z-20">
        <LocaleMenu variant="floating" />
      </div>
      <section className="relative z-10 w-full max-w-lg rounded-[20px] border border-[#EDEEEF] bg-[#F9F8F8] p-7 sm:p-10">
        <div className="mb-7">
          <div className="flex items-center gap-4">
            <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[4px] bg-[#F4F3FF] p-3">
              <Image
                src="/logo-with-bg.png"
                alt=""
                width={161}
                height={166}
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <p className="font-syne text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A5AF8]">
                {t("secureInstance")}
              </p>
              <h1 className="mt-1 font-syne text-xl font-normal leading-tight tracking-[-0.03em] text-black sm:text-[22px]">
                {isSetupMode ? t("setupTitle") : t("signInTitle")}
              </h1>
            </div>
          </div>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-[#6B7280]">
          {isSetupMode
            ? t("setupDescription")
            : t("signInDescription")}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-[#374151]">
              {t("username")}
            </label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.replace(/\s/g, ""))
              }
              placeholder={t("usernamePlaceholder")}
              minLength={3}
              maxLength={128}
              pattern="\S+"
              title={t("usernameTitle")}
              required
              spellCheck={false}
              className="h-12 w-full rounded-lg border border-[#E1E1E5] bg-white px-4 text-sm text-[#191919] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/15"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-[#374151]">
              {t("password")}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSetupMode ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                isSetupMode ? t("passwordNewPlaceholder") : t("passwordPlaceholder")
              }
              minLength={isSetupMode ? 8 : 6}
              maxLength={128}
              required
              className="h-12 w-full rounded-lg border border-[#E1E1E5] bg-white px-4 text-sm text-[#191919] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/15"
              disabled={isSubmitting}
            />
          </div>

          {isSetupMode ? (
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#374151]">
                {t("confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t("confirmPasswordPlaceholder")}
                minLength={8}
                maxLength={128}
                required
                className="h-12 w-full rounded-lg border border-[#E1E1E5] bg-white px-4 text-sm text-[#191919] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/15"
                disabled={isSubmitting}
              />
            </div>
          ) : null}

          {!isSetupMode && status.configured ? (
            <p className="rounded-lg border border-[#EDEEEF] bg-white px-4 py-3 text-xs leading-relaxed text-[#6B7280]">
              {t("adminHint")}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[58px] border border-[#EDEEEF] bg-[#7C51F8] px-5 py-3 font-syne text-xs font-semibold text-white transition hover:bg-[#6d46e6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? isSetupMode
                ? t("savingCredentials")
                : t("signingIn")
              : isSetupMode
                ? t("createAccount")
                : t("signIn")}
          </button>
        </form>
      </section>
    </main>
  );
}

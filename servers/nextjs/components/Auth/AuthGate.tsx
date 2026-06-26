"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getApiUrl } from "@/utils/api";
import { isAuthDisabled } from "@/utils/auth";
import { formatFastApiDetail, UNAUTHORIZED_DETAIL } from "@/utils/authErrors";
import { notify } from "@/components/ui/sonner";

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
};

const initialStatus: AuthStatus = {
  configured: false,
  authenticated: false,
  username: null,
};

export default function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isSetupMode = useMemo(() => !status.configured, [status.configured]);

  useEffect(() => {
    if (isAuthDisabled()) {
      setStatus({
        configured: true,
        authenticated: true,
        username: "electron",
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
        notify.error("Unauthorized", "Sign in to view this page.", {
          id: "auth-unauthorized-redirect",
          duration: 5000,
        });
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isLoading, status.authenticated, status.configured]);

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
      setStatus({
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        username: data.username ?? null,
      });
    } catch (fetchError) {
      console.error(fetchError);
      notify.error(
        "Could not load login",
        "We could not connect to the login service. Please refresh and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanedUsername = username.trim();
    if (cleanedUsername.length < 3) {
      notify.warning(
        "Username too short",
        "Your username must be at least 3 characters."
      );
      return;
    }

    if (password.length < 6) {
      notify.warning(
        "Password too short",
        "Your password must be at least 6 characters."
      );
      return;
    }

    if (isSetupMode && password !== confirmPassword) {
      notify.warning(
        "Passwords do not match",
        "Make sure both password fields match before continuing."
      );
      return;
    }

    setIsSubmitting(true);

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
        if (response.status === 401) {
          notify.error(
            "Sign-in failed",
            detail === UNAUTHORIZED_DETAIL
              ? "The username or password is incorrect. Please try again."
              : detail
          );
        } else {
          notify.error(
            isSetupMode ? "Could not create account" : "Sign-in failed",
            detail || "Something went wrong. Please try again."
          );
        }
        return;
      }

      if (isSetupMode) {
        setStatus({
          configured: true,
          authenticated: false,
          username: (payload as AuthStatus).username ?? cleanedUsername,
        });
        setPassword("");
        setConfirmPassword("");
        notify.success("Account created", "Sign in with your new username and password to continue.", {
          duration: 6000,
        });
        return;
      }

      setStatus({
        configured: Boolean((payload as AuthStatus).configured),
        authenticated: Boolean((payload as AuthStatus).authenticated),
        username: (payload as AuthStatus).username ?? cleanedUsername,
      });
      setPassword("");
      setConfirmPassword("");
      notify.success(
        "Signed in",
        "Welcome back. Loading your workspace."
      );
    } catch (submitError) {
      console.error(submitError);
      notify.error(
        "Login unavailable",
        "The login service is unavailable right now. Please try again in a moment."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isRedirecting || status.authenticated) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-6">
        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border border-[#EDEEEF] bg-white p-8 text-center shadow-xl">
            <Image
              src="/Logo.png"
              alt="Presenton"
              width={160}
              height={48}
              className="mx-auto mb-5 h-12 w-auto opacity-95"
              priority
            />
            <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-[#7C51F8]" />
            <h1 className="font-syne text-lg font-semibold text-black">Presenton</h1>
            <p className="mt-3 font-syne text-sm text-[#000000CC]">Preparing your workspace…</p>
            <div className="mt-6 flex justify-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#5146E5]" />
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-[#7C51F8]"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-[#5146E5]"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-6">
      <section className="relative z-10 w-full max-w-xl rounded-2xl border border-[#E1E1E5] bg-white p-7 shadow-xl sm:p-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[4px] bg-[#F4F3FF] p-3">
              <Image
                src="/logo-with-bg.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
            </div>
            <div>
              <p className="font-syne text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A5AF8]">
                Secure instance
              </p>
              <h1 className="mt-1 font-syne text-2xl font-semibold leading-tight text-black sm:text-[26px]">
                {isSetupMode ? "Create your admin login" : "Sign in to continue"}
              </h1>
            </div>
          </div>
        </div>

        <p className="font-syne text-base text-[#000000CC] sm:text-lg">
          {isSetupMode
            ? "One-time setup for this deployment. You will use the same username and password on future visits."
            : "This deployment is protected. Enter your credentials to open the app."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="block font-syne text-sm font-medium text-black">
              Username
            </label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your-admin-user"
              className="w-full rounded-[11px] border border-[#EDEEEF] bg-white px-4 py-3 font-syne text-sm text-black outline-none transition placeholder:text-[#999999] focus:border-[#a49cfc] focus:ring-2 focus:ring-[#5146E5]/20"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block font-syne text-sm font-medium text-black">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSetupMode ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-[11px] border border-[#EDEEEF] bg-white px-4 py-3 font-syne text-sm text-black outline-none transition placeholder:text-[#999999] focus:border-[#a49cfc] focus:ring-2 focus:ring-[#5146E5]/20"
              disabled={isSubmitting}
            />
          </div>

          {isSetupMode ? (
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block font-syne text-sm font-medium text-black">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                className="w-full rounded-[11px] border border-[#EDEEEF] bg-white px-4 py-3 font-syne text-sm text-black outline-none transition placeholder:text-[#999999] focus:border-[#a49cfc] focus:ring-2 focus:ring-[#5146E5]/20"
                disabled={isSubmitting}
              />
            </div>
          ) : null}

          {!isSetupMode && status.configured ? (
            <p className="font-syne text-sm text-[#494A4D]">
              Setup is complete for this instance. Use the username and password you configured.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[58px] border border-[#EDEEEF] bg-[#7C51F8] px-5 py-3 font-syne text-xs font-semibold text-white transition hover:bg-[#6d46e6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? isSetupMode
                ? "Saving credentials…"
                : "Signing in…"
              : isSetupMode
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { TAILWIND_BROWSER_SCRIPT_URL } from "@/lib/tailwind-browser";

export const TAILWIND_RUNTIME_READY_EVENT =
  "presenton:tailwind-runtime-ready";
export const TAILWIND_RUNTIME_REQUEST_EVENT =
  "presenton:tailwind-runtime-request";

let runtimeReady = false;

function notifyRuntimeReady() {
  if (runtimeReady) return;
  runtimeReady = true;
  window.dispatchEvent(new Event(TAILWIND_RUNTIME_READY_EVENT));
}

export default function TailwindBrowserRuntime() {
  const pathname = usePathname();
  const [loadRequested, setLoadRequested] = useState(false);
  const deferUntilRequested = pathname === "/";

  useEffect(() => {
    if (pathname === "/pdf-maker" || !deferUntilRequested) return;

    const handleRequest = () => setLoadRequested(true);
    window.addEventListener(TAILWIND_RUNTIME_REQUEST_EVENT, handleRequest);
    return () =>
      window.removeEventListener(TAILWIND_RUNTIME_REQUEST_EVENT, handleRequest);
  }, [deferUntilRequested, pathname]);

  if (pathname === "/pdf-maker") return null;
  if (deferUntilRequested && !loadRequested) return null;

  return (
    <Script
      id="presenton-shared-tailwind-runtime"
      onLoad={notifyRuntimeReady}
      onReady={notifyRuntimeReady}
      src={TAILWIND_BROWSER_SCRIPT_URL}
      strategy="afterInteractive"
    />
  );
}

export function useTailwindRuntimeReady() {
  const [ready, setReady] = useState(runtimeReady);

  useEffect(() => {
    const requestTimer = window.setTimeout(() => {
      window.dispatchEvent(new Event(TAILWIND_RUNTIME_REQUEST_EVENT));
    }, 0);
    const handleReady = () => setReady(true);
    window.addEventListener(TAILWIND_RUNTIME_READY_EVENT, handleReady);
    return () => {
      window.clearTimeout(requestTimer);
      window.removeEventListener(TAILWIND_RUNTIME_READY_EVENT, handleReady);
    };
  }, []);

  return ready;
}

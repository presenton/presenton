"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface PresentonSplashLoaderProps {
  message?: string;
  className?: string;
}

export const PRESENTON_SPLASH_MIN_DURATION_MS = 3000;

const SPLASH_ANIMATION_MS = 2600;
const SPLASH_BRAND_NAME = "Yarex";

let splashSessionStartedAt: number | null = null;

function markSplashSessionStart(): number {
  if (splashSessionStartedAt === null) {
    splashSessionStartedAt = Date.now();
  }
  return splashSessionStartedAt;
}

function getSplashAnimationDelayMs(): number {
  const elapsed = Date.now() - markSplashSessionStart();
  return -Math.min(elapsed, SPLASH_ANIMATION_MS);
}

export function PresentonSplashLoader({
  message = "Preparing your workspace",
  className,
}: PresentonSplashLoaderProps) {
  const [animationDelayMs, setAnimationDelayMs] = useState(0);

  useLayoutEffect(() => {
    setAnimationDelayMs(getSplashAnimationDelayMs());
  }, []);

  const containerStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "flex",
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: "#ffffff",
  };

  const surfaceStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "142vmax",
    height: "142vmax",
    borderRadius: "50%",
    background: "#101323",
    transform: "translate3d(-50%, -50%, 0) scale(0.001)",
    animation: `presenton-splash-surface-grow ${SPLASH_ANIMATION_MS}ms linear ${animationDelayMs}ms both`,
    willChange: "transform",
    backfaceVisibility: "hidden",
  };

  const wordmarkStyle: CSSProperties = {
    position: "relative",
    zIndex: 1,
    transform: "translateZ(0)",
  };

  return (
    <main
      aria-busy="true"
      aria-label={message}
      className={cn("presenton-splash-loader", className)}
      role="status"
      style={containerStyle}
    >
      <div
        className="presenton-splash-surface"
        aria-hidden="true"
        style={surfaceStyle}
      />
      <div
        className="presenton-splash-wordmark font-unbounded text-[clamp(44px,14vw,128px)] font-extrabold leading-none tracking-[-0.04em]"
        aria-hidden="true"
        style={wordmarkStyle}
      >
        <span
          className="presenton-splash-wordmark-layer presenton-splash-wordmark-base"
          style={{ color: "#101323" }}
        >
          {SPLASH_BRAND_NAME}
        </span>
        <span
          className="presenton-splash-wordmark-layer presenton-splash-wordmark-reveal"
          style={{
            position: "absolute",
            inset: 0,
            color: "#ffffff",
            clipPath: "circle(0 at 50% 50%)",
            animation: `presenton-splash-text-reveal ${SPLASH_ANIMATION_MS}ms linear ${animationDelayMs}ms both`,
            willChange: "clip-path",
          }}
        >
          {SPLASH_BRAND_NAME}
        </span>
      </div>
    </main>
  );
}

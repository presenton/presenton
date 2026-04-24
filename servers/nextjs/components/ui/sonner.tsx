"use client"

import type React from "react"
import { BadgeCheck, Info, Loader2, ShieldAlert } from "lucide-react"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"

/** Blue circle for neutral / informational toasts (matches web `servers/nextjs` Toaster). */
function NeutralToastIcon() {

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none">
      <path d="M9.12333 17.4567C13.7257 17.4567 17.4567 13.7257 17.4567 9.12337C17.4567 4.521 13.7257 0.790039 9.12333 0.790039C4.52096 0.790039 0.790001 4.521 0.790001 9.12337C0.790001 13.7257 4.52096 17.4567 9.12333 17.4567Z" fill="url(#paint0_linear_4686_451)" stroke="#2863A3" strokeWidth="1.58" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="paint0_linear_4686_451" x1="9.12333" y1="0.790039" x2="9.12333" y2="17.4567" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1880F6" />
          <stop offset="1" stopColor="#75B5FF" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Toasts with both title and description (matches styled [data-title] / [data-description]). */
export const notify = {
  error: (title: string, description: string) =>
    sonnerToast.error(title, { description }),
  success: (title: string, description: string) =>
    sonnerToast.success(title, { description }),
  info: (title: string, description: string) =>
    sonnerToast.info(title, { description }),
} as const

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ icons, ...props }: ToasterProps) => {
  const defaultIcons: NonNullable<ToasterProps["icons"]> = {
    success: <BadgeCheck aria-hidden="true" />,
    error: <ShieldAlert aria-hidden="true" />,
    info: <Info className="fill-[#1880F6] stroke-white" />,
    warning: <ShieldAlert aria-hidden="true" />,
    loading: <Loader2 aria-hidden="true" className="animate-spin" />,
    close: <span aria-hidden="true">Got it!</span>,
  }

  return (
    <>
      <style jsx global>{`
        /* Near Sonner default width on desktop; nearly full width on narrow screens */
        [data-sonner-toaster] {
          --width: min(100dvw - 1.5rem, 22.5rem) !important;
          box-sizing: border-box !important;
        }

        @media (min-width: 640px) {
          [data-sonner-toaster] {
            --width: min(100dvw - 2rem, 24rem) !important;
          }
        }

        /* Neutral "card" toast container — design tokens */
        [data-sonner-toast][data-styled="true"] {
          border-radius: 10px !important;

          border: 1px solid var(--Base-Gray-700, #e1e1e5) !important;
          background: rgba(255, 255, 255, 0.6) !important;
          box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.06) !important;
          padding: clamp(9px, 0.5rem + 0.35vw, 12px) clamp(11px, 0.65rem + 0.5vw, 14px) !important;
          gap: clamp(8px, 0.5rem + 0.35vw, 11px) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        /* Typography — slight scale-up from original 12px, capped modestly */
        [data-sonner-toast][data-styled="true"] [data-title] {
          font-family: var(--font-syne), ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
            "Noto Sans", sans-serif !important;
          font-size: clamp(0.8125rem, 0.8rem + 0.12vw, 0.9375rem) !important;
          font-weight: 500 !important;
          line-height: 1.35 !important;
          letter-spacing: 0.03em !important;
          color: rgb(15 23 42) !important; /* slate-900 */
          text-transform: none !important;
        }

        [data-sonner-toast][data-styled="true"] [data-description] {
          font-family: var(--font-syne), ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
            "Noto Sans", sans-serif !important;
          font-size: clamp(0.6875rem, 0.67rem + 0.1vw, 0.8125rem) !important;
          font-weight: 400 !important;
          line-height: 1.4 !important;
          letter-spacing: 0.03em !important;
          color: rgb(100 116 139) !important; /* slate-500 */
        }

        [data-sonner-toast][data-styled="true"] [data-content] {
          gap: clamp(2px, 0.15vw, 5px) !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
        }

        /* Left icon badge */
        [data-sonner-toast][data-styled="true"] [data-icon] {
          width: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
          height: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
          flex-shrink: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 !important;
          color: rgb(51 65 85) !important; /* slate-700 */
        }

        [data-sonner-toast][data-styled="true"] [data-icon] svg {
          width: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
          height: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
        }

        /* Per-type icon colors */
        [data-sonner-toast][data-type="success"] [data-icon] {
          color: rgb(22, 163, 74) !important;
        }

        [data-sonner-toast][data-type="error"] [data-icon] {
          color: rgb(220, 38, 38) !important;
        }

        [data-sonner-toast][data-type="info"] [data-icon] {
          color: rgb(37, 99, 235) !important;
        }

        [data-sonner-toast][data-type="warning"] [data-icon] {
          color: rgb(217, 119, 6) !important;
        }

        [data-sonner-toast][data-type="loading"] [data-icon] {
          color: rgb(124, 58, 237) !important;
        }

        /* Outline buttons like the mock ("Got it!") */
        [data-sonner-toast][data-styled="true"] [data-button] {
          height: auto !important;
          padding: clamp(4px, 0.3rem + 0.2vw, 7px)
            clamp(7px, 0.5rem + 0.25vw, 10px) !important;
          border-radius: 6px !important;
          font-family: var(--font-syne), ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
            "Noto Sans", sans-serif !important;
          font-size: clamp(0.625rem, 0.62rem + 0.08vw, 0.75rem) !important;
          font-weight: 400 !important;
          background: rgb(255 255 255) !important;
          color: #3F3F3F !important;
          border: 1px solid #EDEEEF !important;
          box-shadow: none !important;
        }

        /* Always-present "Got it!" button (styled close button) */
        [data-sonner-toast][data-styled="true"] [data-close-button] {
          position: static !important;
          inset: auto !important;
          transform: none !important;
          order: 9999 !important;
          flex: 0 0 auto !important;
          flex-shrink: 0 !important;
          white-space: nowrap !important;
          width: auto !important;
          height: auto !important;
          padding: clamp(4px, 0.3rem + 0.2vw, 7px)
            clamp(7px, 0.5rem + 0.25vw, 10px) !important;
          border-radius: 6px !important;
          margin-left: auto !important;
          margin-right: 0 !important;
          align-self: center !important;
          background: rgb(255 255 255) !important;
          color: #3f3f3f !important;
          border: 1px solid #edeeef !important;
          box-shadow: none !important;
          font-family: var(--font-syne), ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
            "Noto Sans", sans-serif !important;
          font-size: clamp(0.625rem, 0.62rem + 0.08vw, 0.75rem) !important;
          font-weight: 400 !important;
          line-height: 1.3 !important;
          letter-spacing: 0.02em !important;
        }

        [data-sonner-toast][data-styled="true"] [data-close-button]:hover {
          background: rgb(248 250 252) !important; /* slate-50 */
        }

        [data-sonner-toast][data-styled="true"] [data-button]:hover {
          background: rgb(248 250 252) !important; /* slate-50 */
        }

        /* Dark mode — same radius, border weight, shadow; frosted dark surface */
        .dark [data-sonner-toast][data-styled="true"] {
          border-radius: 10px !important;
          border: 1px solid rgba(148, 163, 184, 0.22) !important;
          background: rgba(2, 6, 23, 0.6) !important;
          box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.06) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
        }

        .dark [data-sonner-toast][data-styled="true"] [data-title] {
          color: rgb(248 250 252) !important; /* slate-50 */
        }

        .dark [data-sonner-toast][data-styled="true"] [data-description] {
          color: rgb(148 163 184) !important; /* slate-400 */
        }

        .dark [data-sonner-toast][data-styled="true"] [data-button] {
          background: rgb(2 6 23) !important;
          color: rgb(248 250 252) !important;
          border: 1px solid rgba(148, 163, 184, 0.26) !important;
        }

        .dark [data-sonner-toast][data-styled="true"] [data-close-button] {
          background: rgb(2 6 23) !important;
          color: rgb(248 250 252) !important;
          border: 1px solid rgba(148, 163, 184, 0.26) !important;
        }

        .dark [data-sonner-toast][data-styled="true"] [data-button]:hover {
          background: rgb(15 23 42) !important; /* slate-900 */
        }

        .dark [data-sonner-toast][data-styled="true"] [data-close-button]:hover {
          background: rgb(15 23 42) !important; /* slate-900 */
        }
      `}</style>
      <Sonner
        style={{ zIndex: 999999999 }}
        className="toaster group z-50 bg-transparent"
        icons={{ ...defaultIcons, ...(icons ?? {}) }}
        toastOptions={{
          closeButtonAriaLabel: "Dismiss notification",
          classNames: {
            toast: "group toast",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:rounded-2xl group-[.toast]:border group-[.toast]:border-slate-200 group-[.toast]:bg-white group-[.toast]:text-slate-900 hover:group-[.toast]:bg-slate-50",
            cancelButton:
              "group-[.toast]:rounded-2xl group-[.toast]:border group-[.toast]:border-slate-200 group-[.toast]:bg-white group-[.toast]:text-slate-700 hover:group-[.toast]:bg-slate-50",
          },
        }}
        {...props}
      />
    </>
  )
}

export { Toaster }

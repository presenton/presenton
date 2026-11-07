"use client";

import { Check, Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, getLocaleDir } from "@/i18n/config";

type LocaleMenuProps = {
  /**
   * rail    — icon over code, for the dashboard icon rail
   * floating — pill for unauthenticated screens, which have no chrome
   */
  variant?: "rail" | "floating";
};

export default function LocaleMenu({ variant = "rail" }: LocaleMenuProps) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const dir = getLocaleDir(locale);
  const current =
    SUPPORTED_LOCALES.find((entry) => entry.code === locale) ??
    SUPPORTED_LOCALES[0];

  const changeLocale = (next: string) => {
    // Server-readable on the next request, which is what lets <html lang dir>
    // be correct without a redirect.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  const trigger =
    variant === "rail" ? (
      <button
        type="button"
        disabled={isPending}
        aria-label={current.label}
        title={current.label}
        className="flex w-full flex-col items-center gap-2 text-center transition-colors disabled:opacity-60"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="text-[11px] text-slate-800">{current.short}</span>
      </button>
    ) : (
      <button
        type="button"
        disabled={isPending}
        aria-label={current.label}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-[#EDEEEF] bg-white px-3 text-xs font-medium text-[#191919] shadow-sm transition-colors hover:bg-[#F8F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        {current.short}
      </button>
    );

  return (
    <DropdownMenu dir={dir}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        // `side` is physical in Radix, so it follows the document direction.
        side={dir === "rtl" ? "left" : "right"}
        className="min-w-[9rem]"
      >
        {SUPPORTED_LOCALES.map((entry) => (
          <DropdownMenuItem
            key={entry.code}
            onSelect={() => changeLocale(entry.code)}
            className="justify-between gap-3"
          >
            <span>{entry.label}</span>
            {entry.code === locale && <Check className="h-4 w-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

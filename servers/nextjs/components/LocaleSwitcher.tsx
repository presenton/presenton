"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useTransition } from "react";

import { LOCALE_COOKIE, SUPPORTED_LOCALES } from "@/i18n/config";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("settings.locale");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    // Persisting in a cookie keeps the preference server-readable on the next
    // request, which is what lets <html lang dir> be correct without a redirect.
    document.cookie = `${LOCALE_COOKIE}=${event.target.value}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="interface-locale"
        className="text-sm font-medium text-[#101828]"
      >
        {t("label")}
      </label>
      <p className="text-xs text-slate-500">{t("description")}</p>
      <select
        id="interface-locale"
        value={locale}
        onChange={handleChange}
        disabled={isPending}
        className="mt-1 w-full max-w-[220px] rounded-lg border border-[#E1E1E5] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#7C51F8] disabled:opacity-60"
      >
        {SUPPORTED_LOCALES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.label}
          </option>
        ))}
      </select>
    </div>
  );
}

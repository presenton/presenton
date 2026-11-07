"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, getLocaleDir } from "@/i18n/config";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("settings.locale");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Show the chosen language immediately; the RSC refresh replaces it shortly
  // after. Without this the trigger shows the previous value while pending,
  // which reads as "nothing happened" because the control is disabled.
  const [selected, setSelected] = useState(locale);
  useEffect(() => {
    // Only re-sync once the refresh has settled, so a failed cookie write or a
    // no-op refresh cannot leave the trigger claiming a language the UI never
    // switched to.
    if (!isPending) setSelected(locale);
  }, [locale, isPending]);

  const handleChange = (value: string) => {
    setSelected(value);
    // A cookie keeps the preference server-readable on the next request, which
    // is what lets <html lang dir> be correct without a redirect.
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <section aria-labelledby="locale-heading">
      <h4
        id="locale-heading"
        className="text-sm font-semibold text-[#191919] mb-1"
      >
        {t("label")}
      </h4>
      <p
        id="locale-description"
        className="text-xs text-[#6B7280] mb-6 leading-relaxed max-w-lg"
      >
        {t("description")}
      </p>

      <div className="flex items-center gap-2">
        <div className="w-full min-w-0 max-w-[222px]">
          <Select
            value={selected}
            onValueChange={handleChange}
            disabled={isPending}
            dir={getLocaleDir(locale)}
          >
            <SelectTrigger
              aria-labelledby="locale-heading"
              aria-describedby="locale-description"
              className="w-full h-12 px-4 outline-none border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#5146E5] focus-visible:ring-offset-2 focus:border-[#5146E5] transition-colors hover:border-gray-400 justify-between"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LOCALES.map((entry) => (
                <SelectItem key={entry.code} value={entry.code}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isPending && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-[#9CA3AF]"
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
}

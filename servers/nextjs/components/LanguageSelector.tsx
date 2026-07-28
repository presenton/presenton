"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export default function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-[#3A3A3A]">
      <Languages className="h-4 w-4 text-[#5146E5]" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        value={locale}
        onChange={(event) => setLocale(event.target.value === "zh-CN" ? "zh-CN" : "en")}
        className="h-9 rounded-md border border-[#E1E1E5] bg-white px-2 text-xs text-[#191919] outline-none focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/15"
      >
        <option value="en">{t("language.english")}</option>
        <option value="zh-CN">{t("language.simplifiedChinese")}</option>
      </select>
    </label>
  );
}

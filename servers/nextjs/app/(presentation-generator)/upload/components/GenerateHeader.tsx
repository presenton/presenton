"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import type { RootState } from "@/store/store";
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from "@/utils/providerConstants";
import Wrapper from "@/components/Wrapper";

export default function GenerateHeader() {
  const t = useTranslations("upload.header");
  const config = useSelector((state: RootState) => state.userConfig.llm_config);
  const [stars, setStars] = useState<number | null>(null);
  const providers = [LLM_PROVIDERS[config.LLM || "openai"], config.DISABLE_IMAGE_GENERATION ? undefined : IMAGE_PROVIDERS[config.IMAGE_PROVIDER || ""]].filter((provider) => Boolean(provider?.icon));

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/github-stars", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => { if (typeof data?.stars === "number") setStars(data.stars); }).catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <header className="h-[66px] bg-white">
      <Wrapper className="flex h-full items-center justify-between gap-3 px-4 sm:px-10 lg:px-20">
        <Link href="/dashboard" aria-label={t("dashboardAria")} className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-[#7A5AF8]"><Image src="/logo-with-bg.png" alt="Presenton" width={40} height={41} /></Link>
        <div className="flex h-[42px] items-center gap-2 rounded-xl border border-[#EDEEEF] bg-white px-2 font-syne text-sm text-[#191919] sm:gap-[18px] sm:px-3">
          <Link href="/settings" aria-label={t("configureAria")} className="flex items-center gap-1.5 rounded-full p-1.5 hover:bg-[#F8F8FA] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]">
            <span className="flex items-center" aria-hidden="true">{providers.map((provider, index) => <span key={`${provider!.value}-${index}`} className={`flex h-6 w-6 items-center justify-center overflow-hidden rounded-[3px] border border-[#EDEEEF] bg-white ${index ? "-ms-px rotate-[7deg]" : "-rotate-[6deg]"}`}><Image src={provider!.icon!} alt="" width={16} height={16} className="object-contain" /></span>)}</span>
            <span>{config.LLM === "presenton" ? t("presenton") : t("byok")}</span>
          </Link>
          <span className="h-5 w-px bg-[#EDEEEF]" aria-hidden="true" />
          <a href="https://github.com/presenton/presenton" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full p-1.5 hover:bg-[#F8F8FA] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]" aria-label={t("starAria")}><Image src="/dashboard-header/github.svg" alt="" width={18} height={18} /><span className="hidden sm:inline">{t("star")}</span>{stars !== null && <><span aria-hidden="true">·</span><span className="text-xs">{Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(stars)}</span></>}</a>
          <span className="h-5 w-px bg-[#EDEEEF]" aria-hidden="true" />
          <a href="https://discord.com/invite/9ZsKKxudNE" target="_blank" rel="noreferrer" aria-label={t("discordAria")} className="rounded-full p-1.5 hover:bg-[#F8F8FA] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]"><Image src="/dashboard-header/discord.svg" alt="" width={18} height={18} /></a>
        </div>
      </Wrapper>
    </header>
  );
}

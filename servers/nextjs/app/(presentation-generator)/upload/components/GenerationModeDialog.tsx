"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { GenerationMode, PresentationGenerationMode } from "@/utils/presentationGenerationMode";
import { isGenerationModeAvailable } from "@/utils/presentationGenerationMode";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

const modes = [
  { id: "standard" as const, titleKey: "standardTitle", labelKey: "standardLabel", video: "/Standard.mp4", descriptionKey: "standardDescription", featureKeys: ["standardFeature1", "standardFeature2"] },
  { id: "smart" as const, titleKey: "smartTitle", labelKey: "smartLabel", video: "/Smart.mp4", descriptionKey: "smartDescription", featureKeys: ["smartFeature1", "smartFeature2"] },
];

export default function GenerationModeDialog({ open, onOpenChange, onSelect, availableMode = "both" }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: GenerationMode) => void;
  availableMode?: PresentationGenerationMode;
}) {
  const t = useTranslations("upload.mode");
  const [activeMode, setActiveMode] = useState<GenerationMode | null>(null);
  const videos = useRef<Partial<Record<GenerationMode, HTMLVideoElement | null>>>({});

  useEffect(() => {
    for (const mode of modes) {
      const video = videos.current[mode.id];
      if (!video) continue;
      if (!open || (activeMode !== null && activeMode !== mode.id)) video.pause();
      else void video.play().catch(() => {});
    }
  }, [activeMode, open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setActiveMode(null); onOpenChange(nextOpen); }}>
      <DialogContent hideDefaultClose overlayClassName="bg-black/30 backdrop-blur-none" className="max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[820px] gap-5 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:rounded-none">
        <DialogTitle className="sr-only">{t("dialogTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("dialogDescription")}</DialogDescription>
        <DialogClose aria-label={t("closeAria")} className="absolute end-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#666666] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#7A5AF8]"><X className="h-4 w-4" /></DialogClose>
        <div className="grid gap-5 md:grid-cols-2" onMouseLeave={() => setActiveMode(null)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveMode(null); }}>
          {modes.map((mode) => {
            const dimmed = activeMode !== null && activeMode !== mode.id;
            const available = isGenerationModeAvailable(availableMode, mode.id);
            return (
              <button key={mode.id} type="button" disabled={!available} aria-label={t("selectAria", { mode: t(mode.labelKey) })} onMouseEnter={() => setActiveMode(mode.id)} onFocus={() => setActiveMode(mode.id)} onClick={() => { setActiveMode(null); onSelect(mode.id); onOpenChange(false); }} className={`overflow-hidden rounded-xl bg-white text-start transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] disabled:cursor-not-allowed disabled:opacity-40 ${activeMode === mode.id ? "shadow-[0_4px_18px_rgba(0,0,0,0.37)]" : ""}`}>
                <div className={`transition-opacity ${dimmed ? "opacity-70" : "opacity-100"}`}>
                  <video ref={(element) => { videos.current[mode.id] = element; }} src={mode.video} autoPlay muted loop playsInline aria-label={t("previewAria", { mode: t(mode.labelKey) })} className="aspect-[4/3] w-full object-cover" />
                  <div className="space-y-[18px] p-[22px] font-manrope">
                    <p className="text-xs font-semibold tracking-[1.2px] text-[#666666]">{t(mode.titleKey)}</p>
                    <p className="text-sm font-medium leading-[22px] tracking-[0.28px] text-[#333333]">
                      <span className={`me-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold leading-4 ${mode.id === "smart" ? "bg-[#EFEDFE] text-[#5F48F3]" : "bg-[#F4FBFE] text-[#01A8F2]"}`}>{t(mode.labelKey)}</span>
                      {t(mode.descriptionKey)}
                    </p>
                    <ul className="divide-y divide-[#EDEEEF] font-syne text-[13px] leading-5 text-[#333333]">
                      {mode.featureKeys.map((featureKey) => <li key={featureKey} className="flex items-center gap-1 py-2 first:pt-0 last:pb-0"><Image src={`/generate/${mode.id}-check.svg`} alt="" width={14} height={14} />{t(featureKey)}</li>)}
                    </ul>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

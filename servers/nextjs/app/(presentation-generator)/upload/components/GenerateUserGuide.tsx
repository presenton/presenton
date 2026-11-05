"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import type { GenerationMode } from "@/utils/presentationGenerationMode";

const GUIDE_KEY = "presenton_generate_guide_v3";

export default function GenerateUserGuide({ mode, communityEnabled }: { mode: GenerationMode; communityEnabled: boolean }) {
  const t = useTranslations("upload.guide");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const steps = [
    { target: "setup", title: t("setupTitle"), description: t("setupDescription") },
    { target: "prompt", title: t("promptTitle"), description: t("promptDescription") },
    ...(mode === "smart" && communityEnabled ? [{ target: "designs", title: t("designsTitle"), description: t("designsDescription") }] : []),
    { target: "prompt", title: t("generateTitle"), description: t("generateDescription") },
  ];
  const current = steps[Math.min(step, steps.length - 1)];

  useEffect(() => {
    try { if (localStorage.getItem(GUIDE_KEY) !== "seen") setOpen(true); } catch { /* The page remains usable without storage. */ }
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "?" || target?.closest("input, textarea, [contenteditable=true], [role=dialog]") || document.querySelector("[role=dialog]")) return;
      event.preventDefault();
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const target = document.querySelector<HTMLElement>(`[data-generate-guide="${current.target}"]`);
    if (!target) return;
    const previousOutline = target.style.outline;
    const previousOffset = target.style.outlineOffset;
    target.style.outline = "2px solid #7A5AF8";
    target.style.outlineOffset = "6px";
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => { target.style.outline = previousOutline; target.style.outlineOffset = previousOffset; };
  }, [open, current.target]);

  const close = () => {
    try { localStorage.setItem(GUIDE_KEY, "seen"); } catch { /* Closing does not depend on storage. */ }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent overlayClassName="bg-black/15 backdrop-blur-none" className="top-auto bottom-4 max-w-[440px] translate-y-0 rounded-xl border-[#EDEEEF] bg-white p-6 font-syne sm:bottom-6">
        <p className="text-xs text-[#7A5AF8]">{t("progress", { current: Math.min(step + 1, steps.length), total: steps.length })}</p>
        <DialogTitle className="pe-4 text-lg text-[#191919]">{current.title}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-[#666666]">{current.description}</DialogDescription>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="text-xs text-[#808080] hover:text-[#191919]">{t("skip")}</button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep((value) => value - 1)}>{t("back")}</Button>}
            <Button className="bg-[#7A5AF8] text-white hover:bg-[#6847E8]" onClick={() => step >= steps.length - 1 ? close() : setStep((value) => value + 1)}>{step >= steps.length - 1 ? t("getStarted") : t("next")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

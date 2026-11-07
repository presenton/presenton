"use client";

import { useState } from "react";
import { ArrowLeft, LayoutTemplate, Loader2, Presentation } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTemplateSummaries } from "@/app/(presentation-generator)/hooks/useTemplateSummaries";
import {
  TemplateListCard,
  TemplateListEmptyState,
  TemplateListLoadingState,
} from "@/app/(presentation-generator)/components/TemplateListUi";
import type { TemplateListItem } from "@/app/(presentation-generator)/services/api/template";

type BlankPresentationDialogProps = {
  open: boolean;
  isCreating: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueWithoutTemplate: () => void;
  onContinueWithTemplate: (template: TemplateListItem) => void;
};

type DialogStep = "choice" | "templates";

function ChoiceCard({
  title,
  description,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex min-h-44 flex-col items-start rounded-2xl border border-[#E5E7EB] bg-white p-5 text-start outline-none transition hover:-translate-y-0.5 hover:border-[#7A5AF8] hover:shadow-[0_16px_36px_rgba(34,31,54,0.10)] focus-visible:border-[#7A5AF8] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/30 disabled:cursor-wait disabled:opacity-60"
    >
      <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EDFF] text-[#6847F4] transition-colors group-hover:bg-[#E8E2FF]">
        {icon}
      </span>
      <span className="font-syne text-base font-semibold text-[#191919]">
        {title}
      </span>
      <span className="mt-2 text-sm leading-5 text-[#6B6D76]">
        {description}
      </span>
    </button>
  );
}

function TemplatePicker({
  isCreating,
  onSelect,
  onRetry,
}: {
  isCreating: boolean;
  onSelect: (template: TemplateListItem) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("dashboard.blankDialog");
  const { defaultTemplates, customTemplates, loading, error } =
    useTemplateSummaries();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const handleSelect = (template: TemplateListItem) => {
    if (isCreating) return;
    setSelectedTemplateId(template.id);
    onSelect(template);
  };

  if (loading) {
    return <TemplateListLoadingState />;
  }

  if (error) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6847F4] hover:bg-[#F0EDFF]"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  const hasTemplates = defaultTemplates.length + customTemplates.length > 0;

  if (!hasTemplates) {
    return <TemplateListEmptyState message={t("noTemplates")} />;
  }

  return (
    <div className="relative" aria-busy={isCreating}>
      <div className="space-y-8" inert={isCreating || undefined}>
        {defaultTemplates.length > 0 && (
          <section>
            <h3 className="mb-4 font-syne text-sm font-semibold text-[#333333]">
              {t("builtInTemplates")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {defaultTemplates.map((template) => (
                <TemplateListCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onClick={() => handleSelect(template)}
                />
              ))}
            </div>
          </section>
        )}

        {customTemplates.length > 0 && (
          <section>
            <h3 className="mb-4 font-syne text-sm font-semibold text-[#333333]">
              {t("yourTemplates")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {customTemplates.map((template) => (
                <TemplateListCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onClick={() => handleSelect(template)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {isCreating && (
        <div role="status" className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#4F3BC8] shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("creating")}
          </div>
        </div>
      )}
    </div>
  );
}

export function BlankPresentationDialog({
  open,
  isCreating,
  onOpenChange,
  onContinueWithoutTemplate,
  onContinueWithTemplate,
}: BlankPresentationDialogProps) {
  const t = useTranslations("dashboard.blankDialog");
  const [step, setStep] = useState<DialogStep>("choice");
  const [templateLoadAttempt, setTemplateLoadAttempt] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isCreating) return;
        if (!nextOpen) setStep("choice");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        hideDefaultClose={isCreating}
        className={
          step === "templates"
            ? "max-h-[88dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl border-[#E5E7EB] p-0"
            : "max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-[#E5E7EB] p-6 sm:p-7"
        }
        onEscapeKeyDown={(event) => {
          if (isCreating) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isCreating) event.preventDefault();
        }}
      >
        {step === "choice" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-syne text-xl text-[#191919]">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="pt-1 text-sm text-[#6B6D76]">
                {t("description")}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ChoiceCard
                title={t("withTemplate")}
                description={t("withTemplateDescription")}
                icon={<LayoutTemplate className="h-5 w-5" />}
                onClick={() => setStep("templates")}
                disabled={isCreating}
              />
              <ChoiceCard
                title={t("withoutTemplate")}
                description={t("withoutTemplateDescription")}
                icon={<Presentation className="h-5 w-5" />}
                onClick={onContinueWithoutTemplate}
                disabled={isCreating}
              />
            </div>
            {isCreating && (
              <div role="status" className="flex items-center justify-center gap-2 text-sm text-[#4F3BC8]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("creating")}
              </div>
            )}
          </>
        ) : (
          <div className="flex max-h-[88dvh] flex-col">
            <div className="border-b border-[#EDEEEF] px-6 py-5 sm:px-7">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setStep("choice")}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#64666F] transition-colors hover:text-[#6847F4] disabled:cursor-wait disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </button>
              <DialogHeader>
                <DialogTitle className="font-syne text-xl text-[#191919]">
                  {t("chooseTitle")}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm text-[#6B6D76]">
                  {t("chooseDescription")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7">
              <TemplatePicker
                key={templateLoadAttempt}
                isCreating={isCreating}
                onSelect={onContinueWithTemplate}
                onRetry={() => setTemplateLoadAttempt((attempt) => attempt + 1)}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

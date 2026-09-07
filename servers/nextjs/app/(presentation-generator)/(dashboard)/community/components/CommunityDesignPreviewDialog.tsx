"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Eye,
  Heart,
  LoaderCircle,
  X,
} from "lucide-react";

import SmartHtmlSlide from "@/app/(presentation-generator)/components/SmartHtmlSlide";
import {
  CommunityPresentationApi,
  getCommunityPresentationAuthor,
  getCommunityPresentationTitle,
  getCommunityReferenceIds,
  type CommunityPresentation,
} from "@/app/(presentation-generator)/services/api/community";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { notify } from "@/components/ui/sonner";
import {
  IMAGE_PROVIDERS,
  LLM_PROVIDERS,
  WEB_SEARCH_PROVIDERS,
} from "@/utils/providerConstants";

interface CommunityDesignPreviewDialogProps {
  presentation: CommunityPresentation | null;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onUseDesign: (presentation: CommunityPresentation) => void;
}

export default function CommunityDesignPreviewDialog({
  presentation,
  open,
  loading,
  onOpenChange,
  onUseDesign,
}: CommunityDesignPreviewDialogProps) {
  const [referenceView, setReferenceView] = useState<{
    sourceCommunityId: number;
    referenceId: number;
    presentation: CommunityPresentation;
  } | null>(null);
  const [loadingReferenceId, setLoadingReferenceId] = useState<number | null>(
    null
  );
  const referenceRequestId = useRef(0);

  useEffect(() => {
    referenceRequestId.current += 1;
    setLoadingReferenceId(null);
    setReferenceView(null);
  }, [presentation?.id]);

  const referencePresentation =
    referenceView && referenceView.sourceCommunityId === presentation?.id
      ? referenceView.presentation
      : null;
  const displayedPresentation = referencePresentation ?? presentation;
  const isShowingReference = referencePresentation !== null;
  const isLoadingReference = loadingReferenceId !== null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      referenceRequestId.current += 1;
      setLoadingReferenceId(null);
      setReferenceView(null);
    }
    onOpenChange(nextOpen);
  };

  const handleShowReference = async (referenceId: number) => {
    if (
      !presentation ||
      isLoadingReference ||
      referenceView?.referenceId === referenceId
    ) {
      return;
    }

    const requestId = referenceRequestId.current + 1;
    referenceRequestId.current = requestId;
    setLoadingReferenceId(referenceId);

    try {
      const response = await CommunityPresentationApi.getById(referenceId);
      if (referenceRequestId.current !== requestId) return;

      setReferenceView({
        sourceCommunityId: presentation.id,
        referenceId,
        presentation: response,
      });
    } catch (error) {
      if (referenceRequestId.current !== requestId) return;
      notify.error(
        "Could not load the reference presentation",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      if (referenceRequestId.current === requestId) {
        setLoadingReferenceId(null);
      }
    }
  };

  const handleBackToCommunity = () => {
    referenceRequestId.current += 1;
    setLoadingReferenceId(null);
    setReferenceView(null);
  };

  const copyPrompt = async () => {
    const prompt = displayedPresentation?.prompt?.trim();
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
      notify.success("Prompt copied");
    } catch {
      notify.error("Could not copy the prompt");
    }
  };

  const title = displayedPresentation
    ? getCommunityPresentationTitle(displayedPresentation)
    : "";
  const author = displayedPresentation
    ? getCommunityPresentationAuthor(displayedPresentation)
    : "";
  const slides = (displayedPresentation?.slides ?? []).filter((slide) =>
    slide.trim()
  );
  const setup = displayedPresentation?.setup;
  const textProvider = setup?.text_provider?.trim() || null;
  const imageProvider = setup?.image_provider?.trim() || null;
  const webSearchProvider = setup?.web_search_provider?.trim() || null;
  const referencePresentationIds = getCommunityReferenceIds(presentation);
  const setupProviders = Array.from(
    new Set([
      textProvider ?? "presenton",
      imageProvider ?? "presenton",
      webSearchProvider ?? "presenton",
    ])
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideDefaultClose
        overlayClassName="bg-black/30"
        className="block h-[100dvh] w-screen max-w-none gap-0 border-0 bg-transparent p-0 shadow-none sm:h-auto sm:w-[calc(100vw-32px)] sm:max-w-[977px]"
      >
        {presentation && (
          <>
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white shadow-[0_16px_50px_rgba(0,0,0,0.16)] sm:h-[min(614px,calc(100dvh-32px))] sm:rounded-[22px]">
              <header className="flex min-h-[100px] shrink-0 items-center gap-3 border-b border-[#EDEEEF] bg-white px-4 py-4 pr-14 shadow-[0_4px_7px_rgba(0,0,0,0.04)] sm:gap-5 sm:px-6 sm:py-5 sm:pr-16 min-[1100px]:pr-6">
                <div className="min-w-0 flex-1 font-syne">
                  {isShowingReference && (
                    <button
                      type="button"
                      onClick={handleBackToCommunity}
                      className="mb-1 inline-flex items-center gap-1 text-xs text-[#6847F4] transition hover:text-[#5137C8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                    >
                      <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                      Community preview
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg font-normal leading-normal text-[#191919]">
                      {title}
                    </DialogTitle>
                    {loading && (
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[#6847F4]" />
                    )}
                  </div>
                  <DialogDescription className="mt-1 line-clamp-2 text-sm font-normal leading-normal tracking-[-0.14px] text-[#808080]">
                    {displayedPresentation?.description?.trim() ||
                      "Shared community presentation."}
                  </DialogDescription>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <CommunityCount
                    icon={<Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
                    label={`${presentation.views ?? 0} views`}
                    value={presentation.views ?? 0}
                  />
                  <CommunityCount
                    icon={<Heart aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
                    label={`${presentation.likes ?? 0} likes`}
                    value={presentation.likes ?? 0}
                  />
                  <button
                    type="button"
                    onClick={() => onUseDesign(presentation)}
                    className="inline-flex h-[41px] shrink-0 items-center justify-center rounded-full border border-[#EDEEEF] px-[26px] font-syne text-sm font-normal tracking-[0.16px] text-[#191919] transition hover:bg-[#F8F8FA]"
                  >
                    Use Design
                  </button>
                </div>
              </header>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(230px,270px)] sm:overflow-hidden">
                <div
                  className="min-h-[300px] bg-[#FBFCFD] bg-center bg-repeat p-3 sm:min-h-0 sm:overflow-y-auto sm:overscroll-contain sm:p-4 sm:pr-5"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, #DEDEE0 1.5px, transparent 1.5px)",
                    backgroundSize: "23px 23px",
                  }}
                >
                  {slides.length > 0 ? (
                    <div className="flex flex-col gap-3.5">
                      {slides.map((slide, index) => (
                        <div
                          key={`${displayedPresentation?.id ?? presentation.id}-${index}`}
                          className="aspect-[1840/1038] w-full overflow-hidden bg-white"
                        >
                          <SmartHtmlSlide
                            html={slide}
                            fonts={displayedPresentation?.fonts}
                            title={`${title} slide ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[#D9D9DE] bg-white text-sm text-[#808080]">
                      {loading ? "Loading slide previews ..." : "No slide previews available"}
                    </div>
                  )}
                </div>

                <aside className="shrink-0 overflow-visible border-t border-[#EDEEEF] bg-white p-4 font-syne sm:flex sm:min-h-0 sm:flex-col sm:overflow-hidden sm:border-l sm:border-t-0 sm:p-5">
                  <section className="shrink-0">
                    <h3 className="text-base font-medium text-black">AI Setup</h3>

                    <div className="mt-2.5 flex h-[22px] items-center">
                      {setupProviders.map((provider, index) => (
                        <ProviderLogo
                          key={provider}
                          provider={provider}
                          className={index > 0 ? "-ml-[4px]" : ""}
                        />
                      ))}
                    </div>

                    <dl className="mt-2.5 space-y-2.5">
                      <SetupRow label="Text">
                        <SetupChip>
                          {textProvider ? getProviderVisual(textProvider).label : "Presenton managed"}
                        </SetupChip>
                        {setup?.text_model?.trim() && (
                          <SetupChip>{setup.text_model}</SetupChip>
                        )}
                      </SetupRow>
                      <SetupRow label="Images">
                        <SetupChip>
                          {imageProvider ? getProviderVisual(imageProvider).label : "Presenton managed"}
                        </SetupChip>
                      </SetupRow>
                      <SetupRow label="Web Search">
                        <SetupChip>
                          {webSearchProvider ? getProviderVisual(webSearchProvider).label : "Presenton managed"}
                        </SetupChip>
                      </SetupRow>
                      {referencePresentationIds.length > 0 && (
                        <SetupRow label="Reference">
                          {referencePresentationIds.map((referenceId) => {
                            const isActiveReference =
                              isShowingReference &&
                              referenceView?.referenceId === referenceId;
                            const isLoadingThisReference =
                              loadingReferenceId === referenceId;

                            return (
                              <button
                                key={referenceId}
                                type="button"
                                onClick={() => void handleShowReference(referenceId)}
                                disabled={isLoadingReference || isActiveReference}
                                title={String(referenceId)}
                                aria-label={
                                  isActiveReference
                                    ? `Viewing reference presentation ${referenceId}`
                                    : `Preview reference presentation ${referenceId}`
                                }
                                aria-pressed={isActiveReference}
                                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-[10px] border border-[#BFDBFE] bg-[#FAFAFF] px-2.5 py-0.5 text-xs font-normal text-[#4C4C4C] transition-colors hover:border-[#BDB4FD] hover:text-[#6847F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 disabled:cursor-wait disabled:opacity-60"
                              >
                                <span className="min-w-0 truncate font-mono text-[10px]">
                                  {referenceId}
                                </span>
                                {isActiveReference ? (
                                  <Check aria-hidden="true" className="h-3 w-3 shrink-0" />
                                ) : isLoadingThisReference ? (
                                  <LoaderCircle
                                    aria-hidden="true"
                                    className="h-3 w-3 shrink-0 animate-spin"
                                  />
                                ) : (
                                  <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </SetupRow>
                      )}
                    </dl>
                  </section>

                  <div className="my-4 h-px shrink-0 bg-[#EDEEEF] sm:my-7" />

                  <section className="sm:flex sm:min-h-0 sm:flex-1 sm:flex-col">
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-medium text-black">Prompt</h3>
                        <p className="mt-1 font-manrope text-xs font-normal text-[#4C4C4C]">
                          Paste into the prompt field.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyPrompt()}
                        disabled={!displayedPresentation?.prompt?.trim()}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#191919] transition hover:bg-[#F6F6F9] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Copy example prompt"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2.5 max-h-[110px] overflow-y-auto overscroll-contain border-y border-[#EDEEEF] bg-[#F9FAFB] p-2.5 sm:mt-3.5 sm:min-h-0 sm:flex-1 sm:max-h-[165px]">
                      <p className="font-syne text-sm font-normal leading-5 text-[#191919]">
                        {displayedPresentation?.prompt?.trim() ||
                          "No prompt was shared with this presentation."}
                      </p>
                    </div>
                  </section>

                  <div className="mt-4 shrink-0 sm:mt-7">
                    <section className="min-w-0">
                      <h3 className="text-base font-medium text-black">Creator</h3>
                      <p className="mt-1 break-all text-xs font-normal leading-4 text-[#4C4C4C]">
                        by {author}
                      </p>
                    </section>

                    <div className="mt-3 flex items-center gap-2 sm:hidden">
                      <CommunityCount
                        icon={<Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
                        label={`${presentation.views ?? 0} views`}
                        value={presentation.views ?? 0}
                      />
                      <CommunityCount
                        icon={<Heart aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
                        label={`${presentation.likes ?? 0} likes`}
                        value={presentation.likes ?? 0}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onUseDesign(presentation)}
                      className="mt-2 inline-flex h-[41px] w-full min-w-0 items-center justify-center gap-2 rounded-full border border-[#EDEEEF] px-5 text-sm text-[#191919] sm:hidden"
                    >
                      <Check className="h-4 w-4" />
                      Use Design
                    </button>
                  </div>
                </aside>
              </div>
            </div>

            <DialogClose className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#191919] shadow-sm transition hover:bg-[#F8F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 min-[1100px]:-right-[68px] min-[1100px]:top-0 min-[1100px]:h-[52px] min-[1100px]:w-[52px]">
              <X
                className="h-5 w-5 min-[1100px]:h-6 min-[1100px]:w-6"
                strokeWidth={1.5}
              />
              <span className="sr-only">Close preview</span>
            </DialogClose>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CommunityCount({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <span
      aria-label={label}
      className="inline-flex h-[41px] min-w-[60px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#EDEEEF] bg-white px-2.5 font-syne text-sm font-normal text-[#4C4C4C] tabular-nums sm:min-w-[68px] sm:px-3"
    >
      {icon}
      {formatCount(value)}
    </span>
  );
}

function ProviderLogo({
  provider,
  className = "",
}: {
  provider: string;
  className?: string;
}) {
  const visual = getProviderVisual(provider);

  return (
    <span
      className={`relative flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#EDEEEF] bg-white ${className}`}
      title={visual.label}
    >
      {visual.src ? (
        <Image
          src={visual.src}
          alt=""
          aria-hidden="true"
          fill
          sizes="22px"
          className="object-contain p-0.5"
        />
      ) : (
        <span className="text-[8px] font-semibold text-[#4C4C4C]">
          {visual.initials}
        </span>
      )}
    </span>
  );
}

function SetupRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[18px] items-start gap-2.5">
      <dt className="w-[76px] shrink-0 pt-0.5 text-sm font-normal text-[#808080]">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1">{children}</dd>
    </div>
  );
}

function SetupChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[10px] border border-[#BFDBFE] bg-[#FAFAFF] px-2.5 py-0.5 text-xs font-normal text-[#4C4C4C]">
      {children}
    </span>
  );
}

function getProviderVisual(provider: string) {
  const normalized = provider.trim().toLowerCase();
  const option =
    LLM_PROVIDERS[normalized] ??
    IMAGE_PROVIDERS[normalized] ??
    WEB_SEARCH_PROVIDERS[normalized];
  const label =
    option?.label ??
    normalized
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") ??
    "Yarex";
  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "Y";

  return { label, src: option?.icon, initials };
}

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
  }
  return String(value);
}

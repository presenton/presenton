"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

import {
  DashboardApi,
  type PresentationResponse,
} from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import { LegacyPresentationsTable } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/LegacyPresentationsTable";
import { PresentationGenerationApi } from "@/app/(presentation-generator)/services/api/presentation-generation";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { notify } from "@/components/ui/sonner";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from "@/utils/providerConstants";



const actionCardBase =
  "absolute aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] border border-white/50 bg-cover bg-center bg-no-repeat shadow-[0_8px_18px_rgba(16,24,40,0.18)] transition-all duration-500 ease-out opacity-100 translate-y-0 scale-100";

const dashboardHeaderPill =
  "inline-flex shrink-0 items-center justify-center rounded-full text-[#191919] transition-colors hover:bg-[#F8F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2";

const dashboardBodyAsset = (name: string) => `/dashboard-body/${name}`;

const FloatingActionCards = () => (
  <div className="pointer-events-none absolute right-[14px] top-[-35px] z-0 hidden h-[64px] w-[158px] sm:block">
    <div
      className={`${actionCardBase} left-0 top-0 border-none group-hover/action:-translate-x-2 group-hover/action:-rotate-3 group-focus-visible/action:-translate-x-2 group-focus-visible/action:-rotate-3`}
      style={{
        backgroundImage: "url('/create_presentation_card_3.png')",
      }}
    />
    <div
      className={`${actionCardBase} left-[39px] top-1 z-10 border-none group-hover/action:-translate-y-1 group-hover/action:scale-105 group-focus-visible/action:-translate-y-1 group-focus-visible/action:scale-105`}
      style={{
        backgroundImage: "url('/create_presentation_card_2.png')",
      }}
    />
    <div
      className={`${actionCardBase} left-[76px] top-0 border-none group-hover/action:translate-x-2 group-hover/action:rotate-3 group-focus-visible/action:translate-x-2 group-focus-visible/action:rotate-3`}
      style={{
        backgroundImage: "url('/create_presentation_card_1.png')",
      }}
    />
  </div>
);

type DashboardActionCardProps = {
  href?: string;
  title: string;
  media: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
  mediaClassName?: string;
};

const DashboardActionCard = ({
  href,
  title,
  media,
  ariaLabel,
  onClick,
  disabled = false,
  isLoading = false,
  children,
  mediaClassName = "w-[96px]",
}: DashboardActionCardProps) => {
  const className =
    "group/action relative isolate flex h-[90px] w-full min-w-0 overflow-visible rounded-[10.8px] border border-[#EDEEEF] bg-white text-[#191919] outline-none transition-all duration-300 hover:border-[#D7D8DE] hover:shadow-[0_10px_28px_rgba(16,24,40,0.08)] focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-4 disabled:cursor-wait disabled:opacity-70 disabled:hover:border-[#EDEEEF] disabled:hover:shadow-none";
  const content = (
    <>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-[10.8px] bg-white"
      />
      <div
        className={`relative z-20 h-full ${mediaClassName} shrink-0 overflow-hidden rounded-l-[10.8px] bg-[#F8F8FB]`}
      >
        {media}
      </div>
      <span className="relative z-20 flex min-w-0 flex-1 items-center justify-center px-3 text-center font-syne text-sm font-medium leading-normal text-[#191919] sm:px-4">
        {title}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-label={ariaLabel}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={isLoading}
      className={className}
    >
      {content}
    </button>
  );
};

const BlankPresentationIllustration = ({
  isLoading,
}: {
  isLoading: boolean;
}) => (
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#D1E9FF]">
    <div className="relative h-[90px] w-[90px] shrink-0">
      <div className="absolute left-[22.312px] top-[20.46px] h-[52.514px] w-[48.892px] -rotate-[5.81deg] bg-[rgba(0,0,0,0.14)]" />
      <div className="absolute left-[21.452px] top-[19.94px] h-[52.514px] w-[48.892px] -rotate-[5.81deg] bg-[#ECEEEE]" />
      <div className="absolute left-[23.57px] top-[21.78px] h-[50.53px] w-[47.045px] bg-[rgba(0,0,0,0.14)]" />
      <div className="absolute left-[22.79px] top-[21.2px] h-[50.53px] w-[47.045px] bg-[#FEFEFF]" />
      <Image
        src="/dashboard/blank-presentation-clip.svg"
        alt=""
        aria-hidden="true"
        width={9}
        height={15}
        className="absolute left-[25.05px] top-[15.66px] h-[14.283px] w-[8.282px]"
      />
      <div className="absolute left-[25.31px] top-[21.2px] h-[0.387px] w-[0.968px] bg-[#FEFEFF]" />
    </div>

    {isLoading && (
      <div className="absolute inset-0 flex items-center justify-center bg-[#D1E9FF]/75">
        <Loader2 className="h-5 w-5 animate-spin text-[#6847F4]" />
      </div>
    )}
  </div>
);

const GridViewIcon = () => (
  <Image
    src={dashboardBodyAsset("grid.svg")}
    alt=""
    width={16}
    height={16}
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  />
);

const ListViewIcon = () => (
  <Image
    src={dashboardBodyAsset("list.svg")}
    alt=""
    width={16}
    height={16}
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  />
);

const sortPresentationsNewestFirst = (presentations: PresentationResponse[]) =>
  [...presentations].sort((a, b) => {
    
    const createdAtA = Date.parse(a.created_at);
    const createdAtB = Date.parse(b.created_at);

    return (
      (Number.isNaN(createdAtB) ? 0 : createdAtB) -
      (Number.isNaN(createdAtA) ? 0 : createdAtA)
    );
  });

function DashboardHeader() {
  const pathname = usePathname();
  const llmConfig = useSelector(
    (state: RootState) => state.userConfig.llm_config,
  );

  const textProvider = LLM_PROVIDERS[llmConfig.LLM || "openai"];
  const imageProvider = llmConfig.DISABLE_IMAGE_GENERATION
    ? undefined
    : IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER || ""];
  const configuredProviders = [textProvider, imageProvider].filter(
    (provider): provider is NonNullable<typeof provider> =>
      Boolean(provider?.icon),
  );

  return (
    <header className="sticky top-0 z-50 ml-7 mr-[9px] flex h-[105px] items-center justify-between border-b border-[#EDEEEF] bg-white px-1 max-lg:h-auto max-lg:min-h-[105px] max-lg:flex-col max-lg:items-start max-lg:gap-4 max-lg:py-5">
      <div className="flex w-[504.392px] max-w-full shrink-0 items-center gap-3.5 max-xl:w-auto">
        <h1 className="whitespace-nowrap font-syne text-[22px] font-medium leading-normal tracking-[-0.66px] text-[#101323]">
          Dashboard
        </h1>
      </div>

      <div className="max-w-full overflow-x-auto hide-scrollbar lg:overflow-visible">
        <div className="flex h-[42.24px] w-max max-w-none items-center gap-3 rounded-full pl-3">
          <div className="flex h-[42.24px] items-center gap-[18px] rounded-[32px] border border-[#EDEEEF] bg-white px-3 py-1">
            <Link
              href="/settings"
              className={`${dashboardHeaderPill} h-[26.1px] gap-1.5 p-1.5`}
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: "/settings",
                  source: "dashboard_header_settings",
                })
              }
            >
              <span
                className="flex h-[34.1px] shrink-0 items-center"
                title={configuredProviders
                  .map((provider) => provider.label)
                  .join(" + ")}
              >
                {configuredProviders.map((provider, index) => (
                  <span
                    key={`${provider.value}-${index}`}
                    className={`relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded-full border-[1.238px] border-[#EDEEEF] bg-white ${
                      index > 0 ? "-ml-[4.4px]" : "z-10"
                    }`}
                  >
                    <Image
                      src={provider.icon!}
                      alt=""
                      aria-hidden="true"
                      width={224}
                      height={224}
                      className="h-full w-full rounded-full object-cover"
                    />
                  </span>
                ))}
              </span>
              <span className="font-syne text-sm font-medium leading-[17.6px] tracking-[0.56px]">
                Settings
              </span>
            </Link>


          </div>

        </div>
      </div>
    </header>
  );
}

const DashboardPage: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [presentations, setPresentations] = useState<PresentationResponse[]>(
    [],
  );
  const [legacyPresentations, setLegacyPresentations] = useState<
    PresentationResponse[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBlankPresentation, setIsCreatingBlankPresentation] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckViewMode, setDeckViewMode] = useState<"grid" | "list">("grid");
  const blankPresentationRequestInFlight = useRef(false);

  const sortedPresentations = useMemo(
    () => sortPresentationsNewestFirst(presentations),
    [presentations],
  );

  const sortedLegacyPresentations = useMemo(
    () => sortPresentationsNewestFirst(legacyPresentations),
    [legacyPresentations],
  );

  const fetchPresentations = useCallback(async () => {
    let fetchedCount = 0;
    let hasError = false;
    try {
      setIsLoading(true);
      setError(null);
      const [supported, legacy] = await Promise.all([
        DashboardApi.getPresentations("v2-standard"),
        DashboardApi.getPresentations("v1-standard", { includeSlides: false }),
      ]);
      fetchedCount = supported.length + legacy.length;
      setPresentations(supported);
      setLegacyPresentations(legacy);
    } catch {
      hasError = true;
      setError(null);
      setPresentations([]);
      setLegacyPresentations([]);
    } finally {
      trackEvent(MixpanelEvent.Dashboard_Page_Viewed, {
        pathname,
        presentation_count: fetchedCount,
        load_failed: hasError,
      });
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    void fetchPresentations();
  }, [fetchPresentations]);

  const createBlankPresentation = useCallback(async () => {
    if (blankPresentationRequestInFlight.current) return;

    blankPresentationRequestInFlight.current = true;
    setIsCreatingBlankPresentation(true);
    trackEvent(MixpanelEvent.Dashboard_New_Presentation_Clicked, {
      pathname,
      source: "dashboard_blank_presentation_card",
    });

    try {
      const presentation =
        await PresentationGenerationApi.createBlankPresentation();
      trackEvent(MixpanelEvent.Dashboard_Blank_Presentation_Created, {
        pathname,
        presentation_id: presentation.id,
        slide_count: presentation.n_slides,
      });
      router.push(
        `/presentation?id=${encodeURIComponent(presentation.id)}&type=standard`,
      );
    } catch (creationError) {
      const message =
        creationError instanceof Error
          ? creationError.message
          : "Something went wrong while creating the presentation.";
      trackEvent(MixpanelEvent.Dashboard_Blank_Presentation_Create_Failed, {
        pathname,
        error_message: sanitizeAnalyticsError(creationError),
      });
      notify.error("Could not create blank presentation", message);
    } finally {
      blankPresentationRequestInFlight.current = false;
      setIsCreatingBlankPresentation(false);
    }
  }, [pathname, router]);

  const removePresentation = (presentationId: string) => {
    setPresentations((prev) => prev.filter((p) => p.id !== presentationId));
    setLegacyPresentations((prev) =>
      prev.filter((p) => p.id !== presentationId),
    );
  };

  const removeLegacyPresentations = (presentationIds: string[]) => {
    const deletedIds = new Set(presentationIds);
    setLegacyPresentations((prev) =>
      prev.filter((presentation) => !deletedIds.has(presentation.id)),
    );
  };

  return (
    <div className="relative min-h-screen w-full pb-10">
      <DashboardHeader />
      <section className="relative z-10 overflow-visible pb-0 pl-3 pr-3 pt-[17px] sm:pl-6 sm:pr-[9px]">
        <h2 className="w-full font-syne text-[16px] font-medium leading-[normal] text-[#191919]">
          Actions
        </h2>
        <div className="mt-[18px] grid w-full max-w-[625px] grid-cols-1 gap-4 sm:grid-cols-2">
          <DashboardActionCard
            href="/upload"
            onClick={() =>
              trackEvent(MixpanelEvent.Dashboard_New_Presentation_Clicked, {
                pathname,
                source: "dashboard_actions_card",
              })
            }
            title="Create new Presentation"
            ariaLabel="Create new presentation"
            media={
              <Image
                src="/create_presentation_bg.png"
                alt=""
                fill
                sizes="96px"
                className="h-full w-full object-cover object-left"
              />
            }
          >
            <FloatingActionCards />
          </DashboardActionCard>

          <DashboardActionCard
            onClick={() => void createBlankPresentation()}
            disabled={isCreatingBlankPresentation}
            isLoading={isCreatingBlankPresentation}
            title={
              isCreatingBlankPresentation ? "Creating..." : "Blank Presentation"
            }
            ariaLabel={
              isCreatingBlankPresentation
                ? "Creating blank presentation"
                : "Create blank presentation"
            }
            mediaClassName="w-[90px]"
            media={
              <BlankPresentationIllustration
                isLoading={isCreatingBlankPresentation}
              />
            }
          />
        </div>
      </section>
      <section className="relative z-10 mt-[46px] pl-3 pr-3 sm:pl-6 sm:pr-[9px]">
        <div className="mb-[14px] flex items-center justify-between gap-4">
          <h2 className="font-syne text-[16px] font-medium leading-[normal] text-[#191919]">
            Decks
          </h2>
          <div className="flex items-center gap-[17px]">
            <div className="flex items-center rounded-[4px] border border-[#EDEEEF] p-1">
              <button
                type="button"
                onClick={() => setDeckViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={deckViewMode === "grid"}
                className={`flex items-center rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${deckViewMode === "grid" ? "bg-[#F6F6F9]" : "hover:bg-[#FAFAFC]"}`}
              >
                <GridViewIcon />
              </button>
              <button
                type="button"
                onClick={() => setDeckViewMode("list")}
                aria-label="List view"
                aria-pressed={deckViewMode === "list"}
                className={`flex items-center rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${deckViewMode === "list" ? "bg-[#F6F6F9]" : "hover:bg-[#FAFAFC]"}`}
              >
                <ListViewIcon />
              </button>
            </div>
          </div>
        </div>
        <PresentationGrid
          presentations={sortedPresentations}
          viewMode={deckViewMode}
          isLoading={isLoading}
          error={error}
          onPresentationDeleted={removePresentation}
          onPresentationDuplicated={(presentation) =>
            setPresentations((prev) => [presentation, ...prev])
          }
        />
      </section>
      {!isLoading && sortedLegacyPresentations.length > 0 && (
        <div className="relative z-10 mt-[46px] px-3 sm:px-6">
          <LegacyPresentationsTable
            presentations={sortedLegacyPresentations}
            onPresentationsDeleted={removeLegacyPresentations}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

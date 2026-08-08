"use client";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import "@/app/(presentation-generator)/utils/prism-languages";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { AlertCircle } from "lucide-react";
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { useFontLoader } from "@/app/(presentation-generator)/hooks/useFontLoad";
import { Theme } from "@/app/(presentation-generator)/services/api/types";
import SlideScale from "@/app/(presentation-generator)/components/PresentationRender";
import {
  shouldRenderTemplateV2HtmlPreview,
  TemplateV2HtmlSlidePreview,
} from "@/app/(presentation-generator)/components/TemplateV2HtmlSlidePreview";
import { normalizeBackendAssetUrls } from "@/utils/api";
import { ensureTailwindBrowserScript } from "@/lib/tailwind-browser";

const PDF_PRINT_STYLE = `
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
  }

  #presentation-slides-wrapper {
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    gap: 0 !important;
  }

  #presentation-slides-wrapper .slides-export-stack {
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  #presentation-slides-wrapper .main-slide {
    width: 1280px !important;
    min-width: 1280px !important;
    max-width: 1280px !important;
    height: 720px !important;
    min-height: 720px !important;
    max-height: 720px !important;
    flex: 0 0 720px !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }

  #presentation-slides-wrapper .slide-export-inner {
    width: 1280px !important;
    height: 720px !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }

  @media print {
    @page {
      size: 1280px 720px;
      margin: 0;
    }

    #presentation-slides-wrapper {
      overflow: visible !important;
    }

    #presentation-slides-wrapper .main-slide {
      break-after: page;
      page-break-after: always;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    #presentation-slides-wrapper .main-slide:last-child {
      break-after: auto;
      page-break-after: auto;
    }
  }
`;

type PresentationPageProps = {
  presentation_id: string;
  exportCookie?: string;
};

const PresentationPage = ({ presentation_id, exportCookie }: PresentationPageProps) => {
  const pathname = usePathname();
  const [contentLoading, setContentLoading] = useState(true);
  const exportCookieFromHash =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get(
          "exportCookie"
        ) ?? undefined
      : undefined;
  const effectiveExportCookie = exportCookie ?? exportCookieFromHash;

  const dispatch = useDispatch();
  const { presentationData } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (presentationData?.slides?.[0]?.layout?.includes("custom")) {
      ensureTailwindBrowserScript();
    }
  }, [presentationData]);
  useEffect(() => {
    fetchUserSlides();
  }, []);

  const fetchUserSlides = async () => {
    try {
      const data = effectiveExportCookie
        ? await fetchPresentationForExport(presentation_id, effectiveExportCookie)
        : await DashboardApi.getPresentation(presentation_id);
      const normalizedData = normalizeBackendAssetUrls(data);
      dispatch(setPresentationData(normalizedData));

      if (normalizedData.fonts) {
        useFontLoader(normalizedData.fonts);
      }
      if (normalizedData?.theme) {
        try {
          applyTheme(normalizedData.theme);
        } catch (themeError) {
          // Theme issues should not block export rendering.
          console.warn("Theme application skipped for pdf-maker:", themeError);
        }
      }
    } catch (error) {
      setError(true);
      notify.error("Failed to load presentation", "The presentation could not be loaded. Please try again.");
      console.error("Error fetching user slides:", error);
    } finally {
      setContentLoading(false);
    }
  };

  const fetchPresentationForExport = async (
    id: string,
    cookieHeader: string
  ) => {
    const response = await fetch(`/api/export-presentation-data/${id}`, {
      method: "GET",
      headers: {
        "x-export-cookie": cookieHeader,
      },
      cache: "no-store",
    });

    return ApiResponseHandler.handleResponse(
      response,
      "Presentation not found"
    );
  };

  const applyTheme = (theme: Theme) => {
    const element = document.getElementById("presentation-slides-wrapper");
    if (!element) return;
    if (!theme?.data) return;
    if (!theme.data.colors["graph_0"]) return;
    if (!theme.data.fonts?.textFont?.name || !theme.data.fonts?.textFont?.url) return;

    const cssVariables = {
      "--primary-color": theme.data.colors["primary"],
      "--background-color": theme.data.colors["background"],
      "--card-color": theme.data.colors["card"],
      "--stroke": theme.data.colors["stroke"],
      "--primary-text": theme.data.colors["primary_text"],
      "--background-text": theme.data.colors["background_text"],
      "--graph-0": theme.data.colors["graph_0"],
      "--graph-1": theme.data.colors["graph_1"],
      "--graph-2": theme.data.colors["graph_2"],
      "--graph-3": theme.data.colors["graph_3"],
      "--graph-4": theme.data.colors["graph_4"],
      "--graph-5": theme.data.colors["graph_5"],
      "--graph-6": theme.data.colors["graph_6"],
      "--graph-7": theme.data.colors["graph_7"],
      "--graph-8": theme.data.colors["graph_8"],
      "--graph-9": theme.data.colors["graph_9"],
    };

    Object.entries(cssVariables).forEach(([key, value]) => {
      element.style.setProperty(key, value);
    });
    const textFontName = theme.data.fonts.textFont.name;
    const textFontUrl = theme.data.fonts.textFont.url;
    useFontLoader({ [textFontName]: textFontUrl });
    element.style.setProperty("font-family", `"${textFontName}"`);
    element.style.setProperty("--heading-font-family", `"${textFontName}"`);
    element.style.setProperty("--body-font-family", `"${textFontName}"`);
  };

  const slides = presentationData?.slides ?? [];
  const isLoading = contentLoading || slides.length === 0;

  return (
    <div className="m-0 flex flex-col overflow-visible p-0">
      {error ? (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
          <div
            className="bg-white border border-red-300 text-red-700 px-6 py-8 rounded-lg shadow-lg flex flex-col items-center"
            role="alert"
          >
            <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
            <strong className="font-bold text-4xl mb-2">Oops!</strong>
            <p className="block text-2xl py-2">
              We encountered an issue loading your presentation.
            </p>
            <p className="text-lg py-2">
              Please check your internet connection or try again later.
            </p>
            <Button
              className="mt-4 bg-red-500 text-white hover:bg-red-600 focus:ring-4 focus:ring-red-300"
              onClick={() => {
                trackEvent(MixpanelEvent.PdfMaker_Retry_Button_Clicked, { pathname });
                window.location.reload();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <style jsx global>{PDF_PRINT_STYLE}</style>
          <div
            id="presentation-slides-wrapper"
            className="relative m-0 flex w-full flex-col items-center overflow-visible p-0"
          >
            {isLoading ? (
              <div className="relative m-0 flex w-full justify-center p-0">
                <div className="m-0 p-0">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="m-0 h-[720px] w-[1280px] bg-gray-400 p-0"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="slides-export-stack font-inter">
                {slides.map((slide: any, index: number) => {
                  const useTemplateV2HtmlPreview =
                    shouldRenderTemplateV2HtmlPreview(
                      slide,
                      presentationData?.version
                    );

                  return (
                    <div
                      key={`${slide.type}-${index}-${slide.index}`}
                      id={`slide-${slide.index}`}
                      className="main-slide relative flex items-center justify-center"
                      data-speaker-note={slide.speaker_note ?? ""}
                    >
                      <div
                        className="slide-export-inner group font-syne"
                        data-layout={slide.layout}
                        data-group={slide.layout_group}
                      >
                        {useTemplateV2HtmlPreview ? (
                          <TemplateV2HtmlSlidePreview
                            slide={slide}
                            fonts={presentationData?.fonts}
                            fixedSize
                          />
                        ) : (
                          <SlideScale
                            slide={slide}
                            theme={presentationData?.theme ?? null}
                            isEditMode={false}
                            fixedSize
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PresentationPage;

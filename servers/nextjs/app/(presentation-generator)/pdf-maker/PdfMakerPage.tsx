"use client";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import "../utils/prism-languages";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { AlertCircle } from "lucide-react";
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { DashboardApi } from "../services/api/dashboard";
import { setupImageUrlConverter } from "@/utils/image-url-converter";


import { V1ContentRender } from "../components/V1ContentRender";
import { useFontLoader } from "../hooks/useFontLoad";
import { Theme } from "../services/api/types";





const PresentationPage = ({ presentation_id }: { presentation_id: string }) => {
  const pathname = usePathname();
  const [contentLoading, setContentLoading] = useState(true);

  const dispatch = useDispatch();
  const { presentationData } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (presentationData?.slides[0].layout.includes("custom")) {
      const existingScript = document.querySelector(
        'script[src*="tailwindcss.com"]'
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [presentationData]);

  // Ensure /app_data and /static image paths resolve through the backend origin.
  useEffect(() => {
    const observer = setupImageUrlConverter();
    return () => observer?.disconnect();
  }, []);

  // Function to fetch the slides
  useEffect(() => {
    fetchUserSlides();
  }, []);

  // Function to fetch the user slides
  const fetchUserSlides = async () => {
    try {
      const data = await DashboardApi.getPresentation(presentation_id);
      dispatch(setPresentationData(data));
      setContentLoading(false);

      if (data.fonts) {
        useFontLoader(data.fonts);
      }
      if (data?.theme) {
        try {
          applyTheme(data.theme);
        } catch (themeError) {
          // Theme issues should not block export rendering.
          console.warn("Theme application skipped for pdf-maker:", themeError);
        }
      }
    } catch (error) {
      setError(true);
      toast.error("Failed to load presentation");
      console.error("Error fetching user slides:", error);
      setContentLoading(false);
    }
  };

  const applyTheme = async (theme: Theme) => {
    const element = document.getElementById('presentation-slides-wrapper')
    if (!element) return;
    if (!theme || !theme.data) { return; }
    if (!theme.data.colors['graph_0']) { return; }
    if (!theme.data.fonts?.textFont?.name || !theme.data.fonts?.textFont?.url) { return; }
    const cssVariables = {
      '--primary-color': theme.data.colors['primary'],
      '--background-color': theme.data.colors['background'],
      '--card-color': theme.data.colors['card'],
      '--stroke': theme.data.colors['stroke'],
      '--primary-text': theme.data.colors['primary_text'],
      '--background-text': theme.data.colors['background_text'],
      '--graph-0': theme.data.colors['graph_0'],
      '--graph-1': theme.data.colors['graph_1'],
      '--graph-2': theme.data.colors['graph_2'],
      '--graph-3': theme.data.colors['graph_3'],
      '--graph-4': theme.data.colors['graph_4'],
      '--graph-5': theme.data.colors['graph_5'],
      '--graph-6': theme.data.colors['graph_6'],
      '--graph-7': theme.data.colors['graph_7'],
      '--graph-8': theme.data.colors['graph_8'],
      '--graph-9': theme.data.colors['graph_9'],
    }

    Object.entries(cssVariables).forEach(([key, value]) => {
      element.style.setProperty(key, value)
    })
    useFontLoader({ [theme.data.fonts.textFont.name]: theme.data.fonts.textFont.url })

    // Apply fonts to preview container
    element.style.setProperty('font-family', `"${theme.data.fonts.textFont.name}"`)
    element.style.setProperty('--heading-font-family', `"${theme.data.fonts.textFont.name}"`)
    element.style.setProperty('--body-font-family', `"${theme.data.fonts.textFont.name}"`)
    // Update the Presentation content with theme
  }


  // Regular view
  return (
    <div className="flex overflow-hidden flex-col">
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
        <div className="">
          <div
            id="presentation-slides-wrapper"
            className=" mx-auto flex flex-col items-center overflow-hidden justify-center  "
          >
            {!presentationData ||

              contentLoading ||
              !presentationData?.slides ||
              presentationData?.slides.length === 0 ? (
              <div className="relative w-full h-[calc(100vh-120px)] mx-auto ">
                <div className=" ">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="aspect-video bg-gray-400 my-4 w-full mx-auto max-w-[1280px]"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {presentationData &&
                  presentationData.slides &&
                  presentationData.slides.length > 0 &&
                  presentationData.slides.map((slide: any, index: number) => (
                    // [data-speaker-note] is used to extract the speaker note from the slide for export to pptx
                    <div key={index} className="w-full " data-speaker-note={slide.speaker_note}>
                      <V1ContentRender
                        slide={slide}
                        isEditMode={true}
                        theme={presentationData?.theme}

                      />
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PresentationPage;

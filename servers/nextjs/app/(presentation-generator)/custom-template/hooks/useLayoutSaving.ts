import { useState, useCallback } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { ProcessedSlide, UploadedFont, FontData } from "../types";

export const useLayoutSaving = (
  slides: ProcessedSlide[],
  UploadedFonts: UploadedFont[],
  fontsData: FontData | null,
  refetch: () => void,
  setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>
) => {
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openSaveModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeSaveModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const convertSlideToReact = async (slide: ProcessedSlide, presentationId: string, FontUrls: string[]) => {
    const maxRetries = 3;
    let retryCount = 0;

    console.log("Slide to convert to react", {
      html: slide.html,
      image: slide.screenshot_url,
    })

    while (retryCount < maxRetries) {
      try {
        const response = await fetch("/api/v1/ppt/html-to-react/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            html: slide.html,
            image: slide.screenshot_url,
          }),
        });

        const data = await ApiResponseHandler.handleResponse(
          response,
          `Failed to convert slide ${slide.slide_number} to React`
        );

        return {
          presentation: presentationId,
          layout_id: `${slide.slide_number}`,
          layout_name: `Slide${slide.slide_number}`,
          layout_code: data.react_component || data.component_code,
          fonts: FontUrls,
        };
      } catch (error) {
        retryCount++;
        console.error(`Error converting slide ${slide.slide_number} (attempt ${retryCount}):`, error);
        
        if (retryCount < maxRetries) {
          toast.error(`Failed to convert slide ${slide.slide_number}. Retrying in 2 minutes...`, {
            description: `Attempt ${retryCount}/${maxRetries}. Error: ${error instanceof Error ? error.message : "An unexpected error occurred"}`,
          });
          
          // Wait for 2 minutes before retrying
          await delay(2 * 60 * 1000);
          
          toast.info(`Retrying conversion for slide ${slide.slide_number}...`);
        } else {
          throw new Error(`Failed to convert slide ${slide.slide_number} after ${maxRetries} attempts: ${error instanceof Error ? error.message : "An unexpected error occurred"}`);
        }
      }
    }
  };

  const saveLayout = useCallback(async (layoutName: string, description: string): Promise<string | null> => {
    if (!slides.length) {
      toast.error("No slides to save");
      return null;
    }

    setIsSavingLayout(true);

    try {
      // Convert each slide HTML to React component
      const reactComponents: any[] = [];
      const presentationId = uuidv4();

      // Collect uploaded font URLs and Google Fonts CSS URLs
      const uploadedFontUrls = UploadedFonts.map((font) => font.fontUrl);
      const googleFontCssUrls = fontsData?.internally_supported_fonts?.map(f => f.google_fonts_url).filter(Boolean) || [];
      const FontUrls = Array.from(new Set([...(uploadedFontUrls || []), ...googleFontCssUrls]));

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];

        if (!slide.html) {
          toast.error(`Slide ${slide.slide_number} has no HTML content`);
          continue;
        }

        // Mark current slide as converting to React
        setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, convertingToReact: true } : s));

        try {
          const reactComponent = await convertSlideToReact(slide, presentationId, FontUrls);
          reactComponents.push(reactComponent);

          // Update progress
          toast.success(
            `Converted slide ${slide.slide_number} to React component`
          );
        } catch (error) {
          console.error(`Error converting slide ${slide.slide_number}:`, error);
          toast.error(`Failed to convert slide ${slide.slide_number} after all retries`, {
            description:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
          });
          // Continue with other slides even if one fails
        } finally {
          // Clear converting flag for this slide
          setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, convertingToReact: false } : s));
        }
      }

      if (reactComponents.length === 0) {
        toast.error("No slides were successfully converted");
        return null;
      }

      // First create/update the template metadata
      await fetch("/api/v1/ppt/template-management/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: presentationId, name: layoutName, description }),
      });

      const saveResponse = await fetch(
        "/api/v1/ppt/template-management/save-templates",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            layouts: reactComponents,
          }),
        }
      );

      const data = await ApiResponseHandler.handleResponse(
        saveResponse,
        "Failed to save layout components"
      );

      if (!data.success) {
        toast.error("Failed to save layout components");
        return null;
      }

      toast.success("Layout saved successfully");

      // Mark all slides as saved (remove modified flag)
      slides.forEach((slide) => {
        slide.modified = false;
      });

      toast.success(`Layout "${layoutName}" saved successfully`);
      refetch();
      closeSaveModal();
      return presentationId;
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error("Failed to save layout", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
      return null;
    } finally {
      setIsSavingLayout(false);
    }
  }, [slides, UploadedFonts, fontsData, refetch, closeSaveModal, setSlides]);

  return {
    isSavingLayout,
    isModalOpen,
    openSaveModal,
    closeSaveModal,
    saveLayout,
  };
}; 
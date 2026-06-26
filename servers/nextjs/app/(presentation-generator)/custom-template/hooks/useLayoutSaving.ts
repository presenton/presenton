import { useState, useCallback } from "react";
import { notify } from "@/components/ui/sonner";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { ProcessedSlide } from "../types";
import { getHeader } from "@/app/(presentation-generator)/services/api/header";
import { getApiUrl } from "@/utils/api";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { validateLayoutCodeForClient } from "../utils/layoutCodeValidation";


export const useLayoutSaving = (
  slides: ProcessedSlide[],


) => {
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openSaveModal = useCallback(() => {
    trackEvent(MixpanelEvent.CustomTemplate_Save_Modal_Opened, {
      slide_count: slides.length,
      processed_slides: slides.filter((slide) => slide.processed).length,
    });
    setIsModalOpen(true);
  }, [slides]);

  const closeSaveModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);




  const saveLayout = useCallback(async (layoutName: string, description: string, template_info_id: string): Promise<string | null> => {
    if (!slides.length) {
      notify.error("No slides to save", "Add at least one slide before saving the layout.");
      return null;
    }

    setIsSavingLayout(true);

    try {
      trackEvent(MixpanelEvent.CustomTemplate_Save_Started, {
        template_info_id,
        layout_name: layoutName,
        layout_name_length: layoutName.length,
        description_length: description.length,
        slide_count: slides.length,
        processed_slides: slides.filter((slide) => slide.processed).length,
      });

      const reactComponents = await Promise.all(
        slides.map(async (slide) => {
          if (!slide.react) {
            throw new Error(`Slide ${slide.slide_number} does not have layout code`);
          }
          const validatedLayout = await validateLayoutCodeForClient(slide.react);
          return {
            layout_id: validatedLayout.layoutId || `${slide.slide_number}`,
            layout_name: validatedLayout.layoutName || `Slide${slide.slide_number}`,
            layout_code: validatedLayout.layout_code,
          };
        })
      );


      // Save the layout components to the app_data/layouts folder
      const saveResponse = await fetch(
        getApiUrl(`/api/v1/ppt/template/save`),
        {
          method: "POST",
          headers: getHeader(),
          body: JSON.stringify({
            template_info_id: template_info_id,
            name: layoutName,
            description: description,
            layouts: reactComponents,

          }),
        }
      );

      const data = await ApiResponseHandler.handleResponse(
        saveResponse,
        "Failed to save layout components"
      );
      if (!data) {
        notify.error(
          "Could not save layout",
          "Some layout components could not be saved. Please try again."
        );
        return null;
      }

      // Mark all slides as saved (remove modified flag)
      slides.forEach((slide) => {
        slide.modified = false;
      });

      notify.success(
        "Layout saved",
        `Layout "${layoutName}" was saved successfully.`
      );
      trackEvent(MixpanelEvent.CustomTemplate_Saved, {
        template_info_id,
        saved_template_id: data.id,
        layout_name: layoutName,
        slide_count: slides.length,
      });

      closeSaveModal();
      return data.id;
    } catch (error) {
      console.error("Error saving layout:", error);
      notify.error(
        "Failed to save layout",
        error instanceof Error
          ? error.message
          : "An unexpected error occurred"
      );
      return null;
    } finally {
      setIsSavingLayout(false);
    }
  }, [slides, closeSaveModal]);

  return {
    isSavingLayout,
    isModalOpen,
    openSaveModal,
    closeSaveModal,
    saveLayout,
  };
}; 

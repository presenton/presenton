import { useState, useEffect, useRef } from "react";
import { ProcessedSlide } from "../types";
import { getHeader } from "@/app/(presentation-generator)/services/api/header";
import { toast } from "sonner";
import { getApiUrl } from "@/utils/api";

export const useSlideEdit = (
  slide: ProcessedSlide,
  index: number,
  onSlideUpdate?: (updatedSlideData: any) => void,
  setSlides?: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>
) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [prompt, setPrompt] = useState("");

  const handleSave = async (): Promise<boolean> => {

    if (!prompt.trim()) {
      alert("Please enter a prompt before saving.");
      return false;
    }

    setIsUpdating(true);

    try {

      const response = await fetch(getApiUrl(`/api/v1/ppt/template/slide-layout/edit`), {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt,
          react_component: slide.react ?? "",
        }),
        headers: getHeader(),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const data = await response.json();
      const updatedSlideData = {
        slide_number: slide.slide_number,
        react: data.react_component,
        processed: true,
        processing: false,
        error: undefined,
      };


      if (onSlideUpdate) {
        onSlideUpdate(updatedSlideData);
      } else if (setSlides) {
        setSlides((prevSlides) =>
          prevSlides.map((s, i) =>
            i === index ? { ...s, ...updatedSlideData } : s
          )
        );
      }

      // Exit edit mode
      setIsEditMode(false);
      setPrompt("");
      return true;
    } catch (error) {
      console.error("Error updating slide:", error);
      toast.error(
        `Error updating slide: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setPrompt("");
  };

  return {
    isEditMode,
    isUpdating,
    prompt,

    setPrompt,
    handleSave,
    handleEditClick,
    handleCancelEdit,
  };
}; 
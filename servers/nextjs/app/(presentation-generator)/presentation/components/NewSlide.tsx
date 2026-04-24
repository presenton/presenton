'use client'
import React, { useEffect, useState, memo, useCallback } from "react";
import { useDispatch } from "react-redux";
import { addNewSlide } from "@/store/slices/presentationGeneration";
import { Loader2, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { toast } from 'sonner';
import { getCustomTemplateDetails } from "@/app/hooks/useCustomTemplates";
import { getTemplatesByTemplateName } from "@/app/presentation-templates";
import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

interface LayoutItemProps {
  layout: any;
  onSelect: (sampleData: any, layoutId: string) => void;
}

const LayoutItem = memo(({ layout, onSelect }: LayoutItemProps) => {
  const { component: LayoutComponent, sampleData, layoutId } = layout;
  return (
    <div
      onClick={() => onSelect(sampleData, layoutId)}
      className="relative cursor-pointer overflow-hidden aspect-video"
    >
      <div className="absolute cursor-pointer bg-transparent z-40 top-0 left-0 w-full h-full" />
      <div className="transform scale-[0.2] flex justify-center items-center origin-top-left w-[500%] h-[500%]">
        <LayoutComponent data={sampleData} />
      </div>
    </div>
  );
});

LayoutItem.displayName = 'LayoutItem';
interface NewSlideV1Props {
  setShowNewSlideSelection: (show: boolean) => void;
  templateID: string;
  index: number;
  presentationId: string;
}
const NewSlideV1 = ({
  setShowNewSlideSelection,
  templateID,
  index,
  presentationId,
}: NewSlideV1Props) => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const [layouts, setLayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isCustomTemplate = templateID.startsWith("custom-");
  const handleNewSlide = useCallback((sampleData: any, id: string) => {
    try {
      const newSlide = {
        id: uuidv4(),
        index: index,
        content: sampleData,
        layout_group: templateID,
        layout: isCustomTemplate ? `${templateID}:${id}` : id,
        presentation: presentationId,
      };
      dispatch(addNewSlide({ slideData: newSlide, index }));
      trackEvent(MixpanelEvent.Presentation_Slide_Added, {
        pathname,
        presentation_id: presentationId,
        inserted_after_index: index,
        template_id: templateID,
        layout_id: id,
        is_custom_template: isCustomTemplate,
      });
      setShowNewSlideSelection(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Error adding new slide");
    }
  }, [index, templateID, presentationId, dispatch, setShowNewSlideSelection, isCustomTemplate, pathname]);



  useEffect(() => {
    if (layouts.length > 0 || loading) return;

    const fetchLayouts = async () => {

      if (isCustomTemplate) {
        setLoading(true);
        const customTemplateId = templateID.split("custom-")[1];
        const templateDetails = await getCustomTemplateDetails(customTemplateId, "Custom Template", "User-created template");
        setLayouts(templateDetails?.layouts || []);
        setLoading(false);
      } else {
        setLoading(true);
        const templateDetails = getTemplatesByTemplateName(templateID);
        setLayouts(templateDetails || []);
        setLoading(false);
      }
    }
    fetchLayouts();

  }, []);


  if (loading) {
    return (
      <div className="my-6 w-full bg-gray-50 p-8 max-w-[1280px]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold">Select a Slide Layout</h2>
          <X
            onClick={() => setShowNewSlideSelection(false)}
            className="text-gray-500 text-2xl cursor-pointer"
          />
        </div>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 w-full bg-gray-50 p-8 max-w-[1280px]">
      <div className="flex justify-between items-center  mb-8">
        <h2 className="text-2xl font-semibold">Select a Slide Layout</h2>
        <X
          onClick={() => setShowNewSlideSelection(false)}
          className="text-gray-500 text-2xl cursor-pointer"
        />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {layouts.map((layout: any) => (
          <LayoutItem
            key={layout.layoutId}
            layout={layout}
            onSelect={handleNewSlide}
          />
        ))}
      </div>
    </div>
  );
};

export default NewSlideV1;




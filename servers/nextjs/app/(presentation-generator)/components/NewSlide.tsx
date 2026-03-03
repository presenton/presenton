import React from "react";
import { useDispatch } from "react-redux";
import { addNewSlide } from "@/store/slices/presentationGeneration";
import { Loader2 } from "lucide-react";
import { useLayout, FullDataInfo } from "../context/LayoutContext";
import { v4 as uuidv4 } from "uuid";
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
interface NewSlideProps {
  setShowNewSlideSelection: (show: boolean) => void;
  templateID: string;
  index: number;
  presentationId: string;
}
const NewSlide = ({
  setShowNewSlideSelection,
  templateID,
  index,
  presentationId,
}: NewSlideProps) => {
  const dispatch = useDispatch();
  const handleNewSlide = (sampleData: any, id: string) => {
    try {
      const newSlide = {
        id: uuidv4(),
        index: index,
        content: sampleData,
        layout_group: templateID,
        layout: id,
        presentation: presentationId,
      };
      dispatch(addNewSlide({ slideData: newSlide, index }));
      setShowNewSlideSelection(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Error adding new slide");
    }
  };
  const { getFullDataByTemplateID, loading } = useLayout();
  const fullData = getFullDataByTemplateID(templateID);

  if (loading) {
    return (
      <div className="my-6 w-full bg-gray-50 p-8 max-w-[1280px]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold">Select a Slide Layout</h2>
          <Trash2
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
        <Trash2
          onClick={() => setShowNewSlideSelection(false)}
          className="text-gray-500 text-2xl cursor-pointer"
        />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {fullData.map((layout: FullDataInfo, index: number) => {
          const { component: LayoutComponent, sampleData, layoutId } = layout;
          return (
            <div
              onClick={() => handleNewSlide(sampleData, layoutId)}
              key={`${layoutId}-${index}`}
              className=" relative cursor-pointer overflow-hidden aspect-video"
            >
              <div className="absolute cursor-pointer bg-transparent z-40 top-0 left-0 w-full h-full" />
              <div className="transform scale-[0.2] flex justify-center items-center origin-top-left  w-[500%] h-[500%]">
                <LayoutComponent data={sampleData} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NewSlide;

"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import OutlineContent from "./OutlineContent";
import EmptyStateView from "./EmptyStateView";
import GenerateButton from "./GenerateButton";

import { TABS } from "../types/index";
import { useOutlineStreaming } from "../hooks/useOutlineStreaming";
import { useOutlineManagement } from "../hooks/useOutlineManagement";
import { usePresentationGeneration } from "../hooks/usePresentationGeneration";
import TemplateSelection from "./TemplateSelection";
import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import { Separator } from "@/components/ui/separator";

const OutlinePage: React.FC = () => {
  const { presentation_id, outlines } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  const [activeTab, setActiveTab] = useState<string>(TABS.OUTLINE);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLayoutsWithSettings | string | null>(null);
  // Custom hooks
  const streamState = useOutlineStreaming(presentation_id);
  const { handleDragEnd, handleAddSlide } = useOutlineManagement(outlines);
  const { loadingState, handleSubmit } = usePresentationGeneration(
    presentation_id,
    outlines,
    selectedTemplate,
    setActiveTab
  );
  if (!presentation_id) {
    return <EmptyStateView />;
  }
  const handleTabChange = (tab: string) => {
    if (streamState.isStreaming) {
      return;
    }
    setActiveTab(tab);

  };


  return (
    <div className=" font-syne  pb-9">

      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
      />

      <Wrapper className="flex flex-col w-full relative px-5 sm:px-10 lg:px-20 ">
        <div className="w-full mx-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex w-full flex-col">
            {/* Reserves vertical space so content does not sit under the fixed tab bar */}
            <div className="h-[4.75rem] shrink-0 sm:h-[5rem]" aria-hidden />
            <div className="fixed top-26 left-0 right-0 z-50  pb-2">
              <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-10 lg:px-20">
                <TabsList className="my-4 h-auto w-fit rounded-full border border-[#EDEEEF] bg-white p-1.5">
                  <TabsTrigger
                    value={TABS.OUTLINE}
                    className="rounded-full px-5 py-2  text-xs font-medium text-[#2D2D2D] shadow-none data-[state=active]:bg-[#F4F3FF] data-[state=active]:text-[#7E3AF2] data-[state=active]:shadow-none"
                  >
                    Outline & Content
                  </TabsTrigger>
                  <Separator orientation="vertical" className="h-6 mx-1" />
                  <TabsTrigger
                    value={TABS.LAYOUTS}
                    className="relative rounded-full px-5  py-2 text-xs font-medium text-[#2D2D2D] shadow-none  data-[state=active]:bg-[#F4F3FF] data-[state=active]:text-[#7E3AF2] data-[state=active]:shadow-none"
                  >
                    Select Template
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="w-full mx-auto">
              <TabsContent value={TABS.OUTLINE} className="mt-0">
                <OutlineContent
                  outlines={outlines}
                  isLoading={streamState.isLoading}
                  isStreaming={streamState.isStreaming}
                  activeSlideIndex={streamState.activeSlideIndex}
                  highestActiveIndex={streamState.highestActiveIndex}
                  onDragEnd={handleDragEnd}
                  onAddSlide={handleAddSlide}
                />
              </TabsContent>

              <TabsContent value={TABS.LAYOUTS} className="mt-0 bg-white">
                <TemplateSelection
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={setSelectedTemplate}
                />
              </TabsContent>
            </div>
          </Tabs>

          <div className="fixed bottom-[26px] right-[26px] z-50">
            <GenerateButton
              loadingState={loadingState}
              streamState={streamState}
              selectedTemplate={selectedTemplate}
              onSubmit={handleSubmit}
            />
          </div>
        </div>



      </Wrapper>
    </div>
  );
};

export default OutlinePage;

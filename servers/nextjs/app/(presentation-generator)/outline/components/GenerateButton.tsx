import React from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "../types/index";
import { ChevronRight } from "lucide-react";

interface GenerateButtonProps {
  loadingState: LoadingState;
  streamState: { isStreaming: boolean; isLoading: boolean };
  selectedTemplateId: string | null;
  onSubmit: () => void;
}

const GenerateButton: React.FC<GenerateButtonProps> = ({
  loadingState,
  streamState,
  selectedTemplateId,
  onSubmit,
}) => {
  const isDisabled =
    loadingState.isLoading ||
    streamState.isLoading ||
    streamState.isStreaming ||
    !selectedTemplateId;

  const getButtonText = () => {
    if (loadingState.isLoading) return loadingState.message;
    if (streamState.isLoading || streamState.isStreaming) return "Loading...";
    if (!selectedTemplateId) return "Select a Template";
    return "Continue";
  };

  return (
    <Button
      disabled={isDisabled}
      onClick={() => {
        onSubmit();
      }}
      className="flex h-[46px] w-fit items-center gap-[2px] rounded-[58px] px-6 py-3 font-syne text-lg font-medium tracking-[-0.18px] text-[#101323] shadow-none hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
      }}
    >
      {getButtonText()}
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.7}
        className="h-[18px] w-[18px]"
      />
    </Button>
  );
};

export default GenerateButton;

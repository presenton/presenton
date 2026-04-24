'use client'
import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";

interface SaveLayoutButtonProps {
  onSave: () => void;
  isSaving: boolean;
  isProcessing: boolean;
}

export const SaveLayoutButton: React.FC<SaveLayoutButtonProps> = ({
  onSave,
  isSaving,
  isProcessing,
}) => {

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-2"
      style={{
        borderRadius: '36px',
        background: 'rgba(0, 0, 0, 0.28)',
      }}
    >
      <Button
        onClick={onSave}
        disabled={isSaving || isProcessing}
        className="bg-[#6938EF] hover:bg-[#6938EF]/90 rounded-[24px] text-white shadow-lg hover:shadow-xl transition-all duration-200 p-3.5 text-base font-semibold"
        size="lg"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Saving Template...
          </>
        ) : (
          <>

            Save as Template
          </>
        )}
      </Button>
    </div>
  );
}; 
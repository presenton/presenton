'use client'

import { CompiledLayout, compileCustomLayout } from "@/app/hooks/compileLayout";
import { RotateCcw } from "lucide-react";
import React, { memo, useMemo } from "react";
interface SlideContentProps {
  slide: any;
  data?: Record<string, any> | null;
  compiledLayout?: CompiledLayout | null;
  retrySlide: (slideNumber: number) => void;
}

const SlideContent = memo(({ slide, data, compiledLayout, retrySlide }: SlideContentProps) => {

  // Use provided compiled layout or compile (fallback for other usages)
  const module = useMemo(() => {
    if (compiledLayout) return compiledLayout;
    if (!slide.react) return null;
    return compileCustomLayout(slide.react);
  }, [slide.react, compiledLayout]);

  const sampleData = useMemo(() => {
    // If custom data is provided, use it
    if (data) {

      return data;

    }
    // Otherwise use sampleData from compiled layout or generate from schema defaults
    if (module?.sampleData && Object.keys(module.sampleData).length > 0) {
      return module.sampleData;
    }
    try {
      return module?.schema?.parse({}) ?? {};
    } catch {
      return {};
    }
  }, [module, data]);

  const Component = useMemo(() => {
    return module?.component;
  }, [module]);

  if (!slide?.react) return null;
  if (!module) {
    return (
      <div className="w-full aspect-[16/9] h-[720px] bg-red-50 text-red-700 p-4 rounded border border-red-200 text-sm whitespace-pre-wrap break-words flex flex-col items-center justify-center">
        <p className="text-center"> Failed to render slide component. Check console for details.</p>
        <button onClick={() => retrySlide(slide.slide_number)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center justify-center mt-6"> <RotateCcw className="w-4 h-4 mr-1" /> Re-Construct</button>
      </div>
    );
  }


  return (

    <>
      {Component && <Component data={sampleData} />}
    </>
  );
});

SlideContent.displayName = 'SlideContent';

export default SlideContent;

"use client";
import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import GroupLayoutPreview from "./components/TemplatePreviewClient";
import "../utils/prism-languages";

const TemplatePreviewPage = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <GroupLayoutPreview />
    </Suspense>
  );
};

export default TemplatePreviewPage;

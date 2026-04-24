'use client'

import React from "react";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    Images,
    ChevronRight,
    Sparkles
} from "lucide-react";
import { SlidePreviewSectionProps } from "../types";
import { resolveBackendAssetUrl } from '@/utils/api'


export const SlidePreviewSection: React.FC<SlidePreviewSectionProps> = ({
    previewData,
    onInitTemplate,
    isLoading,
}) => {
    const slideCount = previewData.slide_image_urls?.length || 0;

    return (
        <div className="my-8 max-w-[1440px] mx-auto">
            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#F3F4F6] bg-gradient-to-r from-[#FAFAFA] to-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EBE9FE] to-[#DDD6FE] flex items-center justify-center shadow-sm">
                                <Images className="w-6 h-6 text-[#7A5AF8]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-[#111827]">Slide Preview</h2>
                                <p className="text-sm text-[#6B7280] mt-0.5">
                                    {slideCount} slide{slideCount !== 1 ? 's' : ''} ready for template generation
                                </p>
                            </div>
                        </div>

                    </div>
                </div>


                <div className="grid grid-cols-1  gap-4 py-4 max-h-[900px] overflow-y-auto">
                    {previewData.slide_image_urls?.map((url, index) => (
                        <div
                            key={index}
                            className="group relative aspect-video w-full max-w-[1280px] mx-auto rounded-xl overflow-hidden "
                        >
                            <img
                                src={resolveBackendAssetUrl(url)}
                                alt={`Slide ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                            {/* Slide number badge */}
                            <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs font-semibold text-white shadow-lg">
                                {index + 1}
                            </div>


                        </div>
                    ))}
                </div>




                {/* Action Footer */}
                <div className="px-6 py-5 border-t border-[#F3F4F6] bg-gradient-to-r from-[#FAFAFA] to-white">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-[#6B7280] max-w-md text-center sm:text-left">
                            Ready to generate your template. Each slide will be converted to a reusable React component.
                        </p>
                        <Button
                            size="lg"
                            onClick={onInitTemplate}
                            disabled={isLoading}
                            className="px-4 py-2 h-auto text-xs font-syne font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-300 "
                            style={{
                                background: isLoading
                                    ? '#E5E7EB'
                                    : 'linear-gradient(135deg, #D5CAFC 0%, #E3D2EB 35%, #F4DCD3 70%, #FDE4C2 100%)',
                                color: isLoading ? '#9CA3AF' : '#111827',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>

                                    Generate Template
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

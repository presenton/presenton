'use client'

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    defaultTemplateName,
    requiresTemplateMetadata = true,
}) => {
    const [isMetadataOpen, setIsMetadataOpen] = React.useState(false);
    const [templateName, setTemplateName] = React.useState(defaultTemplateName);
    const [description, setDescription] = React.useState("");
    const slideCount = previewData.slide_image_urls?.length || 0;
    const fontCount = Object.keys(previewData.fonts || {}).length;

    React.useEffect(() => {
        setTemplateName(defaultTemplateName);
    }, [defaultTemplateName]);

    const handleOpenMetadata = () => {
        setTemplateName((current) => current.trim() ? current : defaultTemplateName);
        setIsMetadataOpen(true);
    };

    const handleCloseMetadata = () => {
        if (!isLoading) {
            setIsMetadataOpen(false);
        }
    };

    const handleGenerateTemplate = () => {
        const name = templateName.trim();
        if (!name) return;

        const trimmedDescription = description.trim();
        void onInitTemplate({
            name,
            ...(trimmedDescription ? { description: trimmedDescription } : {}),
        });
    };

    const handlePrimaryAction = () => {
        if (requiresTemplateMetadata) {
            handleOpenMetadata();
            return;
        }

        void onInitTemplate();
    };

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
                                    {slideCount} slide{slideCount !== 1 ? 's' : ''} ready
                                    {fontCount > 0 && (
                                        <> · {fontCount} font{fontCount !== 1 ? 's' : ''} applied</>
                                    )}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-6 max-h-[900px] overflow-y-auto">
                    {previewData.slide_image_urls?.map((url, index) => (
                        <div
                            key={index}
                            className="group relative w-full rounded-xl overflow-hidden border border-[#E5E7EB] bg-white shadow-sm"
                        >
                            <img
                                src={resolveBackendAssetUrl(url)}
                                alt={`Slide ${index + 1}`}
                                className="block h-auto w-full"
                                loading="lazy"
                                draggable={false}
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
                            onClick={handlePrimaryAction}
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
            <Dialog open={isMetadataOpen} onOpenChange={handleCloseMetadata}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-[#7A5AF8]" />
                            Template details
                        </DialogTitle>
                        <DialogDescription>
                            Name this template before generation starts.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-5 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="template-name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="template-name"
                                value={templateName}
                                onChange={(event) => setTemplateName(event.target.value)}
                                disabled={isLoading}
                                placeholder="Template name"
                                aria-required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="template-description">
                                Description <span className="text-gray-400">(optional)</span>
                            </Label>
                            <Textarea
                                id="template-description"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                disabled={isLoading}
                                placeholder="Add a short summary of this template..."
                                rows={3}
                                className="resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={handleCloseMetadata}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleGenerateTemplate}
                            disabled={isLoading || !templateName.trim()}
                            aria-busy={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    Generate Template
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

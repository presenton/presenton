"use client";

import Image from "next/image";
import ToolTip from '@/components/ToolTip';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, SlidersHorizontal, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { PresentationConfig, ToneType, VerbosityType } from '../type';
import { cn } from '@/lib/utils';

interface ConfigurationSelectsProps {
    config: PresentationConfig;
    onConfigChange: (key: keyof PresentationConfig, value: any) => void;
    compact?: boolean;
}

const toggleClassName =
    'h-[22px] w-[36px] border-0 bg-[#D8D8DD] data-[state=checked]:bg-[#7A5AF8] ';

const AdvanceSettings = ({
    config,
    onConfigChange,
    compact = false,
}: ConfigurationSelectsProps) => {
    const [openAdvanced, setOpenAdvanced] = useState(false);
    const [openSelect, setOpenSelect] = useState<'tone' | 'verbosity' | null>(null);
    const instructionsRef = useRef<HTMLTextAreaElement>(null);

    const [advancedDraft, setAdvancedDraft] = useState({
        tone: config.tone,
        verbosity: config.verbosity,
        instructions: config.instructions,
        includeTableOfContents: config.includeTableOfContents,
        includeTitleSlide: config.includeTitleSlide,
    });

    const syncDraftFromConfig = () => {
        setAdvancedDraft({
            tone: config.tone,
            verbosity: config.verbosity,
            instructions: config.instructions,
            includeTableOfContents: config.includeTableOfContents,
            includeTitleSlide: config.includeTitleSlide,
        });
    };

    const handleOpenAdvanced = () => {
        syncDraftFromConfig();
        setOpenSelect(null);
        setOpenAdvanced(true);
    };

    const handleSaveAdvanced = () => {
        onConfigChange('tone', advancedDraft.tone);
        onConfigChange('verbosity', advancedDraft.verbosity);
        onConfigChange('instructions', advancedDraft.instructions);
        onConfigChange('includeTableOfContents', advancedDraft.includeTableOfContents);
        onConfigChange('includeTitleSlide', advancedDraft.includeTitleSlide);
        setOpenSelect(null);
        setOpenAdvanced(false);
    };

    return (
        <Dialog open={openAdvanced} onOpenChange={(open) => {
            setOpenAdvanced(open);
            if (!open) setOpenSelect(null);
        }}>
            <div className={cn(!compact && "ml-auto")}>
                <ToolTip content="Advanced settings">
                    <DialogTrigger asChild>
                        <button
                            aria-label="Advanced settings"
                            title="Advanced settings"
                            type="button"
                            onClick={handleOpenAdvanced}
                            className={cn(
                                "flex items-center justify-center rounded-full border bg-white text-[#1C1C27] transition hover:bg-[#F7F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141E5]/25",
                                compact
                                    ? "h-[34px] w-[42px] border-[#EDEEEF] shadow-none"
                                    : "h-10 w-10 border-[#E4E5E8] shadow-sm min-[1800px]:h-11 min-[1800px]:w-11 min-[2200px]:h-12 min-[2200px]:w-12"
                            )}
                            data-testid="advanced-settings-button"
                        >
                            {compact ? <Image src="/generate/settings.svg" alt="" width={14} height={14} /> : <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />}
                        </button>
                    </DialogTrigger>
                </ToolTip>
            </div>

            <DialogContent
                hideDefaultClose
                overlayClassName="z-[70] bg-black/35 backdrop-blur-none"
                className="z-[71] mt-[54px] block w-[calc(100vw-2rem)] max-w-[640px] overflow-visible border-0 bg-transparent p-0 shadow-none min-[1800px]:max-w-[720px] min-[2200px]:max-w-[800px]"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    instructionsRef.current?.focus({ preventScroll: true });
                }}
                onEscapeKeyDown={(event) => {
                    if (openSelect !== null) {
                        event.preventDefault();
                        setOpenSelect(null);
                    }
                }}
            >
                <DialogClose
                    type="button"
                    aria-label="Close advanced settings"
                    className="absolute -top-[62px] right-2 flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[#E7E7EC] bg-white text-[#2C2B35] shadow-sm transition hover:bg-[#F8F8FB] min-[1800px]:h-[56px] min-[1800px]:w-[56px]"
                >
                    <X className="h-3.5 w-3.5 min-[1800px]:h-4 min-[1800px]:w-4" />
                </DialogClose>

                <div className="overflow-hidden rounded-[24px] border border-[#E7E9F2] bg-[#F3F3F6] shadow-[0_24px_80px_rgba(15,23,42,0.20)]">
                    <div className="flex items-start justify-between gap-4 bg-[#F8F8FA] px-6 py-[22px] min-[1800px]:px-8 min-[1800px]:py-7">
                        <div>
                            <DialogTitle className="font-syne text-lg font-semibold leading-none tracking-normal text-[#191919] min-[1800px]:text-xl min-[2200px]:text-2xl">
                                Advanced Settings
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-sm text-[#808080] min-[1800px]:text-base">Adjust Presentation Behavior</DialogDescription>
                        </div>

                        <Button
                            type="button"
                            onClick={handleSaveAdvanced}
                            style={{
                                background:
                                    'linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)',
                            }}
                            className="rounded-full px-[28px] py-[10px] font-syne text-xs font-semibold text-[#1E1D2B] shadow-none hover:opacity-95 min-[1800px]:px-8 min-[1800px]:py-3 min-[1800px]:text-sm"
                        >
                            Save
                        </Button>
                    </div>

                    <div className="bg-[#ECE8F6] px-6 py-5 min-[1800px]:px-8 min-[1800px]:py-6">
                        <div className="flex items-start gap-2">
                            <Pencil className="mt-[3px] h-3.5 w-3.5 text-[#1C1B24] min-[1800px]:h-4 min-[1800px]:w-4" />
                            <div className="w-full">
                                <label
                                    htmlFor="advanced-instructions"
                                    className="block font-syne text-sm font-semibold leading-none text-[#1F1D2A] min-[1800px]:text-base"
                                >
                                    Write instructions
                                </label>
                                <Textarea
                                    id="advanced-instructions"
                                    ref={instructionsRef}
                                    value={advancedDraft.instructions}
                                    rows={2}
                                    onChange={(event) =>
                                        setAdvancedDraft((prev) => ({ ...prev, instructions: event.target.value }))
                                    }
                                    placeholder="Guide the AI: define audience, tone, key points, or constraints."
                                    className="mt-1 min-h-[64px] resize-none border-0 bg-transparent p-0 text-sm leading-[1.3] text-[#242430] shadow-none placeholder:text-[#7C7B87] focus-visible:ring-0 focus-visible:ring-offset-0 min-[1800px]:min-h-[80px] min-[1800px]:text-base"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 px-6 pb-5 pt-3.5 min-[1800px]:space-y-5 min-[1800px]:px-8 min-[1800px]:pb-7 min-[1800px]:pt-5">
                        <div className="flex items-center justify-between gap-3">
                            <label className="font-syne text-sm font-semibold leading-none text-[#1F1D2A] min-[1800px]:text-base">Tone</label>
                            <Select
                                open={openSelect === 'tone'}
                                onOpenChange={(open) => setOpenSelect(open ? 'tone' : null)}
                                value={advancedDraft.tone}
                                onValueChange={(value) =>
                                    setAdvancedDraft((prev) => ({ ...prev, tone: value as ToneType }))
                                }

                            >
                                <SelectTrigger className="w-[120px] rounded-xl border-[#DBDBE1] bg-white p-2.5 font-syne text-sm font-medium capitalize text-[#2C2B37] shadow-none focus:ring-0 focus-visible:ring-0 min-[1800px]:w-[140px] min-[1800px]:text-base">
                                    <SelectValue placeholder="Select tone" />
                                </SelectTrigger>
                                <SelectContent className="z-[120] font-syne">
                                    {Object.values(ToneType).map((tone) => (
                                        <SelectItem key={tone} value={tone} className="text-sm font-medium capitalize min-[1800px]:text-base">
                                            {tone}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <label className="font-syne text-sm font-semibold leading-none text-[#1F1D2A] min-[1800px]:text-base">Verbosity</label>
                            <Select
                                open={openSelect === 'verbosity'}
                                onOpenChange={(open) => setOpenSelect(open ? 'verbosity' : null)}
                                value={advancedDraft.verbosity}
                                onValueChange={(value) =>
                                    setAdvancedDraft((prev) => ({ ...prev, verbosity: value as VerbosityType }))
                                }
                            >
                                <SelectTrigger className="w-[120px] rounded-xl border-[#DBDBE1] bg-white p-2.5 font-syne text-sm font-medium capitalize text-[#2C2B37] shadow-none focus:ring-0 focus-visible:ring-0 min-[1800px]:w-[140px] min-[1800px]:text-base">
                                    <SelectValue placeholder="Select verbosity" />
                                </SelectTrigger>
                                <SelectContent className="z-[120] font-syne">
                                    {Object.values(VerbosityType).map((verbosity) => (
                                        <SelectItem key={verbosity} value={verbosity} className="text-sm font-medium capitalize min-[1800px]:text-base">
                                            {verbosity}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <label className="font-syne text-sm font-semibold leading-none text-[#1F1D2A] min-[1800px]:text-base">
                                Include Table of Content
                            </label>
                            <Switch
                                checked={advancedDraft.includeTableOfContents}
                                onCheckedChange={(checked) =>
                                    setAdvancedDraft((prev) => ({ ...prev, includeTableOfContents: checked }))
                                }
                                className={toggleClassName}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <label className="font-syne text-sm font-semibold leading-none text-[#1F1D2A] min-[1800px]:text-base">Title Slide</label>
                            <Switch
                                checked={advancedDraft.includeTitleSlide}
                                onCheckedChange={(checked) =>
                                    setAdvancedDraft((prev) => ({ ...prev, includeTitleSlide: checked }))
                                }
                                className={toggleClassName}
                            />
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AdvanceSettings;

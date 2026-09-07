import ToolTip from '@/components/ToolTip';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, SlidersHorizontal, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { PresentationConfig, ToneType, VerbosityType } from '../type';
import { cn } from '@/lib/utils';

interface ConfigurationSelectsProps {
    config: PresentationConfig;
    onConfigChange: (key: keyof PresentationConfig, value: any) => void;
    compact?: boolean;
}

const toggleClassName =
    'h-[22px] w-[36px] border-0 bg-[#D8D8DD] data-[state=checked]:bg-[#2563EB] ';

const AdvanceSettings = ({
    config,
    onConfigChange,
    compact = false,
}: ConfigurationSelectsProps) => {
    const [openAdvanced, setOpenAdvanced] = useState(false);

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
        setOpenAdvanced(true);
    };

    const handleCloseAdvanced = () => {
        setOpenAdvanced(false);
    };

    const handleSaveAdvanced = () => {
        onConfigChange('tone', advancedDraft.tone);
        onConfigChange('verbosity', advancedDraft.verbosity);
        onConfigChange('instructions', advancedDraft.instructions);
        onConfigChange('includeTableOfContents', advancedDraft.includeTableOfContents);
        onConfigChange('includeTitleSlide', advancedDraft.includeTitleSlide);
        setOpenAdvanced(false);
    };

    useEffect(() => {
        if (!openAdvanced) {
            return;
        }

        const previousOverflow = document.body.style.overflow;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleCloseAdvanced();
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [openAdvanced]);

    return (
        <>
            <div className={cn(!compact && "ml-auto")}>
                <ToolTip content="Advanced settings">
                    <button
                        aria-label="Advanced settings"
                        title="Advanced settings"
                        type="button"
                        onClick={handleOpenAdvanced}
                        className={cn(
                            "flex items-center justify-center rounded-full border bg-white text-[#1C1C27] transition hover:bg-[#F7F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]/25",
                            compact
                                ? "h-[34px] w-[42px] border-[#EDEEEF] shadow-none"
                                : "h-10 w-10 border-[#E4E5E8] shadow-sm min-[1800px]:h-11 min-[1800px]:w-11 min-[2200px]:h-12 min-[2200px]:w-12"
                        )}
                        data-testid="advanced-settings-button"
                    >
                        <SlidersHorizontal
                            className={cn(
                                compact
                                    ? "h-3.5 w-3.5"
                                    : "h-3.5 w-3.5 min-[1800px]:h-4 min-[1800px]:w-4 min-[2200px]:h-5 min-[2200px]:w-5"
                            )}
                            aria-hidden="true"
                        />
                    </button>
                </ToolTip>
            </div>

            {openAdvanced && (
                <div
                    className="fixed inset-0 z-[70] bg-black/35 flex items-center justify-center"
                    onClick={handleCloseAdvanced}
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Advanced settings"
                        className="relative mx-auto mt-[108px] w-[calc(100vw-2rem)] max-w-[640px] overflow-visible min-[1800px]:max-w-[720px] min-[2200px]:max-w-[800px]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={handleCloseAdvanced}
                            aria-label="Close advanced settings"
                            className="absolute -top-[62px] right-2 flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[#E7E7EC] bg-white text-[#2C2B35] shadow-sm transition hover:bg-[#F8F8FB] min-[1800px]:h-[56px] min-[1800px]:w-[56px]"
                        >
                            <X className="h-3.5 w-3.5 min-[1800px]:h-4 min-[1800px]:w-4" />
                        </button>

                        <div className="overflow-hidden rounded-[24px] border border-[#E7E9F2] bg-[#F3F3F6] shadow-[0_24px_80px_rgba(15,23,42,0.20)]">
                            <div className="flex items-start justify-between gap-4 bg-[#F8F8FA] px-6 py-[22px] min-[1800px]:px-8 min-[1800px]:py-7">
                                <div>
                                    <h2 className="font-syne text-lg font-semibold leading-none text-[#191919] min-[1800px]:text-xl min-[2200px]:text-2xl">
                                        Advanced Settings
                                    </h2>
                                    <p className="mt-1 text-sm text-[#808080] min-[1800px]:text-base">Adjust Presentation Behavior</p>
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
                                            value={advancedDraft.instructions}
                                            autoFocus={true}
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
                    </div>
                </div>
            )}
        </>
    );
};

export default AdvanceSettings;

"use client";
import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette } from 'lucide-react';

import { useDispatch } from 'react-redux';
import { updateTheme } from '@/store/slices/presentationGeneration';
import { usePathname, useRouter } from 'next/navigation';
import {
    applyPresentationThemeToElement,
    clearPresentationThemeFromElement,
} from "../utils/applyPresentationThemeDom";
import { trackEvent, MixpanelEvent } from '@/utils/mixpanel';

const ThemeSelector = ({ current_theme, themes: allThemes }: { current_theme: any, themes: any[] }) => {
    const [currentTheme, setCurrentTheme] = useState<any>(current_theme)
    const dispatch = useDispatch()
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const applyTheme = async (theme: any) => {
        const element = document.getElementById("presentation-slides-wrapper");
        if (!element) return;
        if (allThemes.length === 0) return;
        setCurrentTheme(theme);
        clearPresentationThemeFromElement(element);
        if (!theme.data?.colors?.["graph_0"]) return;
        applyPresentationThemeToElement(element, theme);
        dispatch(updateTheme(theme));
        trackEvent(MixpanelEvent.Presentation_Theme_Changed, {
            pathname,
            theme_id: theme.id,
            theme_name: theme.name,
            theme_source: theme.user === "system" ? "built_in" : "custom",
        });
    };
    const resetTheme = async () => {
        dispatch(updateTheme(null));
        clearPresentationThemeFromElement(
            document.getElementById("presentation-slides-wrapper")
        );
        trackEvent(MixpanelEvent.Presentation_Theme_Reset, { pathname });
    };


    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger>
                <button className={`text-sm px-[18px] py-2.5 gap-1.5 flex items-center  border border-[#EDEEEF] bg-[#F6F6F9]   duration-300 rounded-[88px] font-medium font-syne ${isOpen ? 'text-[#007AFF]' : 'text-black'}`}>
                    <Palette className={`h-4 w-4 ${isOpen ? 'text-[#007AFF]' : 'text-black'}`} /> Theme
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-fit rounded-[18px] max-h-80 overflow-y-auto hide-scrollbar">
                <div className='pb-2 flex  gap-2 justify-end'>
                    <button className='text-xs text-gray-500 pb-2 text-right underline' onClick={() => {
                        trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/theme?tab=new-theme" });
                        router.push(`/theme?tab=new-theme`)
                    }}>+Customize Theme</button>
                    <button className='text-xs text-gray-500 pb-2 text-right underline' onClick={resetTheme}>Reset Theme</button>
                </div>
                <div className="grid grid-cols-3 gap-4">

                    {allThemes && allThemes.length > 0 && allThemes.map((t) => (
                        <div
                            key={t.id}
                            onClick={() => applyTheme(t)}
                            className={`text-left group relative`}
                        >

                            <div className={`rounded-xl cursor-pointer p-1 border shadow-sm bg-white  transition-all group-hover:shadow-md ${currentTheme.id === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                <div className="rounded-lg p-2" style={{ backgroundColor: t.data.colors['background'] }}>
                                    <div className="rounded-md shadow-sm p-3" style={{ backgroundColor: t.data.colors['card'] }}>
                                        <div className="w-16 h-2 rounded-full mb-2" style={{ backgroundColor: t.data.colors['background_text'] }} />
                                        <div className="w-12 h-2 rounded-full mb-1" style={{ backgroundColor: t.data.colors['background_text'] }} />
                                        <div className="w-8 h-2 rounded-full mb-3" style={{ backgroundColor: t.data.colors['background_text'] }} />
                                        <div className="w-8 h-3 rounded-full" style={{ backgroundColor: t.data.colors['primary'] }} />
                                    </div>
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-center font-medium text-gray-700 truncate w-full">
                                {t.name}
                            </p>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default ThemeSelector

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { V1ContentRender } from '../../(presentation-generator)/components/V1ContentRender';


const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

const SlideScale = ({
    slide,
    theme,
    isEditMode = true,
    /** Fill viewport; scale may exceed 1 so slides appear larger in present mode */
    presentMode = false,
    isClickable = true,
}: { slide: any; theme?: any; isEditMode?: boolean; presentMode?: boolean; isClickable?: boolean }) => {

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });

    const scale = useMemo(() => {
        if (presentMode) {
            const { w, h } = box;
            if (w < 1 || h < 1) return 1;
            const sx = (w / BASE_WIDTH) * 0.995;
            const sy = (h / BASE_HEIGHT) * 0.995;
            return Math.min(sx, sy);
        }
        const safeWidth = Math.max(0, box.w + 20);
        if (!safeWidth) return 1;
        return Math.min((safeWidth / BASE_WIDTH) * 0.98, 1);
    }, [presentMode, box.w, box.h]);

    useEffect(() => {
        if (!containerRef.current) return;

        const el = containerRef.current;
        const ro = new ResizeObserver(() => {
            setBox({ w: el.clientWidth, h: el.clientHeight });
        });

        ro.observe(el);
        setBox({ w: el.clientWidth, h: el.clientHeight });

        return () => ro.disconnect();
    }, []);
    return (<div
        ref={containerRef}
        className={`relative w-full ${presentMode ? "flex h-full min-h-0 items-center justify-center shadow-none" : "shadow-md"}`}
    >
        <div
            className={presentMode ? "relative mx-auto shrink-0" : "relative mx-auto max-w-[1280px]"}
            style={{
                width: presentMode ? `${BASE_WIDTH * scale}px` : undefined,
                height: `${BASE_HEIGHT * scale}px`,
                overflow: "hidden",
            }}
        >
            <div
                className="absolute top-0 left-0"
                style={{
                    width: BASE_WIDTH,
                    height: BASE_HEIGHT,
                    transformOrigin: "top left",
                    transform: `scale(${scale})`,
                }}
            >

                <div
                    className="relative w-full h-full  select-none"
                    data-testid="slide-content"
                    style={{
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        MozUserSelect: "none",
                        msUserSelect: "none",
                    } as React.CSSProperties}
                >

                    {!isClickable && <div
                        className="absolute inset-0 bg-transparent z-30 w-full h-full  select-none"
                        aria-hidden="true"

                    />}
                    <V1ContentRender slide={slide} isEditMode={isEditMode} theme={theme} />
                </div>


            </div>
        </div>
    </div>
    )
}

export default SlideScale
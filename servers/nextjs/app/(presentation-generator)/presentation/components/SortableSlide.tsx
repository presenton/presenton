import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Slide } from '../../types/slide';
import { useRef } from 'react';
import { V1ContentRender } from '../../components/V1ContentRender';
import { useSearchParams } from 'next/navigation';
interface SortableSlideProps {
    slide: Slide;
    index: number;
    selectedSlide: number;
    onSlideClick: (index: any) => void;
}
const SCALE = 0.125;

export function SortableSlide({ slide, index, selectedSlide, onSlideClick }: SortableSlideProps) {
    const lastClickTime = useRef(0);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: slide.id || `${slide.index}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: `var(--card-color, #ffffff)`,
        borderColor: selectedSlide === index ? `#5141e5` : `var(--stroke, #e5e7eb)`
    };

    const handleClick = (e: React.MouseEvent) => {
        const now = Date.now();

        // Debounce clicks - only allow one click every 300ms
        if (now - lastClickTime.current < 300) {
            return;
        }

        // Only trigger click if not dragging
        if (!isDragging) {
            lastClickTime.current = now;
            onSlideClick(slide.index);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}
            className={` cursor-pointer border relative  p-1    rounded-[12px] transition-all duration-200 ${selectedSlide === index ? ' border-[#BDB4FE]' : 'border-[#EDEEEF]'
                }`}
        >

            <div
                className="relative"
                style={{ height: `${720 * SCALE}px`, overflow: "hidden" }}
            >
                <div
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{
                        width: 1280,
                        height: 720,
                        transformOrigin: "top left",
                        transform: `scale(${SCALE})`,
                    }}
                >
                    <V1ContentRender slide={slide} isEditMode={true} />
                </div>
            </div>

        </div>
    );
} 
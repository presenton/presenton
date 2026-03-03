import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Slide } from '../../types/slide';
import { useRef } from 'react';

interface SortableSlideProps {
    slide: Slide;
    index: number;
    selectedSlide: number;
    onSlideClick: (index: any) => void;
    renderSlideContent: (slide: any, isEditMode?: boolean) => React.ReactElement;
}

export function SortableSlide({ slide, index, selectedSlide, onSlideClick, renderSlideContent }: SortableSlideProps) {
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
        opacity: isDragging ? 0.5 : 1
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
            className={` cursor-pointer border-[3px] relative  p-1 shadow-lg   rounded-md transition-all duration-200 ${selectedSlide === index ? ' border-[#5141e5]' : 'border-gray-300'
                }`}
        >
            <div className=" slide-box relative z-50  overflow-hidden aspect-video">
                <div className="absolute bg-transparent z-50 top-0 left-0 w-full h-full" />
                <div className="transform scale-[0.2] flex  pointer-events-none justify-center items-center origin-top-left  w-[500%] h-[500%]">
                    {renderSlideContent(slide, false)}
                </div>
            </div>
        </div>
    );
} 
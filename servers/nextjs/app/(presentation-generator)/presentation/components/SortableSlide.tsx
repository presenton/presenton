import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Slide } from '../../types/slide';
import { memo, useRef } from 'react';
import { SlideThumbnailCard } from './SlideThumbnailCard';
interface SortableSlideProps {
    slide: Slide;
    index: number;
    selectedSlide: number;
    onSlideClick: (index: any) => void;
    fonts?: unknown;
    presentationVersion?: unknown;
}

export const SortableSlide = memo(function SortableSlide({
    slide,
    index,
    selectedSlide,
    onSlideClick,
    fonts,
    presentationVersion,
}: SortableSlideProps) {
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
    };

    const handleClick = () => {
        const now = Date.now();

        // Debounce clicks - only allow one click every 300ms
        if (now - lastClickTime.current < 300) {
            return;
        }

        // Only trigger click if not dragging
        if (!isDragging) {
            lastClickTime.current = now;
            onSlideClick(index);
        }
    };

    return (
        <SlideThumbnailCard
            ref={setNodeRef}
            slide={slide}
            index={index}
            selected={selectedSlide === index}
            fonts={fonts}
            presentationVersion={presentationVersion}
            style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}
        />
    );
}, (previous, next) =>
    previous.slide === next.slide &&
    previous.index === next.index &&
    previous.onSlideClick === next.onSlideClick &&
    previous.fonts === next.fonts &&
    previous.presentationVersion === next.presentationVersion &&
    (previous.selectedSlide === previous.index) ===
    (next.selectedSlide === next.index)
);

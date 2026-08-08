import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Slide } from '../../types/slide';
import { useRef } from 'react';

interface SortableListItemProps {
    slide: Slide;
    index: number;
    selectedSlide: number;
    onSlideClick: (index: any) => void;
}

export function SortableListItem({ slide, index, selectedSlide, onSlideClick }: SortableListItemProps) {
    const lastClickTime = useRef(0);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: slide.id! });

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
            onSlideClick(index);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}
            className={`p-3 cursor-pointer ring-0 border-[3px] rounded-lg slide-box
                ${selectedSlide === index
                    ? ' border-[#5141e5] '
                    : 'hover:slide-box/40 border-gray-300'
                }`}
        >
            <span className="font-medium slide-title">Slide {index + 1}</span>
          
        </div>
    );
}

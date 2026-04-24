import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripHorizontal, Trash, Trash2 } from "lucide-react"
import { RootState } from "@/store/store"
import { useDispatch, useSelector } from "react-redux"
import { deleteSlideOutline, setOutlines } from "@/store/slices/presentationGeneration"
import ToolTip from "@/components/ToolTip"
import MarkdownEditor from "../../components/MarkdownEditor"
import { useEffect, useMemo, useRef, useState } from "react"
import { marked } from "marked"


interface OutlineItemProps {
    sortableId: string
    slideOutline: {
        content: string,
    },
    index: number
    isStreaming: boolean
    isActiveStreaming?: boolean
    isStableStreaming?: boolean
}

export function OutlineItem({
    sortableId,
    index,
    slideOutline,
    isStreaming,
    isActiveStreaming = false,
    isStableStreaming = false,
}: OutlineItemProps) {
    const {
        outlines,
    } = useSelector((state: RootState) => state.presentationGeneration);
    const dispatch = useDispatch()

    useEffect(() => {
        if (isStreaming && slideOutline) {
            const outlineItem = document.getElementById(`outline-item-${index}`);
            if (outlineItem) {
                outlineItem.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
            }
        }
    }, [outlines.length]);

    const handleSlideChange = (newOutline: any) => {
        if (isStreaming) return;
        const newData = outlines?.map((each, idx) => {
            if (idx === index - 1) {
                return {
                    content: newOutline
                }
            }
            return each;
        });

        if (!newData) return;
        dispatch(setOutlines(newData));
    }


    // DnD sortable configuration
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sortableId, disabled: isStreaming })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }
    const handleSlideDelete = () => {
        if (isStreaming) return;
        dispatch(deleteSlideOutline({ index: index - 1 }))

    }

    // Throttled markdown rendering only for the active streaming item to avoid flicker
    const [renderedHtml, setRenderedHtml] = useState<string>("")
    const throttleRef = useRef<number | null>(null)
    useEffect(() => {
        if (!isStreaming || !isActiveStreaming) return
        const content = slideOutline.content || ""
        // Throttle updates to ~60ms to reduce reflows/flicker
        if (throttleRef.current) {
            window.clearTimeout(throttleRef.current)
        }
        throttleRef.current = window.setTimeout(() => {
            try {
                setRenderedHtml(marked.parse(content) as string)
            } catch {
                setRenderedHtml("")
            }
        }, 60)
        return () => {
            if (throttleRef.current) {
                window.clearTimeout(throttleRef.current)
            }
        }
    }, [isStreaming, isActiveStreaming, slideOutline.content])

    // Memoized stable HTML for previous (already completed) items during streaming
    const stableHtml = useMemo(() => {
        if (!isStreaming || isActiveStreaming) return null
        if (!isStableStreaming) return null
        try {
            return marked.parse(slideOutline.content || "") as string
        } catch {
            return null
        }
    }, [isStreaming, isActiveStreaming, isStableStreaming, slideOutline.content])

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`mb-4 bg-white rounded-[12px] group shadow-sm p-10 relative font-syne transition-all duration-500 hover:shadow-[0_6.6px_13.2px_0_rgba(0,0,0,0.10)] ${isDragging ? "opacity-50" : ""}`}
        >

            <div
                className="flex items-start gap-3 md:gap-4 rounded-[8px]"
            >

                <div
                    {...attributes}
                    {...listeners}
                    className=" flex items-center justify-center relative cursor-grab"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 10C12.5523 10 13 9.55228 13 9C13 8.44772 12.5523 8 12 8C11.4477 8 11 8.44772 11 9C11 9.55228 11.4477 10 12 10Z" fill="#191919" stroke="#191919" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 10C19.5523 10 20 9.55228 20 9C20 8.44772 19.5523 8 19 8C18.4477 8 18 8.44772 18 9C18 9.55228 18.4477 10 19 10Z" fill="#191919" stroke="#191919" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 10C5.55228 10 6 9.55228 6 9C6 8.44772 5.55228 8 5 8C4.44772 8 4 8.44772 4 9C4 9.55228 4.44772 10 5 10Z" fill="#191919" stroke="#191919" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 16C12.5523 16 13 15.5523 13 15C13 14.4477 12.5523 14 12 14C11.4477 14 11 14.4477 11 15C11 15.5523 11.4477 16 12 16Z" fill="#191919" stroke="#191919" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 16C19.5523 16 20 15.5523 20 15C20 14.4477 19.5523 14 19 14C18.4477 14 18 14.4477 18 15C18 15.5523 18.4477 16 19 16Z" fill="#191919" stroke="#191919" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 16C5.55228 16 6 15.5523 6 15C6 14.4477 5.55228 14 5 14C4.44772 14 4 14.4477 4 15C4 15.5523 4.44772 16 5 16Z" fill="#191919" stroke="#191919" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>


                <div id={`outline-item-${index}`} className="flex flex-col basis-full gap-2">
                    <p className="text-black w-fit text-[10px] font-medium  bg-white border border-[#EDEEEF] rounded-[80px] px-2.5">Slide {index}</p>
                    {/* Editable Markdown Content */}
                    {isStreaming ? (
                        isActiveStreaming ? (
                            <div
                                className="text-sm flex-1 font-normal prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderedHtml || "" }}
                            />
                        ) : stableHtml ? (
                            <div
                                className="text-sm flex-1 font-normal prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: stableHtml }}
                            />
                        ) : (
                            <p className="text-sm  flex-1 font-normal">{slideOutline.content || ''}</p>
                        )
                    ) : (
                        <MarkdownEditor
                            key={index}
                            content={slideOutline.content || ''}
                            onChange={(content) => handleSlideChange(content)}
                        />
                    )}

                </div>


                <div className="hidden group-hover:flex absolute -top-3 -right-3 gap-1 sm:gap-2 items-center">

                    <ToolTip content="Delete Slide">
                        <button
                            onClick={handleSlideDelete}
                            className="p-1.5 sm:p-2 bg-white shadow-md  rounded-full transition-colors"
                        >
                            <Trash className="w-4 h-4  text-black/70" />
                        </button>
                    </ToolTip>
                </div>
            </div>



        </div>
    )
}


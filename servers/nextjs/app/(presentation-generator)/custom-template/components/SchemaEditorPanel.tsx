/**
 * Schema Editor Panel Component
 * Wraps the SchemaEditor with compiled layout functionality
 */

import React from "react";
import { ProcessedSlide } from "../types";
import { SchemaEditor } from "./SchemaEditor";
import { useCompiledLayout } from "../hooks/useCompiledLayout";

interface SchemaEditorPanelProps {
    slide: ProcessedSlide;
    slideIndex: number;
    onSave: (updatedReact: string) => void;
    onCancel: () => void;
    onFillContent?: (content: Record<string, any>) => void;
}

export const SchemaEditorPanel: React.FC<SchemaEditorPanelProps> = ({
    slide,
    slideIndex,
    onSave,
    onCancel,
    onFillContent,
}) => {
    const compiledLayout = useCompiledLayout(slide.react);

    return (
        <SchemaEditor
            slide={slide}
            compiledLayout={compiledLayout}
            isOpen={true}
            onSave={onSave}
            onCancel={onCancel}
            onFillContent={onFillContent}
        />
    );
};


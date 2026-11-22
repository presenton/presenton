"use client";

import React, { useState, useEffect } from "react";

import { marked } from "marked";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
    content?: string | null;
    className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    const [markdownContent, setMarkdownContent] = useState<string>("");

    useEffect(() => {
        if (typeof content !== "string" || content.length === 0) {
            setMarkdownContent("");
            return;
        }

        let active = true;
        const parseMarkdown = async () => {
            try {
                const parsed = await marked.parse(content);
                if (active) setMarkdownContent(parsed);
            } catch (error) {
                if (!active) return;
                console.error("Error parsing markdown:", error);
                setMarkdownContent("");
            }
        };

        parseMarkdown();
        return () => { active = false; };
    }, [content]);

    return (
        <div
            className={cn("prose prose-slate max-w-none mb-10", className)}
            dangerouslySetInnerHTML={{ __html: markdownContent }}
        />
    );
};

export default MarkdownRenderer;

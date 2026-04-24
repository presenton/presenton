/**
 * Constants for Custom Template Creation Flow
 */

import { TemplateCreationStep } from "../types";

// Step configuration
export const TEMPLATE_STEPS: Record<TemplateCreationStep, { title: string; description: string }> = {
    'file-upload': {
        title: 'Upload Template',
        description: 'Upload your PPTX file to begin',
    },
    'font-check': {
        title: 'Font Check',
        description: 'Checking fonts in your presentation',
    },
    'font-upload': {
        title: 'Upload Fonts',
        description: 'Upload missing fonts for accurate rendering',
    },
    'slides-preview': {
        title: 'Preview Slides',
        description: 'Review your slides before processing',
    },
    'template-creation': {
        title: 'Template Creation',
        description: 'Converting slides to reusable templates',
    },
    'completed': {
        title: 'Completed',
        description: 'Your template is ready to save',
    },
};

// UI Configuration
export const UI_CONFIG = {
    schemaEditorWidth: '520px',
    slideGridGap: '20px',
    maxContentWidth: '1400px',
}
// Highlights for benefits section
export const HIGHLIGHTS_ITEMS = [
    {
        number: "1",
        title: "Time-consume",
        description: "Manual formatting and slide copying wastes hours every week",
    },
    {
        number: "2",
        title: "Expensive",
        description: "Design resources spent on repetitive tasks instead of innovation",
    },
    {
        number: "3",
        title: "Inconsistent",
        description: "AI generates unpredictable layouts that require constant cleanup",
    },
]

// External scripts
export const TAILWIND_CDN_URL = "https://cdn.tailwindcss.com";



export const FAQS = [
    {
        question: "What is Custom Template Creation?",
        answer: "Custom Template Creation is a feature that allows you to create custom templates for your presentations.",
    },
    {
        question: "How do I create a custom template?",
        answer: "You can create a custom template by uploading a PPTX file and then editing the template to your liking.",
    },
    {
        question: "How do I edit a custom template?",
        answer: "You can edit a custom template by uploading a PPTX file and then editing the template to your liking.",
    },
    {
        question: "How do I delete a custom template?",
        answer: "You can delete a custom template by uploading a PPTX file and then editing the template to your liking.",
    },
    {
        question: "How do I create a custom template?",
        answer: "You can create a custom template by uploading a PPTX file and then editing the template to your liking.",
    },
    {
        question: "How do I edit a custom template?",
        answer: "You can edit a custom template by uploading a PPTX file and then editing the template to your liking.",
    },
    {
        question: "How do I delete a custom template?",
        answer: "You can delete a custom template by uploading a PPTX file and then editing the template to your liking.",
    },
]
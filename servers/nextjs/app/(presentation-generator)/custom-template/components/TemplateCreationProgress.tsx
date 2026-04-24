import React from "react";
import {
    Upload,
    Type,
    Images,
    Sparkles,
    Check,
    Loader2,
} from "lucide-react";
import { TemplateCreationStep } from "../types";

interface TemplateCreationProgressProps {
    currentStep: TemplateCreationStep;
    totalSlides?: number;
    processedSlides?: number;
}

interface StepConfig {
    id: TemplateCreationStep;
    label: string;
    icon: React.ReactNode;
}

const steps: StepConfig[] = [
    {
        id: 'file-upload',
        label: 'Upload',
        icon: <Upload className="w-4 h-4" />
    },
    {
        id: 'font-check',
        label: 'Fonts',
        icon: <Type className="w-4 h-4" />
    },
    {
        id: 'slides-preview',
        label: 'Preview',
        icon: <Images className="w-4 h-4" />
    },
    {
        id: 'template-creation',
        label: 'Generate',
        icon: <Sparkles className="w-4 h-4" />
    },
    {
        id: 'completed',
        label: 'Done',
        icon: <Check className="w-4 h-4" />
    },
];

export const TemplateCreationProgress: React.FC<TemplateCreationProgressProps> = ({
    currentStep,
    totalSlides = 0,
    processedSlides = 0,
}) => {
    const getCurrentStepIndex = () => {
        if (currentStep === 'font-upload') return 1;
        const stepIndex = steps.findIndex(s => s.id === currentStep);
        return stepIndex >= 0 ? stepIndex : 0;
    };

    const currentStepIndex = getCurrentStepIndex();

    const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'pending' => {
        if (currentStep === 'completed') return 'completed';
        if (stepIndex < currentStepIndex) return 'completed';
        if (stepIndex === currentStepIndex) return 'current';
        return 'pending';
    };

    const progressPercentage = totalSlides > 0
        ? Math.round((processedSlides / totalSlides) * 100)
        : 0;

    return (
        <div className="w-full max-w-[700px] mx-auto mb-8">
            {/* Steps */}
            <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                    const status = getStepStatus(index);
                    const isLast = index === steps.length - 1;

                    return (
                        <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center">
                                {/* Circle */}
                                <div
                                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200
                    ${status === 'completed'
                                            ? 'bg-[#7A5AF8] border-[#7A5AF8] text-white'
                                            : status === 'current'
                                                ? 'bg-white border-[#7A5AF8] text-[#7A5AF8]'
                                                : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                                        }
                  `}
                                >
                                    {status === 'completed' ? (
                                        <Check className="w-4 h-4" />
                                    ) : status === 'current' && currentStep === 'template-creation' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        step.icon
                                    )}
                                </div>

                                {/* Label */}
                                <span
                                    className={`
                    mt-2 text-xs font-medium
                    ${status === 'completed' || status === 'current'
                                            ? 'text-[#374151]'
                                            : 'text-[#9CA3AF]'
                                        }
                  `}
                                >
                                    {step.label}
                                </span>
                            </div>

                            {/* Connector */}
                            {!isLast && (
                                <div className="flex-1 h-px mx-3 -mt-5">
                                    <div
                                        className={`h-full transition-colors duration-200 ${getStepStatus(index + 1) !== 'pending'
                                            ? 'bg-[#7A5AF8]'
                                            : 'bg-[#E5E7EB]'
                                            }`}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Processing Progress */}
            {currentStep === 'template-creation' && totalSlides > 0 && (
                <div className="mt-6 p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#374151]">
                            Processing slides
                        </span>
                        <span className="text-sm font-medium text-[#374151]">
                            {processedSlides} / {totalSlides}
                        </span>
                    </div>

                    <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#7A5AF8] rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

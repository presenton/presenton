import React from 'react'
import { MixpanelEvent, trackEvent } from '@/utils/mixpanel'

const STEPS = ["Text Provider", "Image Provider", "Web Search", "Finish Setup"];

const OnBoardingHeader = ({
    currentStep,
    providerStep,
    setStep,
    setProviderStep,
}: {
    currentStep: number,
    providerStep: number,
    setStep: (step: number) => void,
    setProviderStep: (step: number) => void,
}) => {
    const activeStep = currentStep === 3 ? 4 : providerStep;

    const goToStep = (target: number) => {
        if (target >= activeStep) return;
        trackEvent(MixpanelEvent.Onboarding_Back_Clicked, {
            from_step_number: activeStep,
            to_step_number: target,
            source: "progress_header",
        });
        setProviderStep(target);
        setStep(2);
    };

    return (
        <div className='sticky top-8 z-20 flex items-center font-syne justify-end mt-7 mb-[52px]'>
            <div className='flex items-center gap-1'>
                {STEPS.map((label, index) => {
                    const number = index + 1;
                    return (
                        <React.Fragment key={label}>
                            {index > 0 && <div className='w-4 h-px bg-[#ECECEF]' />}
                            <button
                                type="button"
                                onClick={() => goToStep(number)}
                                className={`flex items-center gap-1 ${number < activeStep ? "cursor-pointer" : "cursor-default"}`}
                            >
                                <div className={`${activeStep === number ? 'bg-[#010100] text-white' : 'border border-[#ECECEF] text-[#494A4D]'} h-7 w-7 text-xs font-medium rounded-full flex items-center justify-center`}>
                                    {number}
                                </div>
                                <p className='hidden xl:block text-[#010000] text-xs'>{label}</p>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    )
}

export default OnBoardingHeader

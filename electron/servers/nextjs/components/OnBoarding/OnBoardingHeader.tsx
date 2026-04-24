import React from 'react'


const OnBoardingHeader = ({ currentStep, setStep }: { currentStep: number, setStep: (step: number) => void }) => {
    return (
        <div className='sticky top-8 z-20 flex items-center font-syne justify-end gap-1 mt-7 mb-[52px]'>

            <div className='flex items-center gap-1 cursor-pointer'
                onClick={() => {
                    if (currentStep > 1) {
                        setStep(1);
                    }
                }}
            >
                <div className={`${currentStep === 1 ? 'bg-[#010100] text-white' : 'border border-[#ECECEF] text-[#494A4D]'} px-2.5 h-7 w-7  text-xs font-medium rounded-full flex items-center justify-center `}>
                    1
                </div>
                <p className='text-[#010000] text-xs '>Select Mode</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="1" viewBox="0 0 22 1" fill="none">
                <path d="M0 0.5H21.5" stroke="#ECECEF" />
            </svg>
            <div className='flex items-center gap-1 cursor-pointer'
                onClick={() => {
                    if (currentStep > 2) {
                        setStep(2);
                    }
                }}
            >
                <div className={`${currentStep === 2 ? 'bg-[#010100] text-white' : 'border border-[#ECECEF] text-[#494A4D]'} px-2.5 h-7 w-7  text-xs font-medium rounded-full flex items-center justify-center `}>
                    2
                </div>
                <p className='text-[#010000] text-xs '>Choose Providers</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="1" viewBox="0 0 22 1" fill="none">
                <path d="M0 0.5H21.5" stroke="#ECECEF" />
            </svg>
            <div className='flex items-center gap-1'>
                <div className={`${currentStep === 3 ? 'bg-[#010100] text-white' : 'border border-[#ECECEF] text-[#494A4D]'} px-2.5 h-7 w-7  text-xs font-medium rounded-full flex items-center justify-center `}>
                    3
                </div>
                <p className='text-[#010000] text-xs '>Finish Setup</p>
            </div>
        </div>
    )
}

export default OnBoardingHeader

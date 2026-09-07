import React from 'react'

interface StepIndicatorProps {
  currentStep: number
}

const steps = [
  { step: 1, label: 'Brand' },
  { step: 2, label: 'Palette' },
  { step: 3, label: 'Fonts' },
  { step: 4, label: 'Logo' },
]

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => (
  <div className="flex flex-col items-center gap-7 px-4 min-w-[104px] pt-8 border-r border-[#EDEEEF]">
    {steps.map(({ step, label }) => {
      const isActive = currentStep === step
      return (
        <div key={step} className="flex flex-col items-center gap-1.5 px-3  ">
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${isActive
              ? 'bg-[#2563EB] text-white'
              : 'bg-white text-[#404348] border border-[#EDEEEF]'
              }`}
          >
            Step-{step}
          </span>
          <span className="text-[11px] font-normal text-black">{label}</span>
        </div>
      )
    })}
  </div>
)

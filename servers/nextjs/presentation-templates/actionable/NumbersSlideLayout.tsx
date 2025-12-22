import ActionableLogo from '@/components/ActionableLogo';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';

export const layoutId = 'numbers-slide'
export const layoutName = 'Numbers Slide'
export const layoutDescription = 'A slide layout to showcase key numbers and metrics.'

const numberItemSchema = z.object({
  number: z.string().min(1).max(8).default("100").meta({
    description: "The number or metric value",
  }),
  unit: z.string().min(1).max(15).default("Metric").meta({
    description: "The unit or label for the number",
  }),
  explanation: z.string().max(140).optional().default("Explanation for this metric").meta({
    description: "Optional explanatory text for the metric",
  })
})

const numbersSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Key Achievements This Quarter").meta({
    description: "Main title of the slide",
  }),
  aboveText: z.string().min(10).max(300).default("Our team has delivered exceptional results across multiple metrics, demonstrating strong momentum and operational excellence throughout the quarter.").meta({
    description: "Introductory text above the numbers",
  }),
  items: z.array(numberItemSchema).min(1).max(4).default([
    {
      number: "127%",
      unit: "Revenue Growth",
      explanation: "Year-over-year increase driven by new product launches and market expansion"
    },
    {
      number: "3.2M",
      unit: "Active Users",
      explanation: "Total active user base with 89% month-over-month retention rate"
    },
    {
      number: "45",
      unit: "New Partners",
      explanation: "Strategic partnerships established across North America and Europe"
    },
    {
      number: "98%",
      unit: "Satisfaction",
      explanation: "Customer satisfaction score based on quarterly survey results"
    }
  ]).meta({
    description: "List of numbers/metrics to display (max 4 items)",
  }),
  belowText: z.string().max(300).optional().default("These metrics reflect our commitment to excellence and position us strongly for continued growth in the coming quarters").meta({
    description: "Optional text below the numbers",
  })
})

export const Schema = numbersSlideSchema

export type NumbersSlideData = z.infer<typeof numbersSlideSchema>

const NumbersSlideLayout: React.FC<{ data: NumbersSlideData }> = ({ data }) => {
  const title = data.title;
  const aboveText = data.aboveText;
  const items = data.items;
  const belowText = data.belowText;

  return (
    <ActionableWrapper className="p-[50px] flex flex-col">
      <ActionableLogo />
      <div className="flex-1 flex-col flex justify-center py-[10px]">
        <div className='flex flex-col gap-8'>
          <ActionableTitle>
            {title}
          </ActionableTitle>
          <ActionableParagraph>
            {aboveText}
          </ActionableParagraph>
          <div className='grid grid-cols-4 gap-6'>
            {items.map((item, index) => (
              <div key={index} className='bg-gray-100 rounded-lg px-6 py-8 flex flex-col gap-6 items-center'>
                <div className='text-center'>
                  <div className="text-[40px] leading-[150%] font-semibold" style={{ fontFamily: "Geist, sans-serif" }}>
                    {item.number}
                  </div>
                  <div className="font-bold leading-[150%]" style={{ fontFamily: "Geist, sans-serif" }}>
                    {item.unit}
                  </div>
                </div>
                {item.explanation && (
                  <p className="leading-[150%] text-center" style={{ fontFamily: "Geist, sans-serif" }}>
                    {item.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
          {belowText && (
            <ActionableParagraph>
              {belowText}
            </ActionableParagraph>
          )}
        </div>
      </div>
    </ActionableWrapper>
  );
};

export default NumbersSlideLayout;
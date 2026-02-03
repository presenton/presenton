import ActionableLogo from '@/components/ActionableLogo';
import ActionableCredits from '@/components/ActionableCredits';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import { ActionableMainContent } from '@/components/ActionableMainContent';
import { cn } from '@/lib/utils';

export const layoutId = 'funnel-slide'
export const layoutName = 'Funnel Slide'
export const layoutDescription = 'A slide layout to visualize conversion funnels or pipelines with stages, volumes, and conversion rates. Perfect for user journeys, sales pipelines, or any multi-stage process analysis.'

const stageSchema = z.object({
  name: z.string().min(2).max(50).default("Awareness").meta({
    description: "Stage name",
  }),
  value: z.number().min(0).default(10000).meta({
    description: "Volume/count for this stage",
  }),
  label: z.string().min(1).max(20).optional().default("visitors").meta({
    description: "Optional unit label (e.g., 'visitors', 'leads', 'customers')",
  })
})

const funnelSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Parcours de Satisfaction Client").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(10).max(200).default("Analyse du parcours depuis la sollicitation NPS jusqu'à l'action, avec identification des points de friction").meta({
    description: "Subtitle providing context",
  }),
  stages: z.array(stageSchema).min(3).max(6).default([
    { name: "Emails NPS envoyés", value: 18500, label: "envois" },
    { name: "Réponses reçues", value: 4280, label: "réponses" },
    { name: "Promoteurs identifiés", value: 2640, label: "promoteurs" },
    { name: "Sollicités pour témoignage", value: 580, label: "sollicitations" }
  ]).meta({
    description: "Funnel stages from top to bottom (3-6 stages, values should be decreasing)",
  }),
  belowText: z.string().max(250).optional().default("Taux de réponse de 23% conforme au benchmark. Opportunité d'amélioration sur conversion promoteurs vers ambassadeurs (22%).").meta({
    description: "Optional insight or conclusion below the funnel",
  })
})

export const Schema = funnelSlideSchema

export type FunnelSlideData = z.infer<typeof funnelSlideSchema>

const FunnelSlideLayout: React.FC<{ data: FunnelSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const stages = data.stages;
  const belowText = data.belowText;

  // Calculate conversion rates
  const conversionRates = stages.map((stage, index) => {
    if (index === 0) return null;
    const rate = ((stage.value / stages[index - 1].value) * 100).toFixed(1);
    return `${rate}%`;
  });

  // Color palette for stages (dark to light gray gradient)
  const stageColors = [
    '#262626', // Very dark gray
    '#404040', // Dark gray
    '#525252', // Medium-dark gray
    '#737373', // Medium gray
    '#a3a3a3', // Light gray
    '#d4d4d4'  // Very light gray
  ];

  return (
    <ActionableWrapper className="p-[50px] flex flex-col justify-between">
      <ActionableLogo />

      <ActionableMainContent className="gap-4">
        <div className='flex flex-col gap-2'>
          <ActionableTitle>
            {title}
          </ActionableTitle>
          <ActionableParagraph>
            {subtitle}
          </ActionableParagraph>
        </div>

        <div className='flex gap-5'>
          {/* Left side: Stages */}
          <div className='flex-1 flex flex-col gap-1'>
            {stages.map((stage, index) => {
              const stageColor = stageColors[index % stageColors.length];
              const nextDropRate = conversionRates[index + 1]
                ? `${(100 - parseFloat(conversionRates[index + 1])).toFixed(1)}% drop-off`
                : null;

              return (
                <div key={index}>
                  {/* Stage block */}
                  <div
                    className='text-white px-4 py-2.5 flex items-center justify-between'
                    style={{ backgroundColor: stageColor }}
                  >
                    <div className='flex flex-col gap-0.5'>
                      <span className='font-semibold text-[13px]' style={{ fontFamily: "Geist, sans-serif" }}>
                        {index + 1}. {stage.name}
                      </span>
                      <span className='text-[9px] opacity-80' style={{ fontFamily: "Geist, sans-serif" }}>
                        {stage.label}
                      </span>
                    </div>
                    <span className='font-bold text-[18px]' style={{ fontFamily: "Geist, sans-serif" }}>
                      {stage.value.toLocaleString()}
                    </span>
                  </div>

                  {/* Drop-off indicator - only if there's a next stage */}
                  {index < stages.length - 1 && nextDropRate && (
                    <div className='flex items-center gap-2 py-1 px-4'>
                      <div className='flex-1 border-l-2 border-dashed border-gray-300 h-3'></div>
                      <div className='flex items-center gap-2 bg-red-50 px-2 py-0.5 border-l-2 border-red-500'>
                        <span className='text-[9px] font-bold text-red-700' style={{ fontFamily: "Geist, sans-serif" }}>
                          {nextDropRate}
                        </span>
                        <span className='text-[9px] text-gray-600' style={{ fontFamily: "Geist, sans-serif" }}>
                          {conversionRates[index + 1]} continue
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right side: Key metrics */}
          <div className='w-1/3 flex flex-col gap-2'>
            <div className='border-2 border-[#2A9D90] bg-emerald-50 p-3 flex flex-col gap-1'>
              <span className='text-[10px] font-bold text-gray-600' style={{ fontFamily: "Geist, sans-serif" }}>
                OVERALL CONVERSION
              </span>
              <span className='text-[28px] font-bold leading-none text-[#2A9D90]' style={{ fontFamily: "Geist, sans-serif" }}>
                {((stages[stages.length - 1].value / stages[0].value) * 100).toFixed(1)}%
              </span>
              <span className='text-[10px] text-gray-600' style={{ fontFamily: "Geist, sans-serif" }}>
                {stages[0].value.toLocaleString()} → {stages[stages.length - 1].value.toLocaleString()}
              </span>
            </div>

            <div className='border border-gray-300 p-3 flex flex-col gap-1'>
              <span className='text-[10px] font-bold text-gray-600' style={{ fontFamily: "Geist, sans-serif" }}>
                TOTAL DROP-OFF
              </span>
              <span className='text-[20px] font-bold leading-none' style={{ fontFamily: "Geist, sans-serif" }}>
                {((1 - stages[stages.length - 1].value / stages[0].value) * 100).toFixed(1)}%
              </span>
              <span className='text-[10px] text-gray-600' style={{ fontFamily: "Geist, sans-serif" }}>
                {(stages[0].value - stages[stages.length - 1].value).toLocaleString()} lost
              </span>
            </div>

            {/* Biggest drop-off */}
            {(() => {
              let maxDrop = 0;
              let maxDropIndex = 0;
              stages.forEach((_, index) => {
                if (index > 0) {
                  const drop = 100 - parseFloat(conversionRates[index] || '100');
                  if (drop > maxDrop) {
                    maxDrop = drop;
                    maxDropIndex = index;
                  }
                }
              });
              return (
                <div className='border border-red-300 bg-red-50 p-3 flex flex-col gap-0.5'>
                  <span className='text-[9px] font-bold text-red-700' style={{ fontFamily: "Geist, sans-serif" }}>
                    BIGGEST DROP-OFF
                  </span>
                  <span className='text-[11px] font-semibold leading-[130%]' style={{ fontFamily: "Geist, sans-serif" }}>
                    {stages[maxDropIndex - 1]?.name} → {stages[maxDropIndex]?.name}
                  </span>
                  <span className='text-[16px] font-bold text-red-700 leading-none' style={{ fontFamily: "Geist, sans-serif" }}>
                    {maxDrop.toFixed(1)}% lost
                  </span>
                </div>
              )
            })()}
          </div>
        </div>

        {belowText && (
          <ActionableParagraph>
            {belowText}
          </ActionableParagraph>
        )}
      </ActionableMainContent>

      <ActionableCredits />
    </ActionableWrapper>
  );
};

export default FunnelSlideLayout;

import ActionableLogo from '@/components/ActionableLogo';
import ActionableCredits from '@/components/ActionableCredits';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableSubTitle from '@/components/ActionableSubTitle';
import { ActionableMainContent } from '@/components/ActionableMainContent';
import { cn } from '@/lib/utils';

export const layoutId = 'comparison-slide'
export const layoutName = 'Comparison Slide'
export const layoutDescription = 'A slide layout to compare two scenarios, options, or time periods side by side with key metrics and variations. Perfect for A/B tests, before/after analysis, or benchmarking.'

const metricItemSchema = z.object({
  label: z.string().min(2).max(50).default("Revenue").meta({
    description: "Metric label",
  }),
  value: z.string().min(1).max(30).default("$2.4M").meta({
    description: "Metric value",
  }),
  variation: z.string().max(20).optional().default("+23%").meta({
    description: "Optional variation indicator (e.g., +23%, -12%)",
  }),
})

const columnSchema = z.object({
  title: z.string().min(2).max(60).default("Option A").meta({
    description: "Column title",
  }),
  subtitle: z.string().min(5).max(100).optional().default("Current approach with existing technology stack").meta({
    description: "Optional subtitle for context",
  }),
  metrics: z.array(metricItemSchema).min(1).max(5).default([
    { label: "Revenue", value: "$2.4M", variation: "+23%" },
    { label: "Users", value: "45K", variation: "+18%" },
    { label: "Conversion", value: "3.2%", variation: "-5%" }
  ]).meta({
    description: "List of metrics for this column",
  }),
  highlight: z.boolean().default(false).meta({
    description: "Whether to highlight this column as recommended/winner",
  })
})

const comparisonSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Impact des Initiatives Satisfaction").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(10).max(200).default("Comparaison des indicateurs avant et après mise en place du programme d'amélioration").meta({
    description: "Subtitle providing context",
  }),
  columns: z.array(columnSchema).length(2).default([
    {
      title: "Avant Initiatives",
      subtitle: "Période de référence Q1-Q2 2025",
      metrics: [
        { label: "NPS Score", value: "48", variation: "—" },
        { label: "Taux de réponse", value: "18%", variation: "—" },
        { label: "Temps de réponse moyen", value: "52h", variation: "—" },
        { label: "Satisfaction support", value: "62%", variation: "—" }
      ],
      highlight: false
    },
    {
      title: "Après Initiatives",
      subtitle: "Résultats Q3-Q4 2025",
      metrics: [
        { label: "NPS Score", value: "64", variation: "+33%" },
        { label: "Taux de réponse", value: "24%", variation: "+33%" },
        { label: "Temps de réponse moyen", value: "28h", variation: "-46%" },
        { label: "Satisfaction support", value: "78%", variation: "+26%" }
      ],
      highlight: true
    }
  ]).meta({
    description: "Two columns to compare (exactly 2 required)",
  }),
  belowText: z.string().max(250).optional().default("Amélioration significative sur tous les indicateurs. ROI positif des initiatives avec impact direct sur satisfaction et engagement.").meta({
    description: "Optional conclusion or note below the comparison",
  })
})

export const Schema = comparisonSlideSchema

export type ComparisonSlideData = z.infer<typeof comparisonSlideSchema>

const ComparisonSlideLayout: React.FC<{ data: ComparisonSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const columns = data.columns;
  const belowText = data.belowText;

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

        <div className='flex gap-4'>
          {columns.map((column, index) => (
            <div
              key={index}
              className={cn(
                'flex-1 border-2 p-5 flex flex-col gap-4',
                column.highlight ? 'border-[#2A9D90] bg-emerald-50' : 'border-gray-200 bg-gray-50'
              )}
            >
              {/* Column Header */}
              <div className='flex flex-col gap-1'>
                <div className='flex items-center gap-2'>
                  <ActionableSubTitle variant='geist'>
                    {column.title}
                  </ActionableSubTitle>
                  {column.highlight && (
                    <span className='text-[10px] font-bold tracking-wider text-[#2A9D90] px-2 py-0.5 bg-emerald-100' style={{ fontFamily: "Geist, sans-serif" }}>
                      RECOMMENDED
                    </span>
                  )}
                </div>
                {column.subtitle && (
                  <p className="text-[13px] leading-[130%]" style={{ fontFamily: "Geist, sans-serif" }}>
                    {column.subtitle}
                  </p>
                )}
              </div>

              {/* Metrics */}
              <div className='flex flex-col gap-2'>
                {column.metrics.map((metric, metricIndex) => (
                  <div key={metricIndex} className='flex justify-between items-center border-b border-gray-200 pb-2'>
                    <span className="text-[13px] font-medium" style={{ fontFamily: "Geist, sans-serif" }}>
                      {metric.label}
                    </span>
                    <div className='flex items-center gap-2'>
                      <span className="text-[16px] font-bold" style={{ fontFamily: "Geist, sans-serif" }}>
                        {metric.value}
                      </span>
                      {metric.variation && (
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-1.5 py-0.5",
                            metric.variation.startsWith('+') ? 'bg-emerald-100 text-emerald-700' :
                            metric.variation.startsWith('-') ? 'bg-red-100 text-red-700' :
                            'bg-gray-200 text-gray-700'
                          )}
                          style={{ fontFamily: "Geist, sans-serif" }}
                        >
                          {metric.variation}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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

export default ComparisonSlideLayout;

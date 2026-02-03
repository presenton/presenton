import ActionableLogo from '@/components/ActionableLogo';
import ActionableCredits from '@/components/ActionableCredits';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import { ActionableMainContent } from '@/components/ActionableMainContent';
import { cn } from '@/lib/utils';

export const layoutId = 'segment-analysis-slide'
export const layoutName = 'Segment Analysis Slide'
export const layoutDescription = 'A slide layout to compare performance across 3-4 segments with key metrics. Perfect for regional analysis, product comparison, customer personas, or any categorical breakdown.'

const metricSchema = z.object({
  label: z.string().min(2).max(40).default("Revenue").meta({
    description: "Metric label",
  }),
  value: z.string().min(1).max(30).default("$2.4M").meta({
    description: "Metric value",
  }),
  trend: z.enum(['up', 'down', 'neutral']).optional().default('up').meta({
    description: "Trend indicator: 'up' (positive), 'down' (negative), 'neutral'",
  })
})

const segmentSchema = z.object({
  name: z.string().min(2).max(50).default("North America").meta({
    description: "Segment name",
  }),
  description: z.string().min(5).max(100).optional().default("Established market with strong brand presence").meta({
    description: "Optional segment description",
  }),
  metrics: z.array(metricSchema).min(2).max(4).default([
    { label: "Revenue", value: "$2.4M", trend: "up" },
    { label: "Growth", value: "+23%", trend: "up" },
    { label: "Customers", value: "1,240", trend: "neutral" }
  ]).meta({
    description: "Key metrics for this segment (2-4 items)",
  }),
  isTopPerformer: z.boolean().default(false).meta({
    description: "Whether this segment is the top performer",
  })
})

const segmentAnalysisSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Analyse par Segment Client").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(10).max(200).default("Comparaison des indicateurs de satisfaction selon les profils clients pour Q4 2025").meta({
    description: "Subtitle providing context",
  }),
  segments: z.array(segmentSchema).min(3).max(4).default([
    {
      name: "Entreprises (>50 employés)",
      description: "Clients B2B avec contrats annuels",
      metrics: [
        { label: "NPS Score", value: "72", trend: "up" },
        { label: "Taux de rétention", value: "94%", trend: "up" },
        { label: "Tickets support/mois", value: "2.4", trend: "down" }
      ],
      isTopPerformer: true
    },
    {
      name: "PME (10-50 employés)",
      description: "Mix contrats mensuels et annuels",
      metrics: [
        { label: "NPS Score", value: "58", trend: "up" },
        { label: "Taux de rétention", value: "82%", trend: "neutral" },
        { label: "Tickets support/mois", value: "3.8", trend: "neutral" }
      ],
      isTopPerformer: false
    },
    {
      name: "TPE (<10 employés)",
      description: "Majoritairement contrats mensuels",
      metrics: [
        { label: "NPS Score", value: "42", trend: "down" },
        { label: "Taux de rétention", value: "68%", trend: "down" },
        { label: "Tickets support/mois", value: "5.2", trend: "up" }
      ],
      isTopPerformer: false
    },
    {
      name: "Particuliers",
      description: "Abonnements individuels flexibles",
      metrics: [
        { label: "NPS Score", value: "51", trend: "neutral" },
        { label: "Taux de rétention", value: "71%", trend: "up" },
        { label: "Tickets support/mois", value: "4.1", trend: "neutral" }
      ],
      isTopPerformer: false
    }
  ]).meta({
    description: "Segments to compare (3-4 segments recommended)",
  }),
  belowText: z.string().max(250).optional().default("Segment Entreprises affiche les meilleures performances. TPE nécessite attention particulière (NPS bas, churn élevé, forte sollicitation support).").meta({
    description: "Optional conclusion or insight below the segments",
  })
})

export const Schema = segmentAnalysisSlideSchema

export type SegmentAnalysisSlideData = z.infer<typeof segmentAnalysisSlideSchema>

const trendConfig = {
  up: {
    icon: '↑',
    color: 'text-emerald-600'
  },
  down: {
    icon: '↓',
    color: 'text-red-600'
  },
  neutral: {
    icon: '→',
    color: 'text-gray-500'
  }
}

const SegmentAnalysisSlideLayout: React.FC<{ data: SegmentAnalysisSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const segments = data.segments;
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

        <div className={cn('grid gap-4', segments.length === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
          {segments.map((segment, index) => (
            <div
              key={index}
              className={cn(
                'border-2 p-4 flex flex-col gap-3',
                segment.isTopPerformer ? 'border-[#2A9D90] bg-emerald-50' : 'border-gray-200 bg-white'
              )}
            >
              {/* Segment Header */}
              <div className='flex flex-col gap-1'>
                <div className='flex flex-col gap-1'>
                  <div className='font-bold text-[16px] leading-[130%]' style={{ fontFamily: "Geist, sans-serif" }}>
                    {segment.name}
                  </div>
                  {segment.isTopPerformer && (
                    <span className='text-[9px] font-bold tracking-wider text-[#2A9D90] px-1.5 py-0.5 bg-emerald-100 w-fit' style={{ fontFamily: "Geist, sans-serif" }}>
                      TOP PERFORMER
                    </span>
                  )}
                </div>
                {segment.description && (
                  <p className="text-[11px] leading-[130%] text-gray-600" style={{ fontFamily: "Geist, sans-serif" }}>
                    {segment.description}
                  </p>
                )}
              </div>

              {/* Metrics */}
              <div className='flex flex-col gap-2'>
                {segment.metrics.map((metric, metricIndex) => {
                  const config = metric.trend ? trendConfig[metric.trend] : null;
                  return (
                    <div key={metricIndex} className='flex flex-col gap-0.5'>
                      <span className="text-[11px] text-gray-600" style={{ fontFamily: "Geist, sans-serif" }}>
                        {metric.label}
                      </span>
                      <div className='flex items-center gap-1.5'>
                        <span className="text-[18px] font-bold leading-none" style={{ fontFamily: "Geist, sans-serif" }}>
                          {metric.value}
                        </span>
                        {config && (
                          <span className={cn('text-[14px] leading-none', config.color)}>
                            {config.icon}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
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

export default SegmentAnalysisSlideLayout;

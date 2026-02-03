import ActionableLogo from '@/components/ActionableLogo';
import ActionableCredits from '@/components/ActionableCredits';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import { ActionableMainContent } from '@/components/ActionableMainContent';
import { cn } from '@/lib/utils';

export const layoutId = 'key-insights-slide'
export const layoutName = 'Key Insights Slide'
export const layoutDescription = 'A slide layout to present 2-4 key insights from data analysis with visual indicators and detailed descriptions. Perfect for highlighting major findings and their implications.'

const insightItemSchema = z.object({
  title: z.string().min(5).max(100).default("User engagement increased significantly").meta({
    description: "Title of the insight",
  }),
  description: z.string().min(20).max(250).default("Analysis reveals a 45% increase in daily active users following the new feature launch, with particularly strong adoption among the 25-34 age demographic.").meta({
    description: "Detailed description of the insight",
  }),
  type: z.enum(['positive', 'negative', 'warning', 'neutral']).default('positive').meta({
    description: "Type of insight: 'positive' (good news, green), 'negative' (concern, red), 'warning' (attention needed, orange), 'neutral' (informational, blue)",
  }),
  impact: z.string().min(5).max(100).optional().default("Projected revenue increase of $2.4M annually").meta({
    description: "Optional impact or implication statement",
  })
})

const keyInsightsSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Principaux Drivers de Satisfaction").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(10).max(200).default("Analyse croisée des données comportementales, transactionnelles et support pour identifier les facteurs clés").meta({
    description: "Subtitle providing context",
  }),
  insights: z.array(insightItemSchema).min(2).max(4).default([
    {
      title: "Le temps de réponse du support est le 1er driver d'insatisfaction",
      description: "Les clients avec un temps de réponse >48h ont un NPS de 15 vs 68 pour ceux avec réponse <24h. Impact sur 23% de la base client.",
      type: "negative",
      impact: "Réduction du temps de réponse pourrait améliorer le NPS de +12 points"
    },
    {
      title: "Les clients multi-canaux sont 2x plus satisfaits",
      description: "NPS de 72 pour les utilisateurs actifs sur app mobile + web vs 38 pour mono-canal. Corrélation forte avec engagement produit.",
      type: "positive",
      impact: "Stratégie d'adoption multi-canal à prioriser"
    },
    {
      title: "Pic d'insatisfaction après 3 mois d'ancienneté",
      description: "NPS chute de 65 à 42 entre mois 3 et 6. Phase critique du parcours client nécessitant attention particulière.",
      type: "warning",
      impact: "Programme d'onboarding et suivi à renforcer sur cette période"
    }
  ]).meta({
    description: "List of key insights (2-4 items recommended)",
  }),
})

export const Schema = keyInsightsSlideSchema

export type KeyInsightsSlideData = z.infer<typeof keyInsightsSlideSchema>

const insightConfig = {
  positive: {
    label: 'POSITIVE',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-l-emerald-500',
    labelColor: 'text-emerald-600',
    dotColor: 'bg-emerald-500'
  },
  negative: {
    label: 'ATTENTION',
    bgColor: 'bg-red-50',
    borderColor: 'border-l-red-500',
    labelColor: 'text-red-600',
    dotColor: 'bg-red-500'
  },
  warning: {
    label: 'WARNING',
    bgColor: 'bg-amber-50',
    borderColor: 'border-l-amber-500',
    labelColor: 'text-amber-600',
    dotColor: 'bg-amber-500'
  },
  neutral: {
    label: 'INSIGHT',
    bgColor: 'bg-blue-50',
    borderColor: 'border-l-blue-500',
    labelColor: 'text-blue-600',
    dotColor: 'bg-blue-500'
  }
}

const KeyInsightsSlideLayout: React.FC<{ data: KeyInsightsSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const insights = data.insights;

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

        <div className='flex flex-col gap-3'>
          {insights.map((insight, index) => {
            const config = insightConfig[insight.type];
            return (
              <div
                key={index}
                className={cn(
                  'px-5 py-3 border-l-4 flex flex-col gap-2',
                  config.bgColor,
                  config.borderColor
                )}
              >
                {/* Label badge */}
                <div className="flex items-center gap-2">
                  <div className={cn('w-1.5 h-1.5', config.dotColor)}></div>
                  <span className={cn('text-[10px] font-bold tracking-wider', config.labelColor)} style={{ fontFamily: "Geist, sans-serif" }}>
                    {config.label}
                  </span>
                </div>

                {/* Content */}
                <div className='flex flex-col gap-1.5'>
                  <h3 className="font-semibold text-[17px] leading-[130%]" style={{ fontFamily: "Geist, sans-serif" }}>
                    {insight.title}
                  </h3>
                  <p className="leading-[140%] text-[13px]" style={{ fontFamily: "Geist, sans-serif" }}>
                    {insight.description}
                  </p>
                  {insight.impact && (
                    <div className="mt-0.5 pt-2 border-t border-gray-200">
                      <p className="leading-[130%] text-[12px] font-semibold" style={{ fontFamily: "Geist, sans-serif" }}>
                        Impact: {insight.impact}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ActionableMainContent>

      <ActionableCredits />
    </ActionableWrapper>
  );
};

export default KeyInsightsSlideLayout;

import ActionableLogo from '@/components/ActionableLogo';
import ActionableCredits from '@/components/ActionableCredits';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import { ActionableMainContent } from '@/components/ActionableMainContent';
import { cn } from '@/lib/utils';

export const layoutId = 'ranking-slide'
export const layoutName = 'Ranking Slide'
export const layoutDescription = 'A slide layout to display ranked performance with top or bottom performers. Perfect for leaderboards, product rankings, sales performance, or any comparative ranking analysis.'

const performerSchema = z.object({
  name: z.string().min(2).max(60).default("John Smith").meta({
    description: "Name of performer (person, product, region, etc.)",
  }),
  metric: z.string().min(1).max(30).default("$245K").meta({
    description: "Primary metric value",
  }),
  secondaryMetric: z.string().max(30).optional().default("+23%").meta({
    description: "Optional secondary metric (e.g., growth rate, change)",
  }),
  description: z.string().max(100).optional().default("Exceeded quarterly target by 23% with strong Q4 performance").meta({
    description: "Optional description or context",
  })
})

const rankingSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Top 5 Drivers de Satisfaction").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(10).max(200).default("Classement des facteurs ayant le plus d'impact sur le NPS selon l'analyse comportementale").meta({
    description: "Subtitle providing context",
  }),
  rankingType: z.enum(['top', 'bottom']).default('top').meta({
    description: "Type of ranking: 'top' (best performers) or 'bottom' (worst performers)",
  }),
  performers: z.array(performerSchema).min(3).max(8).default([
    {
      name: "Temps de réponse support",
      metric: "+28 pts",
      secondaryMetric: "Impact NPS",
      description: "Réponse <24h vs >48h : différence de +28 points de NPS"
    },
    {
      name: "Nombre de fonctionnalités utilisées",
      metric: "+22 pts",
      secondaryMetric: "Impact NPS",
      description: "Utilisateurs actifs 5+ features vs 1-2 features"
    },
    {
      name: "Adoption multi-canal",
      metric: "+18 pts",
      secondaryMetric: "Impact NPS",
      description: "Usage app mobile + web vs mono-canal"
    },
    {
      name: "Fréquence de connexion",
      metric: "+15 pts",
      secondaryMetric: "Impact NPS",
      description: "Connexion hebdomadaire vs mensuelle"
    },
    {
      name: "Ancienneté client",
      metric: "+12 pts",
      secondaryMetric: "Impact NPS",
      description: "Clients >12 mois vs <6 mois (après phase critique)"
    }
  ]).meta({
    description: "List of performers in ranking order (3-8 items, will display in order provided)",
  }),
  belowText: z.string().max(250).optional().default("Le support est le levier #1 d'amélioration. Focus sur réduction temps de réponse et adoption produit recommandé.").meta({
    description: "Optional insight or conclusion below the ranking",
  })
})

export const Schema = rankingSlideSchema

export type RankingSlideData = z.infer<typeof rankingSlideSchema>

const RankingSlideLayout: React.FC<{ data: RankingSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const rankingType = data.rankingType;
  const performers = data.performers;
  const belowText = data.belowText;

  const getRankBadge = (index: number) => {
    if (rankingType === 'top') {
      if (index === 0) return '🥇';
      if (index === 1) return '🥈';
      if (index === 2) return '🥉';
    }
    return null;
  };

  const getRankColor = (index: number) => {
    if (rankingType === 'top' && index < 3) {
      return 'bg-[#2A9D90] text-white';
    }
    if (rankingType === 'bottom' && index < 3) {
      return 'bg-red-100 border-red-300 text-red-700';
    }
    return 'bg-gray-50 border-gray-200 text-gray-700';
  };

  return (
    <ActionableWrapper className="p-[50px] flex flex-col justify-between">
      <ActionableLogo />

      <ActionableMainContent className="gap-3">
        <div className='flex flex-col gap-1.5'>
          <ActionableTitle>
            {title}
          </ActionableTitle>
          <ActionableParagraph>
            {subtitle}
          </ActionableParagraph>
        </div>

        <div className='flex flex-col gap-2'>
          {performers.map((performer, index) => {
            const badge = getRankBadge(index);
            const colorClass = getRankColor(index);

            return (
              <div
                key={index}
                className={cn('border-2 px-4 py-3 flex items-center gap-4', colorClass)}
              >
                {/* Rank number */}
                <div className='flex items-center gap-2 w-[60px] flex-shrink-0'>
                  <span className='font-bold text-[20px]' style={{ fontFamily: "Geist, sans-serif" }}>
                    {index + 1}
                  </span>
                  {badge && (
                    <span className='text-[18px]'>
                      {badge}
                    </span>
                  )}
                </div>

                {/* Name and description */}
                <div className='flex-1 flex flex-col gap-0.5'>
                  <span className='font-semibold text-[15px]' style={{ fontFamily: "Geist, sans-serif" }}>
                    {performer.name}
                  </span>
                  {performer.description && (
                    <p className='text-[11px] leading-[130%] opacity-80' style={{ fontFamily: "Geist, sans-serif" }}>
                      {performer.description}
                    </p>
                  )}
                </div>

                {/* Metrics */}
                <div className='flex items-center gap-3 flex-shrink-0'>
                  <span className='font-bold text-[18px]' style={{ fontFamily: "Geist, sans-serif" }}>
                    {performer.metric}
                  </span>
                  {performer.secondaryMetric && (
                    <span className='text-[13px] font-semibold' style={{ fontFamily: "Geist, sans-serif" }}>
                      {performer.secondaryMetric}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
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

export default RankingSlideLayout;

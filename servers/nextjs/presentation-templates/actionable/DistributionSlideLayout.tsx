import ActionableLogo from '@/components/ActionableLogo';
import ActionableCredits from '@/components/ActionableCredits';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import { ActionableMainContent } from '@/components/ActionableMainContent';

export const layoutId = 'distribution-slide'
export const layoutName = 'Distribution Slide'
export const layoutDescription = 'A slide layout to show distribution and breakdown of data across categories with proportional bars and percentages. Perfect for market share, budget allocation, traffic sources, or any categorical distribution.'

const categorySchema = z.object({
  name: z.string().min(2).max(50).default("Category A").meta({
    description: "Category name",
  }),
  value: z.number().min(0).default(100).meta({
    description: "Value for this category",
  }),
  description: z.string().max(100).optional().default("Additional context for this category").meta({
    description: "Optional description or insight",
  })
})

const distributionSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Causes d'Insatisfaction Client").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(10).max(200).default("Analyse de 2,450 verbatims négatifs pour identifier les principaux motifs d'insatisfaction").meta({
    description: "Subtitle providing context",
  }),
  categories: z.array(categorySchema).min(3).max(8).default([
    { name: "Temps de réponse du support", value: 847, description: "Délais jugés trop longs, promesses non tenues" },
    { name: "Qualité du produit/service", value: 612, description: "Bugs, fonctionnalités manquantes, performance" },
    { name: "Complexité d'utilisation", value: 423, description: "Interface peu intuitive, manque de documentation" },
    { name: "Rapport qualité/prix", value: 334, description: "Prix jugé trop élevé pour valeur perçue" },
    { name: "Problèmes de facturation", value: 234, description: "Erreurs de paiement, incompréhension des tarifs" }
  ]).meta({
    description: "Categories with values (3-8 items, will be auto-sorted by value)",
  }),
  showDescriptions: z.boolean().default(true).meta({
    description: "Whether to show category descriptions",
  }),
  belowText: z.string().max(250).optional().default("Le support représente 35% des causes d'insatisfaction. Actions prioritaires sur temps de réponse et proactivité recommandées.").meta({
    description: "Optional insight or conclusion below the distribution",
  })
})

export const Schema = distributionSlideSchema

export type DistributionSlideData = z.infer<typeof distributionSlideSchema>

const DistributionSlideLayout: React.FC<{ data: DistributionSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const showDescriptions = data.showDescriptions;
  const belowText = data.belowText;

  // Sort categories by value (descending)
  const sortedCategories = [...data.categories].sort((a, b) => b.value - a.value);

  // Calculate total and percentages
  const total = sortedCategories.reduce((sum, cat) => sum + cat.value, 0);

  // Color palette
  const colors = [
    '#2A9D90',
    '#E76E50',
    '#F4A261',
    '#264653',
    '#E9C46A',
    '#8AB17D',
    '#BC6C25',
    '#A8DADC'
  ];

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
          {sortedCategories.map((category, index) => {
            const percentage = ((category.value / total) * 100).toFixed(1);
            const color = colors[index % colors.length];

            return (
              <div key={index} className='flex flex-col gap-1'>
                {/* Category header */}
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-2.5 h-2.5'
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className='font-semibold text-[14px]' style={{ fontFamily: "Geist, sans-serif" }}>
                      {category.name}
                    </span>
                  </div>
                  <div className='flex items-baseline gap-2'>
                    <span className='font-bold text-[15px]' style={{ fontFamily: "Geist, sans-serif" }}>
                      {percentage}%
                    </span>
                    <span className='text-[11px] text-gray-600' style={{ fontFamily: "Geist, sans-serif" }}>
                      ({category.value.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className='w-full bg-gray-200 h-4 relative overflow-hidden'>
                  <div
                    className='h-full transition-all'
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color
                    }}
                  ></div>
                </div>

                {/* Description */}
                {showDescriptions && category.description && (
                  <p className='text-[10px] text-gray-600 leading-[120%]' style={{ fontFamily: "Geist, sans-serif" }}>
                    {category.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className='flex justify-between items-center pt-1.5 border-t-2 border-gray-300'>
          <span className='font-bold text-[13px]' style={{ fontFamily: "Geist, sans-serif" }}>
            Total
          </span>
          <span className='font-bold text-[15px]' style={{ fontFamily: "Geist, sans-serif" }}>
            {total.toLocaleString()}
          </span>
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

export default DistributionSlideLayout;

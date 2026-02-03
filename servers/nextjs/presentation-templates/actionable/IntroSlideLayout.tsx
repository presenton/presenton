import React from 'react'
import * as z from "zod";
import { ImageSchema } from '../defaultSchemes';
import ActionableLogo from '@/components/ActionableLogo';
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableCredits from '@/components/ActionableCredits';
import ActionableImage from '@/components/ActionableImage';
import { ActionableMainContent } from '@/components/ActionableMainContent';

export const layoutId = 'intro-slide'
export const layoutName = 'Intro Slide'
export const layoutDescription = 'An introduction slide layout featuring title, subtitle, optional period and goal information, with an accompanying image. Perfect for section introductions and topic overviews.'

const introSlideSchema = z.object({
  title: z.string().min(3).max(100).default("Analyse de la Satisfaction Client Q4 2025").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(5).max(150).default("Insights sur les drivers de satisfaction et recommandations pour améliorer l'expérience client").meta({
    description: "Subtitle text",
  }),
  period: z.string().min(2).max(100).optional().default("Octobre - Décembre 2025").meta({
    description: "Time period or timeframe (optional)",
  }),
  goal: z.string().min(5).max(150).optional().default("Identifier les causes d'insatisfaction et prédire les tendances NPS pour anticiper les risques de churn").meta({
    description: "Goal or objective statement (optional)",
  }),
  image: ImageSchema.default({
    __image_url__: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
    __image_prompt__: "Modern office workspace with collaborative team working on innovative projects"
  }).meta({
    description: "Supporting image for the slide",
  })
})

export const Schema = introSlideSchema

export type IntroSlideData = z.infer<typeof introSlideSchema>

const IntroSlideLayout: React.FC<{ data: IntroSlideData }> = ({ data }) => {
  const title = data.title
  const subtitle = data.subtitle
  const period = data.period
  const goal = data.goal
  const image = data.image

  return (
    <ActionableWrapper className="flex items-center justify-between">
      <div className="w-2/5 h-full">
        <ActionableImage
          src={image.__image_url__}
          alt={image.__image_prompt__}
        />
      </div>
      <div className="w-3/5 h-full flex flex-col justify-between py-[50px] pl-[60px] pr-[100px]">
        <ActionableLogo />
        <ActionableMainContent className='gap-6 justify-center pt-0'>
          <ActionableTitle>
            {title}
          </ActionableTitle>
          <ActionableParagraph>
            {subtitle}
          </ActionableParagraph>
          {period && (
            <ActionableParagraph>
              Période : {period}
            </ActionableParagraph>
          )}
          {goal && (
            <ActionableParagraph>
              <strong>Objectif : </strong>{goal}
            </ActionableParagraph>
          )}
        </ActionableMainContent>
        <ActionableCredits />
      </div>
    </ActionableWrapper>
  )
}

export default IntroSlideLayout 
import ActionableCredits from '@/components/ActionableCredits';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableSubTitle from '@/components/ActionableSubTitle';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableLogo from '@/components/ActionableLogo';
import React from 'react'
import * as z from "zod";

export const layoutId = 'bullet-list-slide'
export const layoutName = 'Bullet List Slide'
export const layoutDescription = 'A slide layout for structured bullet points in columns.'

const columnSchema = z.object({
  title: z.string().min(3).max(80).default("Column Title").meta({
    description: "Column title",
  }),
  items: z.array(z.string().min(3).max(140)).min(1).max(5).default(["Item point one", "Item point two", "Item point three"]).meta({
    description: "List of items in this column",
  }),
  belowText: z.string().max(200).optional().default("Additional context for this column").meta({
    description: "Optional text below the column items",
  })
})

const bulletListSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Key Points Overview").meta({
    description: "Main title of the slide",
  }),
  columns: z.array(columnSchema).min(1).max(2).default([
    {
      title: "Primary Benefits",
      items: [
        "Enhanced productivity through automation",
        "Seamless integration with existing tools",
        "Real-time collaboration features",
        "Advanced security and compliance"
      ],
      belowText: "These features drive measurable ROI"
    },
    {
      title: "Technical Features",
      items: [
        "Cloud-native architecture",
        "API-first design approach",
        "Built-in analytics dashboard",
        "Customizable workflows"
      ],
      belowText: "Scalable infrastructure for growth"
    }
  ]).meta({
    description: "Columns with bullet lists (max 2 columns)",
  }),
  belowText: z.string().max(200).optional().default("All features are available in the enterprise plan with dedicated support").meta({
    description: "Optional text below all columns",
  })
})

export const Schema = bulletListSlideSchema

export type BulletListSlideData = z.infer<typeof bulletListSlideSchema>

const BulletListSlideLayout: React.FC<{ data: BulletListSlideData }> = ({ data }) => {
  const title = data.title;
  const columns = data.columns;
  const belowText = data.belowText;

  return (
    <>
      {/* Import Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600;700;800&family=Geist:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <ActionableWrapper className="p-[50px] flex flex-col justify-between">
        <ActionableLogo />
        <div className="flex flex-col justify-center">
          <div className='flex flex-col gap-8'>
            <ActionableTitle>
              {title}
            </ActionableTitle>
            <div className='flex gap-5'>
              {columns.map((column, index) => (
                <div key={index} className='flex flex-col gap-5 basis-1/2'>
                  <ActionableSubTitle variant='geist'>
                    {column.title}
                  </ActionableSubTitle>
                  <div className='flex flex-col gap-2'>
                    {column.items.map((item, itemIndex) => (
                      <div key={itemIndex} className='flex gap-4'>
                        <span>•</span><ActionableParagraph>{item}</ActionableParagraph>
                      </div>
                    ))}
                  </div>
                  {column.belowText && (
                    <ActionableParagraph>
                      {column.belowText}
                    </ActionableParagraph>
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
        <div>
          <ActionableCredits />
        </div>
      </ActionableWrapper>
    </>
  )
}

export default BulletListSlideLayout

import ActionableLogo from '@/components/ActionableLogo';
import { cn } from '@/lib/utils';
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableSubTitle from '@/components/ActionableSubTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableCredits from '@/components/ActionableCredits';

export const layoutId = 'data-table-slide'
export const layoutName = 'Data Table Slide'
export const layoutDescription = 'A slide layout with a data table and optional notes below.'

const columnHeaderSchema = z.object({
  key: z.string().min(1).max(30).default("column").meta({
    description: "Unique key for this column",
  }),
  label: z.string().min(1).max(50).default("Column").meta({
    description: "Display label for the column header",
  }),
})

const dataTableSlideSchema = z.object({
  title: z.string().min(3).max(50).default("Performance Metrics Summary").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(5).max(100).default("Quarterly breakdown of key performance indicators across regions").meta({
    description: "Subtitle text",
  }),
  columnHeaders: z.array(columnHeaderSchema).min(1).max(4).default([
    { key: 'region', label: 'Region' },
    { key: 'sales', label: 'Sales ($)' },
    { key: 'growth', label: 'Growth (%)' },
    { key: 'customers', label: 'Customers' }
  ]).meta({
    description: "Table column headers with keys and labels",
  }),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(5).default([
    { region: 'North America', sales: '$2.4M', growth: '+23%', customers: '1,240' },
    { region: 'Europe', sales: '$1.8M', growth: '+18%', customers: '890' },
    { region: 'Asia Pacific', sales: '$1.2M', growth: '+31%', customers: '650' },
    { region: 'Latin America', sales: '$680K', growth: '+15%', customers: '320' },
    { region: 'Middle East', sales: '$520K', growth: '+28%', customers: '210' }
  ]).meta({
    description: "Table data rows (keys must match columnHeaders keys)",
  }),
  belowText: z.string().max(300).optional().default("All figures represent Q3 results with year-over-year comparisons. Asia Pacific shows strongest growth potential").meta({
    description: "Optional text below the table",
  }),
})

export const Schema = dataTableSlideSchema

export type DataTableSlideData = z.infer<typeof dataTableSlideSchema>

const DataTableSlideLayout: React.FC<{ data: DataTableSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const columnHeaders = data.columnHeaders;
  const rows = data.rows;
  const belowText = data.belowText;

  return (
    <ActionableWrapper className="flex p-[50px]">
        <div className='w-full flex flex-col justify-between'>
          <ActionableLogo />
          <div className='w-full flex flex-col py-3 gap-6'>
            <div>
              <ActionableTitle>
                {title}
              </ActionableTitle>
              <ActionableSubTitle>
                {subtitle}
              </ActionableSubTitle>
            </div>
            <div className="w-full border-[#E4E4E7] border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div>
                <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${columnHeaders.length}, 1fr)` }}>
                  {columnHeaders.map((header, index) => (
                    <div 
                      key={index} 
                      className="px-2 h-10 flex items-center text-sm font-semibold"
                      style={{ fontFamily: "Geist, sans-serif" }}
                    >
                      {header.label}
                    </div>
                  ))}
                </div>
              </div>
              {/* Table Body */}
              <div>
                {rows.map((row, rowIndex) => (
                  <div 
                    key={rowIndex} 
                    className={cn('grid gap-px border-t border-[#E4E4E7]', { 'bg-[#F5F5F5]': rowIndex % 2 === 1 })}
                    style={{ gridTemplateColumns: `repeat(${columnHeaders.length}, 1fr)` }}
                  >
                    {columnHeaders.map((header, colIndex) => (
                      <div 
                        key={colIndex} 
                        className="px-2 h-[52px] flex items-center text-sm"
                        style={{ fontFamily: "Geist, sans-serif" }}
                      >
                        {row[header.key] || ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {belowText && (
              <ActionableParagraph>
                {belowText}
              </ActionableParagraph>
            )}
          </div>
          <ActionableCredits />
        </div>
    </ActionableWrapper>
  );
};

export default DataTableSlideLayout

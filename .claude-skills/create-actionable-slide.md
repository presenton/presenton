# Create Actionable Slide Template

Create a new presentation slide template for Presenton/Actionable Intelligence following established design patterns and best practices.

## Context

Actionable is a customer satisfaction analytics platform that:
- Analyzes NPS (Net Promoter Score) and customer satisfaction data
- Uses journey data (support, transactional, behavioral, demographic)
- Generates insights on satisfaction drivers
- Provides prediction capabilities (predicting scores for non-respondents)

Slides are used to present data analysis results in presentations (PDF/PPTX exports).

## Critical Requirements

### 1. Visual Style (MANDATORY)
- **NO border-radius**: All borders must be sharp (no rounded corners)
- **Brand colors**:
  - Primary: `#2A9D90` (teal)
  - Secondary: `#E76E50` (coral), `#F4A261` (orange), `#264653` (dark blue), `#E9C46A` (yellow)
  - Status: `emerald` (positive), `red` (negative), `amber` (warning)
- **Font**: `Geist, sans-serif` for all text
- **Slide dimensions**: 1920x1080 pixels (16:9 ratio)

### 2. Height Constraints (CRITICAL)
Content MUST fit within fixed slide height. To achieve this:
- Use compact spacing: `gap-2`, `gap-3`, `gap-4` (avoid larger)
- Use compact padding: `p-3`, `p-4`, `px-4 py-3` (avoid larger)
- Use appropriate font sizes: `text-[11px]` to `text-[18px]` for body text
- Reduce line heights: `leading-[130%]`, `leading-none`
- Test with maximum realistic content amounts
- **If content overflows, reduce all spacing/sizing proportionally**

### 3. Component Structure
Must use these Actionable components:
```tsx
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableLogo from '@/components/ActionableLogo';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableSubTitle from '@/components/ActionableSubTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableCredits from '@/components/ActionableCredits';
import { ActionableMainContent } from '@/components/ActionableMainContent';
```

### 4. File Structure
```tsx
import React from 'react'
import * as z from "zod";
// ... other imports

export const layoutId = 'unique-slide-id'
export const layoutName = 'Display Name'
export const layoutDescription = 'Description of what this slide is for'

const schema = z.object({
  // Define schema with .meta() descriptions
})

export const Schema = schema
export type DataType = z.infer<typeof schema>

const Layout: React.FC<{ data: DataType }> = ({ data }) => {
  return (
    <ActionableWrapper className="flex flex-col p-[50px]">
      <div className='flex flex-col h-full justify-between'>
        <ActionableLogo />

        <ActionableMainContent className='pb-3 gap-5'>
          {/* Main content here */}
        </ActionableMainContent>

        <ActionableCredits />
      </div>
    </ActionableWrapper>
  );
};

export default Layout;
```

### 5. Zod Schema Guidelines
- Add `.meta({ description: "..." })` to ALL fields for LLM guidance
- Set realistic `.min()` and `.max()` constraints
- Provide `.default()` values with Actionable-relevant mock data
- Use proper types: `z.string()`, `z.number()`, `z.boolean()`, `z.enum()`, `z.array()`
- For arrays, use `.min()` and `.max()` to prevent overflow

Example:
```tsx
const schema = z.object({
  title: z.string().min(3).max(80).default("Analyse NPS Q4 2025").meta({
    description: "Main title of the slide",
  }),
  items: z.array(z.string().min(3).max(140)).min(2).max(5).default([
    "Item 1", "Item 2"
  ]).meta({
    description: "List of items to display",
  })
})
```

### 6. Mock Data Requirements
All default/mock data MUST reflect Actionable's use case:
- NPS scores and analysis (e.g., "NPS Score 62", "Promoteurs vs Détracteurs")
- Customer satisfaction drivers (e.g., "Temps de réponse support", "Qualité du produit")
- Journey/behavior analysis (e.g., "Adoption multi-canal", "Fréquence de connexion")
- Support metrics (e.g., "Temps de réponse <24h", "Tickets support/mois")
- Retention/churn data (e.g., "Taux de rétention 87%", "Churn prédictif")
- Segment analysis (e.g., "Entreprises", "PME", "TPE", "Particuliers")

**Avoid generic business data** (revenue, sales, etc.) - focus on satisfaction analytics.

### 7. Charts (if applicable)
If using Recharts:
- Always set `isAnimationActive={false}` (for PDF/PPTX export)
- For line charts: use `dot={false}` (no bullets on lines)
- Support dual Y-axes if needed: `yAxisId="left"` and `yAxisId="right"`
- Display values on data points with `<LabelList>` and `offset={12}` for spacing
- Use consistent colors from brand palette

### 8. Layout Patterns
Common patterns to follow:
- **Two-column layout**: Use `grid grid-cols-2` or `flex gap-5 basis-1/2`
- **Cards/boxes**: Use `border-2`, `px-4 py-3`, appropriate bg colors
- **Lists**: Use `flex flex-col gap-2` with bullet points
- **Metrics**: Large bold numbers with small labels above/below

## Process

1. **Understand the requirement**: What type of data visualization/presentation is needed?

2. **Check existing templates**: Review similar templates in `servers/nextjs/presentation-templates/actionable/` to maintain consistency. Read the README.md for detailed guidelines.

3. **Design the schema**: Create Zod schema with all fields, validation, metadata, and Actionable-relevant defaults

4. **Build the layout**:
   - Start with ActionableWrapper structure
   - Use ActionableMainContent for main content area
   - Keep spacing compact from the start
   - Test with maximum content amounts

5. **Verify height constraints**:
   - Render with full mock data
   - If overflow occurs, reduce all spacing/sizing
   - Never compromise on content - adjust design instead

6. **Check visual compliance**:
   - [ ] No border-radius anywhere
   - [ ] Uses only brand colors
   - [ ] Uses Geist font consistently
   - [ ] Compact spacing throughout
   - [ ] Content fits in slide height

7. **Review schema**:
   - [ ] All fields have `.meta()` descriptions
   - [ ] Realistic min/max constraints
   - [ ] Actionable-relevant default values
   - [ ] Array limits prevent overflow

8. **Save and export**:
   - Save in `servers/nextjs/presentation-templates/actionable/`
   - Use PascalCase filename ending with `SlideLayout.tsx`
   - Export layoutId, layoutName, layoutDescription, Schema, type, and default component

## Reference Templates

Before creating a new template, check these examples:
- `KeyInsightsSlideLayout.tsx` - Insights with visual indicators
- `ChartSlideLayout.tsx` - Dual-axis charts with values
- `FunnelSlideLayout.tsx` - Multi-stage funnel with drop-offs
- `SegmentAnalysisSlideLayout.tsx` - Segment comparison
- `RankingSlideLayout.tsx` - Top/bottom performers
- `ComparisonSlideLayout.tsx` - Before/after comparisons
- `DistributionSlideLayout.tsx` - Categorical breakdown

## Common Mistakes to Avoid

❌ **DON'T**:
- Use rounded corners (`rounded-lg`, `rounded-full`, etc.)
- Use large spacing (`gap-8`, `p-8`, etc.)
- Use large font sizes (`text-xl`, `text-2xl`, etc.)
- Create schemas without `.meta()` descriptions
- Use generic business mock data
- Add animations to charts
- Add bullets/dots to line charts
- Guess at requirements - ask for clarification

✅ **DO**:
- Keep all borders sharp (no border-radius)
- Use compact spacing from the start
- Test with maximum realistic content
- Provide detailed schema metadata
- Use Actionable-relevant mock data (NPS, satisfaction, etc.)
- Disable animations for PDF/PPTX compatibility
- Follow existing template patterns closely
- Read the full README.md in the templates folder

## Questions to Ask

Before starting, clarify:
1. What type of data will this slide display?
2. How many items/metrics/sections should it support (min/max)?
3. Are there any specific visual requirements (charts, tables, cards)?
4. What is the primary use case for this slide in satisfaction analysis?

## Documentation

For complete details, examples, and code patterns, see:
**`servers/nextjs/presentation-templates/actionable/README.md`**

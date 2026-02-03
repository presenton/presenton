# Actionable Slide Templates - Guide de Développement

Guide complet pour créer de nouveaux templates de slides pour Presenton/Actionable Intelligence.

## 📋 Table des matières

- [Contexte](#contexte)
- [Requis Critiques](#requis-critiques)
- [Structure de Fichier](#structure-de-fichier)
- [Zod Schema](#zod-schema)
- [Mock Data](#mock-data)
- [Charts](#charts)
- [Patterns de Layout](#patterns-de-layout)
- [Process de Création](#process-de-création)
- [Checklist](#checklist)
- [Erreurs Courantes](#erreurs-courantes)

## Contexte

Actionable est une plateforme d'analyse de satisfaction client qui:
- Analyse le NPS (Net Promoter Score) et la satisfaction client
- Utilise les données de parcours (support, transactionnel, comportemental, démographique)
- Génère des insights sur les drivers de satisfaction
- Fournit des capacités de prédiction (scores des non-répondants)

Les slides sont utilisées pour présenter les résultats d'analyse dans des présentations (exports PDF/PPTX).

## Requis Critiques

### 1. Style Visuel (OBLIGATOIRE)

#### ❌ PAS DE BORDER-RADIUS
**Tous les bords doivent être nets (pas d'arrondis)**
```tsx
// ❌ INTERDIT
className="rounded-lg"
className="rounded-full"

// ✅ CORRECT
className="border-2"  // Pas de rounded
```

#### 🎨 Couleurs de Marque
```tsx
// Couleur principale
#2A9D90 (teal)

// Couleurs secondaires
#E76E50 (corail)
#F4A261 (orange)
#264653 (bleu foncé)
#E9C46A (jaune)

// Couleurs de statut
emerald (positif)
red (négatif)
amber (warning)
```

#### 📐 Dimensions
- **Slide**: 1920x1080 pixels (16:9)
- **Font**: `Geist, sans-serif` partout
- **Style inline**: `style={{ fontFamily: "Geist, sans-serif" }}`

### 2. Contraintes de Hauteur (CRITIQUE)

**Le contenu DOIT tenir dans la hauteur fixe de la slide.**

Pour y parvenir:
```tsx
// ✅ Utiliser des spacings compacts
gap-2, gap-3, gap-4  // Éviter gap-5, gap-6, gap-8

// ✅ Utiliser des paddings compacts
p-3, p-4, px-4 py-3  // Éviter p-6, p-8

// ✅ Tailles de police appropriées
text-[11px] à text-[18px]  // Corps de texte
text-[20px] à text-[28px]  // Titres

// ✅ Réduire line-height
leading-[130%], leading-none

// ❌ Éviter les grandes tailles
text-xl, text-2xl, gap-8, p-8
```

**Si le contenu déborde, réduire TOUS les spacings/sizing proportionnellement.**

### 3. Composants Actionable

Toujours utiliser ces composants:
```tsx
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableLogo from '@/components/ActionableLogo';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableSubTitle from '@/components/ActionableSubTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableCredits from '@/components/ActionableCredits';
import { ActionableMainContent } from '@/components/ActionableMainContent';
```

## Structure de Fichier

```tsx
import React from 'react'
import * as z from "zod";
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableLogo from '@/components/ActionableLogo';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableCredits from '@/components/ActionableCredits';
import { ActionableMainContent } from '@/components/ActionableMainContent';

// 1. Exports obligatoires pour l'enregistrement
export const layoutId = 'unique-slide-id'
export const layoutName = 'Nom Affiché'
export const layoutDescription = 'Description du cas d\'usage de cette slide'

// 2. Définir le schéma Zod avec .meta() sur TOUS les champs
const mySlideSchema = z.object({
  title: z.string().min(3).max(80).default("Titre par défaut").meta({
    description: "Titre principal de la slide",
  }),
  // ... autres champs
})

// 3. Exports du schéma et du type
export const Schema = mySlideSchema
export type MySlideData = z.infer<typeof mySlideSchema>

// 4. Composant React
const MySlideLayout: React.FC<{ data: MySlideData }> = ({ data }) => {
  return (
    <ActionableWrapper className="flex flex-col p-[50px]">
      <div className='flex flex-col h-full justify-between'>
        <ActionableLogo />

        <ActionableMainContent className='pb-3 gap-5'>
          {/* Contenu principal ici */}
          <ActionableTitle>
            {data.title}
          </ActionableTitle>

          {/* ... */}
        </ActionableMainContent>

        <ActionableCredits />
      </div>
    </ActionableWrapper>
  );
};

// 5. Export par défaut
export default MySlideLayout;
```

## Zod Schema

### Guidelines

1. **Toujours ajouter `.meta()` avec description**
```tsx
z.string().min(3).max(80).default("Valeur").meta({
  description: "Description claire pour le LLM",
})
```

2. **Définir des contraintes réalistes**
```tsx
// ✅ BIEN
z.string().min(3).max(80)  // Titre
z.string().min(5).max(200)  // Sous-titre
z.array(z.string()).min(2).max(5)  // Liste d'items

// ❌ ÉVITER
z.string()  // Pas de limites
z.array(z.string()).max(20)  // Trop d'items = débordement
```

3. **Utiliser les bons types**
```tsx
z.string()
z.number().min(0).max(100)
z.boolean().default(false)
z.enum(['option1', 'option2'])
z.array(schema).min(2).max(4)
z.object({ ... })
```

### Exemple Complet

```tsx
const itemSchema = z.object({
  label: z.string().min(2).max(50).default("Label").meta({
    description: "Libellé de l'item",
  }),
  value: z.number().min(0).default(100).meta({
    description: "Valeur numérique",
  })
})

const schema = z.object({
  title: z.string().min(3).max(80).default("Analyse NPS Q4 2025").meta({
    description: "Titre principal de la slide",
  }),
  subtitle: z.string().min(10).max(200).default("Vue d'ensemble des indicateurs").meta({
    description: "Sous-titre explicatif",
  }),
  items: z.array(itemSchema).min(2).max(4).default([
    { label: "NPS Score", value: 62 },
    { label: "Taux de réponse", value: 23 }
  ]).meta({
    description: "Liste des indicateurs à afficher (2-4 items)",
  }),
  showLegend: z.boolean().default(true).meta({
    description: "Afficher ou non la légende",
  })
})
```

## Mock Data

**TOUTES les valeurs par défaut doivent refléter le cas d'usage d'Actionable.**

### ✅ Thèmes Appropriés

**NPS et Satisfaction:**
- "NPS Score 62"
- "Promoteurs vs Détracteurs"
- "Évolution du NPS sur 12 mois"
- "Taux de réponse 23%"

**Drivers de Satisfaction:**
- "Temps de réponse support"
- "Qualité du produit"
- "Facilité d'utilisation"
- "Rapport qualité-prix"

**Parcours et Comportement:**
- "Adoption multi-canal"
- "Fréquence de connexion"
- "Nombre de fonctionnalités utilisées"
- "Parcours client complet"

**Support:**
- "Temps de réponse <24h"
- "Tickets support/mois"
- "Taux de résolution"
- "Satisfaction support"

**Rétention:**
- "Taux de rétention 87%"
- "Churn prédictif"
- "Ancienneté client"
- "Risque de churn"

**Segments:**
- "Entreprises (>50 employés)"
- "PME (10-50 employés)"
- "TPE (<10 employés)"
- "Particuliers"

### ❌ À Éviter

- Données génériques business (revenue, sales, profit)
- Cas d'usage non liés à la satisfaction
- Données abstraites sans contexte

## Charts

Si vous utilisez Recharts:

### Configuration de Base

```tsx
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { ChartContainer, ChartLegend } from '@/components/ui/chart';

// ✅ Toujours désactiver les animations (pour PDF/PPTX)
<LineChart data={data}>
  <Line
    isAnimationActive={false}
    // ...
  />
</LineChart>
```

### Line Charts

```tsx
<LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 5 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

  {/* Axes Y gauche et droite pour métriques différentes */}
  <YAxis
    yAxisId="left"
    orientation='left'
    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif" }}
    tickLine={false}
  />
  <YAxis
    yAxisId="right"
    orientation='right'
    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif" }}
    tickLine={false}
  />

  <XAxis
    dataKey="month"
    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif" }}
    tickLine={false}
  />

  {/* Ligne avec valeurs affichées */}
  <Line
    type="monotone"
    dataKey="nps"
    stroke="#2A9D90"
    strokeWidth={3}
    yAxisId="left"
    dot={false}  // ❌ Pas de bullets (moche)
    isAnimationActive={false}
  >
    <LabelList
      dataKey="nps"
      position="top"
      offset={12}  // Espace entre ligne et valeur
      style={{ fontSize: '10px', fontFamily: "Geist, sans-serif", fill: '#2A9D90', fontWeight: 600 }}
    />
  </Line>

  <ChartLegend />
</LineChart>
```

### Bar Charts

```tsx
<BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
  <YAxis
    orientation='right'
    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif" }}
    tickLine={false}
  />
  <XAxis
    dataKey="category"
    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif" }}
    tickLine={false}
  />
  <Bar
    dataKey="value"
    fill="#2A9D90"
    isAnimationActive={false}
  />
  <ChartLegend />
</BarChart>
```

## Patterns de Layout

### Two-Column Layout

```tsx
<div className='flex gap-5'>
  <div className='basis-1/2 flex flex-col gap-3'>
    {/* Colonne gauche */}
  </div>
  <div className='basis-1/2 flex flex-col gap-3'>
    {/* Colonne droite */}
  </div>
</div>
```

### Grid Layout

```tsx
{/* 3 colonnes */}
<div className='grid grid-cols-3 gap-4'>
  {items.map((item, index) => (
    <div key={index}>...</div>
  ))}
</div>

{/* 4 colonnes */}
<div className='grid grid-cols-4 gap-4'>
  {items.map((item, index) => (
    <div key={index}>...</div>
  ))}
</div>
```

### Cards/Boxes

```tsx
{/* Box standard */}
<div className='border-2 border-gray-200 bg-white px-4 py-3 flex flex-col gap-2'>
  <span className='text-[11px] text-gray-600'>Label</span>
  <span className='text-[18px] font-bold'>Value</span>
</div>

{/* Box mise en avant */}
<div className='border-2 border-[#2A9D90] bg-emerald-50 px-4 py-3'>
  {/* ... */}
</div>

{/* Box negative */}
<div className='border-2 border-red-300 bg-red-50 px-4 py-3'>
  {/* ... */}
</div>
```

### Lists avec Bullets

```tsx
<div className='flex flex-col gap-2'>
  {items.map((item, index) => (
    <div key={index} className='flex gap-4'>
      <span>•</span>
      <ActionableParagraph>{item}</ActionableParagraph>
    </div>
  ))}
</div>
```

### Métriques

```tsx
<div className='flex flex-col gap-0.5'>
  <span className='text-[11px] text-gray-600' style={{ fontFamily: "Geist, sans-serif" }}>
    NPS Score
  </span>
  <div className='flex items-center gap-1.5'>
    <span className='text-[20px] font-bold leading-none' style={{ fontFamily: "Geist, sans-serif" }}>
      62
    </span>
    <span className='text-[14px] text-emerald-600'>↑</span>
  </div>
</div>
```

## Process de Création

### 1. Comprendre le Besoin
- Quel type de visualisation de données est nécessaire ?
- Combien d'items/métriques/sections (min/max) ?
- Requis visuels spécifiques (charts, tables, cards) ?
- Cas d'usage principal dans l'analyse de satisfaction ?

### 2. Vérifier les Templates Existants
Consulter les templates similaires:
- `KeyInsightsSlideLayout.tsx` - Afficher plusieurs insights avec indicateurs visuels
- `ChartSlideLayout.tsx` - Charts dual-axis avec valeurs sur points
- `FunnelSlideLayout.tsx` - Funnel multi-étapes avec drop-offs
- `SegmentAnalysisSlideLayout.tsx` - Comparaison de segments côte à côte
- `RankingSlideLayout.tsx` - Top/bottom performers avec classement
- `ComparisonSlideLayout.tsx` - Comparaison avant/après
- `DistributionSlideLayout.tsx` - Répartition catégorielle avec barres

### 3. Créer le Schéma Zod
- Définir tous les champs avec validation
- Ajouter `.meta()` avec descriptions claires
- Définir des `.default()` avec données Actionable
- Limiter les arrays avec `.min()` et `.max()`

### 4. Construire le Layout
- Commencer avec la structure ActionableWrapper
- Utiliser ActionableMainContent pour le contenu principal
- Garder spacing compact dès le départ
- Tester avec quantité maximale de contenu

### 5. Vérifier les Contraintes de Hauteur
- Render avec données mock complètes
- Si débordement: réduire TOUS les spacing/sizing
- Ne jamais sacrifier le contenu - ajuster le design

### 6. Test Visuel
- Visualiser dans le navigateur
- Vérifier avec contenu min et max
- Tester différentes combinaisons de données

### 7. Sauvegarder
- Nom de fichier: `MySlideLayout.tsx` (PascalCase)
- Emplacement: `servers/nextjs/presentation-templates/actionable/`

## Checklist

Avant de considérer le template terminé:

### Visual
- [ ] Aucun border-radius nulle part
- [ ] Utilise uniquement les couleurs de marque
- [ ] Font Geist utilisée partout
- [ ] Spacing compact partout
- [ ] Contenu tient dans la hauteur de slide

### Schema
- [ ] Tous les champs ont `.meta()` avec description
- [ ] Contraintes min/max réalistes
- [ ] Valeurs par défaut Actionable-relevant
- [ ] Limites d'arrays empêchent débordement

### Code
- [ ] Exports: layoutId, layoutName, layoutDescription, Schema, Type, Component
- [ ] Composants Actionable utilisés
- [ ] Charts sans animations si applicable
- [ ] TypeScript types corrects
- [ ] Pas de console.log ou code de debug

### Test
- [ ] Testé avec contenu minimal
- [ ] Testé avec contenu maximal
- [ ] Pas de débordement de hauteur
- [ ] Lisible et clair visuellement

## Erreurs Courantes

### ❌ À NE PAS FAIRE

```tsx
// Border-radius
className="rounded-lg"

// Spacing trop large
className="gap-8 p-8"

// Fonts trop grandes
className="text-2xl"

// Animations sur charts
<Line isAnimationActive={true} />

// Bullets sur line charts
<Line dot={true} />

// Schema sans metadata
z.string().default("Title")

// Mock data générique
default: "Regional Sales Performance"

// Arrays sans limite
z.array(z.string())

// Deviner au lieu de demander
// Si pas sûr, demander clarification !
```

### ✅ À FAIRE

```tsx
// Pas de border-radius
className="border-2"

// Spacing compact
className="gap-3 p-4"

// Fonts appropriées
className="text-[14px]"

// Pas d'animations
<Line isAnimationActive={false} />

// Pas de bullets
<Line dot={false} />

// Schema avec metadata
z.string().default("Title").meta({
  description: "Main title"
})

// Mock data Actionable
default: "Analyse NPS Q4 2025"

// Arrays avec limites
z.array(z.string()).min(2).max(5)

// Demander si incertain
// Clarifier les requis avant de coder
```

## Templates de Référence

Avant de créer un nouveau template, consulter ces exemples:

| Template | Cas d'usage | Points clés |
|----------|-------------|-------------|
| `KeyInsightsSlideLayout.tsx` | Afficher 2-4 insights clés | Visual indicators, compact cards, colored borders |
| `ChartSlideLayout.tsx` | Line/bar charts avec données temporelles | Dual-axis, value labels, no dots |
| `FunnelSlideLayout.tsx` | Conversion funnels | Gradient colors, drop-off rates, side metrics |
| `SegmentAnalysisSlideLayout.tsx` | Comparaison de segments | Grid 3-4 cols, trend indicators, top performer badge |
| `RankingSlideLayout.tsx` | Top/bottom performers | Medals, colored ranks, compact rows |
| `ComparisonSlideLayout.tsx` | Avant/après | Two columns, highlight better option |
| `DistributionSlideLayout.tsx` | Répartition catégorielle | Horizontal bars, auto-sort, percentages |
| `BulletListSlideLayout.tsx` | Listes structurées | Two columns, bullets, below text |
| `DataTableSlideLayout.tsx` | Données tabulaires | Compact table, colored cells |
| `NumbersSlideLayout.tsx` | KPIs principaux | Large numbers, 2-4 metrics, icons |

## Aide

Pour toute question:
1. Consulter les templates existants
2. Vérifier ce README
3. Demander à l'équipe
4. Si vous utilisez Claude Code: `/create-actionable-slide` skill disponible

---

**Dernière mise à jour:** 2025-02-03
**Version:** 1.0

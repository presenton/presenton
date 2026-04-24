import { TemplateWithData, TemplateGroupSettings, createTemplateEntry, TemplateLayoutsWithSettings } from "./utils";


// TODO: Step 1: Import All templates Layouts Here (like the ones below)

// Code templates
import CodeSlide01RoadmapCover, { Schema as CodeRoadmapCoverSchema, slideLayoutId as CodeRoadmapCoverId, slideLayoutName as CodeRoadmapCoverName, slideLayoutDescription as CodeRoadmapCoverDesc } from "./Code/CoverSlide";
import CodeSlide02CodeExplanationSplit, { Schema as CodeExplanationSplitSchema, slideLayoutId as CodeExplanationSplitId, slideLayoutName as CodeExplanationSplitName, slideLayoutDescription as CodeExplanationSplitDesc } from "./Code/CodeExplanationSplitSlide";
import CodeSlide03ApiRequestResponse, { Schema as CodeApiRequestResponseSchema, slideLayoutId as CodeApiRequestResponseId, slideLayoutName as CodeApiRequestResponseName, slideLayoutDescription as CodeApiRequestResponseDesc } from "./Code/APIRequestResponseSlide";
import CodeSlide04FeatureGrid, { Schema as CodeFeatureGridSchema, slideLayoutId as CodeFeatureGridId, slideLayoutName as CodeFeatureGridName, slideLayoutDescription as CodeFeatureGridDesc } from "./Code/CardsGridSlide";
import CodeSlide05ComparisonTable, { Schema as CodeComparisonTableSchema, slideLayoutId as CodeComparisonTableId, slideLayoutName as CodeComparisonTableName, slideLayoutDescription as CodeComparisonTableDesc } from "./Code/TableSlide";
import CodeSlide06Workflow, { Schema as CodeWorkflowSchema, slideLayoutId as CodeWorkflowId, slideLayoutName as CodeWorkflowName, slideLayoutDescription as CodeWorkflowDesc } from "./Code/WorkflowSlide";
import CodeSlide07UseCaseList, { Schema as CodeUseCaseListSchema, slideLayoutId as CodeUseCaseListId, slideLayoutName as CodeUseCaseListName, slideLayoutDescription as CodeUseCaseListDesc } from "./Code/TwoColumnBulletListSlide";
import CodeSlide08CodeExplanationText, { Schema as CodeExplanationTextSchema, slideLayoutId as CodeExplanationTextId, slideLayoutName as CodeExplanationTextName, slideLayoutDescription as CodeExplanationTextDesc } from "./Code/DescriptionTextSlide";
import CodeSlide09TableOfContent, { Schema as CodeTableOfContentSchema, slideLayoutId as CodeTableOfContentId, slideLayoutName as CodeTableOfContentName, slideLayoutDescription as CodeTableOfContentDesc } from "./Code/TableOfContentSlide";
import CodeSlide10MetricsSplit, { Schema as CodeMetricsSplitSchema, slideLayoutId as CodeMetricsSplitId, slideLayoutName as CodeMetricsSplitName, slideLayoutDescription as CodeMetricsSplitDesc } from "./Code/DescriptionAndMetricsSlide";
import CodeSlide11MetricsGrid, { Schema as CodeMetricsGridSchema, slideLayoutId as CodeMetricsGridId, slideLayoutName as CodeMetricsGridName, slideLayoutDescription as CodeMetricsGridDesc } from "./Code/MetricsGridSlide";

// Education templates
import EducationCoverSlide, { Schema as EduCoverSchema, slideLayoutId as EduCoverId, slideLayoutName as EduCoverName, slideLayoutDescription as EduCoverDesc } from "./Education/EducationCoverSlide";
import EducationTableOfContentsSlide, { Schema as EduTocSchema, slideLayoutId as EduTocId, slideLayoutName as EduTocName, slideLayoutDescription as EduTocDesc } from "./Education/EducationTableOfContentsSlide";
import EducationAboutSlide, { Schema as EduAboutSchema, slideLayoutId as EduAboutId, slideLayoutName as EduAboutName, slideLayoutDescription as EduAboutDesc } from "./Education/EducationAboutSlide";
import EducationContentSplitSlide, { Schema as EduContentSplitSchema, slideLayoutId as EduContentSplitId, slideLayoutName as EduContentSplitName, slideLayoutDescription as EduContentSplitDesc } from "./Education/EducationContentSplitSlide";
import EducationImageGallerySlide, { Schema as EduImageGallerySchema, slideLayoutId as EduImageGalleryId, slideLayoutName as EduImageGalleryName, slideLayoutDescription as EduImageGalleryDesc } from "./Education/EducationImageGallerySlide";
import EducationReportDonutSlide, { Schema as EduReportDonutSchema, slideLayoutId as EduReportDonutId, slideLayoutName as EduReportDonutName, slideLayoutDescription as EduReportDonutDesc } from "./Education/EducationReportChartSlide";
import EducationServicesSplitSlide, { Schema as EduServicesSplitSchema, slideLayoutId as EduServicesSplitId, slideLayoutName as EduServicesSplitName, slideLayoutDescription as EduServicesSplitDesc } from "./Education/EducationServicesSplitSlide";
import EducationStatisticsGridSlide, { Schema as EduStatisticsGridSchema, slideLayoutId as EduStatisticsGridId, slideLayoutName as EduStatisticsGridName, slideLayoutDescription as EduStatisticsGridDesc } from "./Education/EducationStatisticsGridSlide";
import EducationTimelineSlide, { Schema as EduTimelineSchema, slideLayoutId as EduTimelineId, slideLayoutName as EduTimelineName, slideLayoutDescription as EduTimelineDesc } from "./Education/EducationTimelineSlide";

// Product Overview templates
import BusinessChallengesCardsSlide, { Schema as PoBizChallengesCardsSchema, slideLayoutId as PoBizChallengesCardsId, slideLayoutName as PoBizChallengesCardsName, slideLayoutDescription as PoBizChallengesCardsDesc } from "./ProductOverview/BusinessChallengesCardsSlide";
import BusinessChallengesGridSlide, { Schema as PoBizChallengesGridSchema, slideLayoutId as PoBizChallengesGridId, slideLayoutName as PoBizChallengesGridName, slideLayoutDescription as PoBizChallengesGridDesc } from "./ProductOverview/BusinessChallengesGridSlide";
import ComparisonChartSlide, { Schema as PoComparisonChartSchema, slideLayoutId as PoComparisonChartId, slideLayoutName as PoComparisonChartName, slideLayoutDescription as PoComparisonChartDesc } from "./ProductOverview/ComparisonChartSlide";
import ComparisonTableWithTextSlide, { Schema as PoComparisonTableSchema, slideLayoutId as PoComparisonTableId, slideLayoutName as PoComparisonTableName, slideLayoutDescription as PoComparisonTableDesc } from "./ProductOverview/ComparisonTableWithTextSlide";
import CoverSlide, { Schema as PoCoverSchema, slideLayoutId as PoCoverId, slideLayoutName as PoCoverName, slideLayoutDescription as PoCoverDesc } from "./ProductOverview/CoverSlide";
import ImageGallerySlide, { Schema as PoImageGallerySchema, slideLayoutId as PoImageGalleryId, slideLayoutName as PoImageGalleryName, slideLayoutDescription as PoImageGalleryDesc } from "./ProductOverview/ImageGallerySlide";
import IntroductionSlide, { Schema as PoIntroductionSchema, slideLayoutId as PoIntroductionId, slideLayoutName as PoIntroductionName, slideLayoutDescription as PoIntroductionDesc } from "./ProductOverview/IntroductionSlide";
import KpiCardsSlide, { Schema as PoKpiCardsSchema, slideLayoutId as PoKpiCardsId, slideLayoutName as PoKpiCardsName, slideLayoutDescription as PoKpiCardsDesc } from "./ProductOverview/KpiCardsSlide";
// import MarketOpportunitySlide, { Schema as PoMarketOpportunitySchema, slideLayoutId as PoMarketOpportunityId, slideLayoutName as PoMarketOpportunityName, slideLayoutDescription as PoMarketOpportunityDesc } from "./ProductOverview/MarketOpportunitySlide";
import MeetTeamSlide, { Schema as PoMeetTeamSchema, slideLayoutId as PoMeetTeamId, slideLayoutName as PoMeetTeamName, slideLayoutDescription as PoMeetTeamDesc } from "./ProductOverview/MeetTeamSlide";
import MissionVisionSlide, { Schema as PoMissionVisionSchema, slideLayoutId as PoMissionVisionId, slideLayoutName as PoMissionVisionName, slideLayoutDescription as PoMissionVisionDesc } from "./ProductOverview/MissionVisionSlide";
import OurServicesSlide, { Schema as PoOurServicesSchema, slideLayoutId as PoOurServicesId, slideLayoutName as PoOurServicesName, slideLayoutDescription as PoOurServicesDesc } from "./ProductOverview/OurServicesSlide";
import PricingPlanSlide, { Schema as PoPricingPlanSchema, slideLayoutId as PoPricingPlanId, slideLayoutName as PoPricingPlanName, slideLayoutDescription as PoPricingPlanDesc } from "./ProductOverview/PricingPlanSlide";
import ProcessSlide, { Schema as PoProcessSchema, slideLayoutId as PoProcessId, slideLayoutName as PoProcessName, slideLayoutDescription as PoProcessDesc } from "./ProductOverview/ProcessSlide";
import ReportSnapshotSlide, { Schema as PoReportSnapshotSchema, slideLayoutId as PoReportSnapshotId, slideLayoutName as PoReportSnapshotName, slideLayoutDescription as PoReportSnapshotDesc } from "./ProductOverview/ReportSnapshotSlide";
import TableOfContentSlide, { Schema as PoTableOfContentSchema, slideLayoutId as PoTableOfContentId, slideLayoutName as PoTableOfContentName, slideLayoutDescription as PoTableOfContentDesc } from "./ProductOverview/TableOfContentSlide";

// Report templates
import ReportIntroSlide, { Schema as RepIntroSchema, slideLayoutId as RepIntroId, slideLayoutName as RepIntroName, slideLayoutDescription as RepIntroDesc } from "./Report/IntroCoverSlide";
import TitleDescriptionImageSlide, { Schema as RepIntroductionImageSchema, slideLayoutId as RepIntroductionImageId, slideLayoutName as RepIntroductionImageName, slideLayoutDescription as RepIntroductionImageDesc } from "./Report/TitleDescriptionImageSlide";
import IntroductionStatsSlide, { Schema as RepIntroductionStatsSchema, slideLayoutId as RepIntroductionStatsId, slideLayoutName as RepIntroductionStatsName, slideLayoutDescription as RepIntroductionStatsDesc } from "./Report/MetricsSlide";
import SolutionSlide, { Schema as RepSolutionSchema, slideLayoutId as RepSolutionId, slideLayoutName as RepSolutionName, slideLayoutDescription as RepSolutionDesc } from "./Report/TitleImageBulletCardsSlide";
import MilestoneSlide, { Schema as RepMilestoneSchema, slideLayoutId as RepMilestoneId, slideLayoutName as RepMilestoneName, slideLayoutDescription as RepMilestoneDesc } from "./Report/MilestoneSlide";
import DataAnalysisListSlide, { Schema as RepDataAnalysisListSchema, slideLayoutId as RepDataAnalysisListId, slideLayoutName as RepDataAnalysisListName, slideLayoutDescription as RepDataAnalysisListDesc } from "./Report/BulletListWithIconTitleDescriptionSlide";
import DataAnalysisBarSlide, { Schema as RepDataAnalysisBarSchema, slideLayoutId as RepDataAnalysisBarId, slideLayoutName as RepDataAnalysisBarName, slideLayoutDescription as RepDataAnalysisBarDesc } from "./Report/BarChartWithBulletListWithTitleDescriptionIconSlide";
import DataAnalysisInsightBarSlide, { Schema as RepDataAnalysisInsightBarSchema, slideLayoutId as RepDataAnalysisInsightBarId, slideLayoutName as RepDataAnalysisInsightBarName, slideLayoutDescription as RepDataAnalysisInsightBarDesc } from "./Report/TitleDescriptionChartSlide";
import DataAnalysisLineStatsSlide, { Schema as RepDataAnalysisLineStatsSchema, slideLayoutId as RepDataAnalysisLineStatsId, slideLayoutName as RepDataAnalysisLineStatsName, slideLayoutDescription as RepDataAnalysisLineStatsDesc } from "./Report/TitleChartWithMetricsCardsSlide";
import DataAnalysisDashboardSlide, { Schema as RepDataAnalysisDashboardSchema, slideLayoutId as RepDataAnalysisDashboardId, slideLayoutName as RepDataAnalysisDashboardName, slideLayoutDescription as RepDataAnalysisDashboardDesc } from "./Report/DataAnalysisDashboardSlide";
import PerformanceSnapshotSlide, { Schema as RepPerformanceSnapshotSchema, slideLayoutId as RepPerformanceSnapshotId, slideLayoutName as RepPerformanceSnapshotName, slideLayoutDescription as RepPerformanceSnapshotDesc } from "./Report/TitleMetricsSlide";
import ReportServicesSlide, { Schema as RepServicesSchema, slideLayoutId as RepServicesId, slideLayoutName as RepServicesName, slideLayoutDescription as RepServicesDesc } from "./Report/TitleWorkflowWithTitleDescriptionSlide";
import ReportTeamSlide, { Schema as RepTeamSchema, slideLayoutId as RepTeamId, slideLayoutName as RepTeamName, slideLayoutDescription as RepTeamDesc } from "./Report/HorizontalHeightSpanningImagesWithTitleSlide";

// General templates
import GeneralIntroSlideLayout, { Schema as GeneralIntroSchema, layoutId as GeneralIntroId, layoutName as GeneralIntroName, layoutDescription as GeneralIntroDesc } from "./general/IntroSlideLayout";
import BasicInfoSlideLayout, { Schema as BasicInfoSchema, layoutId as BasicInfoId, layoutName as BasicInfoName, layoutDescription as BasicInfoDesc } from "./general/BasicInfoSlideLayout";
import BulletIconsOnlySlideLayout, { Schema as BulletIconsOnlySchema, layoutId as BulletIconsOnlyId, layoutName as BulletIconsOnlyName, layoutDescription as BulletIconsOnlyDesc } from "./general/BulletIconsOnlySlideLayout";
import BulletWithIconsSlideLayout, { Schema as BulletWithIconsSchema, layoutId as BulletWithIconsId, layoutName as BulletWithIconsName, layoutDescription as BulletWithIconsDesc } from "./general/BulletWithIconsSlideLayout";
import ChartWithBulletsSlideLayout, { Schema as ChartWithBulletsSchema, layoutId as ChartWithBulletsId, layoutName as ChartWithBulletsName, layoutDescription as ChartWithBulletsDesc } from "./general/ChartWithBulletsSlideLayout";
import MetricsSlideLayout, { Schema as MetricsSchema, layoutId as MetricsId, layoutName as MetricsName, layoutDescription as MetricsDesc } from "./general/MetricsSlideLayout";
import MetricsWithImageSlideLayout, { Schema as MetricsWithImageSchema, layoutId as MetricsWithImageId, layoutName as MetricsWithImageName, layoutDescription as MetricsWithImageDesc } from "./general/MetricsWithImageSlideLayout";
import NumberedBulletsSlideLayout, { Schema as NumberedBulletsSchema, layoutId as NumberedBulletsId, layoutName as NumberedBulletsName, layoutDescription as NumberedBulletsDesc } from "./general/NumberedBulletsSlideLayout";
import QuoteSlideLayout, { Schema as QuoteSchema, layoutId as QuoteId, layoutName as QuoteName, layoutDescription as QuoteDesc } from "./general/QuoteSlideLayout";
import TableInfoSlideLayout, { Schema as TableInfoSchema, layoutId as TableInfoId, layoutName as TableInfoName, layoutDescription as TableInfoDesc } from "./general/TableInfoSlideLayout";
import TableOfContentsSlideLayout, { Schema as TableOfContentsSchema, layoutId as TableOfContentsId, layoutName as TableOfContentsName, layoutDescription as TableOfContentsDesc } from "./general/TableOfContentsSlideLayout";
import TeamSlideLayout, { Schema as TeamSchema, layoutId as TeamId, layoutName as TeamName, layoutDescription as TeamDesc } from "./general/TeamSlideLayout";

// Neo general templates
import HeadlineTextWithBulletsAndStatsLayout, { Schema as HeadlineTextWithBulletsAndStatsSchema, layoutId as HeadlineTextWithBulletsAndStatsId, layoutName as HeadlineTextWithBulletsAndStatsName, layoutDescription as HeadlineTextWithBulletsAndStatsDesc } from "./neo-general/HeadlineTextWithBulletsAndStats";
import HeadlineDescriptionWithImageLayout, { Schema as HeadlineDescriptionWithImageSchema, layoutId as HeadlineDescriptionWithImageId, layoutName as HeadlineDescriptionWithImageName, layoutDescription as HeadlineDescriptionWithImageDesc } from "./neo-general/HeadlineDescriptionWithImage";
import HeadlineDescriptionWithDoubleImageLayout, { Schema as HeadlineDescriptionWithDoubleImageSchema, layoutId as HeadlineDescriptionWithDoubleImageId, layoutName as HeadlineDescriptionWithDoubleImageName, layoutDescription as HeadlineDescriptionWithDoubleImageDesc } from "./neo-general/HeadlineDescriptionWithDoubleImage";
import IndexedThreeColumnListLayout, { Schema as IndexedThreeColumnListSchema, layoutId as IndexedThreeColumnListId, layoutName as IndexedThreeColumnListName, layoutDescription as IndexedThreeColumnListDesc } from "./neo-general/IndexedThreeColumnList";
import LayoutTextBlockWithMetricCardsLayout, { Schema as LayoutTextBlockWithMetricCardsSchema, layoutId as LayoutTextBlockWithMetricCardsId, layoutName as LayoutTextBlockWithMetricCardsName, layoutDescription as LayoutTextBlockWithMetricCardsDesc } from "./neo-general/LayoutTextBlockWithMetricCards";
import LeftAlignQuotesLayout, { Schema as LeftAlignQuotesSchema, layoutId as LeftAlignQuotesId, layoutName as LeftAlignQuotesName, layoutDescription as LeftAlignQuotesDesc } from "./neo-general/LeftAlignQuote";
import TitleDescriptionWithTableLayout, { Schema as TitleDescriptionWithTableSchema, layoutId as TitleDescriptionWithTableId, layoutName as TitleDescriptionWithTableName, layoutDescription as TitleDescriptionWithTableDesc } from "./neo-general/TitleDescriptionWithTable";
import ChallengeAndOutcomeWithOneStatLayout, { Schema as ChallengeAndOutcomeWithOneStatSchema, layoutId as ChallengeAndOutcomeWithOneStatId, layoutName as ChallengeAndOutcomeWithOneStatName, layoutDescription as ChallengeAndOutcomeWithOneStatDesc } from "./neo-general/ChallengeAndOutcomeWithOneStat";
import GridBasedEightMetricsSnapshotsLayout, { Schema as GridBasedEightMetricsSnapshotsSchema, layoutId as GridBasedEightMetricsSnapshotsId, layoutName as GridBasedEightMetricsSnapshotsName, layoutDescription as GridBasedEightMetricsSnapshotsDesc } from "./neo-general/GridBasedEightMetricsSnapshots";
import TitleTopDescriptionFourTeamMembersGridLayout, { Schema as TitleTopDescriptionFourTeamMembersGridSchema, layoutId as TitleTopDescriptionFourTeamMembersGridId, layoutName as TitleTopDescriptionFourTeamMembersGridName, layoutDescription as TitleTopDescriptionFourTeamMembersGridDesc } from "./neo-general/TitleTopDescriptionFourTeamMembersGrid";
import TitleThreeColumnRiskConstraintsLayout, { Schema as TitleThreeColumnRiskConstraintsSchema, layoutId as TitleThreeColumnRiskConstraintsId, layoutName as TitleThreeColumnRiskConstraintsName, layoutDescription as TitleThreeColumnRiskConstraintsDesc } from "./neo-general/TitleThreeColumnRiskConstraints";
import ThankYouContactInfoFooterImageSlideLayout, { Schema as ThankYouContactInfoFooterImageSlideSchema, layoutId as ThankYouContactInfoFooterImageSlideId, layoutName as ThankYouContactInfoFooterImageSlideName, layoutDescription as ThankYouContactInfoFooterImageSlideDesc } from "./neo-general/ThankYouContactInfoFooterImageSlide";
import TimelineLayout, { Schema as TimelineLayoutSchema, layoutId as TimelineLayoutId, layoutName as TimelineLayoutName, layoutDescription as TimelineLayoutDesc } from "./neo-general/Timeline";

import TitleWithFullWidthChartLayout, { Schema as TitleWithFullWidthChartSchema, layoutId as TitleWithFullWidthChartId, layoutName as TitleWithFullWidthChartName, layoutDescription as TitleWithFullWidthChartDesc } from "./neo-general/TitleWithFullWidthChart";
import TitleMetricsWithChartLayout, { Schema as TitleMetricsWithChartSchema, layoutId as TitleMetricsWithChartId, layoutName as TitleMetricsWithChartName, layoutDescription as TitleMetricsWithChartDesc } from "./neo-general/TitleMetricsWithChart";
import TitleWithGridBasedHeadingAndDescriptionLayout, { Schema as TitleWithGridBasedHeadingAndDescriptionSchema, layoutId as TitleWithGridBasedHeadingAndDescriptionId, layoutName as TitleWithGridBasedHeadingAndDescriptionName, layoutDescription as TitleWithGridBasedHeadingAndDescriptionDesc } from './neo-general/TitleWithGridBasedHeadingAndDescription'

import TextSplitWithEmphasisBlockLayout, { Schema as TextSplitWithEmphasisBlockSchema, layoutId as TextSplitWithEmphasisBlockId, layoutName as TextSplitWithEmphasisBlockName, layoutDescription as TextSplitWithEmphasisBlockDesc } from './neo-general/TextSplitWithEmphasisBlock'



import BulletIconsOnlySlideNeoGeneralLayout, { Schema as BulletIconsOnlyNeoGeneralSchema, layoutId as BulletIconsOnlyNeoGeneralId, layoutName as BulletIconsOnlyNeoGeneralName, layoutDescription as BulletIconsOnlyNeoGeneralDesc } from "./neo-general/BulletIconsOnlySlideLayout";
import BulletWithIconsSlideNeoGeneralLayout, { Schema as BulletWithIconsNeoGeneralSchema, layoutId as BulletWithIconsNeoGeneralId, layoutName as BulletWithIconsNeoGeneralName, layoutDescription as BulletWithIconsNeoGeneralDesc } from "./neo-general/BulletWithIconsSlideLayout";
import ChartWithBulletsSlideNeoGeneralLayout, { Schema as ChartWithBulletsNeoGeneralSchema, layoutId as ChartWithBulletsNeoGeneralId, layoutName as ChartWithBulletsNeoGeneralName, layoutDescription as ChartWithBulletsNeoGeneralDesc } from "./neo-general/ChartWithBulletsSlideLayout";

import MetricsWithImageSlideNeoGeneralLayout, { Schema as MetricsWithImageNeoGeneralSchema, layoutId as MetricsWithImageNeoGeneralId, layoutName as MetricsWithImageNeoGeneralName, layoutDescription as MetricsWithImageNeoGeneralDesc } from "./neo-general/MetricsWithImageSlideLayout";
import NumberedBulletsSlideNeoGeneralLayout, { Schema as NumberedBulletsNeoGeneralSchema, layoutId as NumberedBulletsNeoGeneralId, layoutName as NumberedBulletsNeoGeneralName, layoutDescription as NumberedBulletsNeoGeneralDesc } from "./neo-general/NumberedBulletsSlideLayout";
import QuoteSlideNeoGeneralLayout, { Schema as QuoteNeoGeneralSchema, layoutId as QuoteNeoGeneralId, layoutName as QuoteNeoGeneralName, layoutDescription as QuoteNeoGeneralDesc } from "./neo-general/QuoteSlideLayout";

import TeamSlideNeoGeneralLayout, { Schema as TeamNeoGeneralSchema, layoutId as TeamNeoGeneralId, layoutName as TeamNeoGeneralName, layoutDescription as TeamNeoGeneralDesc } from "./neo-general/TeamSlideLayout";
import TableOfContentWithoutPageNumberLayout, { Schema as TableOfContentWithoutPageNumberSchema, layoutId as TableOfContentWithoutPageNumberId, layoutName as TableOfContentWithoutPageNumberName, layoutDescription as TableOfContentWithoutPageNumberDesc } from "./neo-general/TableOfContentWithoutPageNumber";
import TitleMetricValueMetricLabelFunnelStagesLayout, { Schema as TitleMetricValueMetricLabelFunnelStagesSchema, layoutId as TitleMetricValueMetricLabelFunnelStagesId, layoutName as TitleMetricValueMetricLabelFunnelStagesName, layoutDescription as TitleMetricValueMetricLabelFunnelStagesDesc } from "./neo-general/TitleMetricValueMetricLabelFunnelStages";
import MultiChartGridSlideLayout, { Schema as MultiChartGridSlideSchema, layoutId as MultiChartGridSlideId, layoutName as MultiChartGridSlideName, layoutDescription as MultiChartGridSlideDesc } from "./neo-general/MultiChartGridSlideLayout";
import TitleDescriptionMultiChartGridWithMetricsLayout, { Schema as TitleDescriptionMultiChartGridWithMetricsSchema, layoutId as TitleDescriptionMultiChartGridWithMetricsId, layoutName as TitleDescriptionMultiChartGridWithMetricsName, layoutDescription as TitleDescriptionMultiChartGridWithMetricsDesc } from "./neo-general/TitleDescriptionMultiChartGridWithMetrics";
import TitleDescriptionMultiChartGridWithBulletsLayout, { Schema as TitleDescriptionMultiChartGridWithBulletsSchema, layoutId as TitleDescriptionMultiChartGridWithBulletsId, layoutName as TitleDescriptionMultiChartGridWithBulletsName, layoutDescription as TitleDescriptionMultiChartGridWithBulletsDesc } from "./neo-general/TitleDescriptionMultiChartGridWithBullets";




// Modern templates
import ModernIntroSlideLayout, { Schema as ModernIntroSchema, layoutId as ModernIntroId, layoutName as ModernIntroName, layoutDescription as ModernIntroDesc } from "./modern/IntroSlideLayout";
import BulletsWithIconsDescriptionGrid, { Schema as BulletsIconsGridSchema, layoutId as BulletsIconsGridId, layoutName as BulletsIconsGridName, layoutDescription as BulletsIconsGridDesc } from "./modern/BulletsWithIconsDescriptionGrid";
import ModernBulletWithIconsSlideLayout, { Schema as ModernBulletIconsSchema, layoutId as ModernBulletIconsId, layoutName as ModernBulletIconsName, layoutDescription as ModernBulletIconsDesc } from "./modern/BulletWithIconsSlideLayout";
import ChartOrTableWithDescription, { Schema as ChartTableDescSchema, layoutId as ChartTableDescId, layoutName as ChartTableDescName, layoutDescription as ChartTableDescDesc } from "./modern/ChartOrTableWithDescription";
import ChartOrTableWithMetricsDescription, { Schema as ChartMetricsSchema, layoutId as ChartMetricsId, layoutName as ChartMetricsName, layoutDescription as ChartMetricsDesc } from "./modern/ChartOrTableWithMetricsDescription";
import ImageAndDescriptionLayout, { Schema as ImageDescSchema, layoutId as ImageDescId, layoutName as ImageDescName, layoutDescription as ImageDescDesc } from "./modern/ImageAndDescriptionLayout";
import ImageListWithDescriptionSlideLayout, { Schema as ImageListDescSchema, layoutId as ImageListDescId, layoutName as ImageListDescName, layoutDescription as ImageListDescDesc } from "./modern/ImageListWithDescriptionSlideLayout";
import ImagesWithDescriptionLayout, { Schema as ImagesDescSchema, layoutId as ImagesDescId, layoutName as ImagesDescName, layoutDescription as ImagesDescDesc } from "./modern/ImagesWithDescriptionLayout";
import MetricsWithDescription, { Schema as MetricsDescSchema, layoutId as MetricsDescId, layoutName as MetricsDescName, layoutDescription as MetricsDescDesc } from "./modern/MetricsWithDescription";
import ModernTableOfContentsLayout, { Schema as ModernTocSchema, layoutId as ModernTocId, layoutName as ModernTocName, layoutDescription as ModernTocDesc } from "./modern/TableOfContentsLayout";

// Neo modern templates
import TitleDescriptionBulletListModernLayout, { Schema as TitleDescriptionBulletListModernSchema, layoutId as TitleDescriptionBulletListModernId, layoutName as TitleDescriptionBulletListModernName, layoutDescription as TitleDescriptionBulletListModernDesc } from './neo-modern/TitleDescriptionBulletList';
import TitleDescriptionContactListLayout, { Schema as TitleDescriptionContactListSchema, layoutId as TitleDescriptionContactListId, layoutName as TitleDescriptionContactListName, layoutDescription as TitleDescriptionContactListDesc } from './neo-modern/TitleDescriptionContactList';
import TitleDescriptionDualMetricsGridLayout, { Schema as TitleDescriptionDualMetricsGridSchema, layoutId as TitleDescriptionDualMetricsGridId, layoutName as TitleDescriptionDualMetricsGridName, layoutDescription as TitleDescriptionDualMetricsGridDesc } from './neo-modern/TitleDescriptionDualMetricsGrid';
import TitleDescriptionIconTimelineLayout, { Schema as TitleDescriptionIconTimelineSchema, layoutId as TitleDescriptionIconTimelineId, layoutName as TitleDescriptionIconTimelineName, layoutDescription as TitleDescriptionIconTimelineDesc } from './neo-modern/TitleDescriptionIconTimeline';
import TitleDescriptionImageRightModernLayout, { Schema as TitleDescriptionImageRightModernSchema, layoutId as TitleDescriptionImageRightModernId, layoutName as TitleDescriptionImageRightModernName, layoutDescription as TitleDescriptionImageRightModernDesc } from './neo-modern/TitleDescriptionImageRight';
import TitleDescriptionMetricsChartLayout, { Schema as TitleDescriptionMetricsChartSchema, layoutId as TitleDescriptionMetricsChartId, layoutName as TitleDescriptionMetricsChartName, layoutDescription as TitleDescriptionMetricsChartDesc } from './neo-modern/TitleDescriptionMetricsChart';

import TitleDescriptionMetricsImageLayout, { Schema as TitleDescriptionMetricsImageSchema, layoutId as TitleDescriptionMetricsImageId, layoutName as TitleDescriptionMetricsImageName, layoutDescription as TitleDescriptionMetricsImageDesc } from './neo-modern/TitleDescriptionMetricsImage';
import TitleDescriptionMetricsTableLayout, { Schema as TitleDescriptionMetricsTableSchema, layoutId as TitleDescriptionMetricsTableId, layoutName as TitleDescriptionMetricsTableName, layoutDescription as TitleDescriptionMetricsTableDesc } from './neo-modern/TitleDescriptionTable';
import TitleDualComparisonChartsLayout, { Schema as TitleDualComparisonChartsSchema, layoutId as TitleDualComparisonChartsId, layoutName as TitleDualComparisonChartsName, layoutDescription as TitleDualComparisonChartsDesc } from './neo-modern/TitleDualComparisonCharts';
import TitleDualComparisonCardsModernLayout, { Schema as TitleDualComparisonCardsModernSchema, layoutId as TitleDualComparisonCardsModernId, layoutName as TitleDualComparisonCardsModernName, layoutDescription as TitleDualComparisonCardsModernDesc } from './neo-modern/TitleDualComparisonCards';
import TitleHorizontalAltenenatingTimelineLayout, { Schema as TitleHorizontalAltenenatingTimelineSchema, layoutId as TitleHorizontalAltenenatingTimelineId, layoutName as TitleHorizontalAltenenatingTimelineName, layoutDescription as TitleHorizontalAltenenatingTimelineDesc } from './neo-modern/TitleHorizontalAlternatingTimeline';
import TitleKpiSnapshotGridLayout, { Schema as TitleKpiSnapshotGridSchema, layoutId as TitleKpiSnapshotGridId, layoutName as TitleKpiSnapshotGridName, layoutDescription as TitleKpiSnapshotGridDesc } from './neo-modern/TitleKpiSnapshotGrid';
import TitleSubtitlesChartLayout, { Schema as TitleSubtitlesChartSchema, layoutId as TitleSubtitlesChartId, layoutName as TitleSubtitlesChartName, layoutDescription as TitleSubtitlesChartDesc } from './neo-modern/TitleSubtitlesChart';
import TitleTwoColumnNumberListLayout, { Schema as TitleTwoColumnNumberListSchema, layoutId as TitleTwoColumnNumberListId, layoutName as TitleTwoColumnNumberListName, layoutDescription as TitleTwoColumnNumberListDesc } from './neo-modern/TitleTwoColumnNumberedList';
import TitleDescriptionMultiChartGridLayout, { Schema as TitleDescriptionMultiChartGridSchema, layoutId as TitleDescriptionMultiChartGridId, layoutName as TitleDescriptionMultiChartGridName, layoutDescription as TitleDescriptionMultiChartGridDesc } from './neo-modern/TitleDescriptionMultiChartGrid';
import TitleDescriptionMultiChartGridWithMetricsModernLayout, { Schema as TitleDescriptionMultiChartGridWithMetricsModernSchema, layoutId as TitleDescriptionMultiChartGridWithMetricsModernId, layoutName as TitleDescriptionMultiChartGridWithMetricsModernName, layoutDescription as TitleDescriptionMultiChartGridWithMetricsModernDesc } from './neo-modern/TitleDescriptionMultiChartGridWithMetrics';
import TitleDescriptionMultiChartGridWithBulletsModernLayout, { Schema as TitleDescriptionMultiChartGridWithBulletsModernSchema, layoutId as TitleDescriptionMultiChartGridWithBulletsModernId, layoutName as TitleDescriptionMultiChartGridWithBulletsModernName, layoutDescription as TitleDescriptionMultiChartGridWithBulletsModernDesc } from './neo-modern/TitleDescriptionMultiChartGridWithBullets';





// Standard templates
import StandardIntroSlideLayout, { Schema as StandardIntroSchema, layoutId as StandardIntroId, layoutName as StandardIntroName, layoutDescription as StandardIntroDesc } from "./standard/IntroSlideLayout";
import ChartLeftTextRightLayout, { Schema as ChartLeftSchema, layoutId as ChartLeftId, layoutName as ChartLeftName, layoutDescription as ChartLeftDesc } from "./standard/ChartLeftTextRightLayout";
import ContactLayout, { Schema as ContactSchema, layoutId as ContactId, layoutName as ContactName, layoutDescription as ContactDesc } from "./standard/ContactLayout";
import HeadingBulletImageDescriptionLayout, { Schema as HeadingBulletSchema, layoutId as HeadingBulletId, layoutName as HeadingBulletName, layoutDescription as HeadingBulletDesc } from "./standard/HeadingBulletImageDescriptionLayout";
import IconBulletDescriptionLayout, { Schema as IconBulletSchema, layoutId as IconBulletId, layoutName as IconBulletName, layoutDescription as IconBulletDesc } from "./standard/IconBulletDescriptionLayout";
import IconImageDescriptionLayout, { Schema as IconImageSchema, layoutId as IconImageId, layoutName as IconImageName, layoutDescription as IconImageDesc } from "./standard/IconImageDescriptionLayout";
import StandardImageListWithDescriptionLayout, { Schema as StdImageListSchema, layoutId as StdImageListId, layoutName as StdImageListName, layoutDescription as StdImageListDesc } from "./standard/ImageListWithDescriptionLayout";
import MetricsDescriptionLayout, { Schema as MetricsDescLayoutSchema, layoutId as MetricsDescLayoutId, layoutName as MetricsDescLayoutName, layoutDescription as MetricsDescLayoutDesc } from "./standard/MetricsDescriptionLayout";
import NumberedBulletSingleImageLayout, { Schema as NumBulletImgSchema, layoutId as NumBulletImgId, layoutName as NumBulletImgName, layoutDescription as NumBulletImgDesc } from "./standard/NumberedBulletSingleImageLayout";
import StandardTableOfContentsLayout, { Schema as StdTocSchema, layoutId as StdTocId, layoutName as StdTocName, layoutDescription as StdTocDesc } from "./standard/TableOfContentsLayout";
import VisualMetricsSlideLayout, { Schema as VisualMetricsSchema, layoutId as VisualMetricsId, layoutName as VisualMetricsName, layoutDescription as VisualMetricsDesc } from "./standard/VisualMetricsSlideLayout";

// Neo standard templates
import TitleBadgeChartLayout, { Schema as TitleBadgeChartSchema, layoutId as TitleBadgeChartId, layoutName as TitleBadgeChartName, layoutDescription as TitleBadgeChartDesc } from './neo-standard/TitleBadgeChart';
import TitleDescriptionBulletListStandardLayout, { Schema as TitleDescriptionBulletListStandardSchema, layoutId as TitleDescriptionBulletListStandardId, layoutName as TitleDescriptionBulletListStandardName, layoutDescription as TitleDescriptionBulletListStandardDesc } from './neo-standard/TitleDescriptionBulletList';
import TitleDescriptionContactCardsLayout, { Schema as TitleDescriptionContactCardsSchema, layoutId as TitleDescriptionContactCardsId, layoutName as TitleDescriptionContactCardsName, layoutDescription as TitleDescriptionContactCardsDesc } from './neo-standard/TitleDescriptionContactCards';
import TitleDescriptionIconListLayout, { Schema as TitleDescriptionIconListSchema, layoutId as TitleDescriptionIconListId, layoutName as TitleDescriptionIconListName, layoutDescription as TitleDescriptionIconListDesc } from './neo-standard/TitleDescriptionIconList';
import TitleDescriptionImageRightLayout, { Schema as TitleDescriptionImageRightSchema, layoutId as TitleDescriptionImageRightId, layoutName as TitleDescriptionImageRightName, layoutDescription as TitleDescriptionImageRightDesc } from './neo-standard/TitleDescriptionImageRight';
import TitleDescriptionRadialCardsLayout, { Schema as TitleDescriptionRadialCardsSchema, layoutId as TitleDescriptionRadialCardsId, layoutName as TitleDescriptionRadialCardsName, layoutDescription as TitleDescriptionRadialCardsDesc } from './neo-standard/TitleDescriptionRadialCards';
import TitleDescriptionTableLayout, { Schema as TitleDescriptionTableSchema, layoutId as TitleDescriptionTableId, layoutName as TitleDescriptionTableName, layoutDescription as TitleDescriptionTableDesc } from './neo-standard/TitleDescriptionTable';
import TitleDescriptionTimelineLayout, { Schema as TitleDescriptionTimelineSchema, layoutId as TitleDescriptionTimelineId, layoutName as TitleDescriptionTimelineName, layoutDescription as TitleDescriptionTimelineDesc } from './neo-standard/TitleDescriptionTimeline';
import TitleDualChartsComparisonLayout, { Schema as TitleDualChartsComparisonSchema, layoutId as TitleDualChartsComparisonId, layoutName as TitleDualChartsComparisonName, layoutDescription as TitleDualChartsComparisonDesc } from './neo-standard/TitleDualChartsComparison';
import TitleDualComparisonCardsLayout, { Schema as TitleDualComparisonCardsSchema, layoutId as TitleDualComparisonCardsId, layoutName as TitleDualComparisonCardsName, layoutDescription as TitleDualComparisonCardsDesc } from './neo-standard/TitleDualComparisonCards';
import TitleKpiGridLayout, { Schema as TitleKpiGridSchema, layoutId as TitleKpiGridId, layoutName as TitleKpiGridName, layoutDescription as TitleKpiGridDesc } from './neo-standard/TitleKpiGrid';
import TitleMetricsChartLayout, { Schema as TitleMetricsChartSchema, layoutId as TitleMetricsChartId, layoutName as TitleMetricsChartName, layoutDescription as TitleMetricsChartDesc } from './neo-standard/TitleMetricsChart';
import TitleMetricsImageLayout, { Schema as TitleMetricsImageSchema, layoutId as TitleMetricsImageId, layoutName as TitleMetricsImageName, layoutDescription as TitleMetricsImageDesc } from './neo-standard/TitleMetricsImage';
import TitlePointsDonutGridLayout, { Schema as TitlePointsDonutGridSchema, layoutId as TitlePointsDonutGridId, layoutName as TitlePointsDonutGridName, layoutDescription as TitlePointsDonutGridDesc } from './neo-standard/TitlePointsDonutGrid';
import TitleDescriptionMultiChartGridStandardLayout, { Schema as TitleDescriptionMultiChartGridStandardSchema, layoutId as TitleDescriptionMultiChartGridStandardId, layoutName as TitleDescriptionMultiChartGridStandardName, layoutDescription as TitleDescriptionMultiChartGridStandardDesc } from './neo-standard/TitleDescriptionMultiChartGrid';
import TitleDescriptionMultiChartGridWithMetricsStandardLayout, { Schema as TitleDescriptionMultiChartGridWithMetricsStandardSchema, layoutId as TitleDescriptionMultiChartGridWithMetricsStandardId, layoutName as TitleDescriptionMultiChartGridWithMetricsStandardName, layoutDescription as TitleDescriptionMultiChartGridWithMetricsStandardDesc } from './neo-standard/TitleDescriptionMultiChartGridWithMetrics';
import TitleDescriptionMultiChartGridWithBulletsStandardLayout, { Schema as TitleDescriptionMultiChartGridWithBulletsStandardSchema, layoutId as TitleDescriptionMultiChartGridWithBulletsStandardId, layoutName as TitleDescriptionMultiChartGridWithBulletsStandardName, layoutDescription as TitleDescriptionMultiChartGridWithBulletsStandardDesc } from './neo-standard/TitleDescriptionMultiChartGridWithBullets';






// Swift templates
import SwiftIntroSlideLayout, { Schema as SwiftIntroSchema, layoutId as SwiftIntroId, layoutName as SwiftIntroName, layoutDescription as SwiftIntroDesc } from "./swift/IntroSlideLayout";
import BulletsWithIconsTitleDescription, { Schema as BulletsIconsTitleSchema, layoutId as BulletsIconsTitleId, layoutName as BulletsIconsTitleName, layoutDescription as BulletsIconsTitleDesc } from "./swift/BulletsWithIconsTitleDescription";
import IconBulletListDescription, { Schema as IconBulletListSchema, layoutId as IconBulletListId, layoutName as IconBulletListName, layoutDescription as IconBulletListDesc } from "./swift/IconBulletListDescription";
import ImageListDescription, { Schema as ImageListSchema, layoutId as ImageListId, layoutName as ImageListName, layoutDescription as ImageListDesc } from "./swift/ImageListDescription";
import MetricsNumbers, { Schema as MetricsNumbersSchema, layoutId as MetricsNumbersId, layoutName as MetricsNumbersName, layoutDescription as MetricsNumbersDesc } from "./swift/MetricsNumbers";
import SimpleBulletPointsLayout, { Schema as SimpleBulletSchema, layoutId as SimpleBulletId, layoutName as SimpleBulletName, layoutDescription as SimpleBulletDesc } from "./swift/SimpleBulletPointsLayout";
import SwiftTableOfContents, { Schema as SwiftTocSchema, layoutId as SwiftTocId, layoutName as SwiftTocName, layoutDescription as SwiftTocDesc } from "./swift/TableOfContents";
import TableorChart, { Schema as TableChartSchema, layoutId as TableChartId, layoutName as TableChartName, layoutDescription as TableChartDesc } from "./swift/TableorChart";
import Timeline, { Schema as TimelineSchema, layoutId as TimelineId, layoutName as TimelineName, layoutDescription as TimelineDesc } from "./swift/Timeline";

// neo swift templates
import TitleCenteredChartLayout, { Schema as TitleCenteredChartSchema, layoutId as TitleCenteredChartId, layoutName as TitleCenteredChartName, layoutDescription as TitleCenteredChartDesc } from './neo-swift/TitleCenteredChart';
import TitleChartMetricsSidebarLayout, { Schema as TitleChartMetricsSidebarSchema, layoutId as TitleChartMetricsSidebarId, layoutName as TitleChartMetricsSidebarName, layoutDescription as TitleChartMetricsSidebarDesc } from './neo-swift/TitleChartMetricsSidebar';
import TitleDescriptionBulletListLayout, { Schema as TitleDescriptionBulletListSchema, layoutId as TitleDescriptionBulletListId, layoutName as TitleDescriptionBulletListName, layoutDescription as TitleDescriptionBulletListDesc } from './neo-swift/TitleDescriptionBulletList';
import TitleDescriptionDataTableLayout, { Schema as TitleDescriptionDataTableSchema, layoutId as TitleDescriptionDataTableId, layoutName as TitleDescriptionDataTableName, layoutDescription as TitleDescriptionDataTableDesc } from './neo-swift/TitleDescriptionDataTable';
import TitleDescriptionImageRightSwiftLayout, { Schema as TitleDescriptionImageRightSwiftSchema, layoutId as TitleDescriptionImageRightSwiftId, layoutName as TitleDescriptionImageRightSwiftName, layoutDescription as TitleDescriptionImageRightSwiftDesc } from './neo-swift/TitleDescriptionImageRight';

import TitleDescriptionMetricsGridLayout, { Schema as TitleDescriptionMetricsGridSchema, layoutId as TitleDescriptionMetricsGridId, layoutName as TitleDescriptionMetricsGridName, layoutDescription as TitleDescriptionMetricsGridDesc } from './neo-swift/TitleDescriptionMetricsGrid';
import TitleDescriptionMetricsGridImageLayout, { Schema as TitleDescriptionMetricsGridImageSchema, layoutId as TitleDescriptionMetricsGridImageId, layoutName as TitleDescriptionMetricsGridImageName, layoutDescription as TitleDescriptionMetricsGridImageDesc } from './neo-swift/TitleDescriptionMetricsGridImage';
import TitleDualComparisionBlockLayout, { Schema as TitleDualComparisionBlockSchema, layoutId as TitleDualComparisionBlockId, layoutName as TitleDualComparisionBlockName, layoutDescription as TitleDualComparisionBlockDesc } from './neo-swift/TitleDualComparisonBlocks';
import TitleLabelDescriptionStatCardsLayout, { Schema as TitleLabelDescriptionStatCardsSchema, layoutId as TitleLabelDescriptionStatCardsId, layoutName as TitleLabelDescriptionStatCardsName, layoutDescription as TitleLabelDescriptionStatCardsDesc } from './neo-swift/TitleLabelDescriptionStatCards';
import TitleSubtitleTeamMemberCardsLayout, { Schema as TitleSubtitleTeamMemberCardsSchema, layoutId as TitleSubtitleTeamMemberCardsId, layoutName as TitleSubtitleTeamMemberCardsName, layoutDescription as TitleSubtitleTeamMemberCardsDesc } from './neo-swift/TitleSubtitleTeamMemberCards';
import TitleTaglineDescriptionNumberedStepsLayout, { Schema as TitleTaglineDescriptionNumberedStepsSchema, layoutId as TitleTaglineDescriptionNumberedStepsId, layoutName as TitleTaglineDescriptionNumberedStepsName, layoutDescription as TitleTaglineDescriptionNumberedStepsDesc } from './neo-swift/TitleTaglineDescriptionNumberedSteps';
import TitleThreeByThreeMetricsGridLayout, { Schema as TitleThreeByThreeMetricsGridSchema, layoutId as TitleThreeByThreeMetricsGridId, layoutName as TitleThreeByThreeMetricsGridName, layoutDescription as TitleThreeByThreeMetricsGridDesc } from './neo-swift/TitleThreeByThreeMetricsGrid';
import TitleDescriptionSixChartsGridLayout, { Schema as TitleDescriptionSixChartsGridSchema, layoutId as TitleDescriptionSixChartsGridId, layoutName as TitleDescriptionSixChartsGridName, layoutDescription as TitleDescriptionSixChartsGridDesc } from './neo-swift/TitleDescriptionSixChartsGrid';
import TitleDescriptionSixChartsFourMetricsLayout, { Schema as TitleDescriptionSixChartsFourMetricsSchema, layoutId as TitleDescriptionSixChartsFourMetricsId, layoutName as TitleDescriptionSixChartsFourMetricsName, layoutDescription as TitleDescriptionSixChartsFourMetricsDesc } from './neo-swift/TitleDescriptionSixChartsFourMetrics';
import TitleDescriptionFourChartsSixBulletsLayout, { Schema as TitleDescriptionFourChartsSixBulletsSchema, layoutId as TitleDescriptionFourChartsSixBulletsId, layoutName as TitleDescriptionFourChartsSixBulletsName, layoutDescription as TitleDescriptionFourChartsSixBulletsDesc } from './neo-swift/TitleDescriptionFourChartsSixBullets';






// TODO: Step 2: Import template settings Here (like the ones below)
// Template template settings
import generalSettings from "./general/settings.json";
import modernSettings from "./modern/settings.json";
import standardSettings from "./standard/settings.json";
import swiftSettings from "./swift/settings.json";
import neoGeneralSettings from "./neo-general/settings.json";
import neoStandardSettings from "./neo-standard/settings.json";
import neoModernSettings from "./neo-modern/settings.json";
import neoSwiftSettings from "./neo-swift/settings.json";
import codeSettings from "./Code/settings.json";
import educationSettings from "./Education/settings.json";
import productOverviewSettings from "./ProductOverview/settings.json";
import reportSettings from "./Report/settings.json";


// Helper to create template entry


// TODO: Step 3: Create template entries for each template (like the ones below)

export const codeTemplates: TemplateWithData[] = [
    createTemplateEntry(CodeSlide01RoadmapCover, CodeRoadmapCoverSchema, CodeRoadmapCoverId, CodeRoadmapCoverName, CodeRoadmapCoverDesc, "code", "CoverSlide"),
    createTemplateEntry(CodeSlide02CodeExplanationSplit, CodeExplanationSplitSchema, CodeExplanationSplitId, CodeExplanationSplitName, CodeExplanationSplitDesc, "code", "CodeExplanationSplitSlide"),
    createTemplateEntry(CodeSlide03ApiRequestResponse, CodeApiRequestResponseSchema, CodeApiRequestResponseId, CodeApiRequestResponseName, CodeApiRequestResponseDesc, "code", "APIRequestResponseSlide"),
    createTemplateEntry(CodeSlide04FeatureGrid, CodeFeatureGridSchema, CodeFeatureGridId, CodeFeatureGridName, CodeFeatureGridDesc, "code", "CardsGridSlide"),
    createTemplateEntry(CodeSlide05ComparisonTable, CodeComparisonTableSchema, CodeComparisonTableId, CodeComparisonTableName, CodeComparisonTableDesc, "code", "TableSlide"),
    createTemplateEntry(CodeSlide06Workflow, CodeWorkflowSchema, CodeWorkflowId, CodeWorkflowName, CodeWorkflowDesc, "code", "WorkflowSlide"),
    createTemplateEntry(CodeSlide07UseCaseList, CodeUseCaseListSchema, CodeUseCaseListId, CodeUseCaseListName, CodeUseCaseListDesc, "code", "TwoColumnBulletListSlide"),
    createTemplateEntry(CodeSlide08CodeExplanationText, CodeExplanationTextSchema, CodeExplanationTextId, CodeExplanationTextName, CodeExplanationTextDesc, "code", "DescriptionTextSlide"),
    createTemplateEntry(CodeSlide09TableOfContent, CodeTableOfContentSchema, CodeTableOfContentId, CodeTableOfContentName, CodeTableOfContentDesc, "code", "TableOfContentSlide"),
    createTemplateEntry(CodeSlide10MetricsSplit, CodeMetricsSplitSchema, CodeMetricsSplitId, CodeMetricsSplitName, CodeMetricsSplitDesc, "code", "DescriptionAndMetricsSlide"),
    createTemplateEntry(CodeSlide11MetricsGrid, CodeMetricsGridSchema, CodeMetricsGridId, CodeMetricsGridName, CodeMetricsGridDesc, "code", "MetricsGridSlide"),
];

export const educationTemplates: TemplateWithData[] = [
    createTemplateEntry(EducationCoverSlide, EduCoverSchema, EduCoverId, EduCoverName, EduCoverDesc, "education", "EducationCoverSlide"),
    createTemplateEntry(EducationTableOfContentsSlide, EduTocSchema, EduTocId, EduTocName, EduTocDesc, "education", "EducationTableOfContentsSlide"),
    createTemplateEntry(EducationAboutSlide, EduAboutSchema, EduAboutId, EduAboutName, EduAboutDesc, "education", "EducationAboutSlide"),
    createTemplateEntry(EducationContentSplitSlide, EduContentSplitSchema, EduContentSplitId, EduContentSplitName, EduContentSplitDesc, "education", "EducationContentSplitSlide"),
    createTemplateEntry(EducationImageGallerySlide, EduImageGallerySchema, EduImageGalleryId, EduImageGalleryName, EduImageGalleryDesc, "education", "EducationImageGallerySlide"),
    createTemplateEntry(EducationReportDonutSlide, EduReportDonutSchema, EduReportDonutId, EduReportDonutName, EduReportDonutDesc, "education", "EducationReportDonutSlide"),
    createTemplateEntry(EducationServicesSplitSlide, EduServicesSplitSchema, EduServicesSplitId, EduServicesSplitName, EduServicesSplitDesc, "education", "EducationServicesSplitSlide"),
    createTemplateEntry(EducationStatisticsGridSlide, EduStatisticsGridSchema, EduStatisticsGridId, EduStatisticsGridName, EduStatisticsGridDesc, "education", "EducationStatisticsGridSlide"),
    createTemplateEntry(EducationTimelineSlide, EduTimelineSchema, EduTimelineId, EduTimelineName, EduTimelineDesc, "education", "EducationTimelineSlide"),
];

export const productOverviewTemplates: TemplateWithData[] = [
    createTemplateEntry(CoverSlide, PoCoverSchema, PoCoverId, PoCoverName, PoCoverDesc, "product-overview", "CoverSlide"),
    createTemplateEntry(TableOfContentSlide, PoTableOfContentSchema, PoTableOfContentId, PoTableOfContentName, PoTableOfContentDesc, "product-overview", "TableOfContentSlide"),
    createTemplateEntry(IntroductionSlide, PoIntroductionSchema, PoIntroductionId, PoIntroductionName, PoIntroductionDesc, "product-overview", "IntroductionSlide"),
    createTemplateEntry(MissionVisionSlide, PoMissionVisionSchema, PoMissionVisionId, PoMissionVisionName, PoMissionVisionDesc, "product-overview", "MissionVisionSlide"),
    // createTemplateEntry(MarketOpportunitySlide, PoMarketOpportunitySchema, PoMarketOpportunityId, PoMarketOpportunityName, PoMarketOpportunityDesc, "product-overview", "MarketOpportunitySlide"),
    createTemplateEntry(BusinessChallengesGridSlide, PoBizChallengesGridSchema, PoBizChallengesGridId, PoBizChallengesGridName, PoBizChallengesGridDesc, "product-overview", "BusinessChallengesGridSlide"),
    createTemplateEntry(BusinessChallengesCardsSlide, PoBizChallengesCardsSchema, PoBizChallengesCardsId, PoBizChallengesCardsName, PoBizChallengesCardsDesc, "product-overview", "BusinessChallengesCardsSlide"),
    createTemplateEntry(OurServicesSlide, PoOurServicesSchema, PoOurServicesId, PoOurServicesName, PoOurServicesDesc, "product-overview", "OurServicesSlide"),
    createTemplateEntry(ProcessSlide, PoProcessSchema, PoProcessId, PoProcessName, PoProcessDesc, "product-overview", "ProcessSlide"),
    createTemplateEntry(ComparisonChartSlide, PoComparisonChartSchema, PoComparisonChartId, PoComparisonChartName, PoComparisonChartDesc, "product-overview", "ComparisonChartSlide"),
    createTemplateEntry(ComparisonTableWithTextSlide, PoComparisonTableSchema, PoComparisonTableId, PoComparisonTableName, PoComparisonTableDesc, "product-overview", "ComparisonTableWithTextSlide"),
    createTemplateEntry(KpiCardsSlide, PoKpiCardsSchema, PoKpiCardsId, PoKpiCardsName, PoKpiCardsDesc, "product-overview", "KpiCardsSlide"),
    createTemplateEntry(ReportSnapshotSlide, PoReportSnapshotSchema, PoReportSnapshotId, PoReportSnapshotName, PoReportSnapshotDesc, "product-overview", "ReportSnapshotSlide"),
    createTemplateEntry(PricingPlanSlide, PoPricingPlanSchema, PoPricingPlanId, PoPricingPlanName, PoPricingPlanDesc, "product-overview", "PricingPlanSlide"),
    createTemplateEntry(MeetTeamSlide, PoMeetTeamSchema, PoMeetTeamId, PoMeetTeamName, PoMeetTeamDesc, "product-overview", "MeetTeamSlide"),
    createTemplateEntry(ImageGallerySlide, PoImageGallerySchema, PoImageGalleryId, PoImageGalleryName, PoImageGalleryDesc, "product-overview", "ImageGallerySlide"),
];

export const reportTemplates: TemplateWithData[] = [
    createTemplateEntry(ReportIntroSlide, RepIntroSchema, RepIntroId, RepIntroName, RepIntroDesc, "report", "IntroCoverSlide"),
    createTemplateEntry(TitleDescriptionImageSlide, RepIntroductionImageSchema, RepIntroductionImageId, RepIntroductionImageName, RepIntroductionImageDesc, "report", "TitleDescriptionImageSlide"),
    createTemplateEntry(IntroductionStatsSlide, RepIntroductionStatsSchema, RepIntroductionStatsId, RepIntroductionStatsName, RepIntroductionStatsDesc, "report", "MetricsSlide"),
    createTemplateEntry(SolutionSlide, RepSolutionSchema, RepSolutionId, RepSolutionName, RepSolutionDesc, "report", "TitleImageBulletCardsSlide"),
    createTemplateEntry(MilestoneSlide, RepMilestoneSchema, RepMilestoneId, RepMilestoneName, RepMilestoneDesc, "report", "MilestoneSlide"),
    createTemplateEntry(DataAnalysisListSlide, RepDataAnalysisListSchema, RepDataAnalysisListId, RepDataAnalysisListName, RepDataAnalysisListDesc, "report", "BulletListWithIconTitleDescriptionSlide"),
    createTemplateEntry(DataAnalysisBarSlide, RepDataAnalysisBarSchema, RepDataAnalysisBarId, RepDataAnalysisBarName, RepDataAnalysisBarDesc, "report", "BarChartWithBulletListWithTitleDescriptionIconSlide"),
    createTemplateEntry(DataAnalysisInsightBarSlide, RepDataAnalysisInsightBarSchema, RepDataAnalysisInsightBarId, RepDataAnalysisInsightBarName, RepDataAnalysisInsightBarDesc, "report", "TitleDescriptionChartSlide"),
    createTemplateEntry(DataAnalysisLineStatsSlide, RepDataAnalysisLineStatsSchema, RepDataAnalysisLineStatsId, RepDataAnalysisLineStatsName, RepDataAnalysisLineStatsDesc, "report", "TitleChartWithMetricsCardsSlide"),
    createTemplateEntry(DataAnalysisDashboardSlide, RepDataAnalysisDashboardSchema, RepDataAnalysisDashboardId, RepDataAnalysisDashboardName, RepDataAnalysisDashboardDesc, "report", "DataAnalysisDashboardSlide"),
    createTemplateEntry(PerformanceSnapshotSlide, RepPerformanceSnapshotSchema, RepPerformanceSnapshotId, RepPerformanceSnapshotName, RepPerformanceSnapshotDesc, "report", "TitleMetricsSlide"),
    createTemplateEntry(ReportServicesSlide, RepServicesSchema, RepServicesId, RepServicesName, RepServicesDesc, "report", "TitleWorkflowWithTitleDescriptionSlide"),
    createTemplateEntry(ReportTeamSlide, RepTeamSchema, RepTeamId, RepTeamName, RepTeamDesc, "report", "HorizontalHeightSpanningImagesWithTitleSlide"),
];

export const neoGeneralTemplates: TemplateWithData[] = [

    createTemplateEntry(TextSplitWithEmphasisBlockLayout, TextSplitWithEmphasisBlockSchema, TextSplitWithEmphasisBlockId, TextSplitWithEmphasisBlockName, TextSplitWithEmphasisBlockDesc, 'neo-general', 'TextSplitWithEmphasisBlock'),
    createTemplateEntry(TitleWithGridBasedHeadingAndDescriptionLayout, TitleWithGridBasedHeadingAndDescriptionSchema, TitleWithGridBasedHeadingAndDescriptionId, TitleWithGridBasedHeadingAndDescriptionName, TitleWithGridBasedHeadingAndDescriptionDesc, "neo-general", "TitleWithGridBasedHeadingAndDescriptionLayout"),


    createTemplateEntry(TitleWithFullWidthChartLayout, TitleWithFullWidthChartSchema, TitleWithFullWidthChartId, TitleWithFullWidthChartName, TitleWithFullWidthChartDesc, "neo-general", "TitleWithFullWidthChartLayout"),
    createTemplateEntry(TitleMetricsWithChartLayout, TitleMetricsWithChartSchema, TitleMetricsWithChartId, TitleMetricsWithChartName, TitleMetricsWithChartDesc, "neo-general", "TitleMetricsWithChartLayout"),

    createTemplateEntry(TitleTopDescriptionFourTeamMembersGridLayout, TitleTopDescriptionFourTeamMembersGridSchema, TitleTopDescriptionFourTeamMembersGridId, TitleTopDescriptionFourTeamMembersGridName, TitleTopDescriptionFourTeamMembersGridDesc, "neo-general", "TitleTopDescriptionFourTeamMembersGridLayout"),
    createTemplateEntry(TitleThreeColumnRiskConstraintsLayout, TitleThreeColumnRiskConstraintsSchema, TitleThreeColumnRiskConstraintsId, TitleThreeColumnRiskConstraintsName, TitleThreeColumnRiskConstraintsDesc, "neo-general", "TitleThreeColumnRiskConstraintsLayout"),
    createTemplateEntry(TitleMetricValueMetricLabelFunnelStagesLayout, TitleMetricValueMetricLabelFunnelStagesSchema, TitleMetricValueMetricLabelFunnelStagesId, TitleMetricValueMetricLabelFunnelStagesName, TitleMetricValueMetricLabelFunnelStagesDesc, "neo-general", "TitleMetricValueMetricLabelFunnelStages"),
    createTemplateEntry(ThankYouContactInfoFooterImageSlideLayout, ThankYouContactInfoFooterImageSlideSchema, ThankYouContactInfoFooterImageSlideId, ThankYouContactInfoFooterImageSlideName, ThankYouContactInfoFooterImageSlideDesc, "neo-general", "ThankYouContactInfoFooterImageSlideLayout"),
    createTemplateEntry(TimelineLayout, TimelineLayoutSchema, TimelineLayoutId, TimelineLayoutName, TimelineLayoutDesc, "neo-general", "TimelineLayoutLayout"),

    createTemplateEntry(IndexedThreeColumnListLayout, IndexedThreeColumnListSchema, IndexedThreeColumnListId, IndexedThreeColumnListName, IndexedThreeColumnListDesc, "neo-general", "IndexedThreeColumnListLayout"),
    createTemplateEntry(LayoutTextBlockWithMetricCardsLayout, LayoutTextBlockWithMetricCardsSchema, LayoutTextBlockWithMetricCardsId, LayoutTextBlockWithMetricCardsName, LayoutTextBlockWithMetricCardsDesc, "neo-general", "LayoutTextBlockWithMetricCardsLayout"),
    createTemplateEntry(LeftAlignQuotesLayout, LeftAlignQuotesSchema, LeftAlignQuotesId, LeftAlignQuotesName, LeftAlignQuotesDesc, "neo-general", "LeftAlignQuotesLayout"),
    createTemplateEntry(TitleDescriptionWithTableLayout, TitleDescriptionWithTableSchema, TitleDescriptionWithTableId, TitleDescriptionWithTableName, TitleDescriptionWithTableDesc, "neo-general", "TitleDescriptionWithTableLayout"),
    createTemplateEntry(ChallengeAndOutcomeWithOneStatLayout, ChallengeAndOutcomeWithOneStatSchema, ChallengeAndOutcomeWithOneStatId, ChallengeAndOutcomeWithOneStatName, ChallengeAndOutcomeWithOneStatDesc, "neo-general", "ChallengeAndOutcomeWithOneStatLayout"),
    createTemplateEntry(GridBasedEightMetricsSnapshotsLayout, GridBasedEightMetricsSnapshotsSchema, GridBasedEightMetricsSnapshotsId, GridBasedEightMetricsSnapshotsName, GridBasedEightMetricsSnapshotsDesc, "neo-general", "GridBasedEightMetricsSnapshotsLayout"),

    createTemplateEntry(HeadlineTextWithBulletsAndStatsLayout, HeadlineTextWithBulletsAndStatsSchema, HeadlineTextWithBulletsAndStatsId, HeadlineTextWithBulletsAndStatsName, HeadlineTextWithBulletsAndStatsDesc, "neo-general", "HeadlineTextWithBulletsAndStatsLayout"),
    createTemplateEntry(HeadlineDescriptionWithImageLayout, HeadlineDescriptionWithImageSchema, HeadlineDescriptionWithImageId, HeadlineDescriptionWithImageName, HeadlineDescriptionWithImageDesc, "neo-general", "HeadlineDescriptionWithImageLayout"),
    createTemplateEntry(HeadlineDescriptionWithDoubleImageLayout, HeadlineDescriptionWithDoubleImageSchema, HeadlineDescriptionWithDoubleImageId, HeadlineDescriptionWithDoubleImageName, HeadlineDescriptionWithDoubleImageDesc, "neo-general", "HeadlineDescriptionWithDoubleImageLayout"),


    createTemplateEntry(BulletIconsOnlySlideNeoGeneralLayout, BulletIconsOnlyNeoGeneralSchema, BulletIconsOnlyNeoGeneralId, BulletIconsOnlyNeoGeneralName, BulletIconsOnlyNeoGeneralDesc, "neo-general", "BulletIconsOnlySlideLayout"),
    createTemplateEntry(BulletWithIconsSlideNeoGeneralLayout, BulletWithIconsNeoGeneralSchema, BulletWithIconsNeoGeneralId, BulletWithIconsNeoGeneralName, BulletWithIconsNeoGeneralDesc, "neo-general", "BulletWithIconsSlideLayout"),
    createTemplateEntry(ChartWithBulletsSlideNeoGeneralLayout, ChartWithBulletsNeoGeneralSchema, ChartWithBulletsNeoGeneralId, ChartWithBulletsNeoGeneralName, ChartWithBulletsNeoGeneralDesc, "neo-general", "ChartWithBulletsSlideLayout"),

    createTemplateEntry(MetricsWithImageSlideNeoGeneralLayout, MetricsWithImageNeoGeneralSchema, MetricsWithImageNeoGeneralId, MetricsWithImageNeoGeneralName, MetricsWithImageNeoGeneralDesc, "neo-general", "MetricsWithImageSlideLayout"),
    createTemplateEntry(NumberedBulletsSlideNeoGeneralLayout, NumberedBulletsNeoGeneralSchema, NumberedBulletsNeoGeneralId, NumberedBulletsNeoGeneralName, NumberedBulletsNeoGeneralDesc, "neo-general", "NumberedBulletsSlideLayout"),
    createTemplateEntry(QuoteSlideNeoGeneralLayout, QuoteNeoGeneralSchema, QuoteNeoGeneralId, QuoteNeoGeneralName, QuoteNeoGeneralDesc, "neo-general", "QuoteSlideLayout"),

    createTemplateEntry(TableOfContentWithoutPageNumberLayout, TableOfContentWithoutPageNumberSchema, TableOfContentWithoutPageNumberId, TableOfContentWithoutPageNumberName, TableOfContentWithoutPageNumberDesc, "neo-general", "TableOfContentWithoutPageNumber"),

    createTemplateEntry(TeamSlideNeoGeneralLayout, TeamNeoGeneralSchema, TeamNeoGeneralId, TeamNeoGeneralName, TeamNeoGeneralDesc, "neo-general", "TeamSlideLayout"),
    createTemplateEntry(MultiChartGridSlideLayout, MultiChartGridSlideSchema, MultiChartGridSlideId, MultiChartGridSlideName, MultiChartGridSlideDesc, "neo-general", "MultiChartGridSlideLayout"),
    createTemplateEntry(TitleDescriptionMultiChartGridWithMetricsLayout, TitleDescriptionMultiChartGridWithMetricsSchema, TitleDescriptionMultiChartGridWithMetricsId, TitleDescriptionMultiChartGridWithMetricsName, TitleDescriptionMultiChartGridWithMetricsDesc, "neo-general", "TitleDescriptionMultiChartGridWithMetrics"),
    createTemplateEntry(TitleDescriptionMultiChartGridWithBulletsLayout, TitleDescriptionMultiChartGridWithBulletsSchema, TitleDescriptionMultiChartGridWithBulletsId, TitleDescriptionMultiChartGridWithBulletsName, TitleDescriptionMultiChartGridWithBulletsDesc, "neo-general", "TitleDescriptionMultiChartGridWithBullets"),
]

export const neoStandardTemplates: TemplateWithData[] = [
    createTemplateEntry(TitleBadgeChartLayout, TitleBadgeChartSchema, TitleBadgeChartId, TitleBadgeChartName, TitleBadgeChartDesc, "neo-standard", "TitleBadgeChartLayout"),
    createTemplateEntry(TitleDescriptionBulletListStandardLayout, TitleDescriptionBulletListStandardSchema, TitleDescriptionBulletListStandardId, TitleDescriptionBulletListStandardName, TitleDescriptionBulletListStandardDesc, "neo-standard", "TitleDescriptionBulletList"),
    createTemplateEntry(TitleDescriptionContactCardsLayout, TitleDescriptionContactCardsSchema, TitleDescriptionContactCardsId, TitleDescriptionContactCardsName, TitleDescriptionContactCardsDesc, "neo-standard", "TitleDescriptionContactCardsLayout"),
    createTemplateEntry(TitleDescriptionIconListLayout, TitleDescriptionIconListSchema, TitleDescriptionIconListId, TitleDescriptionIconListName, TitleDescriptionIconListDesc, "neo-standard", "TitleDescriptionIconListLayout"),
    createTemplateEntry(TitleDescriptionImageRightLayout, TitleDescriptionImageRightSchema, TitleDescriptionImageRightId, TitleDescriptionImageRightName, TitleDescriptionImageRightDesc, "neo-standard", "TitleDescriptionImageRightLayout"),
    createTemplateEntry(TitleDescriptionRadialCardsLayout, TitleDescriptionRadialCardsSchema, TitleDescriptionRadialCardsId, TitleDescriptionRadialCardsName, TitleDescriptionRadialCardsDesc, "neo-standard", "TitleDescriptionRadialCardsLayout"),
    createTemplateEntry(TitleDescriptionTableLayout, TitleDescriptionTableSchema, TitleDescriptionTableId, TitleDescriptionTableName, TitleDescriptionTableDesc, "neo-standard", "TitleDescriptionTableLayout"),
    createTemplateEntry(TitleDescriptionTimelineLayout, TitleDescriptionTimelineSchema, TitleDescriptionTimelineId, TitleDescriptionTimelineName, TitleDescriptionTimelineDesc, "neo-standard", "TitleDescriptionTimelineLayout"),
    createTemplateEntry(TitleDualChartsComparisonLayout, TitleDualChartsComparisonSchema, TitleDualChartsComparisonId, TitleDualChartsComparisonName, TitleDualChartsComparisonDesc, "neo-standard", "TitleDualChartsComparisonLayout"),
    createTemplateEntry(TitleDualComparisonCardsLayout, TitleDualComparisonCardsSchema, TitleDualComparisonCardsId, TitleDualComparisonCardsName, TitleDualComparisonCardsDesc, "neo-standard", "TitleDualComparisonCardsLayout"),
    createTemplateEntry(TitleKpiGridLayout, TitleKpiGridSchema, TitleKpiGridId, TitleKpiGridName, TitleKpiGridDesc, "neo-standard", "TitleKpiGridLayout"),
    createTemplateEntry(TitleMetricsChartLayout, TitleMetricsChartSchema, TitleMetricsChartId, TitleMetricsChartName, TitleMetricsChartDesc, "neo-standard", "TitleMetricsChartLayout"),
    createTemplateEntry(TitleMetricsImageLayout, TitleMetricsImageSchema, TitleMetricsImageId, TitleMetricsImageName, TitleMetricsImageDesc, "neo-standard", "TitleMetricsImageLayout"),
    createTemplateEntry(TitlePointsDonutGridLayout, TitlePointsDonutGridSchema, TitlePointsDonutGridId, TitlePointsDonutGridName, TitlePointsDonutGridDesc, "neo-standard", "TitlePointsDonutGridLayout"),
    createTemplateEntry(TitleDescriptionMultiChartGridStandardLayout, TitleDescriptionMultiChartGridStandardSchema, TitleDescriptionMultiChartGridStandardId, TitleDescriptionMultiChartGridStandardName, TitleDescriptionMultiChartGridStandardDesc, "neo-standard", "TitleDescriptionMultiChartGrid"),
    createTemplateEntry(TitleDescriptionMultiChartGridWithMetricsStandardLayout, TitleDescriptionMultiChartGridWithMetricsStandardSchema, TitleDescriptionMultiChartGridWithMetricsStandardId, TitleDescriptionMultiChartGridWithMetricsStandardName, TitleDescriptionMultiChartGridWithMetricsStandardDesc, "neo-standard", "TitleDescriptionMultiChartGridWithMetrics"),
    createTemplateEntry(TitleDescriptionMultiChartGridWithBulletsStandardLayout, TitleDescriptionMultiChartGridWithBulletsStandardSchema, TitleDescriptionMultiChartGridWithBulletsStandardId, TitleDescriptionMultiChartGridWithBulletsStandardName, TitleDescriptionMultiChartGridWithBulletsStandardDesc, "neo-standard", "TitleDescriptionMultiChartGridWithBullets"),
]
export const neoModernTemplates: TemplateWithData[] = [
    createTemplateEntry(TitleDescriptionBulletListModernLayout, TitleDescriptionBulletListModernSchema, TitleDescriptionBulletListModernId, TitleDescriptionBulletListModernName, TitleDescriptionBulletListModernDesc, "neo-modern", "TitleDescriptionBulletList"),
    createTemplateEntry(TitleDescriptionContactListLayout, TitleDescriptionContactListSchema, TitleDescriptionContactListId, TitleDescriptionContactListName, TitleDescriptionContactListDesc, "neo-modern", "TitleDescriptionContactListLayout"),
    createTemplateEntry(TitleDescriptionDualMetricsGridLayout, TitleDescriptionDualMetricsGridSchema, TitleDescriptionDualMetricsGridId, TitleDescriptionDualMetricsGridName, TitleDescriptionDualMetricsGridDesc, "neo-modern", "TitleDescriptionDualMetricsGridLayout"),
    createTemplateEntry(TitleDescriptionIconTimelineLayout, TitleDescriptionIconTimelineSchema, TitleDescriptionIconTimelineId, TitleDescriptionIconTimelineName, TitleDescriptionIconTimelineDesc, "neo-modern", "TitleDescriptionIconTimelineLayout"),
    createTemplateEntry(TitleDescriptionImageRightModernLayout, TitleDescriptionImageRightModernSchema, TitleDescriptionImageRightModernId, TitleDescriptionImageRightModernName, TitleDescriptionImageRightModernDesc, "neo-modern", "TitleDescriptionImageRightModernLayout"),
    createTemplateEntry(TitleDescriptionMetricsChartLayout, TitleDescriptionMetricsChartSchema, TitleDescriptionMetricsChartId, TitleDescriptionMetricsChartName, TitleDescriptionMetricsChartDesc, "neo-modern", "TitleDescriptionMetricsChartLayout"),
    createTemplateEntry(TitleDescriptionMetricsImageLayout, TitleDescriptionMetricsImageSchema, TitleDescriptionMetricsImageId, TitleDescriptionMetricsImageName, TitleDescriptionMetricsImageDesc, "neo-modern", "TitleDescriptionMetricsImageLayout"),
    createTemplateEntry(TitleDescriptionMetricsTableLayout, TitleDescriptionMetricsTableSchema, TitleDescriptionMetricsTableId, TitleDescriptionMetricsTableName, TitleDescriptionMetricsTableDesc, "neo-modern", "TitleDescriptionMetricsTableLayout"),
    createTemplateEntry(TitleDualComparisonChartsLayout, TitleDualComparisonChartsSchema, TitleDualComparisonChartsId, TitleDualComparisonChartsName, TitleDualComparisonChartsDesc, "neo-modern", "TitleDualComparisonChartsLayout"),
    createTemplateEntry(TitleDualComparisonCardsModernLayout, TitleDualComparisonCardsModernSchema, TitleDualComparisonCardsModernId, TitleDualComparisonCardsModernName, TitleDualComparisonCardsModernDesc, "neo-modern", "TitleDualComparisonCardsModernLayout"),
    createTemplateEntry(TitleHorizontalAltenenatingTimelineLayout, TitleHorizontalAltenenatingTimelineSchema, TitleHorizontalAltenenatingTimelineId, TitleHorizontalAltenenatingTimelineName, TitleHorizontalAltenenatingTimelineDesc, "neo-modern", "TitleHorizontalAltenenatingTimelineLayout"),
    createTemplateEntry(TitleKpiSnapshotGridLayout, TitleKpiSnapshotGridSchema, TitleKpiSnapshotGridId, TitleKpiSnapshotGridName, TitleKpiSnapshotGridDesc, "neo-modern", "TitleKpiSnapshotGridLayout"),
    createTemplateEntry(TitleSubtitlesChartLayout, TitleSubtitlesChartSchema, TitleSubtitlesChartId, TitleSubtitlesChartName, TitleSubtitlesChartDesc, "neo-modern", "TitleSubtitlesChartLayout"),
    createTemplateEntry(TitleTwoColumnNumberListLayout, TitleTwoColumnNumberListSchema, TitleTwoColumnNumberListId, TitleTwoColumnNumberListName, TitleTwoColumnNumberListDesc, "neo-modern", "TitleTwoColumnNumberListLayout"),
    createTemplateEntry(TitleDescriptionMultiChartGridLayout, TitleDescriptionMultiChartGridSchema, TitleDescriptionMultiChartGridId, TitleDescriptionMultiChartGridName, TitleDescriptionMultiChartGridDesc, "neo-modern", "TitleDescriptionMultiChartGrid"),
    createTemplateEntry(TitleDescriptionMultiChartGridWithMetricsModernLayout, TitleDescriptionMultiChartGridWithMetricsModernSchema, TitleDescriptionMultiChartGridWithMetricsModernId, TitleDescriptionMultiChartGridWithMetricsModernName, TitleDescriptionMultiChartGridWithMetricsModernDesc, "neo-modern", "TitleDescriptionMultiChartGridWithMetrics"),
    createTemplateEntry(TitleDescriptionMultiChartGridWithBulletsModernLayout, TitleDescriptionMultiChartGridWithBulletsModernSchema, TitleDescriptionMultiChartGridWithBulletsModernId, TitleDescriptionMultiChartGridWithBulletsModernName, TitleDescriptionMultiChartGridWithBulletsModernDesc, "neo-modern", "TitleDescriptionMultiChartGridWithBullets"),
]
export const neoSwiftTemplates: TemplateWithData[] = [
    createTemplateEntry(TitleCenteredChartLayout, TitleCenteredChartSchema, TitleCenteredChartId, TitleCenteredChartName, TitleCenteredChartDesc, "neo-swift", "TitleCenteredChartLayout"),
    createTemplateEntry(TitleChartMetricsSidebarLayout, TitleChartMetricsSidebarSchema, TitleChartMetricsSidebarId, TitleChartMetricsSidebarName, TitleChartMetricsSidebarDesc, "neo-swift", "TitleChartMetricsSidebarLayout"),
    createTemplateEntry(TitleDescriptionBulletListLayout, TitleDescriptionBulletListSchema, TitleDescriptionBulletListId, TitleDescriptionBulletListName, TitleDescriptionBulletListDesc, "neo-swift", "TitleDescriptionBulletListLayout"),
    createTemplateEntry(TitleDescriptionDataTableLayout, TitleDescriptionDataTableSchema, TitleDescriptionDataTableId, TitleDescriptionDataTableName, TitleDescriptionDataTableDesc, "neo-swift", "TitleDescriptionDataTableLayout"),
    createTemplateEntry(TitleDescriptionImageRightSwiftLayout, TitleDescriptionImageRightSwiftSchema, TitleDescriptionImageRightSwiftId, TitleDescriptionImageRightSwiftName, TitleDescriptionImageRightSwiftDesc, "neo-swift", "TitleDescriptionImageRightSwiftLayout"),
    createTemplateEntry(TitleDescriptionMetricsGridLayout, TitleDescriptionMetricsGridSchema, TitleDescriptionMetricsGridId, TitleDescriptionMetricsGridName, TitleDescriptionMetricsGridDesc, "neo-swift", "TitleDescriptionMetricsGridLayout"),
    createTemplateEntry(TitleDescriptionMetricsGridImageLayout, TitleDescriptionMetricsGridImageSchema, TitleDescriptionMetricsGridImageId, TitleDescriptionMetricsGridImageName, TitleDescriptionMetricsGridImageDesc, "neo-swift", "TitleDescriptionMetricsGridImageLayout"),
    createTemplateEntry(TitleDualComparisionBlockLayout, TitleDualComparisionBlockSchema, TitleDualComparisionBlockId, TitleDualComparisionBlockName, TitleDualComparisionBlockDesc, "neo-swift", "TitleDualComparisionBlockLayout"),
    createTemplateEntry(TitleLabelDescriptionStatCardsLayout, TitleLabelDescriptionStatCardsSchema, TitleLabelDescriptionStatCardsId, TitleLabelDescriptionStatCardsName, TitleLabelDescriptionStatCardsDesc, "neo-swift", "TitleLabelDescriptionStatCardsLayout"),
    createTemplateEntry(TitleSubtitleTeamMemberCardsLayout, TitleSubtitleTeamMemberCardsSchema, TitleSubtitleTeamMemberCardsId, TitleSubtitleTeamMemberCardsName, TitleSubtitleTeamMemberCardsDesc, "neo-swift", "TitleSubtitleTeamMemberCardsLayout"),
    createTemplateEntry(TitleTaglineDescriptionNumberedStepsLayout, TitleTaglineDescriptionNumberedStepsSchema, TitleTaglineDescriptionNumberedStepsId, TitleTaglineDescriptionNumberedStepsName, TitleTaglineDescriptionNumberedStepsDesc, "neo-swift", "TitleTaglineDescriptionNumberedStepsLayout"),
    createTemplateEntry(TitleThreeByThreeMetricsGridLayout, TitleThreeByThreeMetricsGridSchema, TitleThreeByThreeMetricsGridId, TitleThreeByThreeMetricsGridName, TitleThreeByThreeMetricsGridDesc, "neo-swift", "TitleThreeByThreeMetricsGridLayout"),
    createTemplateEntry(TitleDescriptionSixChartsGridLayout, TitleDescriptionSixChartsGridSchema, TitleDescriptionSixChartsGridId, TitleDescriptionSixChartsGridName, TitleDescriptionSixChartsGridDesc, "neo-swift", "TitleDescriptionSixChartsGridLayout"),
    createTemplateEntry(TitleDescriptionSixChartsFourMetricsLayout, TitleDescriptionSixChartsFourMetricsSchema, TitleDescriptionSixChartsFourMetricsId, TitleDescriptionSixChartsFourMetricsName, TitleDescriptionSixChartsFourMetricsDesc, "neo-swift", "TitleDescriptionSixChartsFourMetricsLayout"),
    createTemplateEntry(TitleDescriptionFourChartsSixBulletsLayout, TitleDescriptionFourChartsSixBulletsSchema, TitleDescriptionFourChartsSixBulletsId, TitleDescriptionFourChartsSixBulletsName, TitleDescriptionFourChartsSixBulletsDesc, "neo-swift", "TitleDescriptionFourChartsSixBulletsLayout"),
]

// General templates array
export const generalTemplates: TemplateWithData[] = [

    createTemplateEntry(GeneralIntroSlideLayout, GeneralIntroSchema, GeneralIntroId, GeneralIntroName, GeneralIntroDesc, "general", "IntroSlideLayout"),
    createTemplateEntry(BasicInfoSlideLayout, BasicInfoSchema, BasicInfoId, BasicInfoName, BasicInfoDesc, "general", "BasicInfoSlideLayout"),
    createTemplateEntry(BulletIconsOnlySlideLayout, BulletIconsOnlySchema, BulletIconsOnlyId, BulletIconsOnlyName, BulletIconsOnlyDesc, "general", "BulletIconsOnlySlideLayout"),
    createTemplateEntry(BulletWithIconsSlideLayout, BulletWithIconsSchema, BulletWithIconsId, BulletWithIconsName, BulletWithIconsDesc, "general", "BulletWithIconsSlideLayout"),
    createTemplateEntry(ChartWithBulletsSlideLayout, ChartWithBulletsSchema, ChartWithBulletsId, ChartWithBulletsName, ChartWithBulletsDesc, "general", "ChartWithBulletsSlideLayout"),
    createTemplateEntry(MetricsSlideLayout, MetricsSchema, MetricsId, MetricsName, MetricsDesc, "general", "MetricsSlideLayout"),
    createTemplateEntry(MetricsWithImageSlideLayout, MetricsWithImageSchema, MetricsWithImageId, MetricsWithImageName, MetricsWithImageDesc, "general", "MetricsWithImageSlideLayout"),
    createTemplateEntry(NumberedBulletsSlideLayout, NumberedBulletsSchema, NumberedBulletsId, NumberedBulletsName, NumberedBulletsDesc, "general", "NumberedBulletsSlideLayout"),
    createTemplateEntry(QuoteSlideLayout, QuoteSchema, QuoteId, QuoteName, QuoteDesc, "general", "QuoteSlideLayout"),
    createTemplateEntry(TableInfoSlideLayout, TableInfoSchema, TableInfoId, TableInfoName, TableInfoDesc, "general", "TableInfoSlideLayout"),
    createTemplateEntry(TableOfContentsSlideLayout, TableOfContentsSchema, TableOfContentsId, TableOfContentsName, TableOfContentsDesc, "general", "TableOfContentsSlideLayout"),
    createTemplateEntry(TeamSlideLayout, TeamSchema, TeamId, TeamName, TeamDesc, "general", "TeamSlideLayout"),
];


// Modern templates array
export const modernTemplates: TemplateWithData[] = [
    createTemplateEntry(ModernIntroSlideLayout, ModernIntroSchema, ModernIntroId, ModernIntroName, ModernIntroDesc, "modern", "IntroSlideLayout"),
    createTemplateEntry(BulletsWithIconsDescriptionGrid, BulletsIconsGridSchema, BulletsIconsGridId, BulletsIconsGridName, BulletsIconsGridDesc, "modern", "BulletsWithIconsDescriptionGrid"),
    createTemplateEntry(ModernBulletWithIconsSlideLayout, ModernBulletIconsSchema, ModernBulletIconsId, ModernBulletIconsName, ModernBulletIconsDesc, "modern", "BulletWithIconsSlideLayout"),
    createTemplateEntry(ChartOrTableWithDescription, ChartTableDescSchema, ChartTableDescId, ChartTableDescName, ChartTableDescDesc, "modern", "ChartOrTableWithDescription"),
    createTemplateEntry(ChartOrTableWithMetricsDescription, ChartMetricsSchema, ChartMetricsId, ChartMetricsName, ChartMetricsDesc, "modern", "ChartOrTableWithMetricsDescription"),
    createTemplateEntry(ImageAndDescriptionLayout, ImageDescSchema, ImageDescId, ImageDescName, ImageDescDesc, "modern", "ImageAndDescriptionLayout"),
    createTemplateEntry(ImageListWithDescriptionSlideLayout, ImageListDescSchema, ImageListDescId, ImageListDescName, ImageListDescDesc, "modern", "ImageListWithDescriptionSlideLayout"),
    createTemplateEntry(ImagesWithDescriptionLayout, ImagesDescSchema, ImagesDescId, ImagesDescName, ImagesDescDesc, "modern", "ImagesWithDescriptionLayout"),
    createTemplateEntry(MetricsWithDescription, MetricsDescSchema, MetricsDescId, MetricsDescName, MetricsDescDesc, "modern", "MetricsWithDescription"),
    createTemplateEntry(ModernTableOfContentsLayout, ModernTocSchema, ModernTocId, ModernTocName, ModernTocDesc, "modern", "TableOfContentsLayout"),
];

// Standard templates array
export const standardTemplates: TemplateWithData[] = [
    createTemplateEntry(StandardIntroSlideLayout, StandardIntroSchema, StandardIntroId, StandardIntroName, StandardIntroDesc, "standard", "IntroSlideLayout"),
    createTemplateEntry(ChartLeftTextRightLayout, ChartLeftSchema, ChartLeftId, ChartLeftName, ChartLeftDesc, "standard", "ChartLeftTextRightLayout"),
    createTemplateEntry(ContactLayout, ContactSchema, ContactId, ContactName, ContactDesc, "standard", "ContactLayout"),
    createTemplateEntry(HeadingBulletImageDescriptionLayout, HeadingBulletSchema, HeadingBulletId, HeadingBulletName, HeadingBulletDesc, "standard", "HeadingBulletImageDescriptionLayout"),
    createTemplateEntry(IconBulletDescriptionLayout, IconBulletSchema, IconBulletId, IconBulletName, IconBulletDesc, "standard", "IconBulletDescriptionLayout"),
    createTemplateEntry(IconImageDescriptionLayout, IconImageSchema, IconImageId, IconImageName, IconImageDesc, "standard", "IconImageDescriptionLayout"),
    createTemplateEntry(StandardImageListWithDescriptionLayout, StdImageListSchema, StdImageListId, StdImageListName, StdImageListDesc, "standard", "ImageListWithDescriptionLayout"),
    createTemplateEntry(MetricsDescriptionLayout, MetricsDescLayoutSchema, MetricsDescLayoutId, MetricsDescLayoutName, MetricsDescLayoutDesc, "standard", "MetricsDescriptionLayout"),
    createTemplateEntry(NumberedBulletSingleImageLayout, NumBulletImgSchema, NumBulletImgId, NumBulletImgName, NumBulletImgDesc, "standard", "NumberedBulletSingleImageLayout"),
    createTemplateEntry(StandardTableOfContentsLayout, StdTocSchema, StdTocId, StdTocName, StdTocDesc, "standard", "TableOfContentsLayout"),
    createTemplateEntry(VisualMetricsSlideLayout, VisualMetricsSchema, VisualMetricsId, VisualMetricsName, VisualMetricsDesc, "standard", "VisualMetricsSlideLayout"),
];

// Swift templates array
export const swiftTemplates: TemplateWithData[] = [
    createTemplateEntry(SwiftIntroSlideLayout, SwiftIntroSchema, SwiftIntroId, SwiftIntroName, SwiftIntroDesc, "swift", "IntroSlideLayout"),
    createTemplateEntry(BulletsWithIconsTitleDescription, BulletsIconsTitleSchema, BulletsIconsTitleId, BulletsIconsTitleName, BulletsIconsTitleDesc, "swift", "BulletsWithIconsTitleDescription"),
    createTemplateEntry(IconBulletListDescription, IconBulletListSchema, IconBulletListId, IconBulletListName, IconBulletListDesc, "swift", "IconBulletListDescription"),
    createTemplateEntry(ImageListDescription, ImageListSchema, ImageListId, ImageListName, ImageListDesc, "swift", "ImageListDescription"),
    createTemplateEntry(MetricsNumbers, MetricsNumbersSchema, MetricsNumbersId, MetricsNumbersName, MetricsNumbersDesc, "swift", "MetricsNumbers"),
    createTemplateEntry(SimpleBulletPointsLayout, SimpleBulletSchema, SimpleBulletId, SimpleBulletName, SimpleBulletDesc, "swift", "SimpleBulletPointsLayout"),
    createTemplateEntry(SwiftTableOfContents, SwiftTocSchema, SwiftTocId, SwiftTocName, SwiftTocDesc, "swift", "TableOfContents"),
    createTemplateEntry(TableorChart, TableChartSchema, TableChartId, TableChartName, TableChartDesc, "swift", "TableorChart"),
    createTemplateEntry(Timeline, TimelineSchema, TimelineId, TimelineName, TimelineDesc, "swift", "Timeline"),
];

// TODO: Step 4: Combine all templates into a single array For UseCases (like the ones below)
// All templates combined
export const allLayouts: TemplateWithData[] = [
    ...neoGeneralTemplates,
    ...neoModernTemplates,
    ...neoStandardTemplates,
    ...neoSwiftTemplates,
    ...generalTemplates,
    ...modernTemplates,
    ...standardTemplates,
    ...swiftTemplates,
    ...codeTemplates,
    ...educationTemplates,
    ...productOverviewTemplates,
    ...reportTemplates,
];


// TODO: Step 5: Combine all templates into a single array For UseCases (like the ones below)
// For UseCases we need to combine all templates into a single array with settings
export const templates: TemplateLayoutsWithSettings[] = [
    {
        id: "general",
        name: "General",
        description: generalSettings.description,
        settings: generalSettings as TemplateGroupSettings,
        layouts: generalTemplates,
    },
    {
        id: "modern",
        name: "Modern",
        description: modernSettings.description,
        settings: modernSettings as TemplateGroupSettings,
        layouts: modernTemplates,
    },
    {
        id: "standard",
        name: "Standard",
        description: standardSettings.description,
        settings: standardSettings as TemplateGroupSettings,
        layouts: standardTemplates,
    },
    {
        id: "swift",
        name: "Swift",
        description: swiftSettings.description,
        settings: swiftSettings as TemplateGroupSettings,
        layouts: swiftTemplates,
    },
    {
        id: "code",
        name: "Code",
        description: codeSettings.description,
        settings: codeSettings as TemplateGroupSettings,
        layouts: codeTemplates,
    },
    {
        id: "education",
        name: "Education",
        description: educationSettings.description,
        settings: educationSettings as TemplateGroupSettings,
        layouts: educationTemplates,
    },
    {
        id: "product-overview",
        name: "Product Overview",
        description: productOverviewSettings.description,
        settings: productOverviewSettings as TemplateGroupSettings,
        layouts: productOverviewTemplates,
    },
    {
        id: "report",
        name: "Report",
        description: reportSettings.description,
        settings: reportSettings as TemplateGroupSettings,
        layouts: reportTemplates,
    },
    {
        id: "neo-general",
        name: "Neo General",
        description: neoGeneralSettings.description,
        settings: neoGeneralSettings as TemplateGroupSettings,
        layouts: neoGeneralTemplates,
    },
    {
        id: "neo-standard",
        name: "Neo Standard",
        description: neoStandardSettings.description,
        settings: neoStandardSettings as TemplateGroupSettings,
        layouts: neoStandardTemplates,
    },
    {
        id: "neo-modern",
        name: "Neo Modern",
        description: neoModernSettings.description,
        settings: neoModernSettings as TemplateGroupSettings,
        layouts: neoModernTemplates,
    },
    {
        id: "neo-swift",
        name: "Neo Swift",
        description: neoSwiftSettings.description,
        settings: neoSwiftSettings as TemplateGroupSettings,
        layouts: neoSwiftTemplates,
    },


];

// Helper to get templates by group ID
export function getTemplatesByTemplateName(templateId: string): TemplateWithData[] {
    const template = templates.find((t) => t.id === templateId);
    return template?.layouts || [];
}

export function getSchemaByTemplateId(templateId: string): any {
    const template = templates.find((t) => t.id === templateId);
    return template?.layouts.map(t => {
        return {
            id: t.layoutId,
            name: t.layoutName,
            description: t.layoutDescription,
            json_schema: t.schemaJSON,
        }
    }) || {};
}
export function getSettingsByTemplateId(templateId: string): TemplateGroupSettings | undefined {
    const template = templates.find((t) => t.id === templateId);
    return template?.settings || undefined;
}
// Helper to get template by layout ID
export function getTemplateByLayoutId(layoutId: string): TemplateWithData | undefined {
    return allLayouts.find((t) => t.layoutId === layoutId);
}
export function getLayoutByLayoutId(layout: string): TemplateWithData | undefined {
    const templateName = layout.split(':')[0]

    const template = templates.find((t) => t.id === templateName)

    if (template) {
        return template.layouts.find((t) => t.layoutId === layout);
    }
    return undefined;
}
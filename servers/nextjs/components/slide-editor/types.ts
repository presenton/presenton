// Template V2 editor geometry is stored in canvas pixels.
export const EDITOR_STAGE_WIDTH = 1280;
export const EDITOR_STAGE_HEIGHT = 720;

export type Nullable<T> = T | null;

export type ThemeRole =
  | "background"
  | "surface"
  | "primary"
  | "secondary"
  | "accent"
  | "text"
  | "muted";

export type HorizontalAlignment = "left" | "center" | "right";
export type VerticalAlignment = "top" | "middle" | "bottom";
export type LayoutAlignment =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch";
export type Marker = "bullet" | "number" | "none";
export type FlexDirection = "row" | "column";
export type ImageFit = "contain" | "cover" | "fill";
export type IconType = "bold" | "duotone" | "fill" | "light" | "regular" | "thin";
export type ChartType =
  | "area"
  | "bar"
  | "bubble"
  | "donut"
  | "horizontal_bar"
  | "horizontal_stacked_bar"
  | "line"
  | "pie"
  | "polar_area"
  | "radar"
  | "scatter"
  | "stacked_bar";
export type InfographicType = "progress_bar" | "gauge";

export type ProgressBarInfographicData = {
  type: "progress_bar";
  max_value: number;
  min_value: number;
  value: number;
};

export type GaugeInfographicData = {
  type: "gauge";
  max_value: number;
  min_value: number;
  value: number;
};

export type Position = {
  // Elements may intentionally bleed beyond the slide and are clipped by the
  // slide surface. Keep interaction bounds separate from persisted geometry.
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type LayoutItem = {
  grow?: number | null;
  shrink?: number | null;
  basis?: number | null;
  min_width?: number | null;
  max_width?: number | null;
  min_height?: number | null;
  max_height?: number | null;
  column_span?: number | null;
  row_span?: number | null;
  align_self?: LayoutAlignment | null;
};

export type Alignment = {
  horizontal?: HorizontalAlignment | null;
  vertical?: VerticalAlignment | null;
};

export type Font = {
  family?: string | null;
  size?: number | null;
  color?: string | null;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  line_height?: number | null;
  // Pixels, matching the Template V2 editor text model.
  letter_spacing?: number | null;
  ellipsis?: boolean | null;
  opacity?: number | null;
};

export type Fill = {
  color: string;
  opacity?: number | null;
};

export type Stroke = {
  color: string;
  opacity?: number | null;
  width: number;
  dash?: number[] | null;
};

export type Line = Stroke;

export type BorderRadius = {
  tl: number;
  tr: number;
  bl: number;
  br: number;
};

export type CornerRadius = BorderRadius;

export type Shadow = {
  color?: string | null;
  blur?: number | null;
  opacity?: number | null;
  offset_x?: number | null;
  offset_y?: number | null;
};

export type ChartDatum = {
  label: string;
  value: number;
  color?: string | null;
};

export type ChartSeries = {
  name: string;
  values: number[];
};

export type DataLabelPosition = "base" | "mid" | "top" | "outside";

export type TextRun = {
  text: string;
  font?: Font | null;
};

export type TextListItem = TextRun[];

export type DesignVariableEffect = {
  path: string;
  effect: string;
};

export type DesignVariable = {
  name: string;
  type?: string | null;
  options: unknown[];
  effect: DesignVariableEffect[];
};

type ElementBase = {
  decorative?: boolean | null;
  name?: string | null;
  position?: Position | null;
  size?: Size | null;
  rotation?: number | null;
  opacity?: number | null;
  shadow?: Shadow | null;
  component_id?: string | null;
  component_instance_id?: string | null;
  component_description?: string | null;
  component_slot?: string | null;
  design_variables?: DesignVariable[] | null;
  layout?: LayoutItem | null;
};

type RequiredElementBase = ElementBase & {
  position: Position;
  size: Size;
};

export type TextElement = ElementBase & {
  type: "text";
  font?: Font | null;
  alignment?: Alignment | null;
  fill?: Fill | null;
  stroke?: Stroke | null;
  runs: TextRun[];
  max_length?: number | null;
  min_length?: number | null;
};

export type MathElement = ElementBase & {
  type: "math";
  latex: string;
  display_mode?: boolean | null;
  font?: Font | null;
  alignment?: Alignment | null;
  max_length?: number | null;
  min_length?: number | null;
};

export type ContainerElement = ElementBase & {
  type: "container";
  alignment?: Alignment | null;
  fill?: Fill | null;
  stroke?: Stroke | null;
  border_radius?: BorderRadius | null;
  padding?: Padding | null;
  child?: SlideElement | null;
};

export type ImageElement = ElementBase & {
  type: "image";
  flip_h?: boolean | null;
  flip_v?: boolean | null;
  data?: string | null;
  fit?: ImageFit | null;
  focus_x?: number | null;
  focus_y?: number | null;
  crop_scale?: number | null;
  border_radius?: BorderRadius | null;
  clippath?: string | null;
  clip_path?: string | null;
  clipPath?: string | null;
  color?: string | null;
  prompt?: string | null;
  is_icon?: boolean | null;
  icon_type?: IconType | null;
};

export type TextListElement = ElementBase & {
  type: "text-list";
  font?: Font | null;
  marker?: Marker | null;
  items: TextListItem[];
  max_items?: number | null;
  min_items?: number | null;
  max_item_length?: number | null;
  min_item_length?: number | null;
};

export type BulletsElement = TextListElement;

export type TableCell = {
  color?: Fill | null;
  font?: Font | null;
  alignment?: HorizontalAlignment | null;
  runs: TextRun[];
};

export type TableElement = ElementBase & {
  type: "table";
  font?: Font | null;
  columns: TableCell[];
  rows: TableCell[][];
  max_columns?: number | null;
  min_columns?: number | null;
  max_rows?: number | null;
  min_rows?: number | null;
};

export type VectorCurve = {
  type: "smooth";
  tension?: number | null;
  segments?: number | null;
};

export type VectorShape = "polygon" | "ellipse";

export type VectorElement = Omit<ElementBase, "decorative" | "name"> & {
  type: "vector";
  decorative?: never;
  name?: never;
  shape?: VectorShape | null;
  points: Position[];
  closed?: boolean | null;
  curve?: VectorCurve | null;
  corner_radii?: number[] | null;
  fill?: Fill | null;
  stroke?: Stroke | null;
};

export type SvgElement = ElementBase & {
  type: "svg";
  svg: string;
};

export type ChartElement = ElementBase & {
  type: "chart";
  chart_type: ChartType;
  data: ChartDatum[];
  title?: string | null;
  title_color?: string | null;
  color?: string | null;
  axis_color?: string | null;
  grid_color?: string | null;
  colors?: string[] | null;
  x_axis?: boolean | null;
  y_axis?: boolean | null;
  x_axis_grid?: boolean | null;
  y_axis_grid?: boolean | null;
  x_axis_title?: string | null;
  y_axis_title?: string | null;
  categories?: string[] | null;
  series?: ChartSeries[] | null;
  data_labels?: DataLabelPosition | null;
  legend?: boolean | null;
  legend_color?: string | null;
  source?: string | null;
};

export type InfographicElement = ElementBase & {
  type: "infographic";
  data: ProgressBarInfographicData | GaugeInfographicData;
  colors?: string[] | null;
};

export type FlexElement = RequiredElementBase & {
  type: "flex";
  direction: FlexDirection;
  wrap?: boolean | null;
  align_items?: LayoutAlignment | null;
  justify_content?: LayoutAlignment | null;
  padding?: Padding | null;
  gap?: number | null;
  column_gap?: number | null;
  row_gap?: number | null;
  children: SlideElement[];
  max_children?: number | null;
  min_children?: number | null;
};

export type GridElement = RequiredElementBase & {
  type: "grid";
  columns: number;
  rows?: number | null;
  gap?: number | null;
  column_gap?: number | null;
  row_gap?: number | null;
  align_items?: LayoutAlignment | null;
  justify_items?: LayoutAlignment | null;
  padding?: Padding | null;
  children: SlideElement[];
  max_children?: number | null;
  min_children?: number | null;
};

export type GroupElement = RequiredElementBase & {
  type: "group";
  children: SlideElement[];
  max_children?: number | null;
  min_children?: number | null;
};

export type SlideElement =
  | TextElement
  | MathElement
  | ContainerElement
  | ImageElement
  | TextListElement
  | TableElement
  | VectorElement
  | SvgElement
  | ChartElement
  | InfographicElement
  | FlexElement
  | GridElement
  | GroupElement;

export type SlideBackgroundImage = {
  data: string;
  fit?: ImageFit | null;
  opacity?: number | null;
};

export type DeckTheme = {
  background: string;
  surface?: string | null;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted?: string | null;
};

export type Slide = {
  background: string;
  background_role?: ThemeRole | null;
  background_image?: SlideBackgroundImage | null;
  elements: SlideElement[];
  title?: string | null;
};

export type Deck = {
  title: string;
  description?: string | null;
  theme?: DeckTheme | null;
  slides: Slide[];
};

export type SlideComponent = {
  id: string;
  description: string;
  position?: Position | null;
  elements: SlideElement[];
};

export type SlideComponents = {
  components: SlideComponent[];
};

export type SlideLayout = {
  id: string;
  description: string;
  components: SlideComponent[];
};

export type SlideLayouts = {
  layouts: SlideLayout[];
};

export type Box = {
  position: Position;
  size: Size;
};

export type LayoutHorizontalAlignment = HorizontalAlignment;
export type LayoutVerticalAlignment = VerticalAlignment;
export type LayoutMarker = Marker;
export type LayoutFlexDirection = FlexDirection;
export type LayoutImageFit = ImageFit;
export type LayoutChartType = ChartType;
export type LayoutInfographicType = InfographicType;
export type LayoutPosition = Position;
export type LayoutSize = Size;
export type LayoutPadding = Padding;
export type LayoutItemProps = LayoutItem;
export type LayoutElementAlignment = Alignment;
export type LayoutFont = Font;
export type LayoutFill = Fill;
export type LayoutStroke = Stroke;
export type LayoutBorderRadius = BorderRadius;
export type LayoutShadow = Shadow;
export type LayoutChartDatum = ChartDatum;
export type LayoutTextRun = TextRun;
export type LayoutTextListItem = TextListItem;
export type LayoutTextElement = TextElement;
export type LayoutContainerElement = ContainerElement;
export type LayoutImageElement = ImageElement;
export type LayoutTextListElement = TextListElement;
export type LayoutTableCell = TableCell;
export type LayoutTableElement = TableElement;
export type LayoutVectorElement = VectorElement;
export type LayoutSvgElement = SvgElement;
export type LayoutChartElement = ChartElement;
export type LayoutInfographicElement = InfographicElement;
export type LayoutFlexElement = FlexElement;
export type LayoutGridElement = GridElement;
export type LayoutGroupElement = GroupElement;
export type LayoutSlideElement = SlideElement;
export type LayoutSlideComponent = SlideComponent;
export type LayoutSlideComponents = SlideComponents;
export type LayoutSlideLayout = SlideLayout;
export type LayoutSlideLayouts = SlideLayouts;

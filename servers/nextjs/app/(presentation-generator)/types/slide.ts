export type TextType =
  | "title"
  | "heading 1"
  | "heading 2"
  | "heading 3"
  | "heading 4"
  | "normal text";
export interface TextSize {
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
}

interface SlideContent {
  title: string;
  body: string | Array<{ heading: string; description: string }>;
  description?: string;
  graph?: any;
  diagram?: any;
  infographics?: any;
  image_prompts?: string[];
  icon_queries?: Array<{ queries: string[] }>;
}

export interface Slide {
  id: string | null;
  index: number;
  type: number;
  design_index: number | null;
  images: string[] | null;
  properties: null | any;
  icons: string[] | null;
  graph_id: string | null;
  presentation?: string;
  speaker_note?: string;
  ui?: Record<string, unknown> | null;

  content: SlideContent;
}

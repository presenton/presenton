import type React from "react";

// ================== Core Types ==================

export interface SlideData {
  slide_number: number;
  screenshot_url: string;
  xml_content?: string;
  normalized_fonts?: string[];
  markdown_content?: string;
}

export interface UploadedFont {
  fontName: string;
  fontUrl: string;
  fontPath: string;
  file: File; // Original file for re-upload
}

export interface FontItem {
  name: string;
  url: string | null;
  original_name?: string | null;
  family_name?: string | null;
  variant?: string | null;
  variants?: string[] | null;
}

export interface FontData {
  available_fonts: FontItem[];
  unavailable_fonts: FontItem[];
}

// ================== Template Creation Flow Types ==================

export type TemplateCreationStep =
  | 'file-upload'
  | 'font-check'
  | 'font-upload'
  | 'slides-preview'
  | 'template-creation'
  | 'completed';

export interface FontUploadPreviewResponse {
  slide_image_urls: string[];
  original_pptx_url: string;
  modified_pptx_url: string;
  fonts: {
    [key: string]: string;
  };
}

export interface FontInfo {
  name: string;
  url?: string;
  path?: string;
}

export interface TemplateCreationState {
  step: TemplateCreationStep;
  isLoading: boolean;
  error: string | null;

  // Font check data
  fontsData: FontData | null;

  // Font upload & preview data
  previewData: FontUploadPreviewResponse | null;

  // Template creation data
  templateId: string | null;
  totalSlides: number;

  currentSlideIndex: number;
}

// ================== Templates V2 Raw Layout Types ==================

export interface TemplateV2Point {
  x?: number | string | null;
  y?: number | string | null;
}

export interface TemplateV2Size {
  width?: number | string | null;
  height?: number | string | null;
}

export interface TemplateV2TextRun {
  text?: string | null;
  font?: TemplateV2Font | null;
}

export interface TemplateV2Font {
  family?: string | null;
  size?: number | string | null;
  color?: string | null;
  bold?: boolean | null;
  italic?: boolean | null;
  lineHeight?: number | string | null;
  line_height?: number | string | null;
  wrap?: string | null;
}

export interface TemplateV2Element {
  type?: string | null;
  position?: TemplateV2Point | null;
  size?: TemplateV2Size | null;
  points?: TemplateV2Point[] | null;
  closed?: boolean | string | null;
  fill?: Record<string, unknown> | null;
  stroke?: Record<string, unknown> | null;
  border_radius?: Record<string, unknown> | null;
  shadow?: Record<string, unknown> | null;
  padding?: Record<string, unknown> | null;
  alignment?: Record<string, unknown> | null;
  font?: TemplateV2Font | null;
  runs?: TemplateV2TextRun[] | null;
  text?: string | null;
  data?: string | null;
  fit?: string | null;
  flip_h?: boolean | string | null;
  flip_v?: boolean | string | null;
  focus_x?: number | string | null;
  focus_y?: number | string | null;
  crop_scale?: number | string | null;
  clippath?: string | null;
  clip_path?: string | null;
  clipPath?: string | null;
  color?: string | null;
  icon_type?: string | null;
  child?: TemplateV2Element | null;
  children?: TemplateV2Element[] | null;
  items?: TemplateV2TextRun[][] | null;
  marker?: string | null;
  columns?: unknown;
  rows?: unknown;
  [key: string]: unknown;
}

export interface TemplateV2Component {
  id?: string | null;
  description?: string | null;
  position?: TemplateV2Point | null;
  elements?: TemplateV2Element[] | null;
  [key: string]: unknown;
}

export interface TemplateV2Layout {
  id?: string | null;
  description?: string | null;
  elements?: TemplateV2Element[] | null;
  components?: TemplateV2Component[] | null;
}

export interface TemplateV2ImportResponse {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  icon_type?: unknown;
  layouts?: unknown;
  raw_layouts?: unknown;
  assets?: unknown;
}

// ================== Processed Slide Types ==================

export interface ProcessedSlide extends SlideData {
  react?: string;
  v2Layout?: TemplateV2Layout;
  template_v2_id?: string;
  uploaded_fonts?: string[];
  processing?: boolean;
  processed?: boolean;
  error?: string;
  modified?: boolean;
  layout_id?: string;
  layout_name?: string;
  layout_description?: string;
}

// ================== Component Props Types ==================

export interface EachSlideProps {
  slide: ProcessedSlide;
  templateFonts?: Record<string, string>;
  index: number;
  retrySlide: (index: number) => void;
  setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>;
  isProcessing: boolean;
  onOpenSchemaEditor?: (index: number | null) => void;
  isSchemaEditorOpen?: boolean;
  schemaPreviewData?: Record<string, any> | null;  // Preview data from schema editor AI fill
  onClearSchemaPreview?: () => void;  // Callback to clear schema preview data in parent
}

export interface FontManagerProps {
  fontsData: FontData;
  uploadedFonts: UploadedFont[];
  uploadFont: (fontName: string, file: File) => string | null;
  removeFont: (fontName: string) => void;
  onContinue: () => void;
  isUploading?: boolean;
}

export interface SlidePreviewSectionProps {
  previewData: FontUploadPreviewResponse;
  onInitTemplate: (metadata?: TemplateCreationMetadata) => void;
  isLoading: boolean;
  defaultTemplateName: string;
  requiresTemplateMetadata?: boolean;
}

export interface TemplateCreationMetadata {
  name: string;
  description?: string;
}

export interface TemplateCreationProgressProps {
  currentStep: TemplateCreationStep;
  totalSlides: number;
  processedSlides: number;
}

export interface DrawingCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  slideDisplayRef: React.RefObject<HTMLDivElement>;
  strokeWidth: number;
  strokeColor: string;
  eraserMode: boolean;
  isDrawing: boolean;
  canvasDimensions: { width: number; height: number };
  onStrokeWidthChange: (width: number) => void;
  onStrokeColorChange: (color: string) => void;
  onEraserModeChange: (isEraser: boolean) => void;
  onClearCanvas: () => void;
}

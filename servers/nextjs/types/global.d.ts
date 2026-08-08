interface ShapeProps {
  id: string;
  type: 'rectangle' | 'circle' | 'line';
  position: { x: number; y: number };
  size: { width: number; height: number };
  // Add other properties as needed
}

interface TextFrameProps {
  id: string;
  content: string;
  position: { x: number; y: number };
  // Add other properties as needed
}

interface ElectronAPI {
  exportPresentation: (
    id: string,
    title: string,
    format: "pptx" | "pdf"
  ) => Promise<any>;
  readFile: (filePath: string) => Promise<{ content: string }>;
}

interface Window {
  electron?: ElectronAPI;
  env?: {
    NEXT_PUBLIC_FAST_API: string;
    APP_VERSION: string;
    DISABLE_AUTH: string;
  };
}

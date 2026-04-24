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

interface Window {
  env?: {
    NEXT_PUBLIC_FAST_API: string;
    NEXT_PUBLIC_URL: string;
    TEMP_DIRECTORY: string;
    NEXT_PUBLIC_USER_CONFIG_PATH: string;
    APP_VERSION: string;
  };
}

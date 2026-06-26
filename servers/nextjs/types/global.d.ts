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
  fileDownloaded: (filePath: string) => Promise<any>;
  exportPresentation: (
    id: string,
    title: string,
    format: "pptx" | "pdf"
  ) => Promise<any>;
  getUserConfig: () => Promise<any>;
  setUserConfig: (userConfig: any) => Promise<any>;
  getCanChangeKeys: () => Promise<boolean>;
  readFile: (filePath: string) => Promise<{ content: string }>;
  getSlideMetadata: (
    url: string,
    theme: string,
    customColors?: any,
    tempDirectory?: string
  ) => Promise<any>;
  getFooter: (userId: string) => Promise<any>;
  setFooter: (userId: string, properties: any) => Promise<any>;
  getTheme: (userId: string) => Promise<any>;
  setTheme: (userId: string, themeData: any) => Promise<any>;
  uploadImage: (file: Buffer) => Promise<any>;
  writeNextjsLog: (logData: string) => Promise<any>;
  clearNextjsLogs: () => Promise<any>;
  hasRequiredKey: () => Promise<{ hasKey: boolean }>;
  telemetryStatus: () => Promise<{ telemetryEnabled: boolean }>;
  getTemplates: () => Promise<
    Array<{
      templateName: string;
      templateID: string;
      files: string[];
      settings: any;
    }>
  >;
}

interface Window {
  electron?: ElectronAPI;
  env?: {
    NEXT_PUBLIC_FAST_API: string;
    NEXT_PUBLIC_URL: string;
    TEMP_DIRECTORY: string;
    NEXT_PUBLIC_USER_CONFIG_PATH: string;
    APP_VERSION: string;
    DISABLE_AUTH: string;
  };
}

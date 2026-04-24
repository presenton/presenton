'use client';

import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = 'd726e8bea8ec147f4c7720060cb2e6d1';

export enum MixpanelEvent {
  PageView = 'Page View',
  Navigation = 'Navigation',
  Home_SaveConfiguration_Button_Clicked = 'Home Save Configuration Button Clicked',
  Home_SaveConfiguration_API_Call = 'Home Save Configuration API Call',
  Home_CheckOllamaModelPulled_API_Call = 'Home Check Ollama Model Pulled API Call',
  Home_DownloadOllamaModel_API_Call = 'Home Download Ollama Model API Call',

  Onboarding_Providers_Models_Selected = 'Onboarding Providers Models Selected',
  Onboarding_Configuration_Saved = 'Onboarding Configuration Saved',
  Onboarding_Completed = 'Onboarding Completed',

  Codex_SignIn_API_Call = 'Codex Sign In API Call',

  Upload_Configuration_Invalid = 'Upload Configuration Invalid',
  Upload_Generation_Started = 'Upload Generation Started',
  Upload_Documents_Processed = 'Upload Documents Processed',
  Upload_Outline_Generation_Requested = 'Upload Outline Generation Requested',
  Outline_Generate_Presentation_Button_Clicked = 'Outline Generate Presentation Button Clicked',
  Outline_Select_Template_Button_Clicked = 'Outline Select Template Button Clicked',
  Outline_Add_Slide_Button_Clicked = 'Outline Add Slide Button Clicked',
  Outline_Template_Selected = 'Outline Template Selected',
  Outline_Presentation_Generation_Started = 'Outline Presentation Generation Started',

  Presentation_Editor_Viewed = 'Presentation Editor Viewed',
  Presentation_Mode_Entered = 'Presentation Mode Entered',
  Presentation_Title_Updated = 'Presentation Title Updated',
  Presentation_Slides_Reordered = 'Presentation Slides Reordered',
  Presentation_Slide_Added = 'Presentation Slide Added',
  Presentation_Slide_Updated = 'Presentation Slide Updated',
  Presentation_Slide_Deleted = 'Presentation Slide Deleted',
  Presentation_Theme_Changed = 'Presentation Theme Changed',
  Presentation_Theme_Reset = 'Presentation Theme Reset',
  Presentation_Export_Started = 'Presentation Export Started',
  Presentation_Regenerated = 'Presentation Regenerated',

  Presentation_Prepare_API_Call = 'Presentation Prepare API Call',
  Presentation_Stream_API_Call = 'Presentation Stream API Call',
  Group_Layout_Selected_Clicked = 'Group Layout Selected Clicked',
  Header_Export_PDF_Button_Clicked = 'Header Export PDF Button Clicked',
  Header_Export_PPTX_Button_Clicked = 'Header Export PPTX Button Clicked',
  Header_UpdatePresentationContent_API_Call = 'Header Update Presentation Content API Call',
  Header_ExportAsPDF_API_Call = 'Header Export As PDF API Call',
  Header_GetPptxModel_API_Call = 'Header Get PPTX Model API Call',
  Header_ExportAsPPTX_API_Call = 'Header Export As PPTX API Call',
  Slide_Add_New_Slide_Button_Clicked = 'Slide Add New Slide Button Clicked',
  Slide_Delete_Slide_Button_Clicked = 'Slide Delete Slide Button Clicked',
  Slide_Update_From_Prompt_Button_Clicked = 'Slide Update From Prompt Button Clicked',
  Slide_Edit_API_Call = 'Slide Edit API Call',
  Slide_Delete_API_Call = 'Slide Delete API Call',
  TemplatePreview_Back_Button_Clicked = 'Template Preview Back Button Clicked',
  TemplatePreview_All_Groups_Button_Clicked = 'Template Preview All Groups Button Clicked',
  TemplatePreview_Delete_Templates_Button_Clicked = 'Template Preview Delete Templates Button Clicked',
  TemplatePreview_Delete_Templates_API_Call = 'Template Preview Delete Templates API Call',
  TemplatePreview_Open_Editor_Button_Clicked = 'Template Preview Open Editor Button Clicked',
  CustomTemplate_Save_Templates_API_Call = 'Custom Template Save Templates API Call',
  PdfMaker_Retry_Button_Clicked = 'PDF Maker Retry Button Clicked',
  Upload_Upload_Documents_API_Call = 'Upload Upload Documents API Call',
  Upload_Decompose_Documents_API_Call = 'Upload Decompose Documents API Call',
  Upload_Create_Presentation_API_Call = 'Upload Create Presentation API Call',
  Upload_GetStarted_Button_Clicked = 'Upload Get Started Button Clicked',
  Upload_Validation_Failed = 'Upload Validation Failed',
  DocumentsPreview_Create_Presentation_API_Call = 'Documents Preview Create Presentation API Call',
  DocumentsPreview_Next_Button_Clicked = 'Documents Preview Next Button Clicked',
  Settings_SaveConfiguration_Button_Clicked = 'Settings Save Configuration Button Clicked',
  Settings_SaveConfiguration_API_Call = 'Settings Save Configuration API Call',
  Settings_CheckOllamaModelPulled_API_Call = 'Settings Check Ollama Model Pulled API Call',
  Settings_DownloadOllamaModel_API_Call = 'Settings Download Ollama Model API Call',
  PresentationPage_Refresh_Page_Button_Clicked = 'Presentation Page Refresh Page Button Clicked',
  PresentationMode_Fullscreen_Toggle_Clicked = 'Presentation Mode Fullscreen Toggle Clicked',
  PresentationMode_Exit_Clicked = 'Presentation Mode Exit Clicked',
  ImageEditor_GetPreviousGeneratedImages_API_Call = 'Image Editor Get Previous Generated Images API Call',
  ImageEditor_GenerateImage_API_Call = 'Image Editor Generate Image API Call',
  ImageEditor_UploadImage_API_Call = 'Image Editor Upload Image API Call',
  Header_ReGenerate_Button_Clicked = 'Header ReGenerate Button Clicked',

  Dashboard_Page_Viewed = 'Dashboard Page Viewed',
  Dashboard_New_Presentation_Clicked = 'Dashboard New Presentation Clicked',
  Dashboard_Presentation_Opened = 'Dashboard Presentation Opened',
  Dashboard_Presentation_Deleted = 'Dashboard Presentation Deleted',
  Dashboard_Create_New_Card_Clicked = 'Dashboard Create New Card Clicked',

  Sidebar_Navigation_Clicked = 'Sidebar Navigation Clicked',

  Templates_Page_Viewed = 'Templates Page Viewed',
  Templates_Tab_Switched = 'Templates Tab Switched',
  Templates_Inbuilt_Opened = 'Templates Inbuilt Opened',
  Templates_Custom_Opened = 'Templates Custom Opened',
  Templates_New_Template_Clicked = 'Templates New Template Clicked',
  Templates_Build_Template_Clicked = 'Templates Build Template Clicked',

  Theme_Page_Viewed = 'Theme Page Viewed',
  Theme_Selected = 'Theme Selected',
  Theme_Saved = 'Theme Saved',
  Theme_Deleted = 'Theme Deleted',
  Theme_Font_Changed = 'Theme Font Changed',
  Theme_Custom_Font_Uploaded = 'Theme Custom Font Uploaded',
  Theme_Logo_Uploaded = 'Theme Logo Uploaded',
  Theme_Tab_Switched = 'Theme Tab Switched',
  Theme_New_Theme_Clicked = 'Theme New Theme Clicked',
  Theme_Palette_Generated = 'Theme Palette Generated',
  Theme_Editor_Opened = 'Theme Editor Opened',
  Theme_Save_Started = 'Theme Save Started',

  CustomTemplate_Creation_Started = 'Custom Template Creation Started',
  CustomTemplate_Creation_Completed = 'Custom Template Creation Completed',
  CustomTemplate_Save_Started = 'Custom Template Save Started',
  CustomTemplate_Saved = 'Custom Template Saved',
  CustomTemplate_Save_Modal_Opened = 'Custom Template Save Modal Opened',
}

export type MixpanelProps = Record<string, unknown>;

declare global {
  interface Window {
    __mixpanel_initialized?: boolean;
    __mixpanel_telemetry_enabled?: boolean;
  }
}

function canUseMixpanel(): boolean {
  return typeof window !== 'undefined' && Boolean(MIXPANEL_TOKEN);
}

let trackingCheckPromise: Promise<boolean> | null = null;

async function ensureTelemetryStatus(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof window.__mixpanel_telemetry_enabled === 'boolean') {
    return window.__mixpanel_telemetry_enabled;
  }
  if (!trackingCheckPromise) {
    trackingCheckPromise = (async () => {
      try {
        const res = await fetch('/api/telemetry-status');
        const data = await res.json();
        const enabled = Boolean(data?.telemetryEnabled);
        window.__mixpanel_telemetry_enabled = enabled;
        return enabled;
      } catch {
        // If the API call fails, default to enabling tracking
        window.__mixpanel_telemetry_enabled = true;
        return true;
      }
    })();
  }
  return trackingCheckPromise;
}

export function initMixpanel(): void {
  if (!canUseMixpanel()) return;
  if (window.__mixpanel_initialized) return;
  // Ensure telemetry is allowed before initializing
  void ensureTelemetryStatus().then((enabled) => {
    if (!enabled) return;
    if (window.__mixpanel_initialized) return;
    mixpanel.init(MIXPANEL_TOKEN as string, { track_pageview: false, api_host: 'https://api-eu.mixpanel.com', });
    const appVersion = window.env?.APP_VERSION;
    if (appVersion) {
      mixpanel.register({ app_version: appVersion });
    }
    mixpanel.identify(mixpanel.get_distinct_id());
    window.__mixpanel_initialized = true;
  });
}

export function track(eventName: string, props?: Record<string, unknown>): void {
  if (!canUseMixpanel()) return;
  if (typeof window !== 'undefined' && window.__mixpanel_telemetry_enabled === false) {
    return;
  }
  if (!window.__mixpanel_initialized) {
    initMixpanel();
    return;
  }
  mixpanel.track(eventName, props);
}

export function trackEvent(event: MixpanelEvent, props?: MixpanelProps): void {
  track(event, props);
}

export function getDistinctId(): string | undefined {
  if (!canUseMixpanel()) return undefined;
  if (typeof window !== 'undefined' && window.__mixpanel_telemetry_enabled === false) {
    return undefined;
  }
  if (!window.__mixpanel_initialized) {
    initMixpanel();
    return undefined;
  }
  if (!window.__mixpanel_initialized) return undefined;
  return mixpanel.get_distinct_id();
}

export function identifyAnonymous(): void {
  if (!canUseMixpanel()) return;
  if (typeof window !== 'undefined' && window.__mixpanel_telemetry_enabled === false) {
    return;
  }
  if (!window.__mixpanel_initialized) {
    initMixpanel();
    return;
  }
  mixpanel.identify(mixpanel.get_distinct_id());
}

export function resetTelemetryCache(): void {
  trackingCheckPromise = null;
  if (typeof window !== 'undefined') {
    delete window.__mixpanel_telemetry_enabled;
  }
}

export function setTelemetryEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    window.__mixpanel_telemetry_enabled = enabled;
  }
  trackingCheckPromise = null;
  if (enabled && !window?.__mixpanel_initialized) {
    initMixpanel();
  }
}

export default {
  initMixpanel,
  track,
  trackEvent,
  getDistinctId,
  identifyAnonymous,
  resetTelemetryCache,
  setTelemetryEnabled,
};

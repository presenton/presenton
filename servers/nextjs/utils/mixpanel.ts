'use client';

import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = 'd726e8bea8ec147f4c7720060cb2e6d1';

export enum MixpanelEvent {
  PageView = 'Page View',
  Navigation = 'Navigation',

  Onboarding_Providers_Models_Selected = 'Onboarding Providers Models Selected',
  Onboarding_Configuration_Saved = 'Onboarding Configuration Saved',
  Onboarding_Completed = 'Onboarding Completed',
  Onboarding_Step_Viewed = 'Onboarding Step Viewed',
  Onboarding_Step_Continued = 'Onboarding Step Continued',
  Onboarding_Back_Clicked = 'Onboarding Back Clicked',
  Onboarding_Validation_Failed = 'Onboarding Validation Failed',
  Onboarding_Text_Provider_Tab_Selected = 'Onboarding Text Provider Tab Selected',
  Onboarding_Text_Provider_Selected = 'Onboarding Text Provider Selected',
  Onboarding_Text_Model_Selected = 'Onboarding Text Model Selected',
  Onboarding_Image_Generation_Toggled = 'Onboarding Image Generation Toggled',
  Onboarding_Image_Provider_Selected = 'Onboarding Image Provider Selected',
  Onboarding_Image_Quality_Selected = 'Onboarding Image Quality Selected',
  Onboarding_Web_Search_Toggled = 'Onboarding Web Search Toggled',
  Onboarding_Web_Search_Provider_Selected = 'Onboarding Web Search Provider Selected',
  Onboarding_Video_Narration_Toggled = 'Onboarding Video Narration Toggled',
  Onboarding_Video_Narration_Provider_Selected = 'Onboarding Video Narration Provider Selected',

  Provider_Login_Clicked = 'Provider Login Clicked',
  Provider_Connection_Completed = 'Provider Connection Completed',
  Provider_Logout_Clicked = 'Provider Logout Clicked',
  Provider_Connection_Deleted = 'Provider Connection Deleted',

  Codex_SignIn_API_Call = 'Codex Sign In API Call',
  Codex_SignIn_Completed = 'Codex Sign In Completed',
  Codex_SignIn_Failed = 'Codex Sign In Failed',
  Codex_SignIn_Cancelled = 'Codex Sign In Cancelled',
  Codex_Signed_Out = 'Codex Signed Out',
  Codex_Reauth_Required = 'Codex Reauth Required',

  Auth_Gate_Viewed = 'Auth Gate Viewed',
  Auth_Status_Checked = 'Auth Status Checked',
  Auth_Unauthorized_Redirect = 'Auth Unauthorized Redirect',
  Auth_Validation_Failed = 'Auth Validation Failed',
  Auth_Setup_Started = 'Auth Setup Started',
  Auth_Setup_Completed = 'Auth Setup Completed',
  Auth_Setup_Failed = 'Auth Setup Failed',
  Auth_SignIn_Started = 'Auth Sign In Started',
  Auth_SignIn_Completed = 'Auth Sign In Completed',
  Auth_SignIn_Failed = 'Auth Sign In Failed',
  Auth_SignOut_Started = 'Auth Sign Out Started',
  Auth_Signed_Out = 'Auth Signed Out',
  Auth_SignOut_Failed = 'Auth Sign Out Failed',
  Auth_Admin_Viewed = 'Auth Admin Viewed',
  Auth_Admin_User_List_Loaded = 'Auth Admin User List Loaded',
  Auth_Admin_User_List_Failed = 'Auth Admin User List Failed',
  Auth_Admin_User_Create_Started = 'Auth Admin User Create Started',
  Auth_Admin_User_Create_Completed = 'Auth Admin User Create Completed',
  Auth_Admin_User_Create_Failed = 'Auth Admin User Create Failed',
  Auth_Admin_User_Password_Reset_Started = 'Auth Admin User Password Reset Started',
  Auth_Admin_User_Password_Reset_Completed = 'Auth Admin User Password Reset Completed',
  Auth_Admin_User_Password_Reset_Failed = 'Auth Admin User Password Reset Failed',
  Auth_Admin_User_Delete_Started = 'Auth Admin User Delete Started',
  Auth_Admin_User_Delete_Completed = 'Auth Admin User Delete Completed',
  Auth_Admin_User_Delete_Failed = 'Auth Admin User Delete Failed',
  Auth_Admin_API_Key_List_Loaded = 'Auth Admin API Key List Loaded',
  Auth_Admin_API_Key_List_Failed = 'Auth Admin API Key List Failed',
  Auth_Admin_API_Key_Create_Started = 'Auth Admin API Key Create Started',
  Auth_Admin_API_Key_Create_Completed = 'Auth Admin API Key Create Completed',
  Auth_Admin_API_Key_Create_Failed = 'Auth Admin API Key Create Failed',
  Auth_Admin_API_Key_Revoke_Started = 'Auth Admin API Key Revoke Started',
  Auth_Admin_API_Key_Revoke_Completed = 'Auth Admin API Key Revoke Completed',
  Auth_Admin_API_Key_Revoke_Failed = 'Auth Admin API Key Revoke Failed',

  Upload_Configuration_Invalid = 'Upload Configuration Invalid',
  Upload_Generation_Started = 'Upload Generation Started',
  Upload_Documents_Processed = 'Upload Documents Processed',
  Upload_Outline_Generation_Requested = 'Upload Outline Generation Requested',
  Outline_Presentation_Generation_Started = 'Outline Presentation Generation Started',

  Smart_Mode_Selected = 'Smart Mode Selected',
  Smart_Mode_Generation_Started = 'Smart Mode Generation Started',
  Smart_Mode_Generation_Completed = 'Smart Mode Generation Completed',
  Smart_Mode_Generation_Failed = 'Smart Mode Generation Failed',
  Smart_Mode_Select_Edit_Toggled = 'Smart Mode Select Edit Toggled',
  Smart_Mode_Element_Selected = 'Smart Mode Element Selected',

  Presentation_Editor_Viewed = 'Presentation Editor Viewed',
  Presentation_Mode_Entered = 'Presentation Mode Entered',
  Presentation_Title_Updated = 'Presentation Title Updated',
  Presentation_Slides_Reordered = 'Presentation Slides Reordered',
  Presentation_Slide_Added = 'Presentation Slide Added',
  Presentation_Slide_Deleted = 'Presentation Slide Deleted',
  Presentation_Theme_Changed = 'Presentation Theme Changed',
  Presentation_Theme_Reset = 'Presentation Theme Reset',
  Presentation_Export_Started = 'Presentation Export Started',
  Presentation_Export_Completed = 'Presentation Export Completed',
  Presentation_Export_Failed = 'Presentation Export Failed',
  Presentation_Regenerated = 'Presentation Regenerated',

  Presentation_Stream_API_Call = 'Presentation Stream API Call',
  TemplatePreview_Delete_Templates_Button_Clicked = 'Template Preview Delete Templates Button Clicked',
  TemplatePreview_Delete_Templates_API_Call = 'Template Preview Delete Templates API Call',
  PdfMaker_Retry_Button_Clicked = 'PDF Maker Retry Button Clicked',
  DocumentsPreview_Create_Presentation_API_Call = 'Documents Preview Create Presentation API Call',
  Settings_SaveConfiguration_Button_Clicked = 'Settings Save Configuration Button Clicked',
  Settings_SaveConfiguration_API_Call = 'Settings Save Configuration API Call',
  Settings_Section_Entered = 'Settings Section Entered',
  Settings_Tab_Switched = 'Settings Tab Switched',
  Settings_Provider_Selected = 'Settings Provider Selected',
  Settings_Model_Selected = 'Settings Model Selected',
  Usage_Analytics_Disabled = 'Usage Analytics Disabled',
  PresentationPage_Refresh_Page_Button_Clicked = 'Presentation Page Refresh Page Button Clicked',
  ImageEditor_GetPreviousGeneratedImages_API_Call = 'Image Editor Get Previous Generated Images API Call',
  ImageEditor_GenerateImage_API_Call = 'Image Editor Generate Image API Call',
  ImageEditor_UploadImage_API_Call = 'Image Editor Upload Image API Call',

  AI_Assistant_Opened = 'AI Assistant Opened',
  AI_Assistant_Prompt_Submitted = 'AI Assistant Prompt Submitted',
  AI_Assistant_Prompt_Completed = 'AI Assistant Prompt Completed',
  AI_Assistant_Prompt_Failed = 'AI Assistant Prompt Failed',
  AI_Assistant_Prompt_Stopped = 'AI Assistant Prompt Stopped',
  AI_Assistant_Chat_Reset = 'AI Assistant Chat Reset',
  AI_Assistant_Attachment_Added = 'AI Assistant Attachment Added',
  AI_Assistant_Attachment_Failed = 'AI Assistant Attachment Failed',

  TemplateV2_Template_Selected = 'Template V2 Template Selected',
  TemplateV2_Outline_Regeneration_Started = 'Template V2 Outline Regeneration Started',
  TemplateV2_Outline_Regeneration_Completed = 'Template V2 Outline Regeneration Completed',
  TemplateV2_Outline_Regeneration_Failed = 'Template V2 Outline Regeneration Failed',
  TemplateV2_Prepare_Completed = 'Template V2 Prepare Completed',
  TemplateV2_Prepare_Failed = 'Template V2 Prepare Failed',
  TemplateV2_Stream_Completed = 'Template V2 Stream Completed',
  TemplateV2_Stream_Failed = 'Template V2 Stream Failed',
  TemplateV2_Editor_Loaded = 'Template V2 Editor Loaded',

  Editor_Side_Panel_Tab_Selected = 'Editor Side Panel Tab Selected',
  Editor_Insert_Palette_Item_Selected = 'Editor Insert Palette Item Selected',
  Editor_Template_Block_Inserted = 'Editor Template Block Inserted',
  Editor_Template_Blocks_Loaded = 'Editor Template Blocks Loaded',
  Editor_Template_Blocks_Load_Failed = 'Editor Template Blocks Load Failed',
  Editor_Element_Text_Edited = 'Editor Element Text Edited',
  Editor_Element_Style_Changed = 'Editor Element Style Changed',
  Editor_Element_Deleted = 'Editor Element Deleted',
  Editor_Element_Duplicated = 'Editor Element Duplicated',
  Editor_Component_Ungrouped = 'Editor Component Ungrouped',
  Editor_Component_Layer_Changed = 'Editor Component Layer Changed',
  Editor_Image_Replaced = 'Editor Image Replaced',
  Editor_Image_Replace_Failed = 'Editor Image Replace Failed',
  Editor_Icon_Replaced = 'Editor Icon Replaced',

  Dashboard_Page_Viewed = 'Dashboard Page Viewed',
  Dashboard_New_Presentation_Clicked = 'Dashboard New Presentation Clicked',
  Dashboard_Blank_Presentation_Created = 'Dashboard Blank Presentation Created',
  Dashboard_Blank_Presentation_Create_Failed = 'Dashboard Blank Presentation Create Failed',
  Dashboard_Presentation_Opened = 'Dashboard Presentation Opened',
  Dashboard_Presentation_Deleted = 'Dashboard Presentation Deleted',
  Dashboard_Presentation_Duplicated = 'Dashboard Presentation Duplicated',

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
  CustomTemplate_Creation_Failed = 'Custom Template Generation Failed',
  CustomTemplate_Font_Check_Completed = 'Custom Template Font Check Completed',
  CustomTemplate_Font_Check_Failed = 'Custom Template Font Check Failed',
  CustomTemplate_Preview_Started = 'Custom Template Preview Started',
  CustomTemplate_Preview_Completed = 'Custom Template Preview Completed',
  CustomTemplate_Preview_Failed = 'Custom Template Preview Failed',
  CustomTemplate_Slide_Generation_Started = 'Custom Template Slide Generation Started',
  CustomTemplate_Slide_Generation_Completed = 'Custom Template Slide Generation Completed',
  CustomTemplate_Slide_Generation_Failed = 'Custom Template Slide Generation Failed',
  CustomTemplate_Blocks_Generation_Completed = 'Custom Template Blocks Generation Completed',
  CustomTemplate_Blocks_Generation_Failed = 'Custom Template Blocks Generation Failed',
  TemplatePreview_Loaded = 'Template Preview Loaded',
  TemplatePreview_Failed = 'Template Preview Failed',
  TemplatePreview_Not_Found = 'Template Preview Not Found',
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
        if (!res.ok) throw new Error(`telemetry-status returned ${res.status}`);
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
    initializeMixpanelNow();
  });
}

function initializeMixpanelNow(): void {
  if (window.__mixpanel_initialized) return;
  mixpanel.init(MIXPANEL_TOKEN as string, {
    track_pageview: false,
    autocapture: false,
    api_host: 'https://api-eu.mixpanel.com',
    record_sessions_percent: 100,
    record_mask_text_selector: '',
    record_block_selector: '',
    record_collect_fonts: true,
    record_canvas: true,
  });
  const appVersion = window.env?.APP_VERSION;
  if (appVersion) {
    mixpanel.register({ app_version: appVersion });
  }
  mixpanel.identify(mixpanel.get_distinct_id());
  window.__mixpanel_initialized = true;
}

export function track(eventName: string, props?: Record<string, unknown>): void {
  if (!canUseMixpanel()) return;
  if (typeof window !== 'undefined' && window.__mixpanel_telemetry_enabled === false) {
    return;
  }
  if (!window.__mixpanel_initialized) {
    void ensureTelemetryStatus().then((enabled) => {
      if (!enabled) return;
      initializeMixpanelNow();
      mixpanel.track(eventName, props);
    });
    return;
  }
  mixpanel.track(eventName, props);
}

export function trackEvent(event: MixpanelEvent, props?: MixpanelProps): void {
  track(event, props);
}

/**
 * Sends an event at a navigation/download boundary without leaving it in the
 * normal request batch. Await this before triggering the boundary action.
 */
export async function trackEventImmediately(
  event: MixpanelEvent,
  props?: MixpanelProps
): Promise<void> {
  if (!canUseMixpanel()) return;
  const enabled = await ensureTelemetryStatus();
  if (!enabled) return;
  initializeMixpanelNow();
  mixpanel.track(event, props, { transport: 'sendBeacon' });
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
  trackEventImmediately,
  getDistinctId,
  identifyAnonymous,
  resetTelemetryCache,
  setTelemetryEnabled,
};

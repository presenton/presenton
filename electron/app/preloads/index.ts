import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('env', {
  NEXT_PUBLIC_FAST_API: process.env.NEXT_PUBLIC_FAST_API || '',
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || '',
  TEMP_DIRECTORY: process.env.TEMP_DIRECTORY || '',
  NEXT_PUBLIC_USER_CONFIG_PATH: process.env.NEXT_PUBLIC_USER_CONFIG_PATH || '',
  APP_VERSION: process.env.APP_VERSION || '',
  DISABLE_AUTH: process.env.DISABLE_AUTH || '',
});


contextBridge.exposeInMainWorld('electron', {
  fileDownloaded: (filePath: string) => ipcRenderer.invoke("file-downloaded", filePath),
  exportPresentation: (id: string, title: string, format: "pptx" | "pdf") =>
    ipcRenderer.invoke("export-presentation", id, title, format),
  getUserConfig: () => ipcRenderer.invoke("get-user-config"),
  setUserConfig: (userConfig: UserConfig) => ipcRenderer.invoke("set-user-config", userConfig),
  getCanChangeKeys: () => ipcRenderer.invoke("get-can-change-keys"),
  readFile: (filePath: string) => ipcRenderer.invoke("read-file", filePath),
  getSlideMetadata: (url: string, theme: string, customColors?: any, tempDirectory?: string) =>
    ipcRenderer.invoke("get-slide-metadata", url, theme, customColors, tempDirectory),
  getFooter: (userId: string) => ipcRenderer.invoke("get-footer", userId),
  setFooter: (userId: string, properties: any) => ipcRenderer.invoke("set-footer", userId, properties),
  getTheme: (userId: string) => ipcRenderer.invoke("get-theme", userId),
  setTheme: (userId: string, themeData: any) => ipcRenderer.invoke("set-theme", userId, themeData),
  uploadImage: (file: Buffer) => ipcRenderer.invoke("upload-image", file),
  writeNextjsLog: (logData: string) => ipcRenderer.invoke("write-nextjs-log", logData),
  clearNextjsLogs: () => ipcRenderer.invoke("clear-nextjs-logs"),
  // API handlers
  hasRequiredKey: () => ipcRenderer.invoke("api:has-required-key"),
  telemetryStatus: () => ipcRenderer.invoke("api:telemetry-status"),
  getTemplates: () => ipcRenderer.invoke("api:templates"),
});

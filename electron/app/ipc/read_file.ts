import { ipcMain } from "electron";
import { readReadableLocalFile } from "../utils/readable-file-access";

export function setupReadFile() {
  ipcMain.handle("read-file", async (_, filePath: unknown) => {
    try {
      const content = readReadableLocalFile(filePath);
      return { content };
    } catch (error) {
      console.error("Error reading file:", error);
      throw error;
    }
  });
}

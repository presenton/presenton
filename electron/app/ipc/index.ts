import { setupExportHandlers } from "./export_handlers";
import { setupReadFile } from "./read_file";

export function setupIpcHandlers() {
  setupExportHandlers();
  setupReadFile();
}

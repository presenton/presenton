import path from "path";
import { resourceBaseDir } from "./constants";

export function getLiteParseRunnerPath(): string {
  return path.join(resourceBaseDir, "resources", "document-extraction", "liteparse_runner.mjs");
}

import path from "path";
import { baseDir, getUserConfigPath, isDev } from "./constants";
import {
  readUserConfigFile,
  updateUserConfigFile,
} from "./user-config-store";

type UserConfigEnvironment = Record<string, string | undefined>;

type SharedUserConfigEnv = {
  buildUserConfigFromEnv: (
    existingConfig: UserConfig,
    env: UserConfigEnvironment,
  ) => UserConfig;
  readUserConfigEnv: (env: UserConfigEnvironment) => UserConfig;
};

function loadSharedUserConfigEnv(): SharedUserConfigEnv {
  const modulePath = isDev
    ? path.resolve(baseDir, "..", "scripts", "user-config-env.cjs")
    : path.join(process.resourcesPath, "user-config-env.cjs");
  return require(modulePath) as SharedUserConfigEnv;
}

const sharedUserConfigEnv = loadSharedUserConfigEnv();

/** Seed Electron's user config with the same normalization used by Docker. */
export function syncUserConfigFromEnv(): void {
  const userConfigPath = getUserConfigPath();
  const existingConfig = readUserConfigFile<UserConfig>(userConfigPath);
  const envConfig = sharedUserConfigEnv.readUserConfigEnv(process.env);

  // Preserve an existing UI-managed config when no configuration was supplied
  // through the Electron process environment, matching start.js.
  if (
    Object.keys(existingConfig).length > 0 &&
    Object.keys(envConfig).length === 0
  ) {
    return;
  }

  updateUserConfigFile<UserConfig>(userConfigPath, (currentConfig) =>
    sharedUserConfigEnv.buildUserConfigFromEnv(currentConfig, process.env)
  );
}

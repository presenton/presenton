import net from 'net'
import treeKill from 'tree-kill'
import { getTempDir, getUserConfigPath, localhost } from './constants'
import { readUserConfigFile, updateUserConfigFile } from './user-config-store'

export function setUserConfig(userConfig: UserConfig) {
  const userConfigPath = getUserConfigPath()
  updateUserConfigFile<UserConfig>(userConfigPath, (existingConfig) => {
    const definedIncomingEntries = Object.entries(userConfig).filter(([, value]) => value !== undefined)
    return {
      ...existingConfig,
      ...Object.fromEntries(definedIncomingEntries),
      CODEX_ACCESS_TOKEN: existingConfig.CODEX_ACCESS_TOKEN,
      CODEX_REFRESH_TOKEN: existingConfig.CODEX_REFRESH_TOKEN,
      CODEX_TOKEN_EXPIRES: existingConfig.CODEX_TOKEN_EXPIRES,
      CODEX_ACCOUNT_ID: existingConfig.CODEX_ACCOUNT_ID,
    }
  })
}

export function getUserConfig(): UserConfig {
  const userConfigPath = getUserConfigPath()
  return readUserConfigFile<UserConfig>(userConfigPath)
}

export function setupEnv(fastApiPort: number, nextjsPort: number) {
  const { app } = require('electron');
  process.env.APP_VERSION = app.getVersion();
  process.env.SENTRY_RELEASE = process.env.SENTRY_RELEASE || `presenton-electron@${process.env.APP_VERSION}`;
  process.env.SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || (app.isPackaged ? 'production' : 'development');
  const tempDir = getTempDir();
  const userConfigPath = getUserConfigPath();
  process.env.NEXT_PUBLIC_FAST_API = `${localhost}:${fastApiPort}`;
  process.env.TEMP_DIRECTORY = tempDir;
  process.env.NEXT_PUBLIC_USER_CONFIG_PATH = userConfigPath;
  process.env.NEXT_PUBLIC_URL = `${localhost}:${nextjsPort}`;
  
  // Set environment variables for NextJS API routes
  process.env.USER_CONFIG_PATH = userConfigPath;
  // Read CAN_CHANGE_KEYS from existing env or default to true
  if (process.env.CAN_CHANGE_KEYS === undefined) {
    process.env.CAN_CHANGE_KEYS = "true";
  }
}


export function killProcess(pid: number, signal: NodeJS.Signals = "SIGTERM") {
  return new Promise((resolve, reject) => {
    treeKill(pid, signal, (err: any) => {
      if (err) {
        console.error(`Error killing process ${pid}:`, err)
        reject(err)
      } else {
        console.log(`Process ${pid} killed (${signal})`)
        resolve(true)
      }
    })
  })
}

export async function findUnusedPorts(startPort: number = 40000, count: number = 2): Promise<number[]> {
  const ports: number[] = [];
  console.log(`Finding ${count} unused ports starting from ${startPort}`);

  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  };

  let currentPort = startPort;
  while (ports.length < count) {
    if (await isPortAvailable(currentPort)) {
      ports.push(currentPort);
    }
    currentPort++;
  }

  return ports;
}


export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}

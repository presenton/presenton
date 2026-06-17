import fs from "fs";

export function getFastApiBaseUrl(): string {
  const internal = process.env.FAST_API_INTERNAL_URL?.trim();
  if (internal) {
    return internal.replace(/\/+$/, "");
  }
  const configured = process.env.NEXT_PUBLIC_FAST_API?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8000";
}

/**
 * Auth headers for same-host FastAPI calls from Next.js route handlers.
 * Uses AUTH_USERNAME/AUTH_PASSWORD env (docker-compose) when set.
 */
export function getFastApiAuthHeaders(): Record<string, string> {
  const user = process.env.AUTH_USERNAME?.trim();
  const pass = process.env.AUTH_PASSWORD?.trim();
  if (user && pass) {
    const encoded = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  const configPath = process.env.USER_CONFIG_PATH?.trim();
  if (!configPath) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(raw) as {
      AUTH_USERNAME?: string;
      AUTH_PASSWORD?: string;
    };
    const configUser = config.AUTH_USERNAME?.trim();
    const configPass = config.AUTH_PASSWORD?.trim();
    if (configUser && configPass) {
      const encoded = Buffer.from(`${configUser}:${configPass}`, "utf8").toString(
        "base64",
      );
      return { Authorization: `Basic ${encoded}` };
    }
  } catch {
    // Best effort only.
  }

  return {};
}

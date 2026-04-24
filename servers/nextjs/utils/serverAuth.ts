import { headers } from "next/headers";
import { redirect } from "next/navigation";

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
};

/**
 * Resolves the FastAPI base used from Next server components (same as start.js).
 */
function getServerFastApiBase(): string {
  const internal = process.env.FAST_API_INTERNAL_URL?.trim();
  if (internal) {
    return internal.replace(/\/+$/, "");
  }
  const fromEnv = process.env.NEXT_PUBLIC_FAST_API?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000";
  }
  return "http://127.0.0.1:8000";
}

/**
 * Calls the same /api/v1/auth/status as the browser, using the incoming request cookies.
 * Used by server layouts so 404/unknown routes are not conflated with unauthenticated access
 * (the layout only runs for routes that exist and sit under the layout’s segment).
 */
export async function getServerAuthStatus(): Promise<AuthStatus> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  try {
    const response = await fetch(`${getServerFastApiBase()}/api/v1/auth/status`, {
      method: "GET",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        configured: true,
        authenticated: false,
        username: null,
      };
    }
    const data = (await response.json()) as Partial<AuthStatus>;
    return {
      configured: Boolean(data.configured),
      authenticated: Boolean(data.authenticated),
      username: data.username ?? null,
    };
  } catch {
    return {
      configured: true,
      authenticated: false,
      username: null,
    };
  }
}

/**
 * If credentials are not configured yet, send the user to `/` (setup in AuthGate).
 * If configured but not signed in, send to login with a query flag the client turns into a toast.
 */
export async function requireAppSession() {
  const s = await getServerAuthStatus();
  if (!s.configured) {
    redirect("/");
  }
  if (!s.authenticated) {
    redirect("/?reason=unauthorized");
  }
}

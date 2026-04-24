import type { ReactNode } from "react";

import { requireAppSession } from "@/utils/serverAuth";

/**
 * /schema is outside the (presentation-generator) group; same session gate as the main app.
 */
export default async function SchemaLayout({ children }: { children: ReactNode }) {
  await requireAppSession();
  return <>{children}</>;
}

"use client";

import { DirectionProvider as RadixDirectionProvider } from "@radix-ui/react-direction";
import type { ReactNode } from "react";

/**
 * Radix primitives (Tabs, Select, DropdownMenu, Popover, …) default to `ltr`
 * unless a DirectionProvider is present. Without this wrapper an RTL page
 * renders RTL chrome but every Radix subtree — including tab panels, tables
 * and forms inside them — falls back to LTR.
 */
export function AppDirectionProvider({
  dir,
  children,
}: {
  dir: "ltr" | "rtl";
  children: ReactNode;
}) {
  return (
    <RadixDirectionProvider dir={dir}>{children}</RadixDirectionProvider>
  );
}

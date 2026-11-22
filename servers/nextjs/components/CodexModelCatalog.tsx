"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { getApiErrorMessage, getApiUrl } from "@/utils/api";
import { parseCodexModelCatalog, type CodexModel } from "@/utils/codexModels";

interface CatalogState {
  status: "idle" | "loading" | "ready" | "error";
  models: CodexModel[];
  error: string | null;
}

interface CatalogContext extends CatalogState {
  connected: boolean;
  updateConnection: (authenticated: boolean, accountId?: string | null) => void;
  refresh: () => void;
}

const INITIAL_STATE: CatalogState = { status: "idle", models: [], error: null };
const CodexCatalogContext = createContext<CatalogContext | null>(null);

/** A mounted settings/onboarding view owns this state; it is never persisted or shared between accounts. */
export function CodexModelCatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CatalogState>(INITIAL_STATE);
  const [connection, setConnection] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const connectionRef = useRef<string | null>(null);
  const sequence = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const cancelRequest = useCallback(() => {
    sequence.current += 1;
    controllerRef.current?.abort();
  }, []);

  const updateConnection = useCallback((authenticated: boolean, accountId?: string | null) => {
    const next = authenticated ? accountId || "authenticated" : null;
    if (connectionRef.current === next) return;
    connectionRef.current = next;
    cancelRequest();
    setState(INITIAL_STATE);
    setConnection(next);
  }, [cancelRequest]);

  const refresh = useCallback(() => {
    if (!connectionRef.current) return;
    cancelRequest();
    setReload((value) => value + 1);
  }, [cancelRequest]);

  useEffect(() => {
    if (!connection) return;
    const controller = new AbortController();
    const requestSequence = ++sequence.current;
    controllerRef.current = controller;
    setState((previous) => ({ ...previous, status: "loading", error: null }));

    const current = () => !controller.signal.aborted &&
      sequence.current === requestSequence && connectionRef.current === connection;

    void fetch(getApiUrl("/api/v1/admin/codex/models"), {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to load ChatGPT models."));
      }
      return parseCodexModelCatalog(await response.json());
    }).then((catalog) => {
      if (current()) setState({ status: "ready", models: catalog.models, error: null });
    }).catch((error: unknown) => {
      if (!current()) return;
      setState((previous) => ({
        ...previous,
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load ChatGPT models.",
      }));
    });

    return () => {
      controller.abort();
      sequence.current += 1;
    };
  }, [connection, reload]);

  const value = useMemo(() => ({
    ...state, connected: connection !== null, updateConnection, refresh,
  }), [state, connection, updateConnection, refresh]);

  return <CodexCatalogContext.Provider value={value}>{children}</CodexCatalogContext.Provider>;
}

export function useCodexModels(): CatalogContext {
  const catalog = useContext(CodexCatalogContext);
  if (!catalog) throw new Error("Codex model controls require CodexModelCatalogProvider.");
  return catalog;
}

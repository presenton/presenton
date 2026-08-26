'use client';

import { useEffect, useState } from 'react';
import { setCanChangeKeys, setLLMConfig } from '@/store/slices/userConfig';
import { hasValidLLMConfig, normalizeLLMConfig } from '@/utils/storeHelpers';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { isOllamaModelAvailable } from '@/utils/providerUtils';
import { LLMConfig } from '@/types/llm_config';
import {
  assertBackendReachable,
  getApiUrl,
  isBackendConnectionError,
} from '@/utils/api';
import { notify } from '@/components/ui/sonner';
import { PRESENTON_SPLASH_MIN_DURATION_MS } from '@/components/ui/presenton-splash-loader';

function ConfigurationLoadingScreen() {
  return (
    <main
      aria-busy="true"
      className="fixed inset-0 z-[2147483000] flex items-center justify-center overflow-hidden bg-white"
      role="status"
    >
      <div className="flex flex-col items-center gap-7 whitespace-nowrap text-center">
        <div aria-hidden="true" className="configuration-loader" />
        <p className="font-syne text-[18px] font-normal leading-normal tracking-[-0.54px] text-[#191919]">
          Loading Presenton...
        </p>
      </div>

      {/* <div className="absolute left-1/2 top-[calc(50%+123.47px)] flex h-[42px] w-[352px] max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-1 rounded-md bg-[#F5F8FF] px-[14px]">
        <Image
          alt=""
          aria-hidden="true"
          className="h-[14px] w-[14px] shrink-0"
          height={14}
          src="/figma-assets/configuration-status-icon.svg"
          width={14}
        />
        <p className="whitespace-nowrap font-manrope text-[14px] font-medium leading-normal tracking-[0.3px] text-[#6172F3]">
          Checking &amp; configuring application assets.
        </p>
      </div> */}
    </main>
  );
}

export function ConfigurationInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  const route = usePathname();
  const shouldShowStartupSplash = !route?.startsWith("/pdf-maker");
  const isSettingsRoute =
    route === "/settings" || route?.startsWith("/settings/");
  const [isLoading, setIsLoading] = useState(
    () => shouldShowStartupSplash
  );
  const [hasMetSplashDuration, setHasMetSplashDuration] = useState(
    () => !shouldShowStartupSplash
  );
  const router = useRouter();

  // Fetch user config state
  useEffect(() => {
    fetchUserConfigState();
    // Configuration bootstrap runs once. Presenton is revalidated separately
    // below whenever the user navigates to another application route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      route === '/' ||
      isSettingsRoute ||
      route.startsWith('/pdf-maker')
    ) {
      return;
    }

    let cancelled = false;
    let selectedProvider: string | undefined;
    const revalidateProviderConfiguration = async () => {
      try {
        const configResponse = await fetch('/api/user-config', {
          cache: 'no-store',
        });
        if (!configResponse.ok) {
          await assertBackendReachable();
          throw new Error(`user-config returned ${configResponse.status}`);
        }

        const config = normalizeLLMConfig(await configResponse.json());
        selectedProvider = config.LLM;
        dispatch(setLLMConfig(config));

        if (!hasValidLLMConfig(config)) {
          if (!cancelled) {
            notify.warning(
              "Provider setup required",
              "Choose and configure a text provider before opening other pages.",
              { id: "provider-setup-required" }
            );
            router.replace('/');
          }
          return;
        }

        if (selectedProvider !== 'presenton') return;

        const statusResponse = await fetch(
          getApiUrl('/api/v1/auth/presenton/status'),
          { cache: 'no-store', credentials: 'include' }
        );
        if (!statusResponse.ok) {
          await assertBackendReachable();
          throw new Error(`Presenton status returned ${statusResponse.status}`);
        }
        const status = await statusResponse.json() as { linked?: boolean };

        if (!cancelled && !status?.linked) {
          dispatch(setLLMConfig({ ...config, LLM: '' }));
          notify.warning(
            "Provider setup required",
            "Presenton Cloud is disconnected. Choose a text provider to continue.",
            { id: "provider-setup-required" }
          );
          router.replace('/');
        }
      } catch (error) {
        console.error('Failed to revalidate provider configuration:', error);
        if (!cancelled && isBackendConnectionError(error)) {
          notify.error(
            "Cannot reach backend",
            error.message,
            { id: "backend-unreachable" }
          );
        } else if (!cancelled && selectedProvider === 'presenton') {
          notify.error(
            "Could not verify Presenton Cloud",
            "Your current page has been kept open. Try again after checking the backend service.",
            { id: "presenton-status-unavailable" }
          );
        } else if (!cancelled) {
          notify.error(
            "Could not verify provider settings",
            "Your current page has been kept open. Refresh after checking the backend service.",
            { id: "configuration-unavailable" }
          );
        }
      }
    };

    void revalidateProviderConfiguration();
    return () => {
      cancelled = true;
    };
  }, [dispatch, isSettingsRoute, route, router]);

  useEffect(() => {
    if (!shouldShowStartupSplash) {
      setHasMetSplashDuration(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setHasMetSplashDuration(true);
    }, PRESENTON_SPLASH_MIN_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [shouldShowStartupSplash]);

  const setLoadingToFalseAfterNavigatingTo = (pathname: string) => {
    if (window.location.pathname === pathname) {
      setIsLoading(false);
      return;
    }

    const interval = setInterval(() => {
      if (window.location.pathname === pathname) {
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 500);
  }

  const fetchUserConfigState = async () => {
    if (route.startsWith("/pdf-maker")) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      await assertBackendReachable();
    } catch (error) {
      console.error('Failed to reach the FastAPI backend:', error);
      notify.error(
        "Cannot reach backend",
        error instanceof Error ? error.message : "Check the backend service and try again.",
        { id: "backend-unreachable" }
      );
      setIsLoading(false);
      return;
    }

    let canChangeKeys = false;
    try {
      const res = await fetch('/api/can-change-keys');
      if (!res.ok) throw new Error(`can-change-keys returned ${res.status}`);
      const data = await res.json();
      canChangeKeys = data.canChange ?? false;
    } catch (e) {
      console.error('Failed to fetch can-change-keys:', e);
      notify.error(
        "Could not load configuration",
        "Your current page has been kept open. Refresh after checking the backend service.",
        { id: "configuration-unavailable" }
      );
      setIsLoading(false);
      return;
    }
    dispatch(setCanChangeKeys(canChangeKeys));

    if (canChangeKeys) {
      let llmConfig: LLMConfig = {};
      try {
        const res = await fetch('/api/user-config');
        if (!res.ok) throw new Error(`user-config returned ${res.status}`);
        llmConfig = await res.json();
      } catch (e) {
        console.error('Failed to fetch user config:', e);
        notify.error(
          "Could not load provider settings",
          "Your current page has been kept open. Refresh after checking the backend service.",
          { id: "configuration-unavailable" }
        );
        setIsLoading(false);
        return;
      }
      llmConfig = normalizeLLMConfig(llmConfig);

      dispatch(setLLMConfig(llmConfig));

      let hasPresentonCloud = false;
      if (llmConfig.LLM === 'presenton') {
        try {
          const response = await fetch(
            getApiUrl('/api/v1/auth/presenton/status'),
            { cache: 'no-store', credentials: 'include' }
          );
          if (!response.ok) {
            await assertBackendReachable();
            throw new Error(`Presenton status returned ${response.status}`);
          }
          const status = await response.json();
          hasPresentonCloud = Boolean(status.linked);
        } catch (error) {
          console.error('Failed to fetch Presenton cloud status:', error);
          const backendUnavailable = isBackendConnectionError(error);
          notify.error(
            backendUnavailable ? "Cannot reach backend" : "Could not verify Presenton Cloud",
            backendUnavailable
              ? error.message
              : "Your current page has been kept open. Refresh after checking the backend service.",
            { id: backendUnavailable ? "backend-unreachable" : "presenton-status-unavailable" }
          );
          setIsLoading(false);
          return;
        }
      }
      const isValid = hasValidLLMConfig(llmConfig) &&
        (llmConfig.LLM !== 'presenton' || hasPresentonCloud);
      if (route.startsWith('/pdf-maker')) {
        setIsLoading(false);
        return;
      }
      if (isValid) {
        // Check if the selected Ollama model is pulled
        if (llmConfig.LLM === 'ollama' && llmConfig.OLLAMA_MODEL) {
          let isAvailable = false;
          try {
            isAvailable = await isOllamaModelAvailable(
              llmConfig.OLLAMA_MODEL,
              llmConfig.OLLAMA_URL
            );
          } catch (error) {
            const backendUnavailable = isBackendConnectionError(error);
            notify.error(
              backendUnavailable ? "Cannot reach backend" : "Could not connect to Ollama",
              error instanceof Error ? error.message : "Check the Ollama URL and try again.",
              { id: backendUnavailable ? "backend-unreachable" : "ollama-unreachable" }
            );
            setIsLoading(false);
            return;
          }
          if (!isAvailable) {
            router.push('/');
            setLoadingToFalseAfterNavigatingTo('/');
            return;
          }
        }
        if (route === '/') {
          router.push('/upload');
          setLoadingToFalseAfterNavigatingTo('/upload');
        } else {
          setIsLoading(false);
        }
      } else if (
        route !== '/' &&
        !(
          isSettingsRoute &&
          (llmConfig.LLM === 'codex' || llmConfig.LLM === 'presenton')
        )
      ) {
        router.push('/');
        setLoadingToFalseAfterNavigatingTo('/');
      } else {
        setIsLoading(false);
      }
    } else {
      try {
        const res = await fetch("/api/runtime-config", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`runtime-config returned ${res.status}`);
        const runtime = await res.json();
        const runtimeConfig = normalizeLLMConfig(
          (runtime.config || {}) as LLMConfig
        );
        dispatch(setLLMConfig(runtimeConfig));
        if (!runtime.configured) {
          notify.error(
            "Instance not configured",
            "Ask the administrator to configure the AI providers in Settings."
          );
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch runtime configuration:", error);
        notify.error(
          "Could not load provider settings",
          "Your current page has been kept open. Refresh after checking the backend service.",
          { id: "configuration-unavailable" }
        );
        setIsLoading(false);
        return;
      }
      if (route === '/') {
        router.push('/upload');
        setLoadingToFalseAfterNavigatingTo('/upload');
      } else {
        setIsLoading(false);
      }
    }
  }

  if (isLoading || !hasMetSplashDuration) {
    return <ConfigurationLoadingScreen />;
  }

  return children;
}

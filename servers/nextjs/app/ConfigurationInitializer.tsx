'use client';

import { useEffect, useState } from 'react';
import { setCanChangeKeys, setLLMConfig } from '@/store/slices/userConfig';
import { hasValidLLMConfig, normalizeLLMConfig } from '@/utils/storeHelpers';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { checkIfSelectedOllamaModelIsPulled } from '@/utils/providerUtils';
import { LLMConfig } from '@/types/llm_config';
import { getApiUrl } from '@/utils/api';

export function ConfigurationInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  const route = usePathname();
  const [isLoading, setIsLoading] = useState(
    () => !route?.startsWith("/pdf-maker")
  );
  const router = useRouter();

  // Fetch user config state
  useEffect(() => {
    fetchUserConfigState();
  }, []);

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

    let canChangeKeys = false;
    try {
      if (window.electron?.getCanChangeKeys) {
        canChangeKeys = await window.electron.getCanChangeKeys();
      } else {
        const res = await fetch('/api/can-change-keys');
        const data = await res.json();
        canChangeKeys = data.canChange ?? false;
      }
    } catch (e) {
      console.error('Failed to fetch can-change-keys:', e);
      canChangeKeys = false;
    }
    dispatch(setCanChangeKeys(canChangeKeys));

    if (canChangeKeys) {
      let llmConfig: LLMConfig = {};
      try {
        if (window.electron?.getUserConfig) {
          llmConfig = await window.electron.getUserConfig();
        } else {
          const res = await fetch('/api/user-config');
          llmConfig = await res.json();
        }
      } catch (e) {
        console.error('Failed to fetch user config:', e);
        llmConfig = {};
      }
      if (!llmConfig.LLM) {
        llmConfig.LLM = 'openai';
      }
      llmConfig = normalizeLLMConfig(llmConfig);

      dispatch(setLLMConfig(llmConfig));

      const isValid = hasValidLLMConfig(llmConfig);
      if (route.startsWith('/pdf-maker')) {
        setIsLoading(false);
        return;
      }
      if (isValid) {
        // Check if the selected Ollama model is pulled
        if (llmConfig.LLM === 'ollama' && llmConfig.OLLAMA_MODEL) {
          const isPulled = await checkIfSelectedOllamaModelIsPulled(llmConfig.OLLAMA_MODEL);
          if (!isPulled) {
            router.push('/');
            setLoadingToFalseAfterNavigatingTo('/');
            return;
          }
        }
        if (llmConfig.LLM === 'custom') {
          const isAvailable = await checkIfSelectedCustomModelIsAvailable(llmConfig);
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
      } else if (route !== '/') {
        router.push('/');
        setLoadingToFalseAfterNavigatingTo('/');
      } else {
        setIsLoading(false);
      }
    } else {
      if (route === '/') {
        router.push('/upload');
        setLoadingToFalseAfterNavigatingTo('/upload');
      } else {
        setIsLoading(false);
      }
    }
  }


  const checkIfSelectedCustomModelIsAvailable = async (llmConfig: LLMConfig) => {
    try {
      const response = await fetch(getApiUrl('/api/v1/ppt/openai/models/available'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: llmConfig.CUSTOM_LLM_URL,
          api_key: llmConfig.CUSTOM_LLM_API_KEY,
        }),
      });
      const data = await response.json();
      return data.includes(llmConfig.CUSTOM_MODEL);
    } catch (error) {
      console.error('Error fetching custom models:', error);
      return false;
    }
  }


  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[#EDEEEF] bg-white p-8 text-center shadow-xl">
            {/* Logo/Branding */}
            <div className="mb-6">
              <img
                src="/Logo.png"
                alt="PresentOn"
                className="mx-auto mb-4 h-12 opacity-90"
              />
              <div className="mx-auto h-1 w-16 rounded-full bg-[#7C51F8]" />
            </div>

            {/* Loading Text */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-800 font-inter">
                Initializing Application
              </h3>
              <p className="text-sm text-gray-600 font-inter">
                Loading configuration and checking model availability...
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="mt-6">
              <div className="flex space-x-1 justify-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

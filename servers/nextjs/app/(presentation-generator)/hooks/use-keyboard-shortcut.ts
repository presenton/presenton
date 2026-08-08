import { useEffect, useCallback } from 'react';

type KeyboardEvent = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  preventDefault: () => void;
};

export const useKeyboardShortcut = (
  keys: string[],
  callback: (e: KeyboardEvent) => void,
  deps: any[] = []
) => {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if ((event as unknown as globalThis.KeyboardEvent).defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();
      const isTemplateV2KonvaShortcut =
        typeof document !== "undefined" &&
        Boolean(document.documentElement.dataset.templateV2KonvaActiveSurface) &&
        (key === "z" || key === "y");
      if (isTemplateV2KonvaShortcut) {
        return;
      }

      const isCtrlPressed = event.ctrlKey;
      
      if (keys.includes(key) && isCtrlPressed) {
        event.preventDefault();
        callback(event);
      }
    },
    [callback, ...deps]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress as any);
    return () => {
      document.removeEventListener('keydown', handleKeyPress as any);
    };
  }, [handleKeyPress]);
}; 

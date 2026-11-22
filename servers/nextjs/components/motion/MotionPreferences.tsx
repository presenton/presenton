"use client";

import { useEffect } from "react";

/** Keep keyboard navigation instant, including content rendered in portals. */
export default function MotionPreferences() {
  useEffect(() => {
    const root = document.documentElement;
    const useKeyboard = () => {
      root.dataset.motionInput = "keyboard";
    };
    const usePointer = () => {
      if (root.dataset.motionInput !== "pointer") {
        root.dataset.motionInput = "pointer";
      }
    };
    const completeEntrance = (event: AnimationEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.matches(".motion-enter, .motion-fade") &&
        (event.animationName === "presenton-content-enter" ||
          event.animationName === "presenton-fade-in")
      ) {
        // A completed entrance must stay complete if input mode changes.
        target.dataset.motionComplete = "true";
      }
    };

    document.addEventListener("keydown", useKeyboard, true);
    document.addEventListener("pointerdown", usePointer, true);
    // Hovering after keyboard use should restore pointer feedback as well.
    document.addEventListener("pointermove", usePointer, { passive: true });
    document.addEventListener("animationend", completeEntrance, true);
    return () => {
      document.removeEventListener("keydown", useKeyboard, true);
      document.removeEventListener("pointerdown", usePointer, true);
      document.removeEventListener("pointermove", usePointer);
      document.removeEventListener("animationend", completeEntrance, true);
      delete root.dataset.motionInput;
    };
  }, []);

  return null;
}

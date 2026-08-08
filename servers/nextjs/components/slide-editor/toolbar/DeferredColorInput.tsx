import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { withoutHash, withHash } from "@/components/slide-editor/utils/color";

type DeferredColorInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "onChange" | "type" | "value"
> & {
  commitDelayMs?: number;
  onCommit: (color: string) => void;
  value: string;
};

function normalizeColorValue(color: string | undefined) {
  const value = withoutHash(color ?? "000000").trim();

  if (/^[0-9A-Fa-f]{6}$/.test(value)) {
    return value.toUpperCase();
  }

  if (/^[0-9A-Fa-f]{3}$/.test(value)) {
    return value
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toUpperCase();
  }

  return "000000";
}

export const DeferredColorInput = forwardRef<
  HTMLInputElement,
  DeferredColorInputProps
>(function DeferredColorInput(
  {
    commitDelayMs = 120,
    onBlur,
    onCommit,
    onKeyUp,
    onMouseUp,
    onTouchEnd,
    value,
    ...props
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialColorRef = useRef<string | null>(null);
  if (initialColorRef.current === null) {
    initialColorRef.current = normalizeColorValue(value);
  }
  const initialColor = initialColorRef.current;
  const committedColorRef = useRef(initialColor);
  const draftColorRef = useRef(initialColor);
  const [draftColor, setDraftColor] = useState(initialColor);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  const clearPendingCommit = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const flushCommit = useCallback(
    (color = draftColorRef.current) => {
      clearPendingCommit();
      const normalizedColor = normalizeColorValue(color);
      if (normalizedColor === committedColorRef.current) return;
      committedColorRef.current = normalizedColor;
      onCommit(normalizedColor);
    },
    [clearPendingCommit, onCommit],
  );

  const scheduleCommit = useCallback(
    (color: string) => {
      clearPendingCommit();
      timerRef.current = setTimeout(() => flushCommit(color), commitDelayMs);
    },
    [clearPendingCommit, commitDelayMs, flushCommit],
  );

  useEffect(() => {
    const nextColor = normalizeColorValue(value);
    committedColorRef.current = nextColor;
    draftColorRef.current = nextColor;
    setDraftColor(nextColor);
  }, [value]);

  useEffect(() => clearPendingCommit, [clearPendingCommit]);

  return (
    <input
      {...props}
      ref={inputRef}
      type="color"
      value={withHash(draftColor)}
      onChange={(event) => {
        const nextColor = normalizeColorValue(event.currentTarget.value);
        draftColorRef.current = nextColor;
        setDraftColor(nextColor);
        scheduleCommit(nextColor);
      }}
      onBlur={(event) => {
        flushCommit();
        onBlur?.(event);
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          flushCommit();
        }
        onKeyUp?.(event);
      }}
      onMouseUp={(event) => {
        flushCommit();
        onMouseUp?.(event);
      }}
      onTouchEnd={(event) => {
        flushCommit();
        onTouchEnd?.(event);
      }}
    />
  );
});

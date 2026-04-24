import { useMemo } from "react";
import { compileCustomLayout, CompiledLayout } from "@/app/hooks/compileLayout";

/**
 * Hook to compile layout code once and memoize the result.
 * This prevents double compilation when both SlideContent and SchemaEditor need the compiled layout.
 */
export function useCompiledLayout(code: string | undefined): CompiledLayout | null {
    return useMemo(() => {
        if (!code) return null;
        try {
            return compileCustomLayout(code);
        } catch (error) {
            console.error("Error compiling layout:", error);
            return null;
        }
    }, [code]);
}


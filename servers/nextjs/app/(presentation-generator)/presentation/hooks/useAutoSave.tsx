'use client'
import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { PresentationGenerationApi } from '../../services/api/presentation-generation';
import { addToHistory } from '@/store/slices/undoRedoSlice';
import type { PresentationData } from '@/store/slices/presentationGeneration';
import type { AutoSaveSnapshot } from '../utils/autoSaveDiff';
import {
    createAutoSaveSnapshot,
    getAutoSaveChanges,
} from '../utils/autoSaveDiff';
import { buildAutoSaveOperations } from '../utils/autoSaveOperations';

interface UseAutoSaveOptions {
    debounceMs?: number;
    enabled?: boolean;
}

export const useAutoSave = ({
    debounceMs = 1000,
    enabled = true,
}: UseAutoSaveOptions = {}) => {
   
    const dispatch = useDispatch();
    const { presentationData, isStreaming, isLoading, isLayoutLoading } = useSelector(
        (state: RootState) => state.presentationGeneration
    );

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const acknowledgedDataRef = useRef<AutoSaveSnapshot | null>(null);
    const latestDataRef = useRef<PresentationData | null>(presentationData);
    const autoSavePausedRef = useRef(true);
    const wasAutoSavePausedRef = useRef(false);
    const pendingSaveRef = useRef(false);
    const saveLatestRef = useRef<(options?: { force?: boolean }) => Promise<void>>(async () => undefined);
    const isSavingRef = useRef(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const autoSavePaused =
        !enabled || isStreaming || isLoading || isLayoutLoading;

    useEffect(() => {
        latestDataRef.current = presentationData;
        autoSavePausedRef.current = autoSavePaused;
    }, [presentationData, autoSavePaused]);

    const saveLatest = useCallback(async (options?: { force?: boolean }) => {
        const data = latestDataRef.current;
        if (!data) return;
        if (!options?.force && autoSavePausedRef.current) return;
        if (isSavingRef.current) {
            pendingSaveRef.current = true;
            return;
        }

        const acknowledged = acknowledgedDataRef.current;
        if (!acknowledged || acknowledged.presentationId !== data.id) {
            acknowledgedDataRef.current = createAutoSaveSnapshot(data);
            return;
        }

        const operations = buildAutoSaveOperations(acknowledged, data);
        if (operations.length === 0) return;
        const baseRevision = acknowledged.revision;
        if (!baseRevision) {
            setSaveError('A saved revision is required. Reload before editing.');
            return;
        }

        try {
            isSavingRef.current = true;
            setIsSaving(true);
            setSaveError(null);
            console.log('🔄 Auto-saving presentation data...');

            const result = await PresentationGenerationApi.submitDocumentOperations(data.id, {
                operationId: crypto.randomUUID(),
                baseRevision,
                operations,
            });
            const next = createAutoSaveSnapshot(data);
            const resulting = Number(result?.resultingRevision);
            next.revision = Number.isFinite(resulting) ? resulting : acknowledged.revision;
            acknowledgedDataRef.current = next;

            console.log('✅ Auto-save successful');
        } catch (error) {
            console.error('❌ Auto-save failed:', error);
            setSaveError(error instanceof Error ? error.message : 'Save failed. Your changes are not saved.');
        } finally {
            isSavingRef.current = false;
            setIsSaving(false);

            if (pendingSaveRef.current && !autoSavePausedRef.current) {
                pendingSaveRef.current = false;
                saveTimeoutRef.current = setTimeout(() => {
                    void saveLatestRef.current();
                }, 250);
            }
        }
    }, []);

    useEffect(() => {
        saveLatestRef.current = saveLatest;
    }, [saveLatest]);

    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            const data = latestDataRef.current;
            const baseline = acknowledgedDataRef.current;
            if (!data || !baseline) return;
            const changes = getAutoSaveChanges(baseline, data);
            if (isSavingRef.current || changes.structuralChange || changes.metadataChanged || changes.changedSlides.length) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, []);

    // Effect to trigger auto-save when presentation data changes
    useEffect(() => {
        if (!presentationData) return;

        if (autoSavePaused) {
            // Changes arriving while editing is paused are server-originated
            // hydration/streaming updates and are already persisted.
            wasAutoSavePausedRef.current = true;
            pendingSaveRef.current = false;
            if (!isSavingRef.current) {
                acknowledgedDataRef.current = createAutoSaveSnapshot(presentationData);
            }
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            return;
        }

        // History is updated immediately from immutable Redux snapshots. It is
        // independent from network debounce, so even the first edit can undo.
        dispatch(addToHistory({
            slides: presentationData.slides,
            actionType: "AUTO_SAVE"
        }));

        if (wasAutoSavePausedRef.current) {
            // The final streaming/loading payload can land in the same render
            // that flips editing back on. Treat that first active snapshot as
            // already persisted instead of issuing slide updates for it.
            wasAutoSavePausedRef.current = false;
            acknowledgedDataRef.current = createAutoSaveSnapshot(presentationData);
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            return;
        }

        if (
            !acknowledgedDataRef.current ||
            acknowledgedDataRef.current.presentationId !== presentationData.id
        ) {
            acknowledgedDataRef.current = createAutoSaveSnapshot(presentationData);
            return;
        }
        
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            void saveLatestRef.current();
        }, debounceMs);
       
        // Cleanup timeout on unmount
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [
        presentationData,
        autoSavePaused,
        debounceMs,
        dispatch,
    ]);
    
    return {
        isSaving,
        saveError,
        retrySave: () => void saveLatestRef.current(),
        flushPendingSave: () => saveLatestRef.current({ force: true }),
    };
};

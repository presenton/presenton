'use client'
import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { PresentationGenerationApi } from '../../services/api/presentation-generation';
import { addToHistory } from '@/store/slices/undoRedoSlice';
import type { PresentationData } from '@/store/slices/presentationGeneration';
import type { Slide } from '../../types/slide';
import type { AutoSaveSnapshot } from '../utils/autoSaveDiff';
import {
    createAutoSaveSnapshot,
    fingerprintValue,
    getAutoSaveChanges,
} from '../utils/autoSaveDiff';

const savedDocumentFromSnapshot = (snapshot: AutoSaveSnapshot) => ({
    id: snapshot.presentationId,
    ...JSON.parse(snapshot.persistedMetadataFingerprint),
    n_slides: snapshot.slideOrder.length,
    slides: snapshot.slideOrder.map(id => JSON.parse(snapshot.slideFingerprints[id])),
});

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
    const saveLatestRef = useRef<() => Promise<void>>(async () => undefined);
    const isSavingRef = useRef(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const autoSavePaused =
        !enabled || isStreaming || isLoading || isLayoutLoading;

    useEffect(() => {
        latestDataRef.current = presentationData;
        autoSavePausedRef.current = autoSavePaused;
    }, [presentationData, autoSavePaused]);

    const saveLatest = useCallback(async () => {
        const data = latestDataRef.current;
        if (!data || autoSavePausedRef.current) return;
        if (isSavingRef.current) {
            pendingSaveRef.current = true;
            return;
        }

        const acknowledged = acknowledgedDataRef.current;
        if (!acknowledged || acknowledged.presentationId !== data.id) {
            acknowledgedDataRef.current = createAutoSaveSnapshot(data);
            return;
        }

        const changes = getAutoSaveChanges(acknowledged, data);
        if (
            !changes.structuralChange &&
            !changes.metadataChanged &&
            changes.changedSlides.length === 0
        ) return;

        try {
            isSavingRef.current = true;
            setIsSaving(true);
            setSaveError(null);
            console.log('🔄 Auto-saving presentation data...');

            if (changes.structuralChange) {
                // Serialize once after the debounce window. The API accepts the
                // serialized body and avoids a second whole-deck stringify.
                await PresentationGenerationApi.updatePresentationContent(
                    JSON.stringify({ ...data, ...(!changes.metadataChanged ? JSON.parse(acknowledged.persistedMetadataFingerprint) : {}), base_document: savedDocumentFromSnapshot(acknowledged) })
                );
                const next = createAutoSaveSnapshot(data);
                next.persistedMetadataFingerprint = changes.metadataChanged ? fingerprintValue({title:data.title,theme:data.theme}) : acknowledged.persistedMetadataFingerprint;
                acknowledgedDataRef.current = next;
            } else {
                let firstError: unknown = null;
                const nextAcknowledged: AutoSaveSnapshot = {
                    ...acknowledged,
                    slideFingerprints: { ...acknowledged.slideFingerprints },
                };

                if (changes.metadataChanged) {
                    try {
                        await PresentationGenerationApi.updatePresentationContent({
                            id: data.id,
                            base_document: savedDocumentFromSnapshot(acknowledged),
                            title: data.title,
                            theme: data.theme,
                        });
                        nextAcknowledged.metadataFingerprint = fingerprintValue({
                            title: data.title,
                            theme: data.theme,
                        });
                        nextAcknowledged.persistedMetadataFingerprint = nextAcknowledged.metadataFingerprint;
                        acknowledgedDataRef.current = nextAcknowledged;
                    } catch (error) {
                        firstError = error;
                    }
                }

                for (const slide of changes.changedSlides) {
                    try {
                        await PresentationGenerationApi.updatePresentationSlide(
                            slide as Slide,
                            JSON.parse(acknowledged.slideFingerprints[slide.id]) as Slide
                        );
                        nextAcknowledged.slideFingerprints[slide.id] =
                            fingerprintValue(slide);
                        acknowledgedDataRef.current = nextAcknowledged;
                    } catch (error) {
                        firstError ??= error;
                    }
                }

                if (firstError) throw firstError;
                const next = createAutoSaveSnapshot(data);
                next.persistedMetadataFingerprint = nextAcknowledged.persistedMetadataFingerprint;
                acknowledgedDataRef.current = next;
            }

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
    };
};

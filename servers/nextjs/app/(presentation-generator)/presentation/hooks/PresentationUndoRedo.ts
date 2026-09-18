import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { redo, undo } from "@/store/slices/undoRedoSlice";
import { useKeyboardShortcut } from "../../hooks/use-keyboard-shortcut";
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";

export const usePresentationUndoRedo = () => {
  const dispatch = useDispatch();
  const undoRedoState = useSelector((state: RootState) => state.undoRedo);
  const { presentationData } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  const canUndo = undoRedoState.past.length > 0;
  const canRedo = undoRedoState.future.length > 0;

  const applySlidesSnapshot = useCallback(
    (slidesSnapshot: unknown) => {
      if (!presentationData || !Array.isArray(slidesSnapshot)) {
        return;
      }

      dispatch(
        setPresentationData({
          ...presentationData,
          slides: slidesSnapshot,
        })
      );
    },
    [dispatch, presentationData]
  );

  const onUndo = useCallback(() => {
    const documentId = (presentationData as { id?: string } | null)?.id;
    const run = async () => {
      if (documentId) {
        try {
          const snapshot = await PresentationGenerationApi.getDocumentSnapshot(documentId);
          const operationId = snapshot?.lastOperationId;
          if (operationId) {
            await PresentationGenerationApi.undoDocumentOperation(documentId, operationId);
            const next = await PresentationGenerationApi.getDocumentSnapshot(documentId);
            dispatch(
              setPresentationData({
                ...(presentationData ?? {}),
                ...(next || {}),
                slides: next?.slides || presentationData?.slides,
                revision: next?.revision,
              } as NonNullable<typeof presentationData>)
            );
            dispatch(undo());
            return;
          }
        } catch (error) {
          console.error("Server undo failed, falling back to local history", error);
        }
      }
      if (!canUndo) return;
      const previousState = undoRedoState.past[undoRedoState.past.length - 1];
      if (!previousState) return;
      dispatch(undo());
      applySlidesSnapshot(previousState.slides);
    };
    void run();
  }, [applySlidesSnapshot, canUndo, dispatch, presentationData, undoRedoState.past]);

  const onRedo = useCallback(() => {
    if (!canRedo) {
      return;
    }

    const nextState = undoRedoState.future[0];
    if (!nextState) {
      return;
    }

    dispatch(redo());
    applySlidesSnapshot(nextState.slides);
  }, [applySlidesSnapshot, canRedo, dispatch, undoRedoState.future]);

  useKeyboardShortcut(
    ["z"],
    (e) => {
      if (e.ctrlKey && !e.shiftKey && (canUndo || (presentationData as { id?: string } | null)?.id)) {
        e.preventDefault();
        onUndo();
      }
    },
    [canUndo, onUndo, presentationData]
  );

  useKeyboardShortcut(
    ["z"],
    (e) => {
      if (e.ctrlKey && e.shiftKey && canRedo) {
        e.preventDefault();
        onRedo();
      }
    },
    [canRedo, onRedo]
  );

  useKeyboardShortcut(
    ["y"],
    (e) => {
      if (e.ctrlKey && canRedo) {
        e.preventDefault();
        onRedo();
      }
    },
    [canRedo, onRedo]
  );

  return { onUndo, onRedo, canUndo, canRedo };
};

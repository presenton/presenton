import { createSlice, original, PayloadAction } from '@reduxjs/toolkit';
import { Slide } from '@/app/(presentation-generator)/types/slide';

interface HistoryState {
  slides: Slide[];
  timestamp: number;
  actionType: string;
}

interface UndoRedoState {
  past: HistoryState[];
  present: HistoryState | null;
  future: HistoryState[];
  maxHistorySize: number;
  isUndoRedoInProgress: boolean;
  pendingHistorySkips: number;
}

const initialState: UndoRedoState = {
  past: [],
  present: null,
  future: [],
  maxHistorySize: 30,
  isUndoRedoInProgress: false,
  pendingHistorySkips: 0,
};

const undoRedoSlice = createSlice({
  name: 'undoRedo',
  initialState,
  reducers: {
    addToHistory: (state, action: PayloadAction<{slides: Slide[], actionType: string}>) => {
      if (state.pendingHistorySkips > 0) {
        state.pendingHistorySkips -= 1;
        if (state.pendingHistorySkips === 0) {
          state.isUndoRedoInProgress = false;
        }
        return;
      }

      // Defensive guard for any stale in-progress state.
      if (state.isUndoRedoInProgress) {
        return;
      }

      // Redux presentation snapshots are immutable. Preserve their structurally
      // shared references instead of cloning/stringifying the complete deck.
      const newSlides = action.payload.slides;

      // Reference equality is sufficient because presentation updates go
      // through Redux Toolkit/Immer and therefore replace changed arrays.
      // It also avoids duplicate entries from explicit pre-operation captures.
      const presentSlides = state.present
        ? original(state.present)?.slides ?? state.present.slides
        : null;
      if (presentSlides === newSlides) {
        return;
      }

      if (!state.present) {
        state.present = {
          slides: newSlides,
          timestamp: Date.now(),
          actionType: action.payload.actionType
        };
        return;
      }

      // Add current state to past
      state.past.push(state.present);

      // Limit history size
      if (state.past.length > state.maxHistorySize) {
        state.past.shift();
      }

      // Clear future on new change
      state.future = [];

      // Set new present
      state.present = {
        slides: newSlides,
        timestamp: Date.now(),
        actionType: action.payload.actionType
      };
    },

    undo: (state) => {
      if (state.past.length === 0) {
        return;
      }

      state.isUndoRedoInProgress = true;
      state.pendingHistorySkips = 1;

      // Move present to future
      if (state.present) {
        state.future.unshift(state.present);
      }

      // Get last past state
      const previous = state.past[state.past.length - 1];
      state.past = state.past.slice(0, -1);
      state.present = previous;
    },

    redo: (state) => {
      if (state.future.length === 0) {
        return;
      }

      state.isUndoRedoInProgress = true;
      state.pendingHistorySkips = 1;

      // Move present to past
      if (state.present) {
        state.past.push(state.present);
      }

      // Get first future state
      const next = state.future[0];
      state.future = state.future.slice(1);
      state.present = next;
    },

    finishUndoRedo: (state) => {
      state.isUndoRedoInProgress = false;
      state.pendingHistorySkips = 0;
    },

    clearHistory: (state) => {
      state.past = [];
      state.future = [];
      state.present = null;
      state.isUndoRedoInProgress = false;
      state.pendingHistorySkips = 0;
    }
  }
});

export const { addToHistory, undo, redo, finishUndoRedo, clearHistory } = undoRedoSlice.actions;
export default undoRedoSlice.reducer;

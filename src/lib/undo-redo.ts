import { useState, useCallback } from 'react';

export interface HistoryState<T> {
  present: T;
  past: T[];
  future: T[];
}

export interface UndoRedoManager<T> {
  state: T;
  canUndo: boolean;
  canRedo: boolean;
  push: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (initialState: T) => void;
  history: HistoryState<T>;
}

export function useUndoRedo<T>(initialState: T): UndoRedoManager<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    present: initialState,
    past: [],
    future: [],
  });

  const push = useCallback((newState: T) => {
    setHistory((h) => ({
      present: newState,
      past: [...h.past, h.present],
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;

      return {
        present: h.past[h.past.length - 1],
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;

      return {
        present: h.future[0],
        past: [...h.past, h.present],
        future: h.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback((initialState: T) => {
    setHistory({
      present: initialState,
      past: [],
      future: [],
    });
  }, []);

  return {
    state: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    push,
    undo,
    redo,
    reset,
    history,
  };
}

// Hook for automatic Ctrl+Z support
export function useUndoRedoWithShortcuts<T>(initialState: T): UndoRedoManager<T> {
  const manager = useUndoRedo(initialState);

  // Note: To use keyboard shortcuts, wrap your app with KeyboardShortcutsProvider
  // and the shortcut handler can call manager.undo() and manager.redo()

  return manager;
}

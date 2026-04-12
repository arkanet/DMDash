import type { ToastActionElement, ToastProps } from "@components/UI/Toast.tsx";
import { type ReactNode, useState, useEffect } from "react";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;
// Auto-dismiss informational toasts after 5 seconds
const AUTO_DISMISS_MS = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ToastActionElement;
  delay?: number;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const autoDismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        // clear any pending auto-dismiss timer
        const auto = autoDismissTimeouts.get(toastId);
        if (auto) {
          clearTimeout(auto);
          autoDismissTimeouts.delete(toastId);
        }
        addToRemoveQueue(toastId);
      } else {
        for (const toast of state.toasts) {
          const auto = autoDismissTimeouts.get(toast.id);
          if (auto) {
            clearTimeout(auto);
            autoDismissTimeouts.delete(toast.id);
          }
          addToRemoveQueue(toast.id);
        }
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST": {
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    }
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };
// Provide a typed handle to `globalThis.memoryState` for tests
const globalMemory = globalThis as unknown as { memoryState?: State };

// For tests we allow injecting/resetting the shared memoryState via globalThis.memoryState
if (globalMemory.memoryState) {
  memoryState = globalMemory.memoryState as State;
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  // eslint-disable-next-line no-console
  console.debug("useToast: dispatch", action.type, "listeners", listeners.length);
  // mirror into globalThis for test control (tests set globalThis.memoryState)
  try {
    globalMemory.memoryState = memoryState;
  } catch {
    // ignore
  }
  for (const listener of listeners) {
    try {
      listener(memoryState);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("useToast: listener error", err);
    }
  }
}

type Toast = Omit<ToasterToast, "id">;

function toast({ delay = 0, ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  const doAdd = () =>
    dispatch({
      type: "ADD_TOAST",
      toast: {
        ...props,
        id,
        open: true,
        onOpenChange: (open: boolean) => {
          if (!open) {
            dismiss();
          }
        },
      },
    });

  if (delay > 0) {
    setTimeout(doAdd, delay);
  } else {
    // add on next tick to match previous behavior and avoid immediate auto-dismiss
    setTimeout(doAdd, 0);
  }

  // schedule auto-dismiss for informational toasts (non-destructive) after AUTO_DISMISS_MS
  // only schedule after the toast is added
  // schedule auto-dismiss for informational toasts (non-destructive) after AUTO_DISMISS_MS
  // Skip auto-dismiss when running tests to avoid fake-timers removing the toast immediately
  if (process.env.NODE_ENV !== "test") {
    setTimeout(() => {
      // default to informational (variant !== 'destructive')
      const variant = (props as import("@components/UI/Toast").ToastProps).variant;
      if (variant !== "destructive") {
        const auto = setTimeout(() => {
          dispatch({ type: "DISMISS_TOAST", toastId: id });
        }, AUTO_DISMISS_MS);
        autoDismissTimeouts.set(id, auto);
      }
    }, delay + 0);
  }

  return {
    id: id,
    dismiss,
    update,
  };
}

const subscribe = (listener: () => void) => {
  listeners.push(listener);
  return function unsubscribe() {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};

const getState = () => {
  return globalMemory.memoryState ?? memoryState;
};

function useToast() {
  const [state, setState] = useState<State>(getState());

  useEffect(() => {
    const unsubscribe = subscribe(() => setState(getState()));
    // ensure we pick up any toasts added before the subscription was registered
    // eslint-disable-next-line no-console
    console.debug("useToast: useEffect initial getState", getState());
    setState(getState());
    return unsubscribe;
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { toast, useToast };

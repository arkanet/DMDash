import { useAppStore } from "@core/stores";
import { useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";

const LONG_PRESS_DURATION_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
let suppressNodeSearchClickUntil = 0;

function isMobileNodeSearchViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function suppressFollowUpClick() {
  suppressNodeSearchClickUntil = Date.now() + 800;
}

function shouldSuppressFollowUpClick() {
  return Date.now() < suppressNodeSearchClickUntil;
}

export function handleNodeSearchContextMenu<T extends HTMLElement>(
  event: MouseEvent<T>,
  requestNodeSearch: (nodeName: string | undefined) => void,
  nodeName: string | undefined,
) {
  if (!isMobileNodeSearchViewport()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (shouldSuppressFollowUpClick()) {
    return;
  }
  requestNodeSearch(nodeName);
}

type NodeSearchLongPressHandlers<T extends HTMLElement> = Pick<
  HTMLAttributes<T>,
  | "onClickCapture"
  | "onContextMenu"
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerLeave"
  | "onPointerMove"
  | "onPointerUp"
  | "onTouchCancel"
  | "onTouchEnd"
  | "onTouchMove"
  | "onTouchStart"
>;

type Point = {
  x: number;
  y: number;
};

function touchPoint<T extends HTMLElement>(event: TouchEvent<T>): Point | undefined {
  const touch = event.touches[0] ?? event.changedTouches[0];

  if (!touch) {
    return undefined;
  }

  return {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function movedBeyondTolerance(start: Point, current: Point) {
  return (
    Math.abs(current.x - start.x) > LONG_PRESS_MOVE_TOLERANCE_PX ||
    Math.abs(current.y - start.y) > LONG_PRESS_MOVE_TOLERANCE_PX
  );
}

export function createNodeSearchLongPressHandlers<T extends HTMLElement>(
  requestNodeSearch: (nodeName: string | undefined) => void,
  nodeName: string | undefined,
): NodeSearchLongPressHandlers<T> {
  let timeoutId: number | undefined;
  let startPoint: Point | undefined;
  let activePointerId: number | undefined;
  let pointerPressActive = false;

  const hasSearchTarget = () => !!nodeName?.trim();

  const clearPress = () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    startPoint = undefined;
    activePointerId = undefined;
    pointerPressActive = false;
  };

  const startPress = (
    event: Pick<
      MouseEvent<T> | PointerEvent<T> | TouchEvent<T>,
      "preventDefault" | "stopPropagation"
    >,
    point: Point | undefined,
  ) => {
    if (!isMobileNodeSearchViewport() || !hasSearchTarget() || !point) {
      return;
    }

    clearPress();
    startPoint = point;
    timeoutId = window.setTimeout(() => {
      timeoutId = undefined;
      suppressFollowUpClick();
      event.preventDefault();
      event.stopPropagation();
      requestNodeSearch(nodeName);
    }, LONG_PRESS_DURATION_MS);
  };

  return {
    onClickCapture: (event) => {
      if (!shouldSuppressFollowUpClick()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu: (event) => handleNodeSearchContextMenu(event, requestNodeSearch, nodeName),
    onPointerDown: (event) => {
      if (event.button !== 0) {
        return;
      }

      pointerPressActive = true;
      activePointerId = event.pointerId;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some SVG/portal-backed map elements do not expose pointer capture.
      }
      startPress(event, { x: event.clientX, y: event.clientY });
    },
    onPointerMove: (event) => {
      if (activePointerId !== undefined && event.pointerId !== activePointerId) {
        return;
      }
      if (startPoint && movedBeyondTolerance(startPoint, { x: event.clientX, y: event.clientY })) {
        clearPress();
      }
    },
    onPointerUp: clearPress,
    onPointerCancel: clearPress,
    onPointerLeave: clearPress,
    onTouchStart: (event) => {
      if (pointerPressActive) {
        return;
      }
      startPress(event, touchPoint(event));
    },
    onTouchMove: (event) => {
      const currentPoint = touchPoint(event);
      if (startPoint && currentPoint && movedBeyondTolerance(startPoint, currentPoint)) {
        clearPress();
      }
    },
    onTouchEnd: clearPress,
    onTouchCancel: clearPress,
  };
}

export function useNodeSearchRequest() {
  const setPendingNodeSearch = useAppStore((state) => state.setPendingNodeSearch);
  const navigate = useNavigate({ from: "/" });

  return useCallback(
    (nodeName: string | undefined) => {
      const search = nodeName?.trim();
      if (!search) {
        return;
      }

      setPendingNodeSearch(search);
      void navigate({ to: "/nodes" });
    },
    [navigate, setPendingNodeSearch],
  );
}

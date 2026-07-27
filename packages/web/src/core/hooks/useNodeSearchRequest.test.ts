import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { createNodeSearchLongPressHandlers } from "./useNodeSearchRequest.ts";

function setMobileViewport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function makePointerEvent(overrides: Partial<ReactPointerEvent<HTMLDivElement>> = {}) {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  const setPointerCapture = vi.fn();

  return {
    event: {
      button: 0,
      pointerId: 1,
      clientX: 20,
      clientY: 30,
      currentTarget: { setPointerCapture },
      preventDefault,
      stopPropagation,
      ...overrides,
    } as unknown as ReactPointerEvent<HTMLDivElement>,
    preventDefault,
    setPointerCapture,
    stopPropagation,
  };
}

function makeTouchEvent(
  point: { clientX: number; clientY: number },
  overrides: Partial<ReactTouchEvent<HTMLDivElement>> = {},
) {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();

  return {
    event: {
      touches: [point],
      changedTouches: [point],
      preventDefault,
      stopPropagation,
      ...overrides,
    } as unknown as ReactTouchEvent<HTMLDivElement>,
    preventDefault,
    stopPropagation,
  };
}

function makeMouseEvent() {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();

  return {
    event: {
      preventDefault,
      stopPropagation,
    } as unknown as ReactMouseEvent<HTMLDivElement>,
    preventDefault,
    stopPropagation,
  };
}

describe("createNodeSearchLongPressHandlers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T12:00:00.000Z"));
    setMobileViewport(true);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requests node search after a mobile touch long press", () => {
    const requestNodeSearch = vi.fn();
    const handlers = createNodeSearchLongPressHandlers<HTMLDivElement>(
      requestNodeSearch,
      "Meteo Roma Centocelle",
    );
    const touchStart = makeTouchEvent({ clientX: 20, clientY: 30 });

    handlers.onTouchStart?.(touchStart.event);
    vi.advanceTimersByTime(520);

    expect(requestNodeSearch).toHaveBeenCalledWith("Meteo Roma Centocelle");
    expect(touchStart.preventDefault).toHaveBeenCalled();
    expect(touchStart.stopPropagation).toHaveBeenCalled();
  });

  it("cancels node search when the touch moves like a scroll", () => {
    const requestNodeSearch = vi.fn();
    const handlers = createNodeSearchLongPressHandlers<HTMLDivElement>(requestNodeSearch, "Node");
    const touchStart = makeTouchEvent({ clientX: 20, clientY: 30 });
    const touchMove = makeTouchEvent({ clientX: 20, clientY: 55 });

    handlers.onTouchStart?.(touchStart.event);
    handlers.onTouchMove?.(touchMove.event);
    vi.advanceTimersByTime(520);

    expect(requestNodeSearch).not.toHaveBeenCalled();
  });

  it("supports pointer long press and suppresses the follow-up click/contextmenu", () => {
    const requestNodeSearch = vi.fn();
    const handlers = createNodeSearchLongPressHandlers<HTMLDivElement>(requestNodeSearch, "Node");
    const pointerDown = makePointerEvent();
    const click = makeMouseEvent();
    const contextMenu = makeMouseEvent();

    handlers.onPointerDown?.(pointerDown.event);
    vi.advanceTimersByTime(520);
    handlers.onClickCapture?.(click.event);
    handlers.onContextMenu?.(contextMenu.event);

    expect(requestNodeSearch).toHaveBeenCalledTimes(1);
    expect(requestNodeSearch).toHaveBeenCalledWith("Node");
    expect(pointerDown.setPointerCapture).toHaveBeenCalledWith(1);
    expect(click.preventDefault).toHaveBeenCalled();
    expect(click.stopPropagation).toHaveBeenCalled();
    expect(contextMenu.preventDefault).toHaveBeenCalled();
    expect(contextMenu.stopPropagation).toHaveBeenCalled();
  });

  it("keeps handlers inert outside mobile viewport", () => {
    setMobileViewport(false);
    const requestNodeSearch = vi.fn();
    const handlers = createNodeSearchLongPressHandlers<HTMLDivElement>(requestNodeSearch, "Node");
    const pointerDown = makePointerEvent();
    const contextMenu = makeMouseEvent();

    handlers.onPointerDown?.(pointerDown.event);
    vi.advanceTimersByTime(520);
    handlers.onContextMenu?.(contextMenu.event);

    expect(requestNodeSearch).not.toHaveBeenCalled();
    expect(contextMenu.preventDefault as Mock).not.toHaveBeenCalled();
  });
});

import React, { useCallback, useRef, useState } from "react";

interface SwipeReplyMessageProps {
  enabled?: boolean;
  onReply?: () => void;
  children: React.ReactNode;
}

export const SwipeReplyMessage = ({
  enabled = true,
  onReply,
  children,
}: SwipeReplyMessageProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const [translateX, setTranslateX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      startXRef.current = e.clientX;
      setDragging(true);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startXRef.current;
      if (dx <= 0) {
        setTranslateX(0);
        return;
      }
      // cap translate to 50% of container width
      const width = containerRef.current?.offsetWidth ?? 300;
      const capped = Math.min(dx, width * 0.6);
      setTranslateX(capped);
    },
    [dragging],
  );

  const reset = useCallback(() => {
    setTranslateX(0);
    setDragging(false);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const width = containerRef.current?.offsetWidth ?? 300;
      const threshold = Math.min(80, width * 0.35);
      if (translateX >= threshold) {
        // trigger reply
        try {
          onReply?.();
        } finally {
          // brief visual feedback then reset
          setTranslateX(width * 0.3);
          setTimeout(reset, 160);
        }
      } else {
        // animate back
        reset();
      }
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}
    },
    [dragging, onReply, reset, translateX],
  );

  return (
    <div className="relative" ref={containerRef}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging ? "none" : "transform 160ms ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeReplyMessage;

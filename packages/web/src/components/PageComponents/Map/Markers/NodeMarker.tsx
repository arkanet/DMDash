import { cn } from "@app/core/utils/cn";
import type { PxOffset } from "@components/PageComponents/Map/cluster.ts";
import { Avatar } from "@components/UI/Avatar.tsx";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from "@components/UI/Tooltip.tsx";
import { memo } from "react";
import { Marker } from "react-map-gl/maplibre";

export const NodeMarker = memo(function NodeMarker({
  id,
  lng,
  lat,
  label,
  longLabel,
  tooltipLabel,
  hasError,
  isFavorite,
  offset,
  avatarClassName,
  showLabel = false,
  isVisible = true,
  onClick,
}: {
  id: number;
  lng: number;
  lat: number;
  label: string;
  longLabel?: string;
  tooltipLabel?: string;
  hasError?: boolean;
  isFavorite?: boolean;
  offset?: PxOffset;
  avatarClassName?: string;
  showLabel?: boolean;
  isVisible?: boolean;
  onClick: (id: number, e: { originalEvent: MouseEvent }) => void;
}) {
  const [dx, dy] = offset ?? [0, 0];

  const style = {
    "--dx": `${dx}px`,
    "--dy": `${dy}px`,
    pointerEvents: "auto",
  } as React.CSSProperties;

  return (
    <Marker
      longitude={lng}
      latitude={lat}
      anchor="bottom"
      style={{
        top: "20px",
        pointerEvents: "none",
        display: isVisible ? "" : "none",
      }}
    >
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="will-change-transform cursor-pointer animate-fan-out"
              style={style}
              onClick={(e) => onClick(id, { originalEvent: e.nativeEvent })}
            >
              <span className="hidden h-10 w-8 flex-col items-center max-md:flex">
                <span className="relative flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#2f8fe8] shadow-[0_2px_5px_rgba(0,0,0,0.45)]">
                  <span className="size-2.5 rounded-full bg-white" />
                </span>
                <span className="-mt-1 h-4 w-4 rotate-45 rounded-br-full bg-[#2f8fe8] shadow-[2px_2px_3px_rgba(0,0,0,0.25)]" />
              </span>
              <Avatar
                nodeNum={id}
                className="max-md:hidden"
                avatarClassName={cn(
                  "border-[1.5px] border-slate-600 shadow-m shadow-slate-600",
                  avatarClassName,
                )}
                showError={hasError}
                showFavorite={isFavorite}
              />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            {tooltipLabel && ( // only show tooltip if there's a label
              <TooltipContent
                className="bg-slate-800 dark:bg-slate-600 text-white px-4 py-1 rounded text-xs cursor-pointer"
                onClick={(e) => onClick(id, { originalEvent: e.nativeEvent })}
              >
                {tooltipLabel}
                <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
              </TooltipContent>
            )}
          </TooltipPortal>
        </Tooltip>
      </TooltipProvider>
      {showLabel && label && (
        <button
          type="button"
          className="absolute top-16 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-900 backdrop-blur-xs cursor-pointer max-md:top-7 max-md:text-sm"
          style={style}
          onClick={(e) => onClick(id, { originalEvent: e.nativeEvent })}
        >
          {label}
        </button>
      )}
      {longLabel && ( // only show label if there's a longLabel
        <button
          type="button"
          className="absolute top-21 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-white/70 px-2 py-0.5 text-xs text-slate-900 backdrop-blur-xs cursor-pointer"
          style={style}
          onClick={(e) => onClick(id, { originalEvent: e.nativeEvent })}
        >
          {longLabel}
        </button>
      )}
    </Marker>
  );
});

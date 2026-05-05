import { useNodeDB } from "@app/core/stores";
import { getColorFromNodeNum, isLightColor } from "@app/core/utils/color";
import {
  getCachedNodeIdenticon,
  getNodeIdenticonDataUri,
  resolveNodeAvatarId,
} from "@app/core/utils/identicon";
import { getNodeShortName } from "@app/darkmesh/utils.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartSimple } from "@fortawesome/free-solid-svg-icons";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from "@components/UI/Tooltip.tsx";
import { cn } from "@core/utils/cn.ts";
import { isNodeStatusUnread, normalizeNodeStatus } from "@core/utils/nodeStatus.ts";
import { LockKeyholeOpenIcon, StarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface AvatarProps {
  nodeNum: number;
  nodeId?: string;
  size?: "sm" | "lg";
  className?: string;
  avatarClassName?: string;
  showError?: boolean;
  showFavorite?: boolean;
  showStatusIndicator?: boolean;
}

export const Avatar = ({
  nodeNum,
  nodeId,
  size = "sm",
  showError = false,
  showFavorite = false,
  showStatusIndicator = true,
  className,
  avatarClassName,
}: AvatarProps) => {
  const { t } = useTranslation();
  const node = useNodeDB((s) => s.getNode(nodeNum));

  if (!nodeNum) {
    return null;
  }

  const sizes = {
    sm: "size-10 text-xs font-light",
    lg: "size-16 text-lg",
  };

  const resolvedNodeId = resolveNodeAvatarId(nodeNum, nodeId ?? node?.user?.id);
  const [identiconSrc, setIdenticonSrc] = useState<string | undefined>(() =>
    getCachedNodeIdenticon(resolvedNodeId),
  );

  // Per le regole UI: Avatar mostra sempre lo shortName; se mancante, mostra ultime 4 cifre di nameHex.
  // Non mostrare mai il longName troncato qui.
  const shortName = getNodeShortName(node);
  let displayName = shortName;
  if (!displayName) {
    const nameHex =
      (node?.user as unknown as { nameHex?: string })?.nameHex ??
      (node as unknown as { nameHex?: string })?.nameHex;
    if (nameHex && nameHex.length >= 4) displayName = nameHex.slice(-4).toUpperCase();
  }

  const bgColor = getColorFromNodeNum(nodeNum);
  const isLight = isLightColor(bgColor);
  const textColor = isLight ? "#000000" : "#FFFFFF";
  const initials = displayName ? displayName.slice(0, 4) : t("unknown.shortName");
  const nodeStatus = normalizeNodeStatus(
    (node as { nodeStatus?: string; lastReadNodeStatus?: string } | undefined)?.nodeStatus,
  );
  const hasUnreadNodeStatus = isNodeStatusUnread(
    nodeStatus,
    (node as { nodeStatus?: string; lastReadNodeStatus?: string } | undefined)?.lastReadNodeStatus,
  );

  useEffect(() => {
    const cached = getCachedNodeIdenticon(resolvedNodeId);
    if (cached) {
      setIdenticonSrc(cached);
      return;
    }

    let cancelled = false;

    void getNodeIdenticonDataUri(resolvedNodeId)
      .then((src) => {
        if (!cancelled) {
          setIdenticonSrc(src);
        }
      })
      .catch((error: unknown) => {
        console.error("[Avatar] Failed to generate identicon", error);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedNodeId]);

  return (
    <div className={cn("relative inline-flex shrink-0", sizes[size], className)}>
      <div
        className={cn(
          "flex size-full items-center justify-center overflow-hidden rounded-full bg-[rgb(var(--bg-r),var(--bg-g),var(--bg-b))] font-semibold",
          avatarClassName,
        )}
        style={
          {
            "--bg-r": bgColor.r,
            "--bg-g": bgColor.g,
            "--bg-b": bgColor.b,
            color: textColor,
          } as React.CSSProperties
        }
      >
        {identiconSrc ? (
          <img
            src={identiconSrc}
            alt=""
            aria-hidden="true"
            className="size-full object-cover"
            decoding="async"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <p className="p-1 text-nowrap">{initials}</p>
        )}
      </div>
      {showStatusIndicator && nodeStatus ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "absolute -top-0.5 -left-0.5 z-10 inline-flex size-4 items-center justify-center rounded-full bg-slate-950/85 text-cyan-300 shadow-sm ring-1 ring-white/70",
                  hasUnreadNodeStatus && "motion-safe:animate-pulse",
                )}
                aria-hidden="true"
              >
                <FontAwesomeIcon icon={faChartSimple} className="size-2.5" />
              </span>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent className="max-w-56 rounded bg-slate-800 px-4 py-2 text-white dark:bg-slate-600">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                    {t("nodeDetail.statusMessage", { ns: "nodes", defaultValue: "Status Message" })}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-xs font-normal italic text-white/95">
                    {nodeStatus}
                  </p>
                </div>
                <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {showFavorite ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <StarIcon
                className="absolute -top-0.5 -right-0.5 z-10 size-4 stroke-1 fill-yellow-400"
                aria-hidden="true"
                style={{
                  color: `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`,
                }}
              />
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent className="bg-slate-800 dark:bg-slate-600 text-white px-4 py-1 rounded text-xs">
                {t("nodeDetail.favorite.label", { ns: "nodes" })}
                <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {showError ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <LockKeyholeOpenIcon
                className="absolute -bottom-0.5 -right-0.5 z-10 size-4 text-red-500 stroke-3"
                aria-hidden="true"
              />
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent className="bg-slate-800 dark:bg-slate-600 text-white px-4 py-1 rounded text-xs">
                {t("nodeDetail.error.label", { ns: "nodes" })}
                <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
};

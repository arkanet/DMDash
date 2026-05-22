import { Button } from "@app/components/UI/Button";
import type { Connection } from "@app/core/stores/deviceStore/types";
import { cn } from "@core/utils/cn.ts";

export function ConnectionStatusBadge({ status }: { status: Connection["status"] }) {
  let color = "";
  let displayStatus: string = status;
  let isBlinking = false;
  let textColor = "text-slate-500 dark:text-slate-400";

  switch (status) {
    case "connected":
    case "configured":
      color = "bg-emerald-500";
      displayStatus = "connected";
      break;
    case "connecting":
    case "configuring":
      color = "bg-[#d3a02f]";
      displayStatus = "reconnect";
      textColor = "text-[#d3a02f]";
      isBlinking = true;
      break;
    case "online":
      color = "bg-blue-500";
      break;
    case "error":
      color = "bg-[#D32F2F]";
      displayStatus = "lost connect";
      textColor = "text-[#D32F2F]";
      isBlinking = true;
      break;
    default:
      color = "bg-gray-400";
  }
  return (
    <Button variant="subtle" className="inline-flex items-center gap-2">
      <span
        className={cn("h-2.5 w-2.5 rounded-full", color, isBlinking && "darkmesh-status-blink")}
        aria-hidden="true"
      />
      <span className={cn("text-xs capitalize", textColor, isBlinking && "darkmesh-status-blink")}>
        {displayStatus}
      </span>
    </Button>
  );
}

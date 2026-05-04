import { Separator } from "@components/UI/Separator.tsx";
import { normalizeNodeStatus } from "@core/utils/nodeStatus.ts";
import { cn } from "@core/utils/cn.ts";
export { normalizeNodeStatus } from "@core/utils/nodeStatus.ts";

interface NodeStatusMessageProps {
  status?: string | null;
  title: string;
  variant: "popup" | "dialog";
  className?: string;
}

export const NodeStatusMessage = ({
  status,
  title,
  variant,
  className,
}: NodeStatusMessageProps) => {
  const normalizedStatus = normalizeNodeStatus(status);

  if (!normalizedStatus) {
    return null;
  }

  if (variant === "popup") {
    return (
      <>
        <Separator className="my-2" />
        <div className={cn("space-y-1", className)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-slate-100">
            {normalizedStatus}
          </p>
        </div>
        <Separator className="my-2" />
      </>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg bg-slate-100 p-4 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
        className,
      )}
    >
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{normalizedStatus}</p>
    </div>
  );
};

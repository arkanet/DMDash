// React import not needed with the new JSX transform
import { useNotifications } from "@core/hooks/useNotifications.ts";
function relativeTime(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

type Props = {
  id: string;
  type: string;
  priority: number;
  nodeNum?: number;
  payload?: Record<string, unknown>;
  seen: boolean;
  timestamp: number;
};

export function NotificationItem(props: Props) {
  const { remove, markSeen } = useNotifications();

  const title = (() => {
    switch (props.type) {
      case "low_battery":
        return `Low battery: ${props.nodeNum ?? "?"}`;
      case "retransmit":
        return `Retransmit failed: ${props.nodeNum ?? "?"}`;
      case "scheduled_send":
        return `Scheduled: ${typeof props.payload?.status === "string" ? props.payload.status : ""}`;
      case "service":
        return `Service: ${typeof props.payload?.service === "string" ? props.payload.service : ""}`;
      default:
        return typeof props.payload?.title === "string" ? props.payload.title : "Notification";
    }
  })();

  return (
    <div
      className={`flex items-center justify-between p-3 border-b ${props.seen ? "opacity-70" : "bg-slate-50 dark:bg-slate-800"}`}
    >
      <div className="flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
          {props.priority}
        </div>
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs text-text-secondary">
            {props.nodeNum ? `Node ${props.nodeNum}` : ""} • {relativeTime(props.timestamp)} ago
          </div>
          {typeof props.payload?.detail === "string" && (
            <div className="text-sm text-text-secondary">{props.payload.detail}</div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => markSeen(props.id)} className="text-sm px-2 py-1">
          Mark
        </button>
        <button onClick={() => remove(props.id)} className="text-sm px-2 py-1 text-red-600">
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default NotificationItem;

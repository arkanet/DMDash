import useNotificationsStore, {
  type Notification,
  type NotificationType,
} from "@core/stores/notificationsStore/index.ts";
import { useCallback } from "react";

export function useNotifications() {
  const notifications = useNotificationsStore((s) => s.notifications);
  const add = useNotificationsStore((s) => s.add);
  const markSeen = useNotificationsStore((s) => s.markSeen);
  const markAllSeen = useNotificationsStore((s) => s.markAllSeen);
  const remove = useNotificationsStore((s) => s.remove);
  const setConfig = useNotificationsStore((s) => s.setConfig);

  const notify = useCallback(
    (
      type: string,
      payload?: Record<string, unknown>,
      opts?: { priority?: number; nodeNum?: number },
    ) => {
      return add({
        type: type as NotificationType,
        payload: (payload ?? {}) as Record<string, unknown>,
        priority: opts?.priority ?? 1,
        nodeNum: opts?.nodeNum,
      });
    },
    [add],
  );

  return { notifications, notify, markSeen, markAllSeen, remove, setConfig } as const;
}

export type { Notification };

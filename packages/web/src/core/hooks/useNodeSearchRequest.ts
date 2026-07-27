import { useAppStore } from "@core/stores";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, type MouseEvent } from "react";

function isMobileNodeSearchViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
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
  requestNodeSearch(nodeName);
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

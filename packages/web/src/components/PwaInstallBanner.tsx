import { isIosLikeDevice, isStandalonePwa } from "@core/utils/pwaEnvironment.ts";
import { DownloadIcon, PlusSquareIcon, Share2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

const INSTALL_DISMISSED_KEY = "darkmesh:pwa-install-dismissed:v1";

function isInstallDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissInstallBanner(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  } catch {}
}

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const iosInstallMode = isIosLikeDevice() && !installPrompt;

  const refreshVisibility = useCallback(
    (prompt: BeforeInstallPromptEvent | null = installPrompt) => {
      setVisible(
        !isStandalonePwa() && !isInstallDismissed() && (isIosLikeDevice() || Boolean(prompt)),
      );
    },
    [installPrompt],
  );

  useEffect(() => {
    refreshVisibility();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      refreshVisibility(promptEvent);
    };

    const handleAppInstalled = () => {
      dismissInstallBanner();
      setVisible(false);
      setInstallPrompt(null);
    };

    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => refreshVisibility();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneMedia.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneMedia.removeEventListener("change", handleDisplayModeChange);
    };
  }, [refreshVisibility]);

  const dismiss = () => {
    dismissInstallBanner();
    setVisible(false);
  };

  const install = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      dismissInstallBanner();
      setVisible(false);
    }
    setInstallPrompt(null);
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed right-3 bottom-0 left-3 z-[80] mx-auto max-w-xl"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3 rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-black">
          <img src="/darkmesh-dashboard-192.png" alt="" className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-text-primary">Installa DMDash</div>
          {iosInstallMode ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
              <span>Su iPhone/iPad apri</span>
              <Share2Icon className="size-3.5" aria-hidden="true" />
              <span>Condividi, poi</span>
              <PlusSquareIcon className="size-3.5" aria-hidden="true" />
              <span>Aggiungi a Home.</span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-text-secondary">
              Aggiungi la dashboard alla schermata Home per avvio standalone, offline cache e push.
            </div>
          )}
        </div>
        {installPrompt ? (
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium dark:border-zinc-700"
          >
            <DownloadIcon className="size-4" aria-hidden="true" />
            Installa
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-transparent text-text-secondary hover:border-slate-300 dark:hover:border-zinc-700"
          aria-label="Nascondi banner installazione"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

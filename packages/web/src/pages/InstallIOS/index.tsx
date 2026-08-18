import { Button } from "@components/UI/Button.tsx";
import { isNativeAppShell } from "@core/utils/nativeShell.ts";
import { useNavigate } from "@tanstack/react-router";
import { DownloadIcon, ExternalLink, StoreIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const NATIVE_APP_BUILD = import.meta.env.VITE_DARKMESH_NATIVE_APP === "true";
const FALLBACK_PUBLIC_ORIGIN = "https://dmdash.arkantiko.com";
const DARKMESH_IOS_BUNDLE_IDENTIFIER = "org.darkmesh.dmdash";
const DARKMESH_IOS_IPA_PATH = "/downloads/darkmesh.ipa";
const DARKMESH_IOS_SOURCE_PATH = "/altstore/source.json";

type BrowserProfile = {
  isIOSLike: boolean;
};

function getBrowserProfile(): BrowserProfile {
  if (typeof navigator === "undefined") {
    return { isIOSLike: false };
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isIOSLike =
    /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  return { isIOSLike };
}

function getDistributionOrigin(): string {
  if (typeof window === "undefined") {
    return FALLBACK_PUBLIC_ORIGIN;
  }

  if (
    window.location.protocol !== "https:" ||
    /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
  ) {
    return FALLBACK_PUBLIC_ORIGIN;
  }

  return window.location.origin;
}

function getAbsolutePublicUrl(path: string, origin: string): string {
  return new URL(path, origin).href;
}

function getAltStoreSourceShareUrl(sourceUrl: string): string {
  const source = new URL(sourceUrl);
  return `https://altstore.io/source/${source.host}${source.pathname}?app=${encodeURIComponent(
    DARKMESH_IOS_BUNDLE_IDENTIFIER,
  )}`;
}

export default function InstallIOSPage() {
  const navigate = useNavigate();
  const nativeAppShell = isNativeAppShell();
  const browserProfile = useMemo(getBrowserProfile, []);
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  const links = useMemo(() => {
    const origin = getDistributionOrigin();
    const sourceUrl = getAbsolutePublicUrl(DARKMESH_IOS_SOURCE_PATH, origin);
    const ipaUrl = getAbsolutePublicUrl(DARKMESH_IOS_IPA_PATH, origin);

    return {
      altStoreInstallSchemeUrl: `altstore://install?url=${encodeURIComponent(ipaUrl)}`,
      altStoreSourceSchemeUrl: `altstore://source?url=${encodeURIComponent(sourceUrl)}`,
      altStoreSourceShareUrl: getAltStoreSourceShareUrl(sourceUrl),
      ipaUrl,
      sourceUrl,
    };
  }, []);

  useEffect(() => {
    if (NATIVE_APP_BUILD || nativeAppShell) {
      void navigate({ to: "/connections", replace: true });
      return;
    }

    const timeout = window.setTimeout(() => {
      setRedirectAttempted(true);
      if (browserProfile.isIOSLike) {
        window.location.assign(links.altStoreSourceShareUrl);
        return;
      }

      window.location.assign(links.ipaUrl);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [
    browserProfile.isIOSLike,
    links.altStoreSourceShareUrl,
    links.ipaUrl,
    nativeAppShell,
    navigate,
  ]);

  if (NATIVE_APP_BUILD || nativeAppShell) {
    return null;
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,#611818_0%,#1f0d0d_33%,#090909_74%)] px-6 py-8 text-zinc-100">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <section className="w-full rounded-[28px] border border-white/10 bg-[#141414]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <img
              src="/darkmesh-dashboard-logo.png"
              alt="DarkMesh Dashboard"
              className="h-20 w-20 rounded-2xl border border-white/10 bg-black/80 p-2 shadow-[0_0_30px_rgba(255,255,255,0.06)]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                DarkMesh iOS
              </p>
              <h1 className="mt-2 break-words text-3xl font-semibold text-white md:text-4xl">
                Installazione app iOS
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                Bluefy non gestisce in modo affidabile il download diretto dei file IPA. Da iPhone
                usa AltStore; da desktop puoi scaricare direttamente l'archivio IPA.
              </p>
              {redirectAttempted ? (
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Reindirizzamento automatico tentato
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <a
              href={links.altStoreSourceShareUrl}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-500/35 bg-emerald-950/60 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-emerald-900/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <StoreIcon className="size-4" />
              AltStore source
            </a>
            <a
              href={links.altStoreSourceSchemeUrl}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <ExternalLink className="size-4" />
              Source direct
            </a>
            <a
              href={links.altStoreInstallSchemeUrl}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <ExternalLink className="size-4" />
              Install direct
            </a>
            {browserProfile.isIOSLike ? null : (
              <a
                href={links.ipaUrl}
                download="darkmesh.ipa"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                <DownloadIcon className="size-4" />
                Download IPA
              </a>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => void navigate({ to: "/connections" })}
              className="border-white/15 bg-black/20 text-zinc-100 hover:bg-white/10 hover:text-white"
            >
              Torna a Connessioni
            </Button>
            <a
              href={links.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
            >
              Source JSON
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

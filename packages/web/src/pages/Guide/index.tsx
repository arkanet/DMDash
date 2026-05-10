import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

type GuideVariant = "landing" | "en" | "it";

const GUIDE_CONFIG: Record<
  GuideVariant,
  {
    assetPath: string;
    assetBase: string;
    title: string;
  }
> = {
  landing: {
    assetPath: "/guide/index.html",
    assetBase: "/guide/",
    title: "DMDash User Guide",
  },
  en: {
    assetPath: "/guide/en/index.html",
    assetBase: "/guide/en/",
    title: "DMDash User Guide (English)",
  },
  it: {
    assetPath: "/guide/it/index.html",
    assetBase: "/guide/it/",
    title: "Guida utente DMDash",
  },
};

function rewriteGuideHtml(html: string, assetBase: string): string {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");

  const base = documentNode.createElement("base");
  base.setAttribute("href", assetBase);
  documentNode.head.prepend(base);

  const rewriteHref = (href: string): string => {
    switch (href) {
      case "./styles.css":
      case "../styles.css":
        return "/guide/styles.css";
      case "./en/":
      case "../en/":
        return "/guide/en";
      case "./it/":
      case "../it/":
        return "/guide/it";
      case "./":
      case "../":
        return "/guide";
      default:
        return href;
    }
  };

  documentNode.querySelectorAll<HTMLElement>("[href]").forEach((element) => {
    const href = element.getAttribute("href");
    if (!href) {
      return;
    }

    const rewrittenHref = rewriteHref(href);
    if (rewrittenHref !== href) {
      element.setAttribute("href", rewrittenHref);
    }

    if (element.tagName.toLowerCase() !== "a") {
      return;
    }

    if (rewrittenHref.startsWith("#")) {
      element.removeAttribute("target");
      return;
    }

    if (rewrittenHref.startsWith("/")) {
      element.removeAttribute("target");
      element.setAttribute("data-dmdash-route", rewrittenHref);
      return;
    }

    element.setAttribute("target", "_top");
    if (/^https?:\/\//.test(rewrittenHref)) {
      element.setAttribute("rel", "noreferrer");
    }
  });

  const mobileFullscreenStyle = documentNode.createElement("style");
  mobileFullscreenStyle.textContent = `
    @media (max-width: 950px) {
      html,
      body {
        width: 100% !important;
        min-width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
      }

      body > *,
      main,
      article,
      section,
      .container,
      .page,
      .guide,
      .guide-shell,
      .guide-page {
        width: 100% !important;
        max-width: none !important;
      }
    }
  `;
  documentNode.head.append(mobileFullscreenStyle);

  const anchorScript = documentNode.createElement("script");
  anchorScript.textContent = `
    (() => {
      const navigateParent = (to) => {
        window.parent.postMessage({ type: 'dmdash:navigate', to }, '*');
      };

      const resolveAnchorTarget = (hash) => {
        if (!hash || hash === '#') return null;
        const id = decodeURIComponent(hash.slice(1));
        return document.getElementById(id);
      };

      const scrollToHash = (hash) => {
        const target = resolveAnchorTarget(hash);
        if (!target) return false;

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        return true;
      };

      document.addEventListener('click', (event) => {
        const appRouteAnchor = event.target instanceof Element ? event.target.closest('a[data-dmdash-route]') : null;
        if (appRouteAnchor instanceof HTMLAnchorElement) {
          const to = appRouteAnchor.dataset.dmdashRoute;
          if (to) {
            event.preventDefault();
            navigateParent(to);
          }
          return;
        }

        const anchor = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
        if (!(anchor instanceof HTMLAnchorElement)) return;

        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;

        event.preventDefault();
        scrollToHash(href);
      });

      window.addEventListener('hashchange', () => {
        scrollToHash(window.location.hash);
      });

      window.addEventListener('load', () => {
        if (window.location.hash) {
          requestAnimationFrame(() => {
            scrollToHash(window.location.hash);
          });
        }
      });
    })();
  `;
  documentNode.body.append(anchorScript);

  return `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
}

interface GuidePageProps {
  variant?: GuideVariant;
}

export default function GuidePage({ variant = "landing" }: GuidePageProps) {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const config = GUIDE_CONFIG[variant];

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin && event.origin !== "null") {
        return;
      }

      const data = event.data as { type?: unknown; to?: unknown };
      if (data.type !== "dmdash:navigate" || typeof data.to !== "string") {
        return;
      }
      if (!data.to.startsWith("/") || data.to.startsWith("//")) {
        return;
      }

      void navigate({ to: data.to });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = config.title;

    let active = true;

    void fetch(config.assetPath, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        if (!active) {
          return;
        }

        setSrcDoc(rewriteGuideHtml(html, config.assetBase));
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!active) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "Unable to load guide");
      });

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [config.assetBase, config.assetPath, config.title]);

  const fallbackLink = useMemo(() => config.assetPath, [config.assetPath]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909] px-6 text-zinc-100">
        <div className="max-w-xl rounded-[28px] border border-white/10 bg-[#141414]/92 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <h1 className="text-2xl font-semibold text-white">Guide unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            The embedded guide could not be loaded right now.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{error}</p>
          <a
            href={fallbackLink}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center rounded-full border border-[#7a2424] bg-[#551717] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-100 transition-colors hover:bg-[#6c1d1d] hover:text-white"
          >
            Open raw guide
          </a>
        </div>
      </div>
    );
  }

  if (!srcDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909] px-6 text-zinc-200">
        <p className="text-sm uppercase tracking-[0.18em] text-zinc-400">Loading guide</p>
      </div>
    );
  }

  return (
    <div className="guide-viewport flex min-h-screen w-screen flex-1 bg-[#090909]">
      <iframe
        title={config.title}
        srcDoc={srcDoc}
        className="guide-frame h-screen w-full border-0 bg-[#090909]"
      />
    </div>
  );
}

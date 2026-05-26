import { cn } from "@core/utils/cn.ts";
import React from "react";

type FooterProps = {
  className?: string;
};

const Footer = ({ className, ...props }: FooterProps) => {
  const version = React.useMemo(
    () => String(import.meta.env.VITE_VERSION)?.toUpperCase() || "",
    [],
  );
  const commitHash = React.useMemo(
    () =>
      String(import.meta.env.VITE_COMMIT_HASH)
        ?.toUpperCase()
        .slice(0, 7) || "unk",
    [],
  );

  return (
    <footer
      className={cn(
        "app-footer fixed inset-x-0 bottom-0 z-40 border-t border-slate-300 bg-background-primary/95 px-3 py-1 text-xs backdrop-blur supports-[backdrop-filter]:bg-background-primary/85 dark:border-slate-700 md:px-4 md:text-sm",
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex min-h-8 w-full max-w-screen-2xl items-center justify-center gap-3 overflow-hidden whitespace-nowrap min-[951px]:max-[1088px]:scale-90 min-[951px]:max-[1088px]:origin-bottom">
        <div className="shrink-0">
          <span className="font-semibold text-gray-500/40 dark:text-gray-400/40">{version}</span>
          <span className="mx-2 font-semibold text-gray-500/40 dark:text-gray-400/40">-</span>
          <span className="font-semibold text-gray-500/40 dark:text-gray-400/40">
            {`#${commitHash}`}
          </span>
        </div>
        <p className="app-footer-description min-w-0 truncate text-gray-500 dark:text-gray-400">
          DarkMesh dashboard derived from Meshtastic Web, kept aligned with the official Meshtastic
          protobufs for radio compatibility.
        </p>
      </div>
    </footer>
  );
};

export default Footer;

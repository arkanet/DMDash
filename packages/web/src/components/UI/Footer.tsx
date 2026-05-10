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
        "app-footer flex mt-auto shrink-0 justify-center py-2 px-4 text-sm lg:text-md",
        className,
      )}
      {...props}
    >
      <div className="px-2">
        <span className="font-semibold text-gray-500/40 dark:text-gray-400/40">{version}</span>
        <span className="font-semibold text-gray-500/40 dark:text-gray-400/40 mx-2">-</span>
        <span className="font-semibold text-gray-500/40 dark:text-gray-400/40">
          {`#${commitHash}`}
        </span>
      </div>
      <p className="app-footer-description ml-auto mr-auto text-gray-500 dark:text-gray-400">
        DarkMesh dashboard derived from Meshtastic Web, kept aligned with the official Meshtastic
        protobufs for radio compatibility.
      </p>
    </footer>
  );
};

export default Footer;

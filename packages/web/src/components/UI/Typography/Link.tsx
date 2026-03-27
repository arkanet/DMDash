import { cn } from "@core/utils/cn.ts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

type RouterLinkChildren =
  | ReactElement
  | string
  | number
  | null
  | undefined
  | ((state: {
      isActive: boolean;
      isTransitioning: boolean;
    }) => ReactElement | string | number | null);

export interface LinkProps {
  href: string;
  children?: RouterLinkChildren;
  className?: string;
}

export const Link = ({ href, children, className }: LinkProps) => (
  <RouterLink
    to={href}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      "font-medium text-slate-900 underline underline-offset-4 dark:text-slate-200",
      className,
    )}
  >
    {children as never}
  </RouterLink>
);

import { useTheme } from "@core/hooks/useTheme.ts";
import { useEffect } from "react";

interface ThemeDocumentControllerProps {
  pathname: string;
}

export function ThemeDocumentController({ pathname }: ThemeDocumentControllerProps) {
  const { theme } = useTheme();
  const documentTheme = pathname === "/connections" ? "dark" : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", documentTheme);
  }, [documentTheme]);

  return null;
}

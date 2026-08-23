import { useTheme } from "@core/hooks/useTheme.ts";
import { getNativeAppPlatform, isNativeAppShell } from "@core/utils/nativeShell.ts";
import { useEffect } from "react";

interface ThemeDocumentControllerProps {
  pathname: string;
}

export function ThemeDocumentController({ pathname }: ThemeDocumentControllerProps) {
  const { theme } = useTheme();
  const nativeShell = isNativeAppShell();
  const documentTheme = nativeShell || pathname === "/connections" ? "dark" : theme;

  useEffect(() => {
    if (nativeShell) {
      document.title = "DarkMesh";
    }
    document.documentElement.setAttribute("data-theme", documentTheme);
    document.documentElement.classList.toggle("darkmesh-ios-shell", nativeShell);
    const platform = getNativeAppPlatform();
    if (platform) {
      document.documentElement.dataset.nativePlatform = platform;
    } else {
      delete document.documentElement.dataset.nativePlatform;
    }
  }, [documentTheme, nativeShell]);

  return null;
}

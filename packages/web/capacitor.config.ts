import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.darkmesh.dmdash",
  appName: "DMDash",
  webDir: "dist",
  bundledWebRuntime: false,
  ios: {
    contentInset: "always",
  },
};

export default config;

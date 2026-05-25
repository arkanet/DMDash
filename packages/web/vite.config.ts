import { execSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import { VitePWA } from "vite-plugin-pwa";
import { handleHuntForwardProxy, handleHuntHealthProxy } from "./server/huntProxy";
import { handleNetworkDiscoveryProxy } from "./server/networkDiscovery";
import { attachTcpBridgeProxy } from "./server/tcpProxy";

let hash = "";
let version = "v0.0.0";
try {
  hash = execSync("git rev-parse --short HEAD", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  hash = "DEV";
}

try {
  version = execSync("git describe --tags --abbrev=0", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // Fail silently and keep default version. Avoid throwing during Vite config load
  // (some CI/worktrees may not have tags or a git history available).
  version = "v0.0.0";
}

const CONTENT_SECURITY_POLICY =
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn-cookieyes.com; style-src 'self' 'unsafe-inline' data: https://rsms.me https://cdn.jsdelivr.net; img-src 'self' data:; font-src 'self' data: https://rsms.me https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'self';";

const VENDOR_CHUNK_GROUPS = [
  {
    name: "router",
    packages: [
      "@tanstack/react-router",
      "@tanstack/router-devtools",
      "@tanstack/react-router-devtools",
    ],
  },
  {
    name: "radix",
    packages: ["@radix-ui/"],
  },
  {
    name: "i18n",
    packages: [
      "i18next",
      "react-i18next",
      "i18next-browser-languagedetector",
      "i18next-http-backend",
    ],
  },
  {
    name: "forms",
    packages: ["react-hook-form", "@hookform/resolvers"],
  },
  {
    name: "validation",
    packages: ["zod"],
  },
  {
    name: "state",
    packages: ["zustand", "immer", "idb-keyval"],
  },
  {
    name: "meshtastic-core",
    packages: ["@bufbuild/protobuf", "@meshtastic/core", "@noble/curves"],
  },
  {
    name: "meshtastic-transports",
    packages: [
      "@meshtastic/transport-http",
      "@meshtastic/transport-web-bluetooth",
      "@meshtastic/transport-web-serial",
    ],
  },
  {
    name: "charts",
    packages: ["recharts"],
  },
  {
    name: "emoji",
    packages: ["emoji-picker-react"],
  },
  {
    name: "icons",
    packages: ["lucide-react"],
  },
] as const;

function resolveVendorChunk(id: string): string | undefined {
  const isNodeModule = id.includes("node_modules");
  const isWorkspacePackage = id.includes("/packages/");

  if (!isNodeModule && !isWorkspacePackage) {
    return undefined;
  }

  if (id.includes("maplibre-gl")) return "maplibre";
  if (id.includes("react-map-gl")) return "react-map-gl";
  if (/node_modules\/(react|react-dom)\//.test(id)) return "react-vendor";
  if (id.includes("@turf") || id.includes("/turf/")) return "turf";

  if (id.includes("/packages/core/") || id.includes("/packages/protobufs/")) {
    return "meshtastic-core";
  }

  if (
    id.includes("/packages/transport-http/") ||
    id.includes("/packages/transport-web-bluetooth/") ||
    id.includes("/packages/transport-web-serial/")
  ) {
    return "meshtastic-transports";
  }

  for (const group of VENDOR_CHUNK_GROUPS) {
    if (group.packages.some((pkg) => id.includes(`/node_modules/${pkg}`))) {
      return group.name;
    }
  }

  return undefined;
}

function darkMeshHuntDevProxy() {
  return {
    name: "darkmesh-hunt-dev-proxy",
    configureServer(server: {
      middlewares: {
        use: (
          handler: (
            req: {
              url?: string;
              method?: string;
            } & import("node:http").IncomingMessage,
            res: import("node:http").ServerResponse,
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0];

        if (pathname === "/api/hunt/health") {
          void handleHuntHealthProxy(req, res);
          return;
        }

        if (pathname === "/api/hunt/forward") {
          void handleHuntForwardProxy(req, res);
          return;
        }

        if (pathname === "/api/network/discover") {
          void handleNetworkDiscoveryProxy(req, res);
          return;
        }

        next();
      });
    },
  };
}

function darkMeshTcpBridgeProxy() {
  return {
    name: "darkmesh-tcp-bridge-proxy",
    configureServer(server: { httpServer?: import("node:http").Server | null }) {
      attachTcpBridgeProxy(server.httpServer);
    },
    configurePreviewServer(server: { httpServer?: import("node:http").Server | null }) {
      attachTcpBridgeProxy(server.httpServer);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  const isProd = mode === "production";
  const useHTTPS = env.VITE_USE_HTTPS === "true";

  return {
    plugins: [
      darkMeshHuntDevProxy(),
      darkMeshTcpBridgeProxy(),
      react(),
      tailwindcss(),
      ...(useHTTPS ? [basicSsl()] : []),
      createHtmlPlugin({
        inject: {
          data: {
            title: "DarkMesh Dashboard",
            cookieYesScript:
              isProd && env.VITE_COOKIEYES_CLIENT_ID
                ? // This is for GDPR/CCPA compliance
                  `<script async src="https://cdn-cookieyes.com/client_data/${env.VITE_COOKIEYES_CLIENT_ID}/script.js"></script>`
                : "",
          },
        },
      }),
      VitePWA({
        includeAssets: [
          "darkmesh-dashboard-logo.png",
          "darkmesh-dashboard-180.png",
          "darkmesh-dashboard-192.png",
          "darkmesh-dashboard-512.png",
        ],
        registerType: "autoUpdate",
        manifest: {
          name: "DarkMesh Dashboard",
          short_name: "DarkMesh Dashboard",
          description: "DarkMesh Dashboard",
          start_url: "/",
          display: "standalone",
          theme_color: "#D32F2F",
          background_color: "#D32F2F",
          icons: [
            {
              src: "/darkmesh-dashboard-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/darkmesh-dashboard-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    optimizeDeps: {
      include: ["react/jsx-runtime"],
    },
    define: {
      "import.meta.env.VITE_COMMIT_HASH": JSON.stringify(hash),
      "import.meta.env.VITE_VERSION": JSON.stringify(version),
    },
    build: {
      emptyOutDir: true,
      assetsDir: "./",
      rollupOptions: {
        output: {
          manualChunks(id) {
            const chunkName = resolveVendorChunk(id);
            if (chunkName) {
              return chunkName;
            }
            // Let Rollup handle other node_modules to avoid circular chunking.
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        "@app": path.resolve(process.cwd(), "./src"),
        "@pages": path.resolve(process.cwd(), "./src/pages"),
        "@components": path.resolve(process.cwd(), "./src/components"),
        "@core": path.resolve(process.cwd(), "./src/core"),
        "@layouts": path.resolve(process.cwd(), "./src/layouts"),
      },
    },
    server: {
      port: 3000,
      headers: {
        "Content-Security-Policy": CONTENT_SECURITY_POLICY,
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "credentialless",
        "X-Content-Type-Options": "nosniff",
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    },
  };
});

import { cleanup } from "@testing-library/react";
import { enableMapSet } from "immer";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom";
import "@testing-library/user-event";
import channelsEN from "@public/i18n/locales/en/channels.json" with { type: "json" };
import commandPaletteEN from "@public/i18n/locales/en/commandPalette.json" with { type: "json" };
import commonEN from "@public/i18n/locales/en/common.json" with { type: "json" };
import configEN from "@public/i18n/locales/en/config.json" with { type: "json" };
import connectionsEN from "@public/i18n/locales/en/connections.json" with { type: "json" };
import dialogEN from "@public/i18n/locales/en/dialog.json" with { type: "json" };
import messagesEN from "@public/i18n/locales/en/messages.json" with { type: "json" };
import moduleConfigEN from "@public/i18n/locales/en/moduleConfig.json" with { type: "json" };
import nodesEN from "@public/i18n/locales/en/nodes.json" with { type: "json" };
import uiEN from "@public/i18n/locales/en/ui.json" with { type: "json" };
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

enableMapSet();

const createStorageMock = (): Storage => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
};

if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage.clear !== "function"
) {
  const storageMock = createStorageMock();
  Object.defineProperty(globalThis, "localStorage", {
    value: storageMock,
    configurable: true,
  });
  Object.defineProperty(window, "localStorage", {
    value: storageMock,
    configurable: true,
  });
}

vi.mock("idb-keyval", () => ({
  get: vi.fn(() => Promise.resolve(undefined)),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
  clear: vi.fn(() => Promise.resolve()),
  keys: vi.fn(() => Promise.resolve([])),
  createStore: vi.fn(() => ({})),
}));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const appNamespaces = [
  "channels",
  "commandPalette",
  "common",
  "config",
  "moduleConfig",
  "connections",
  "dialog",
  "messages",
  "nodes",
  "ui",
];
const appFallbackNS = ["common", "ui", "dialog"];
const appDefaultNS = "common";

i18n.use(initReactI18next).init({
  lng: "en",

  ns: appNamespaces,
  defaultNS: appDefaultNS,
  fallbackNS: appFallbackNS,

  resources: {
    en: {
      channels: channelsEN,
      commandPalette: commandPaletteEN,
      common: commonEN,
      config: configEN,
      moduleConfig: moduleConfigEN,
      connections: connectionsEN,
      dialog: dialogEN,
      messages: messagesEN,
      nodes: nodesEN,
      ui: uiEN,
    },
  },

  interpolation: {
    escapeValue: false,
  },

  react: {
    useSuspense: false,
  },
  debug: false,
});

afterEach(() => {
  cleanup();
});

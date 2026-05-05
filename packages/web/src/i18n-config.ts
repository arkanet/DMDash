import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

export type Lang = {
  code: string;
  name: string;
  flag: string;
  region?: string;
};

export type LangCode = Lang["code"];

export const supportedLocaleCodes = ["en", "it-IT"] as const;

export const supportedLanguages: Lang[] = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "it-IT", name: "Italiano", flag: "🇮🇹" },
];

export const FALLBACK_LANGUAGE_CODE: LangCode = "en";

i18next
  .use(Backend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    backend: {
      loadPath: "/i18n/locales/{{lng}}/{{ns}}.json",
    },
    react: {
      useSuspense: true,
    },
    supportedLngs: [...supportedLocaleCodes],
    load: "currentOnly",
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    fallbackLng: {
      default: [FALLBACK_LANGUAGE_CODE],
      it: ["it-IT", FALLBACK_LANGUAGE_CODE],
    },
    fallbackNS: ["common", "ui", "dialog"],
    debug: import.meta.env.MODE === "development",
    ns: [
      "channels",
      "connections",
      "commandPalette",
      "common",
      "config",
      "moduleConfig",
      "dialog",
      "messages",
      "nodes",
      "ui",
      "map",
    ],
  });

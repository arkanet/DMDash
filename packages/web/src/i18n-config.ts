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

export const supportedLocaleCodes = [
  "be-BY",
  "bg-BG",
  "cs-CZ",
  "de-DE",
  "en",
  "es-ES",
  "fi-FI",
  "fr-FR",
  "hu-HU",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ru-RU",
  "sv-SE",
  "tr-TR",
  "uk-UA",
  "zh-CN",
  "zh-TW",
] as const;

export const supportedLanguages: Lang[] = [
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "fi-FI", name: "Suomi", flag: "🇫🇮" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "it-IT", name: "Italiano", flag: "🇮🇹" },
  { code: "ru-RU", name: "Русский", flag: "🇷🇺" },
  { code: "sv-SE", name: "Svenska", flag: "🇸🇪" },
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
      fi: ["fi-FI", FALLBACK_LANGUAGE_CODE],
      fr: ["fr-FR", FALLBACK_LANGUAGE_CODE],
      it: ["it-IT", FALLBACK_LANGUAGE_CODE],
      ru: ["ru-RU", FALLBACK_LANGUAGE_CODE],
      sv: ["sv-SE", FALLBACK_LANGUAGE_CODE],
      de: ["de-DE", FALLBACK_LANGUAGE_CODE],
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

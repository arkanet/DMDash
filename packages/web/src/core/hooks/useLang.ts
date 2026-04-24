import {
  FALLBACK_LANGUAGE_CODE,
  type Lang,
  type LangCode,
  supportedLanguages,
} from "@app/i18n-config.ts";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useLocalStorage from "./useLocalStorage.ts";

const STORAGE_KEY = "language";

type LanguageState = {
  language: LangCode;
};

function useLang() {
  const { i18n } = useTranslation();
  const [_, setLanguageInStorage] = useLocalStorage<LanguageState | null>(STORAGE_KEY, null);

  const currentLanguage = useMemo((): Lang | undefined => {
    const selectedLanguage = i18n.language ?? i18n.resolvedLanguage;

    const exactMatch = supportedLanguages.find((language) => language.code === selectedLanguage);
    if (exactMatch) {
      return exactMatch;
    }

    const baseLanguage = selectedLanguage?.split("-")[0];
    if (baseLanguage) {
      const familyMatch = supportedLanguages.find(
        (language) => language.code.split("-")[0] === baseLanguage,
      );
      if (familyMatch) {
        return familyMatch;
      }
    }

    return supportedLanguages.find((l) => l.code === FALLBACK_LANGUAGE_CODE);
  }, [i18n.language, i18n.resolvedLanguage]);

  const collator = useMemo(() => {
    return new Intl.Collator(i18n.language, { sensitivity: "base" });
  }, [i18n.language]);

  const set = useCallback(
    async (lng: LangCode, persist = true) => {
      if (i18n.language === lng) {
        return;
      }
      try {
        if (persist) {
          setLanguageInStorage({ language: lng });
        }
        await i18n.changeLanguage(lng);
      } catch (_e) {
        console.warn("Failed to change language:", _e);
      }
    },
    [i18n, setLanguageInStorage],
  );

  const getSupportedLangs = useMemo(
    () => supportedLanguages.toSorted((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const compare = useCallback(
    (a: string, b: string) => {
      return collator.compare(a, b);
    },
    [collator],
  );

  return { compare, set, current: currentLanguage, getSupportedLangs };
}

export default useLang;

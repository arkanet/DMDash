import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useLang from "./useLang.ts";

const mockChangeLanguage = vi.fn();
const mockSetLanguageInStorage = vi.fn();

const mockI18n = {
  language: "en",
  resolvedLanguage: "en",
  changeLanguage: mockChangeLanguage,
};

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      i18n: mockI18n,
    }),
  };
});

vi.mock("./useLocalStorage.ts", () => ({
  default: () => [null, mockSetLanguageInStorage],
}));

describe("useLang", () => {
  beforeEach(() => {
    mockI18n.language = "en";
    mockI18n.resolvedLanguage = "en";
    mockChangeLanguage.mockReset();
    mockSetLanguageInStorage.mockReset();
  });

  it("prefers the selected language over resolved fallback language", () => {
    mockI18n.language = "it-IT";
    mockI18n.resolvedLanguage = "en";

    const { result } = renderHook(() => useLang());

    expect(result.current.current?.code).toBe("it-IT");
    expect(result.current.current?.name).toBe("Italiano");
  });

  it("matches a supported language by family when the selected code is generic", () => {
    mockI18n.language = "it";
    mockI18n.resolvedLanguage = "en";

    const { result } = renderHook(() => useLang());

    expect(result.current.current?.code).toBe("it-IT");
  });
});

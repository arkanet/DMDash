import { describe, it } from "vitest";
import { buildTranslationReport } from "../scripts/i18n-sync.mjs";

describe("declared locale bundles", () => {
  it("include every English key for each declared locale", () => {
    const report = buildTranslationReport();

    if (report.missingTranslations.length > 0) {
      throw new Error(report.missingTranslations.join("\n"));
    }
  });
});

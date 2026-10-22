import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  saveScenario,
  loadScenario,
  sanitizeOverrides,
  type ScenarioCase
} from "./scenario-manager.js";

describe("Scenario Manager - Safe Case Files", () => {
  const tmpDir = path.resolve("testbed/temp_scenarios");

  it("sanitizes raw sensitive production overrides into macros and masks", () => {
    const rawData = {
      INVOICE_NUM: "138100000531261",
      INVOICE_DATE: "2026-10-22",
      GL_DATE: "10/22/2026",
      INVOICE_AMOUNT: "2500.50",
      HEADER_DISCRIMINATOR: "BEG",
      ALREADY_MACRO: "{{uuid}}"
    };

    const sanitized = sanitizeOverrides(rawData);

    // Document number masked without exposing digits
    expect(sanitized.INVOICE_NUM).toMatch(/^\{\{mask:1381#+\}\}$/);

    // Dates converted to dynamic macros
    expect(sanitized.INVOICE_DATE).toBe("{{date:YYYY-MM-DD}}");
    expect(sanitized.GL_DATE).toBe("{{date:MM/DD/YYYY}}");

    // Decimals converted to random range macro
    expect(sanitized.INVOICE_AMOUNT).toMatch(/^\{\{rand_decimal:\d+,\d+,2\}\}$/);

    // Static discriminators & existing macros preserved
    expect(sanitized.HEADER_DISCRIMINATOR).toBe("BEG");
    expect(sanitized.ALREADY_MACRO).toBe("{{uuid}}");
  });

  it("saves and reloads a YAML scenario file accurately", () => {
    const testScenario: ScenarioCase = {
      name: "AP Invoice Daily Batch",
      interface: "I001_DAC_AP_Invoice_Out_Async",
      description: "Test minimal daily batch",
      layer: 3,
      count: 3,
      allOptional: false,
      overrides: {
        INVOICE_NUM: "{{mask:INV-######}}",
        INVOICE_DATE: "{{date:MM/DD/YYYY}}",
        INVOICE_AMOUNT: "{{rand_decimal:500,5000,2}}"
      }
    };

    const targetFile = path.join(tmpDir, "ap-invoice-test.scenario.yaml");
    saveScenario(targetFile, testScenario);
    expect(fs.existsSync(targetFile)).toBe(true);

    const loaded = loadScenario(targetFile);
    expect(loaded.name).toBe("AP Invoice Daily Batch");
    expect(loaded.interface).toBe("I001_DAC_AP_Invoice_Out_Async");
    expect(loaded.count).toBe(3);
    expect(loaded.allOptional).toBe(false);
    expect(loaded.overrides?.["INVOICE_NUM"]).toBe("{{mask:INV-######}}");
    expect(loaded.overrides?.["INVOICE_DATE"]).toBe("{{date:MM/DD/YYYY}}");

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws clear error when loading non-existent scenario", () => {
    expect(() => loadScenario("/path/to/non-existent.scenario.yaml")).toThrow(/Scenario file not found/);
  });
});

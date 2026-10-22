import { describe, it, expect } from "vitest";
import { evaluateMacros } from "./macro-evaluator.js";

describe("Macro Evaluator", () => {
  it("evaluates rand_month, rand_day, rand_year", () => {
    const template = "{{rand_month}}/{{rand_day}}/{{rand_year}}";
    const evaluated = evaluateMacros(template);
    expect(evaluated).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    const [mm, dd, yyyy] = evaluated.split("/").map(Number);
    expect(mm).toBeGreaterThanOrEqual(1);
    expect(mm).toBeLessThanOrEqual(12);
    expect(dd).toBeGreaterThanOrEqual(1);
    expect(dd).toBeLessThanOrEqual(28);
    expect(yyyy).toBe(new Date().getFullYear());
  });

  it("evaluates custom date format tokens", () => {
    const evaluated = evaluateMacros("{{date:YYYYMMDD}}");
    expect(evaluated).toMatch(/^\d{8}$/);
  });

  it("evaluates numeric ranges and choices", () => {
    const intVal = Number(evaluateMacros("{{rand_int:100,200}}"));
    expect(intVal).toBeGreaterThanOrEqual(100);
    expect(intVal).toBeLessThanOrEqual(200);

    const choice = evaluateMacros("{{choice:USD,EUR,PHP}}");
    expect(["USD", "EUR", "PHP"]).toContain(choice);
  });

  it("evaluates counter with padding", () => {
    const c1 = evaluateMacros("{{counter:1,5}}", { rowIndex: 0 });
    const c2 = evaluateMacros("{{counter:1,5}}", { rowIndex: 1 });
    expect(c1).toBe("00001");
    expect(c2).toBe("00002");
  });

  it("evaluates uuid, uuid:nodash, and uuid:upper", () => {
    const u1 = evaluateMacros("{{uuid}}");
    expect(u1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const u2 = evaluateMacros("{{uuid:nodash}}");
    expect(u2).toMatch(/^[0-9a-f]{32}$/i);
    expect(u2).not.toContain("-");

    const u3 = evaluateMacros("{{uuid:upper}}");
    expect(u3).toBe(u3.toUpperCase());
    expect(u3).toContain("-");
  });

  it("evaluates now_iso, epoch, and relative dates", () => {
    const fixedDate = new Date("2026-10-22T12:00:00Z");
    const iso = evaluateMacros("{{now_iso}}", { mockDate: fixedDate });
    expect(iso).toBe("2026-10-22T12:00:00.000Z");

    const epoch = evaluateMacros("{{epoch}}", { mockDate: fixedDate });
    expect(epoch).toBe(String(Math.floor(fixedDate.getTime() / 1000)));

    const yesterday = evaluateMacros("{{yesterday}}", { mockDate: fixedDate });
    expect(yesterday).toBe("2026-10-21");

    const tomorrow = evaluateMacros("{{tomorrow}}", { mockDate: fixedDate });
    expect(tomorrow).toBe("2026-10-23");

    const offsetFuture = evaluateMacros("{{date_offset:+30d,YYYYMMDD}}", { mockDate: fixedDate });
    expect(offsetFuture).toBe("20261121");

    const offsetPast = evaluateMacros("{{date_offset:-5d,YYYY-MM-DD}}", { mockDate: fixedDate });
    expect(offsetPast).toBe("2026-10-17");
  });

  it("evaluates pattern masking, random digits, alpha, and alphanumeric", () => {
    const maskedInv = evaluateMacros("{{mask:INV-######}}");
    expect(maskedInv).toMatch(/^INV-\d{6}$/);

    const maskedPo = evaluateMacros("{{mask:PO-????-####}}");
    expect(maskedPo).toMatch(/^PO-[A-Z]{4}-\d{4}$/);

    const digits = evaluateMacros("{{rand_digits:10}}");
    expect(digits).toMatch(/^\d{10}$/);

    const alpha = evaluateMacros("{{rand_alpha:5}}");
    expect(alpha).toMatch(/^[A-Z]{5}$/);

    const alphanum = evaluateMacros("{{rand_alphanumeric:8}}");
    expect(alphanum).toMatch(/^[0-9A-Z]{8}$/);
  });

  it("evaluates env variable with fallback", () => {
    process.env["AETHERFLOW_TEST_KEY"] = "MOCK_SECRET_123";
    const resolved = evaluateMacros("{{env:AETHERFLOW_TEST_KEY,DEFAULT}}");
    expect(resolved).toBe("MOCK_SECRET_123");

    const fallback = evaluateMacros("{{env:NON_EXISTENT_VAR_XYZ,FALLBACK_VAL}}");
    expect(fallback).toBe("FALLBACK_VAL");
  });
});

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
});

export interface MacroContext {
  rowIndex?: number;
  recordCount?: number;
  mockDate?: Date;
}

function padZero(num: number, length: number = 2): string {
  return String(num).padStart(length, "0");
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(date: Date, format: string): string {
  const yyyy = date.getFullYear().toString();
  const MM = padZero(date.getMonth() + 1);
  const dd = padZero(date.getDate());
  const HH = padZero(date.getHours());
  const mm = padZero(date.getMinutes());
  const ss = padZero(date.getSeconds());

  return format
    .replace(/YYYY/g, yyyy)
    .replace(/yyyy/g, yyyy)
    .replace(/MM/g, MM)
    .replace(/DD/g, dd)
    .replace(/dd/g, dd)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss);
}

/**
 * Resolves generative macro variables in a template string:
 * - {{rand_month}} -> 01..12
 * - {{rand_day}} -> 01..28
 * - {{rand_year}} -> 2026
 * - {{today}} -> YYYY-MM-DD
 * - {{date:FORMAT}} -> custom formatted date, e.g. {{date:MM/DD/YYYY}}
 * - {{rand_int:min,max}} -> integer in range
 * - {{rand_decimal:min,max,decimals}} -> decimal in range
 * - {{choice:a,b,c}} -> random pick from comma-separated list
 * - {{counter}} or {{counter:start,pad}} -> incrementing counter based on rowIndex
 */
export function evaluateMacros(template: string, context: MacroContext = {}): string {
  if (!template || typeof template !== "string") {
    return template;
  }

  const baseDate = context.mockDate || new Date();
  const rowIndex = context.rowIndex ?? 0;

  return template.replace(/\{\{([^{}]+)\}\}/g, (_match, tokenRaw) => {
    const token = tokenRaw.trim();

    // 1. Date components
    if (token === "rand_month") {
      return padZero(getRandomInt(1, 12));
    }

    if (token === "rand_day") {
      return padZero(getRandomInt(1, 28)); // safe day range across all months
    }

    if (token === "rand_year") {
      return String(baseDate.getFullYear());
    }

    if (token === "today") {
      return formatDate(baseDate, "YYYY-MM-DD");
    }

    if (token.startsWith("date:")) {
      const format = token.slice(5).trim();
      return formatDate(baseDate, format);
    }

    // 2. Numeric randoms
    if (token.startsWith("rand_int")) {
      const args = token.slice(8).replace(/^:/, "").split(",").map((s: string) => Number(s.trim()));
      const min = args[0] !== undefined && !isNaN(args[0]) ? args[0] : 1000;
      const max = args[1] !== undefined && !isNaN(args[1]) ? args[1] : 9999;
      return String(getRandomInt(min, max));
    }

    if (token.startsWith("rand_decimal")) {
      const args = token.slice(12).replace(/^:/, "").split(",").map((s: string) => Number(s.trim()));
      const min = args[0] !== undefined && !isNaN(args[0]) ? args[0] : 10;
      const max = args[1] !== undefined && !isNaN(args[1]) ? args[1] : 5000;
      const dec = args[2] !== undefined && !isNaN(args[2]) ? args[2] : 2;
      const val = Math.random() * (max - min) + min;
      return val.toFixed(dec);
    }

    // 3. Pool choices
    if (token.startsWith("choice:")) {
      const choices = token.slice(7).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (choices.length === 0) return "";
      const idx = getRandomInt(0, choices.length - 1);
      return choices[idx] || "";
    }

    // 4. Sequential counter and record count
    if (token === "count" || token === "record_count") {
      return String(context.recordCount ?? 1);
    }

    if (token.startsWith("counter")) {
      const args = token.slice(7).replace(/^:/, "").split(",").map((s: string) => Number(s.trim()));
      const start = args[0] !== undefined && !isNaN(args[0]) ? args[0] : 1;
      const pad = args[1] !== undefined && !isNaN(args[1]) ? args[1] : 0;
      const val = start + rowIndex;
      return pad > 0 ? padZero(val, pad) : String(val);
    }

    // Unrecognized token - keep unchanged
    return `{{${token}}}`;
  });
}

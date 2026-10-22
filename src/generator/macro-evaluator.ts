import crypto from "node:crypto";

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

const DIGITS = "0123456789";
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHANUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Resolves generative macro variables in a template string:
 * - {{rand_month}} -> 01..12
 * - {{rand_day}} -> 01..28
 * - {{rand_year}} -> 2026
 * - {{today}} -> YYYY-MM-DD
 * - {{yesterday}} -> YYYY-MM-DD (1 day ago)
 * - {{tomorrow}} -> YYYY-MM-DD (1 day ahead)
 * - {{now_iso}} -> ISO 8601 string (e.g. 2026-10-22T18:45:00.000Z)
 * - {{epoch}} / {{timestamp}} -> Unix epoch seconds
 * - {{epoch_ms}} / {{timestamp_ms}} -> Unix epoch milliseconds
 * - {{date:FORMAT}} -> custom formatted date, e.g. {{date:MM/DD/YYYY}}
 * - {{date_offset:+30d,FORMAT}} -> offset date e.g. +30d, -7d, +1m, +1y
 * - {{uuid}} / {{guid}} -> RFC4122 v4 UUID
 * - {{uuid:nodash}} -> 32 hex chars without dashes
 * - {{uuid:upper}} -> uppercase UUID
 * - {{mask:PATTERN}} -> pattern mask (# for digit, ? for letter, * for alphanum)
 * - {{rand_digits:N}} -> random digit string of length N
 * - {{rand_alpha:N}} -> random uppercase letter string of length N
 * - {{rand_alphanumeric:N}} -> random alphanumeric string of length N
 * - {{rand_int:min,max}} -> integer in range
 * - {{rand_decimal:min,max,decimals}} -> decimal in range
 * - {{choice:a,b,c}} -> random pick from comma-separated list
 * - {{counter}} or {{counter:start,pad}} -> incrementing counter based on rowIndex
 * - {{env:VAR,fallback}} -> environment variable lookup
 */
export function evaluateMacros(template: string, context: MacroContext = {}): string {
  if (!template || typeof template !== "string") {
    return template;
  }

  const baseDate = context.mockDate || new Date();
  const rowIndex = context.rowIndex ?? 0;

  return template.replace(/\{\{([^{}]+)\}\}/g, (_match, tokenRaw) => {
    const token = tokenRaw.trim();

    // 1. UUID / GUID
    if (token === "uuid" || token === "guid") {
      return crypto.randomUUID();
    }
    if (token === "uuid:nodash" || token === "guid:nodash") {
      return crypto.randomUUID().replace(/-/g, "");
    }
    if (token === "uuid:upper" || token === "guid:upper") {
      return crypto.randomUUID().toUpperCase();
    }

    // 2. Timestamps and ISO
    if (token === "now_iso" || token === "iso_date") {
      return baseDate.toISOString();
    }

    if (token === "epoch" || token === "timestamp") {
      return String(Math.floor(baseDate.getTime() / 1000));
    }

    if (token === "epoch_ms" || token === "timestamp_ms") {
      return String(baseDate.getTime());
    }

    // 3. Date components & Relative Dates
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

    if (token === "yesterday") {
      const y = new Date(baseDate);
      y.setDate(y.getDate() - 1);
      return formatDate(y, "YYYY-MM-DD");
    }

    if (token === "tomorrow") {
      const t = new Date(baseDate);
      t.setDate(t.getDate() + 1);
      return formatDate(t, "YYYY-MM-DD");
    }

    if (token.startsWith("date:")) {
      const format = token.slice(5).trim();
      return formatDate(baseDate, format);
    }

    if (token.startsWith("date_offset:")) {
      const rest = token.slice(12).trim();
      const [offsetStr, ...fmtParts] = rest.split(",");
      const fmt = fmtParts.join(",").trim() || "YYYY-MM-DD";
      const match = offsetStr?.match(/^([+-]?\d+)\s*([dmyw])$/i);
      const targetDate = new Date(baseDate);
      if (match) {
        const amount = parseInt(match[1]!, 10);
        const unit = match[2]!.toLowerCase();
        if (unit === "d") targetDate.setDate(targetDate.getDate() + amount);
        else if (unit === "w") targetDate.setDate(targetDate.getDate() + amount * 7);
        else if (unit === "m") targetDate.setMonth(targetDate.getMonth() + amount);
        else if (unit === "y") targetDate.setFullYear(targetDate.getFullYear() + amount);
      }
      return formatDate(targetDate, fmt);
    }

    // 4. Pattern Masking (e.g. {{mask:INV-######}} or {{mask:PO-????-####}})
    if (token.startsWith("mask:")) {
      const pattern = token.slice(5);
      return pattern.replace(/[#?*]/g, (char: string) => {
        if (char === "#") return DIGITS[getRandomInt(0, DIGITS.length - 1)]!;
        if (char === "?") return ALPHA[getRandomInt(0, ALPHA.length - 1)]!;
        if (char === "*") return ALPHANUM[getRandomInt(0, ALPHANUM.length - 1)]!;
        return char;
      });
    }

    // 5. Random Strings & Digits
    if (token.startsWith("rand_alphanumeric") || token.startsWith("rand_string")) {
      const prefixLen = token.startsWith("rand_alphanumeric") ? 17 : 11;
      const rawLen = parseInt(token.slice(prefixLen).replace(/^:/, "").trim() || "8", 10);
      const len = isNaN(rawLen) ? 8 : rawLen;
      let res = "";
      for (let i = 0; i < len; i++) {
        res += ALPHANUM[getRandomInt(0, ALPHANUM.length - 1)];
      }
      return res;
    }

    if (token.startsWith("rand_digits")) {
      const rawLen = parseInt(token.slice(11).replace(/^:/, "").trim() || "8", 10);
      const len = isNaN(rawLen) ? 8 : rawLen;
      let res = "";
      for (let i = 0; i < len; i++) {
        res += DIGITS[getRandomInt(0, DIGITS.length - 1)];
      }
      return res;
    }

    if (token.startsWith("rand_alpha")) {
      const rawLen = parseInt(token.slice(10).replace(/^:/, "").trim() || "6", 10);
      const len = isNaN(rawLen) ? 6 : rawLen;
      let res = "";
      for (let i = 0; i < len; i++) {
        res += ALPHA[getRandomInt(0, ALPHA.length - 1)];
      }
      return res;
    }

    // 6. Numeric randoms
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

    // 7. Pool choices
    if (token.startsWith("choice:")) {
      const choices = token.slice(7).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (choices.length === 0) return "";
      const idx = getRandomInt(0, choices.length - 1);
      return choices[idx] || "";
    }

    // 8. Sequential counter and record count
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

    // 9. Environment variable resolution
    if (token.startsWith("env:")) {
      const rest = token.slice(4).trim();
      const [varName, ...fallbackParts] = rest.split(",");
      const fallback = fallbackParts.join(",").trim();
      return process.env[varName?.trim() || ""] ?? fallback ?? "";
    }

    // Unrecognized token - keep unchanged
    return `{{${token}}}`;
  });
}

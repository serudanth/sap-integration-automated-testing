import { randomUUID } from "node:crypto";
import type {
  FileSpec,
  GenerationOptions,
  GeneratedFileResult,
  GenerationContext,
  FieldSpec,
  FieldRule
} from "./types.js";

function formatDate(date: Date, format: string): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);

  switch (format) {
    case "MMDDYYYY":
      return `${mm}${dd}${yyyy}`;
    case "YYYYMMDD":
      return `${yyyy}${mm}${dd}`;
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "MMDDYY":
      return `${mm}${dd}${yy}`;
    default:
      return `${mm}/${dd}/${yyyy}`;
  }
}

function evaluateRule(
  spec: FieldSpec,
  rule: FieldRule,
  ctx: GenerationContext,
  recordsetName: string,
  overrides?: Record<string, Record<string, string>>
): string {
  // Check explicit override
  if (overrides && overrides[recordsetName] && overrides[recordsetName][spec.name] !== undefined) {
    return overrides[recordsetName][spec.name] ?? "";
  }

  switch (rule.type) {
    case "constant":
      return rule.value;

    case "macro": {
      const token = rule.token;
      if (token === "{{$filename}}") {
        return ctx.filename;
      }
      if (token === "{{$date}}") {
        return formatDate(ctx.date, rule.format || "MM/DD/YYYY");
      }
      if (token === "{{$headerDate}}") {
        return formatDate(ctx.date, rule.format || "MMDDYYYY");
      }
      if (token === "{{$guid}}") {
        return randomUUID();
      }
      if (token === "{{$counter}}") {
        return String(ctx.rowIndex);
      }
      return token;
    }

    case "counter": {
      const start = rule.start ?? 1;
      const val = start + ctx.rowIndex - 1;
      return rule.pad ? String(val).padStart(rule.pad, "0") : String(val);
    }

    case "range": {
      const min = rule.min;
      const max = rule.max;
      const decimals = rule.decimals ?? 0;
      const raw = Math.random() * (max - min) + min;
      if (decimals > 0) {
        return raw.toFixed(decimals);
      }
      const rounded = Math.round(raw);
      return rule.pad ? String(rounded).padStart(rule.pad, "0") : String(rounded);
    }

    case "pool": {
      if (rule.values.length === 0) return "";
      const idx = Math.floor(Math.random() * rule.values.length);
      return rule.values[idx] ?? "";
    }

    case "autoCount": {
      const count = ctx.recordCounts[rule.targetRecordset] ?? 0;
      return rule.pad ? String(count).padStart(rule.pad, "0") : String(count);
    }

    case "autoSum": {
      const sums = ctx.detailSums[rule.targetRecordset] || {};
      const sum = sums[rule.targetField] ?? 0;
      const decimals = rule.decimals ?? 2;
      return sum.toFixed(decimals);
    }

    default:
      return "";
  }
}

function formatValue(value: string, spec: FieldSpec, format: "delimited" | "fixed-width", separator: string, enclosure?: string): string {
  if (format === "fixed-width" && spec.fixedLength) {
    const padChar = spec.padChar || " ";
    const padDir = spec.padDirection || "left";
    let val = value.slice(0, spec.fixedLength);
    if (padDir === "right") {
      val = val.padEnd(spec.fixedLength, padChar);
    } else {
      val = val.padStart(spec.fixedLength, padChar);
    }
    return val;
  }

  if (enclosure) {
    if (value.includes(separator) || value.includes(enclosure) || value.includes("\n") || value.includes("\r")) {
      const escaped = value.replaceAll(enclosure, enclosure + enclosure);
      return `${enclosure}${escaped}${enclosure}`;
    }
  }

  return value;
}

export function generateFileFromSpec(
  spec: FileSpec,
  options: GenerationOptions = {}
): GeneratedFileResult {
  const date = options.date || new Date();
  const filename = options.filename || spec.name;

  const ctx: GenerationContext = {
    filename,
    date,
    recordCounts: {},
    detailRows: {},
    detailSums: {},
    rowIndex: 0
  };

  // Pass 1: Generate detail and standard recordsets
  for (const rs of spec.recordsets) {
    if (rs.role === "header" || rs.role === "trailer") {
      continue;
    }

    const count = options.detailCount !== undefined ? options.detailCount : (rs.defaultCount ?? 1);
    ctx.recordCounts[rs.name] = count;
    const currentDetailRows: Record<string, string>[] = [];
    const currentDetailSums: Record<string, number> = {};
    ctx.detailRows[rs.name] = currentDetailRows;
    ctx.detailSums[rs.name] = currentDetailSums;

    for (let i = 1; i <= count; i++) {
      ctx.rowIndex = i;
      const row: Record<string, string> = {};

      for (const field of rs.fields) {
        const val = evaluateRule(field, field.rule, ctx, rs.name, options.overrides);
        row[field.name] = val;

        // Auto-sum tracking: if value is numeric, accumulate
        const num = parseFloat(val);
        if (!isNaN(num)) {
          currentDetailSums[field.name] = (currentDetailSums[field.name] || 0) + num;
        }
      }

      currentDetailRows.push(row);
    }
  }

  // Pass 2: Assemble lines in recordset order (Header -> Details -> Trailer)
  const lines: string[] = [];

  for (const rs of spec.recordsets) {
    if (rs.role === "header") {
      ctx.rowIndex = 1;
      const values = rs.fields.map((f) => {
        const raw = evaluateRule(f, f.rule, ctx, rs.name, options.overrides);
        return formatValue(raw, f, spec.format, spec.fieldSeparator, spec.enclosureSign);
      });
      lines.push(values.join(spec.fieldSeparator));
      ctx.recordCounts[rs.name] = 1;
    } else if (rs.role === "detail" || rs.role === "standard") {
      const rows = ctx.detailRows[rs.name] || [];
      for (const row of rows) {
        const values = rs.fields.map((f) => {
          const raw = row[f.name] ?? "";
          return formatValue(raw, f, spec.format, spec.fieldSeparator, spec.enclosureSign);
        });
        lines.push(values.join(spec.fieldSeparator));
      }
    } else if (rs.role === "trailer") {
      ctx.rowIndex = 1;
      const values = rs.fields.map((f) => {
        const raw = evaluateRule(f, f.rule, ctx, rs.name, options.overrides);
        return formatValue(raw, f, spec.format, spec.fieldSeparator, spec.enclosureSign);
      });
      lines.push(values.join(spec.fieldSeparator));
      ctx.recordCounts[rs.name] = 1;
    }
  }

  const endSep = spec.endSeparator || "\n";
  const content = lines.join(endSep) + endSep;

  // Aggregate totals
  const totals: Record<string, number> = {};
  for (const [rsName, sums] of Object.entries(ctx.detailSums)) {
    for (const [fieldName, total] of Object.entries(sums)) {
      totals[`${rsName}.${fieldName}`] = Math.round(total * 100) / 100;
    }
  }

  return {
    filename,
    content,
    recordCounts: ctx.recordCounts,
    totals,
    lineCount: lines.length
  };
}

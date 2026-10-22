/**
 * Universal Specification-Driven File Generator Types
 */

export type FieldRuleType =
  | "constant"
  | "macro"
  | "counter"
  | "range"
  | "pool"
  | "autoSum"
  | "autoCount";

export interface ConstantFieldRule {
  type: "constant";
  value: string;
}

export interface MacroFieldRule {
  type: "macro";
  token: string; // e.g. "{{$filename}}", "{{$date}}", "{{$guid}}", "{{$isoTimestamp}}"
  format?: string; // e.g. "MMDDYYYY", "MM/DD/YYYY"
}

export interface CounterFieldRule {
  type: "counter";
  start?: number;
  pad?: number; // e.g. 5 -> "00001"
}

export interface RangeFieldRule {
  type: "range";
  min: number;
  max: number;
  decimals?: number; // e.g. 2 -> "307422.55"
  pad?: number;
}

export interface PoolFieldRule {
  type: "pool";
  values: string[];
}

export interface AutoSumFieldRule {
  type: "autoSum";
  targetRecordset: string; // e.g. "AP_INVOICE"
  targetField: string;     // e.g. "AMOUNT" or "INVOICE_AMOUNT"
  decimals?: number;       // default: 2
}

export interface AutoCountFieldRule {
  type: "autoCount";
  targetRecordset: string; // e.g. "AP_INVOICE"
  pad?: number;
}

export type FieldRule =
  | ConstantFieldRule
  | MacroFieldRule
  | CounterFieldRule
  | RangeFieldRule
  | PoolFieldRule
  | AutoSumFieldRule
  | AutoCountFieldRule;

export interface FieldSpec {
  name: string;
  type?: string;
  rule: FieldRule;
  fixedLength?: number;
  padChar?: string;
  padDirection?: "left" | "right";
  description?: string;
}

export interface RecordsetSpec {
  name: string;
  role: "header" | "detail" | "trailer" | "standard";
  minCount?: number;
  maxCount?: number;
  minOccurs?: number;
  maxOccurs?: number;
  defaultCount?: number;
  fields: FieldSpec[];
}

export interface FileSpec {
  id: string;
  name: string;
  description?: string;
  format: "delimited" | "fixed-width";
  fieldSeparator: string;  // e.g. ","
  endSeparator: string;    // e.g. "\n"
  enclosureSign?: string;  // e.g. "\""
  trim?: boolean;
  filenamePattern?: string; // e.g. "{companyCode}0000{date}{seq}.{ext}"
  recordsets: RecordsetSpec[];
}

export interface GenerationContext {
  filename: string;
  date: Date;
  recordCounts: Record<string, number>;
  detailRows: Record<string, Record<string, string>[]>;
  detailSums: Record<string, Record<string, number>>;
  rowIndex: number;
}

export interface GenerationOptions {
  filename?: string;
  detailCount?: number;
  overrides?: Record<string, Record<string, string>>; // recordsetName -> { fieldName: value }
  date?: Date;
}

export interface GeneratedFileResult {
  filename: string;
  content: string;
  recordCounts: Record<string, number>;
  totals: Record<string, number>;
  lineCount: number;
}

/**
 * Compliance Validator for generated files against SAP FCC / Base Specifications
 */

export interface ComplianceReport {
  compliant: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    filename: string;
    totalLines: number;
    detailCount: number;
    trailerReportedCount?: number;
    calculatedSum: number;
    trailerReportedSum?: number;
  };
}

export function validateDacApInvoiceCompliance(
  fileContent: string,
  expectedFilename: string
): ComplianceReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawLines = fileContent.split("\n");
  // Trim trailing empty line from standard final newline
  const lines = rawLines[rawLines.length - 1] === "" ? rawLines.slice(0, -1) : rawLines;

  if (lines.length < 3) {
    errors.push(`File is too short: expected at least 3 lines (Header, 1+ Detail, Trailer), got ${lines.length}`);
    return {
      compliant: false,
      errors,
      warnings,
      summary: {
        filename: expectedFilename,
        totalLines: lines.length,
        detailCount: 0,
        calculatedSum: 0
      }
    };
  }

  // 1. Validate Header
  const headerLine = lines[0] ?? "";
  const headerFields = headerLine.split(",");
  if (headerFields[0] !== "BEG") {
    errors.push(`Header must begin with "BEG", got "${headerFields[0]}"`);
  }
  if (headerFields.length !== 5) {
    errors.push(`Header must have exactly 5 fields, got ${headerFields.length}`);
  } else {
    if (headerFields[1] !== "1") {
      warnings.push(`Header version expected "1", got "${headerFields[1]}"`);
    }
    if (headerFields[3] !== expectedFilename) {
      errors.push(`Header filename "${headerFields[3]}" does not match expected "${expectedFilename}"`);
    }
    const headerDate = headerFields[4] ?? "";
    if (!/^\d{8}$/.test(headerDate)) {
      errors.push(`Header date "${headerDate}" does not match MMDDYYYY format`);
    }
  }

  // 2. Validate Detail Rows
  const detailLines = lines.slice(1, -1);
  let calculatedSum = 0;

  for (let i = 0; i < detailLines.length; i++) {
    const rowNum = i + 1;
    const detailLine = detailLines[i] ?? "";
    const fields = detailLine.split(",");

    if (fields.length !== 47 && fields.length !== 48) {
      errors.push(`Detail row ${rowNum} has invalid field count: expected 47 or 48, got ${fields.length}`);
    }

    // Check amount field (field index 36, 37th field)
    const amountStr = fields[36] ?? "";
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      errors.push(`Detail row ${rowNum} has unparseable AMOUNT: "${amountStr}"`);
    } else {
      calculatedSum += amount;
    }

    // Check self-referencing filename (field index 46, 47th field)
    const rowFilename = fields[46];
    if (rowFilename !== expectedFilename) {
      errors.push(`Detail row ${rowNum} filename self-reference "${rowFilename}" does not match "${expectedFilename}"`);
    }
  }

  // Round calculated sum to 2 decimal places
  calculatedSum = Math.round(calculatedSum * 100) / 100;

  // 3. Validate Trailer
  const trailerLine = lines[lines.length - 1] ?? "";
  const trailerFields = trailerLine.split(",");
  let trailerReportedCount: number | undefined;
  let trailerReportedSum: number | undefined;

  if (trailerFields[0] !== "EOF") {
    errors.push(`Trailer must begin with "EOF", got "${trailerFields[0]}"`);
  }
  if (trailerFields.length !== 3) {
    errors.push(`Trailer must have exactly 3 fields, got ${trailerFields.length}`);
  } else {
    trailerReportedCount = parseInt(trailerFields[1] ?? "", 10);
    trailerReportedSum = parseFloat(trailerFields[2] ?? "");

    if (trailerReportedCount !== detailLines.length) {
      errors.push(`Trailer count ${trailerReportedCount} does not match actual detail count ${detailLines.length}`);
    }

    if (isNaN(trailerReportedSum) || Math.abs(trailerReportedSum - calculatedSum) > 0.01) {
      errors.push(`Trailer amount ${trailerReportedSum} does not match calculated sum of detail rows ${calculatedSum}`);
    }
  }

  return {
    compliant: errors.length === 0,
    errors,
    warnings,
    summary: {
      filename: expectedFilename,
      totalLines: lines.length,
      detailCount: detailLines.length,
      trailerReportedCount,
      calculatedSum,
      trailerReportedSum
    }
  };
}

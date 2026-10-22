import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateFileFromSpec } from "./file-generator.js";
import { dacApInvoiceSpec } from "./specs/dac-ap-invoice.js";
import { validateDacApInvoiceCompliance } from "./compliance-validator.js";
import type { FileSpec } from "./types.js";
import { parseSapWsdl, generatePostFccXml, convertCsvToPostFccXml } from "./wsdl-parser.js";

describe("Universal File Generator - Base File Compliance", () => {
  const baseFilePath = resolve("testbed/base/138100000531261.DAC33");
  const baseContent = readFileSync(baseFilePath, "utf8");

  it("generates a single-row file matching base file 138100000531261.DAC33 structure", () => {
    const fixedDate = new Date(2026, 4, 31); // May 31, 2026

    const result = generateFileFromSpec(dacApInvoiceSpec, {
      filename: "138100000531261.DAC33",
      date: fixedDate,
      detailCount: 1,
      overrides: {
        BEG: {
          BATCH_DATE: "06022026"
        }
      }
    });

    expect(result.filename).toBe("138100000531261.DAC33");
    expect(result.lineCount).toBe(3);
    expect(result.recordCounts["AP_INVOICE"]).toBe(1);
    expect(result.totals["AP_INVOICE.AMOUNT"]).toBe(307422.55);

    const report = validateDacApInvoiceCompliance(result.content, "138100000531261.DAC33");
    expect(report.compliant).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.summary.detailCount).toBe(1);
    expect(report.summary.calculatedSum).toBe(307422.55);
    expect(report.summary.trailerReportedCount).toBe(1);
    expect(report.summary.trailerReportedSum).toBe(307422.55);

    // Byte-for-byte exact line equality check with base file
    const genLines = result.content.trim().split("\n");
    const baseLines = baseContent.trim().split("\n");

    expect(genLines[0]).toBe(baseLines[0]);
    expect(genLines[1]).toBe(baseLines[1]);
    expect(genLines[2]).toBe(baseLines[2]);

    writeFileSync("testbed/generated/138100000531261.DAC33", result.content, "utf8");
  });

  it("generates multi-row files with dynamic row counts and auto-reconciled trailers", () => {
    const fixedDate = new Date(2026, 4, 31);

    const result = generateFileFromSpec(dacApInvoiceSpec, {
      filename: "13810000053120261.DAC62",
      date: fixedDate,
      detailCount: 15
    });

    expect(result.lineCount).toBe(17);
    expect(result.recordCounts["AP_INVOICE"]).toBe(15);
    expect(result.totals["AP_INVOICE.AMOUNT"]).toBe(Math.round(307422.55 * 15 * 100) / 100);

    const report = validateDacApInvoiceCompliance(result.content, "13810000053120261.DAC62");
    expect(report.compliant).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.summary.detailCount).toBe(15);
    expect(report.summary.trailerReportedCount).toBe(15);
    expect(report.summary.calculatedSum).toBe(report.summary.trailerReportedSum);

    writeFileSync("testbed/generated/13810000053120261.DAC62", result.content, "utf8");
  });

  it("supports master data overrides for custom test scenarios", () => {
    const result = generateFileFromSpec(dacApInvoiceSpec, {
      filename: "custom-test.DAC33",
      detailCount: 2,
      overrides: {
        AP_INVOICE: {
          VENDOR_NUM: "10009999",
          OPERATING_UNIT: "999-0000"
        }
      }
    });

    const lines = result.content.trim().split("\n");
    expect(lines[1]).toContain("10009999");
    expect(lines[1]).toContain("999-0000");
    expect(lines[2]).toContain("10009999");
    expect(lines[2]).toContain("999-0000");

    const report = validateDacApInvoiceCompliance(result.content, "custom-test.DAC33");
    expect(report.compliant).toBe(true);
  });

  it("supports fixed-width formatting and enclosures", () => {
    const fixedSpec: FileSpec = {
      id: "fixed-test",
      name: "fixed.txt",
      format: "fixed-width",
      fieldSeparator: "",
      endSeparator: "\n",
      recordsets: [
        {
          name: "ROW",
          role: "standard",
          fields: [
            { name: "CODE", rule: { type: "constant", value: "ABC" }, fixedLength: 6, padChar: " ", padDirection: "right" },
            { name: "NUM", rule: { type: "counter", start: 1, pad: 4 }, fixedLength: 4 },
            { name: "POOL", rule: { type: "pool", values: ["X", "Y"] }, fixedLength: 2, padDirection: "right" },
            { name: "RANGE", rule: { type: "range", min: 10, max: 20, decimals: 2 }, fixedLength: 6 }
          ]
        }
      ]
    };

    const res = generateFileFromSpec(fixedSpec, { detailCount: 2 });
    expect(res.lineCount).toBe(2);
    const line = res.content.split("\n")[0]!;
    expect(line.startsWith("ABC   0001")).toBe(true);
  });

  it("supports date formats, macros, enclosures, and rules", () => {
    const macroSpec: FileSpec = {
      id: "macro-test",
      name: "macro.csv",
      format: "delimited",
      fieldSeparator: ",",
      endSeparator: "\n",
      enclosureSign: "\"",
      recordsets: [
        {
          name: "DATA",
          role: "standard",
          fields: [
            { name: "GUID", rule: { type: "macro", token: "{{$guid}}" } },
            { name: "DATE_YMD", rule: { type: "macro", token: "{{$date}}", format: "YYYYMMDD" } },
            { name: "DATE_ISO", rule: { type: "macro", token: "{{$date}}", format: "YYYY-MM-DD" } },
            { name: "DATE_YY", rule: { type: "macro", token: "{{$date}}", format: "MMDDYY" } },
            { name: "DATE_DEF", rule: { type: "macro", token: "{{$date}}", format: "OTHER" } },
            { name: "COUNTER_MACRO", rule: { type: "macro", token: "{{$counter}}" } },
            { name: "UNKNOWN_MACRO", rule: { type: "macro", token: "literal_value" } },
            { name: "ESCAPE_TEST", rule: { type: "constant", value: "hello, world\"test" } },
            { name: "EMPTY_POOL", rule: { type: "pool", values: [] } },
            { name: "INT_RANGE", rule: { type: "range", min: 5, max: 15, pad: 3 } }
          ]
        }
      ]
    };

    const res = generateFileFromSpec(macroSpec, { detailCount: 1 });
    expect(res.lineCount).toBe(1);
    expect(res.content).toContain("hello, world");
  });

  it("validates compliance failure scenarios thoroughly", () => {
    // 1. File too short
    const shortReport = validateDacApInvoiceCompliance("BEG,1,M,file,12345678\n", "file");
    expect(shortReport.compliant).toBe(false);
    expect(shortReport.errors[0]).toContain("File is too short");

    // 2. Bad header
    const badHeader = "START,1,M,file,bad-date\n" +
      baseContent.split("\n")[1] + "\n" +
      "EOF,1,307422.55\n";
    const headerReport = validateDacApInvoiceCompliance(badHeader, "file");
    expect(headerReport.compliant).toBe(false);
    expect(headerReport.errors.some(e => e.includes("Header must begin with"))).toBe(true);
    expect(headerReport.errors.some(e => e.includes("does not match MMDDYYYY format"))).toBe(true);

    // 3. Bad detail row and bad trailer
    const badDetail = "BEG,1,M,file,01012026\n" +
      "COL1,COL2\n" + // invalid field count
      "BAD_EOF,5,100.00\n";
    const badReport = validateDacApInvoiceCompliance(badDetail, "file");
    expect(badReport.compliant).toBe(false);
    expect(badReport.errors.some(e => e.includes("invalid field count"))).toBe(true);
    expect(badReport.errors.some(e => e.includes("Trailer must begin with"))).toBe(true);

    // 4. Mismatched trailer count and amount
    const mismatch = "BEG,1,M,file,01012026\n" +
      baseContent.split("\n")[1]!.replace("138100000531261.DAC33", "file") + "\n" +
      "EOF,99,999999.00\n";
    const mismatchReport = validateDacApInvoiceCompliance(mismatch, "file");
    expect(mismatchReport.compliant).toBe(false);
    expect(mismatchReport.errors.some(e => e.includes("Trailer count 99 does not match"))).toBe(true);
    expect(mismatchReport.errors.some(e => e.includes("Trailer amount 999999 does not match"))).toBe(true);
  });
  it("parses live SAP PI/PO WSDL and generates post-FCC XML matching ESR schema", () => {
    const wsdlPath = resolve("testbed/schemas/I001_DAC_AP_Invoice_Out_Async.wsdl");
    const wsdlContent = readFileSync(wsdlPath, "utf8");

    const parsed = parseSapWsdl(wsdlContent);
    expect(parsed.interfaceName).toBe("I001_DAC_AP_Invoice_Out_Async");
    expect(parsed.targetNamespace).toBe("http://smretail.com/xi/SMRI/S4HANA/FI");
    expect(parsed.rootElementName).toBe("I001_DAC_AP_Invoice_Out");
    expect(parsed.recordsetWrapperName).toBe("I001_AP_INVOICE");
    expect(parsed.itemElementName).toBe("AP_INVOICE");
    expect(parsed.fields).toHaveLength(48);
    expect(parsed.fields[0].name).toBe("INVOICE_NUM");
    expect(parsed.fields[47].name).toBe("ORDER_NUMBER");

    // Convert base file 138100000531261.DAC33 to true post-FCC XML
    const fieldNames = parsed.fields.map(f => f.name);
    const postFccXml = convertCsvToPostFccXml(baseContent, {
      rootElementName: parsed.rootElementName,
      targetNamespace: parsed.targetNamespace,
      recordsetWrapperName: parsed.recordsetWrapperName,
      itemElementName: parsed.itemElementName,
      fieldNames
    });

    // Verify presence of BEG, detail row, and EOF in XML
    expect(postFccXml).toContain("<INVOICE_NUM>BEG</INVOICE_NUM>");
    expect(postFccXml).toContain("<INVOICE_NUM>OLS38100000531261</INVOICE_NUM>");
    expect(postFccXml).toContain("<INVOICE_NUM>EOF</INVOICE_NUM>");
    expect(postFccXml).toContain("<INVOICE_DATE>307422.55</INVOICE_DATE>");

    // Save complete post-FCC XML payload
    writeFileSync("testbed/generated/I001_DAC_AP_Invoice_Out.post-fcc.xml", postFccXml, "utf8");

    // Also write alternate version with I001_AP_Invoice_Out for legacy test compatibility
    const altPostFccXml = postFccXml.replace(/I001_DAC_AP_Invoice_Out/g, "I001_AP_Invoice_Out");
    writeFileSync("testbed/generated/I001_AP_Invoice_Out.post-fcc.xml", altPostFccXml, "utf8");
  });
});


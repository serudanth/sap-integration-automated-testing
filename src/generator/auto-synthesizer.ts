import type { FileSpec, FieldSpec, FieldRule } from "./types.js";
import type { RawIntegratedConfiguration, RawCommunicationChannel } from "../types/raw-inventory.js";

function inferRuleFromFieldName(fieldName: string): FieldRule {
  const upper = fieldName.toUpperCase();

  if (upper.includes("DATE") || upper.includes("TIME") || upper.endsWith("_DT")) {
    return { type: "macro", token: "{{$date}}", format: "MM/DD/YYYY" };
  }

  if (
    upper.includes("AMOUNT") ||
    upper.includes("AMT") ||
    upper.includes("PRICE") ||
    upper.includes("TOTAL") ||
    upper.includes("REVENUE") ||
    upper.includes("FEE") ||
    upper.includes("DISCOUNT") ||
    upper.includes("TAX") ||
    upper.includes("SUBTOTAL")
  ) {
    return { type: "range", min: 10.0, max: 5000.0, decimals: 2 };
  }

  if (upper.includes("CURRENCY") || upper === "CURR" || upper === "WAERS") {
    return { type: "constant", value: "PHP" };
  }

  if (upper.includes("STATUS")) {
    return { type: "pool", values: ["Paid", "Completed", "Active", "Processed"] };
  }

  if (upper.includes("TYPE")) {
    return { type: "pool", values: ["Orders", "Refunds", "Adjustments", "Standard"] };
  }

  if (
    upper.includes("NUM") ||
    upper.includes("NO") ||
    upper.includes("ID") ||
    upper.includes("SKU") ||
    upper.includes("REF") ||
    upper.includes("CODE")
  ) {
    return { type: "counter", start: 100001, pad: 8 };
  }

  if (upper.includes("WEIGHT")) {
    return { type: "range", min: 100, max: 2500, decimals: 0 };
  }

  return { type: "constant", value: "" };
}

export interface SynthesizedSpecResult {
  spec: FileSpec;
  rootElementName: string;
  targetNamespace: string;
  recordsetWrapperName?: string;
  itemElementName: string;
  skipHeaderRow?: boolean;
}

export function synthesizeSpecFromChannel(
  interfaceName: string,
  _ico: RawIntegratedConfiguration,
  channel: RawCommunicationChannel
): SynthesizedSpecResult {
  // Pattern 1: FormatConversionBean (Excel2XML / CSV)
  const modParams = channel.ModuleProcess?.ParameterGroup?.[0]?.Parameter || [];
  const fieldNamesParam = modParams.find((p) => p.Name === "fieldNames");

  if (fieldNamesParam) {
    const fieldNames = fieldNamesParam.Value.split(",").map((f) => f.trim()).filter(Boolean);
    const docName = modParams.find((p) => p.Name === "documentName")?.Value || interfaceName;
    const docNs = modParams.find((p) => p.Name === "documentNamespace")?.Value || "http://smretail.com/xi/SMRI";
    const recordName = modParams.find((p) => p.Name === "recordName")?.Value || "Record";

    // Row 1 is header
    const headerFields: FieldSpec[] = fieldNames.map((fn) => ({
      name: fn,
      type: "string",
      rule: { type: "constant", value: fn }
    }));

    // Data rows
    const detailFields: FieldSpec[] = fieldNames.map((fn) => ({
      name: fn,
      type: "string",
      rule: inferRuleFromFieldName(fn)
    }));

    const spec: FileSpec = {
      id: interfaceName.toLowerCase(),
      name: `${interfaceName}.csv`,
      description: `Auto-synthesized spec for ${interfaceName} via ${channel.CommunicationChannelID.ChannelID}`,
      format: "delimited",
      fieldSeparator: ",",
      endSeparator: "\n",
      enclosureSign: "\"",
      recordsets: [
        {
          name: "Header",
          role: "header",
          minOccurs: 1,
          maxOccurs: 1,
          fields: headerFields
        },
        {
          name: recordName,
          role: "detail",
          minOccurs: 1,
          defaultCount: 1,
          fields: detailFields
        }
      ]
    };

    return {
      spec,
      rootElementName: docName,
      targetNamespace: docNs,
      itemElementName: recordName,
      skipHeaderRow: true
    };
  }

  // Pattern 2: Standard FCC (file.conversionParameters)
  const fccTable = channel.AdapterSpecificTableAttribute?.find((t) => t.Name === "file.conversionParameters")?.ValueTableRow || [];
  const struct = String(channel.AdapterSpecificAttribute?.find((a) => a.Name === "xml.recordsetStructure")?.Value || "Record,*");
  const docName = String(channel.AdapterSpecificAttribute?.find((a) => a.Name === "xml.documentName")?.Value || interfaceName);
  const docNs = String(channel.AdapterSpecificAttribute?.find((a) => a.Name === "xml.documentNamespace")?.Value || "http://smretail.com/xi/SMRI");
  const recordsetVal = channel.AdapterSpecificAttribute?.find((a) => a.Name === "xml.recordsetName")?.Value;
  const recordsetName = recordsetVal !== undefined ? String(recordsetVal) : undefined;

  // Extract recordset definitions from struct (e.g., "BEG,1,GV_JV,*,EOF,1" or "Record,*")
  const parts = struct.split(",").map((s: string) => s.trim());
  const recordsetMeta: Array<{ name: string; count: string }> = [];
  for (let i = 0; i < parts.length; i += 2) {
    const pName = parts[i];
    if (pName) {
      recordsetMeta.push({ name: pName, count: parts[i + 1] || "*" });
    }
  }

  const recordsets: any[] = [];
  let primaryDetailName = "Record";

  for (const rs of recordsetMeta) {
    // Look up fieldNames in FCC table
    let fieldNamesStr = "";
    for (const row of fccTable) {
      const cells = row.ValueTableCell || [];
      const paramNameCell = cells.find((c) => c.ColumnName === "file.addConvParamName");
      const paramValCell = cells.find((c) => c.ColumnName === "file.addConvParamValue");
      if (paramNameCell?.Value === `${rs.name}.fieldNames`) {
        fieldNamesStr = paramValCell?.Value || "";
        break;
      }
    }

    const fieldNames = fieldNamesStr ? fieldNamesStr.split(",").map((f) => f.trim()).filter(Boolean) : ["F1", "F2", "F3"];
    const isHeader = rs.name.toUpperCase().includes("BEG") || rs.name.toUpperCase().includes("HEADER");
    const isTrailer = rs.name.toUpperCase().includes("EOF") || rs.name.toUpperCase().includes("TRAILER");
    const role = isHeader ? "header" : isTrailer ? "trailer" : "detail";

    if (role === "detail") {
      primaryDetailName = rs.name;
    }

    const fields: FieldSpec[] = fieldNames.map((fn) => ({
      name: fn,
      type: "string",
      rule: isHeader && fn === fieldNames[0]
        ? { type: "constant", value: rs.name }
        : isTrailer && fn === fieldNames[0]
        ? { type: "constant", value: rs.name }
        : inferRuleFromFieldName(fn)
    }));

    recordsets.push({
      name: rs.name,
      role,
      minOccurs: 1,
      maxOccurs: rs.count === "*" ? undefined : parseInt(rs.count, 10) || 1,
      defaultCount: rs.count === "*" ? 1 : parseInt(rs.count, 10) || 1,
      fields
    });
  }

  const spec: FileSpec = {
    id: interfaceName.toLowerCase(),
    name: `${interfaceName}.csv`,
    description: `Auto-synthesized FCC spec for ${interfaceName}`,
    format: "delimited",
    fieldSeparator: ",",
    endSeparator: "\n",
    enclosureSign: "\"",
    recordsets
  };

  return {
    spec,
    rootElementName: docName,
    targetNamespace: docNs,
    recordsetWrapperName: recordsetName,
    itemElementName: primaryDetailName,
    skipHeaderRow: false
  };
}

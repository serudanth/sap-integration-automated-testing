import { XMLParser } from "fast-xml-parser";

export interface WsdlFieldDefinition {
  name: string;
  type: string;
  minOccurs?: string;
  maxOccurs?: string;
  defaultValue?: string;
}

export interface ParsedSapWsdl {
  interfaceName: string;
  targetNamespace: string;
  rootElementName: string;
  complexTypeName: string;
  recordsetWrapperName?: string;
  itemElementName: string;
  fields: WsdlFieldDefinition[];
  endpointUrl?: string;
}

export function parseSapWsdl(wsdlContent: string): ParsedSapWsdl {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });

  const parsed = parser.parse(wsdlContent);
  const defs = parsed["wsdl:definitions"] || parsed["definitions"] || {};
  const interfaceName = defs["@_name"] || "";
  const targetNamespace = defs["@_targetNamespace"] || "";

  const types = defs["wsdl:types"] || defs["types"] || {};
  const schema = types["xsd:schema"] || types["schema"] || {};

  // Extract root element
  const rootElement = schema["xsd:element"] || schema["element"] || {};
  const rootElementName = rootElement["@_name"] || interfaceName;

  // Extract complexType
  const complexType = schema["xsd:complexType"] || schema["complexType"] || {};
  const complexTypeName = complexType["@_name"] || "";

  const seq = complexType["xsd:sequence"] || complexType["sequence"] || {};
  const wrapperElement = seq["xsd:element"] || seq["element"] || {};

  let recordsetWrapperName: string | undefined;
  let itemElementName = "ITEM";
  let fields: WsdlFieldDefinition[] = [];

  if (wrapperElement["@_name"] && (wrapperElement["xsd:complexType"] || wrapperElement["complexType"])) {
    recordsetWrapperName = wrapperElement["@_name"];
    const subCt = wrapperElement["xsd:complexType"] || wrapperElement["complexType"];
    const subSeq = subCt["xsd:sequence"] || subCt["sequence"] || {};
    const itemElem = subSeq["xsd:element"] || subSeq["element"] || {};

    itemElementName = itemElem["@_name"] || "ITEM";
    const itemCt = itemElem["xsd:complexType"] || itemElem["complexType"] || {};
    const itemSeq = itemCt["xsd:sequence"] || itemCt["sequence"] || {};
    const rawElements = itemSeq["xsd:element"] || itemSeq["element"] || [];
    const elementsList = Array.isArray(rawElements) ? rawElements : [rawElements];

    fields = elementsList.map((el: any) => ({
      name: el["@_name"] || "",
      type: el["@_type"] || "xsd:string",
      minOccurs: el["@_minOccurs"],
      maxOccurs: el["@_maxOccurs"],
      defaultValue: el["@_default"]
    })).filter((f) => f.name.length > 0);
  }

  // Extract endpoint if present
  let endpointUrl: string | undefined;
  const service = defs["wsdl:service"] || defs["service"];
  if (service) {
    const port = service["wsdl:port"] || service["port"];
    const ports = Array.isArray(port) ? port : [port];
    for (const p of ports) {
      if (p && (p["soap:address"] || p["address"])) {
        const addr = p["soap:address"] || p["address"];
        endpointUrl = addr["@_location"];
        break;
      }
    }
  }

  return {
    interfaceName,
    targetNamespace,
    rootElementName,
    complexTypeName,
    recordsetWrapperName,
    itemElementName,
    fields,
    endpointUrl
  };
}

export interface XmlGenerationOptions {
  rowValues?: Record<string, string>[];
  count?: number;
  defaults?: Record<string, string>;
}

export function generatePostFccXml(
  parsed: ParsedSapWsdl,
  options: XmlGenerationOptions = {}
): string {
  const count = options.count ?? (options.rowValues?.length || 1);
  const rows = options.rowValues || [];
  const defaults = options.defaults || {};

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<p1:${parsed.rootElementName} xmlns:p1="${parsed.targetNamespace}">`);

  if (parsed.recordsetWrapperName) {
    lines.push(`  <${parsed.recordsetWrapperName}>`);
  }

  const indent = parsed.recordsetWrapperName ? "    " : "  ";

  for (let i = 0; i < count; i++) {
    const row = rows[i] || {};
    lines.push(`${indent}<${parsed.itemElementName}>`);

    for (const field of parsed.fields) {
      const val = row[field.name] !== undefined ? row[field.name] : (defaults[field.name] ?? field.defaultValue ?? "");
      if (val === "" && field.minOccurs === "0") {
        lines.push(`${indent}  <${field.name}/>`);
      } else {
        const escaped = String(val)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        lines.push(`${indent}  <${field.name}>${escaped}</${field.name}>`);
      }
    }

    lines.push(`${indent}</${parsed.itemElementName}>`);
  }

  if (parsed.recordsetWrapperName) {
    lines.push(`  </${parsed.recordsetWrapperName}>`);
  }

  lines.push(`</p1:${parsed.rootElementName}>`);
  return lines.join("\n");
}

export interface CsvToXmlOptions {
  rootElementName?: string;
  targetNamespace?: string;
  recordsetWrapperName?: string;
  itemElementName?: string;
  fieldNames: string[];
  delimiter?: string;
  quoteChar?: string;
  skipHeaderRow?: boolean;
}

export function convertCsvToPostFccXml(csvContent: string, options: CsvToXmlOptions): string {
  const root = options.rootElementName || "I001_DAC_AP_Invoice_Out";
  const ns = options.targetNamespace || "http://smretail.com/xi/SMRI/S4HANA/FI";
  const wrapper = options.recordsetWrapperName;
  const item = options.itemElementName || "AP_INVOICE";
  const delimiter = options.delimiter || ",";
  const quoteChar = options.quoteChar || '"';

  let lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (options.skipHeaderRow && lines.length > 1) {
    lines = lines.slice(1);
  }

  const outLines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<p1:${root} xmlns:p1="${ns}">`
  ];

  if (wrapper) {
    outLines.push(`  <${wrapper}>`);
  }

  const indent = wrapper ? "    " : "  ";

  for (const line of lines) {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === quoteChar) {
        inQuotes = !inQuotes;
      } else if (c === delimiter && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    fields.push(current.trim());

    outLines.push(`${indent}<${item}>`);
    for (let i = 0; i < fields.length; i++) {
      const fieldName = options.fieldNames[i] || `FIELD_${i}`;
      const val = fields[i];
      if (val === "" || val === undefined) {
        outLines.push(`${indent}  <${fieldName}/>`);
      } else {
        const escaped = val
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        outLines.push(`${indent}  <${fieldName}>${escaped}</${fieldName}>`);
      }
    }
    outLines.push(`${indent}</${item}>`);
  }

  if (wrapper) {
    outLines.push(`  </${wrapper}>`);
  }
  outLines.push(`</p1:${root}>`);
  return outLines.join("\n");
}



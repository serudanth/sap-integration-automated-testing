import { XMLParser } from "fast-xml-parser";

export type SchemaPrimitiveType =
  | "string"
  | "decimal"
  | "integer"
  | "date"
  | "time"
  | "dateTime"
  | "boolean"
  | "complex";

export interface SchemaNode {
  name: string;
  type: SchemaPrimitiveType;
  minOccurs: number;
  maxOccurs: number | "unbounded";
  maxLength?: number;
  fractionDigits?: number;
  totalDigits?: number;
  enumerations?: string[];
  defaultValue?: string;
  children?: SchemaNode[];
}

export interface SchemaTree {
  interfaceName?: string;
  targetNamespace: string;
  rootElementName: string;
  rootNode: SchemaNode;
}

function normalizeType(rawType: string): SchemaPrimitiveType {
  if (!rawType) return "string";
  const clean = rawType.replace(/^(xsd:|xs:|p1:)/, "").toLowerCase();

  if (clean === "string" || clean === "normalizedstring" || clean === "token") return "string";
  if (clean === "decimal" || clean === "float" || clean === "double") return "decimal";
  if (clean === "integer" || clean === "int" || clean === "long" || clean === "short" || clean === "nonnegativeinteger") return "integer";
  if (clean === "date") return "date";
  if (clean === "time") return "time";
  if (clean === "datetime") return "dateTime";
  if (clean === "boolean") return "boolean";

  return "string";
}

function parseElementNode(elemObj: any, complexTypesMap: Map<string, any>, simpleTypesMap: Map<string, any>): SchemaNode {
  const name = elemObj["@_name"] || "";
  let rawType = elemObj["@_type"] || "";
  const minOccurs = elemObj["@_minOccurs"] !== undefined ? Number(elemObj["@_minOccurs"]) : 1;
  const maxOccursRaw = elemObj["@_maxOccurs"];
  const maxOccurs = maxOccursRaw === "unbounded" ? "unbounded" : maxOccursRaw !== undefined ? Number(maxOccursRaw) : 1;
  const defaultValue = elemObj["@_default"];

  // Check for inline complexType or referenced complexType
  const inlineCt = elemObj["xsd:complexType"] || elemObj["xs:complexType"] || elemObj["complexType"];
  const referencedCtName = rawType ? rawType.replace(/^(xsd:|xs:|p1:)/, "") : "";
  const referencedCt = complexTypesMap.get(referencedCtName);
  const ct = inlineCt || referencedCt;

  if (ct) {
    const seq = ct["xsd:sequence"] || ct["xs:sequence"] || ct["sequence"] || ct["xsd:choice"] || ct["xs:choice"] || ct["choice"] || {};
    const rawSubElems = seq["xsd:element"] || seq["xs:element"] || seq["element"] || [];
    const subElemList = Array.isArray(rawSubElems) ? rawSubElems : [rawSubElems].filter(Boolean);

    const children: SchemaNode[] = subElemList.map((sub: any) =>
      parseElementNode(sub, complexTypesMap, simpleTypesMap)
    );

    return {
      name,
      type: "complex",
      minOccurs,
      maxOccurs,
      defaultValue,
      children
    };
  }

  // Check for inline simpleType or referenced simpleType restrictions
  const inlineSt = elemObj["xsd:simpleType"] || elemObj["xs:simpleType"] || elemObj["simpleType"];
  const referencedSt = simpleTypesMap.get(referencedCtName);
  const st = inlineSt || referencedSt;

  let maxLength: number | undefined;
  let fractionDigits: number | undefined;
  let totalDigits: number | undefined;
  let enumerations: string[] | undefined;

  if (st) {
    const restriction = st["xsd:restriction"] || st["xs:restriction"] || st["restriction"];
    if (restriction) {
      if (restriction["@_base"]) {
        rawType = restriction["@_base"];
      }

      const ml = restriction["xsd:maxLength"] || restriction["xs:maxLength"] || restriction["maxLength"];
      if (ml && ml["@_value"]) {
        maxLength = Number(ml["@_value"]);
      }

      const fd = restriction["xsd:fractionDigits"] || restriction["xs:fractionDigits"] || restriction["fractionDigits"];
      if (fd && fd["@_value"]) {
        fractionDigits = Number(fd["@_value"]);
      }

      const td = restriction["xsd:totalDigits"] || restriction["xs:totalDigits"] || restriction["totalDigits"];
      if (td && td["@_value"]) {
        totalDigits = Number(td["@_value"]);
      }

      const enums = restriction["xsd:enumeration"] || restriction["xs:enumeration"] || restriction["enumeration"];
      if (enums) {
        const enumList = Array.isArray(enums) ? enums : [enums];
        enumerations = enumList.map((e: any) => e["@_value"]).filter(Boolean);
      }
    }
  }

  return {
    name,
    type: normalizeType(rawType),
    minOccurs,
    maxOccurs,
    maxLength,
    fractionDigits,
    totalDigits,
    enumerations,
    defaultValue
  };
}

/**
 * Parses raw WSDL or XSD into an AST SchemaTree
 */
export function parseSchema(rawXml: string): SchemaTree {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });

  const parsed = parser.parse(rawXml);

  // Determine if WSDL or XSD
  let schema = parsed["xsd:schema"] || parsed["xs:schema"] || parsed["schema"];
  let targetNamespace = "";
  let interfaceName = "";

  if (!schema) {
    const defs = parsed["wsdl:definitions"] || parsed["definitions"];
    if (defs) {
      interfaceName = defs["@_name"] || "";
      targetNamespace = defs["@_targetNamespace"] || "";
      const types = defs["wsdl:types"] || defs["types"] || {};
      schema = types["xsd:schema"] || types["xs:schema"] || types["schema"];
    }
  }

  if (!schema) {
    throw new Error("Invalid schema: No xsd:schema found in XML content.");
  }

  if (!targetNamespace) {
    targetNamespace = schema["@_targetNamespace"] || "";
  }

  // Index top-level complexTypes and simpleTypes
  const complexTypesMap = new Map<string, any>();
  const rawComplexTypes = schema["xsd:complexType"] || schema["xs:complexType"] || schema["complexType"] || [];
  const complexTypesList = Array.isArray(rawComplexTypes) ? rawComplexTypes : [rawComplexTypes].filter(Boolean);
  for (const ct of complexTypesList) {
    if (ct["@_name"]) {
      complexTypesMap.set(ct["@_name"], ct);
    }
  }

  const simpleTypesMap = new Map<string, any>();
  const rawSimpleTypes = schema["xsd:simpleType"] || schema["xs:simpleType"] || schema["simpleType"] || [];
  const simpleTypesList = Array.isArray(rawSimpleTypes) ? rawSimpleTypes : [rawSimpleTypes].filter(Boolean);
  for (const st of simpleTypesList) {
    if (st["@_name"]) {
      simpleTypesMap.set(st["@_name"], st);
    }
  }

  // Find root element
  const rawElements = schema["xsd:element"] || schema["xs:element"] || schema["element"];
  const elementsList = Array.isArray(rawElements) ? rawElements : [rawElements].filter(Boolean);

  let rootElementObj = elementsList[0];
  if (!rootElementObj && complexTypesList.length > 0) {
    const firstCt = complexTypesList[0];
    rootElementObj = {
      "@_name": firstCt["@_name"] || interfaceName || "Root",
      "@_type": firstCt["@_name"],
      ...firstCt
    };
  }

  if (!rootElementObj) {
    throw new Error("No root element definition found in schema.");
  }

  const rootNode = parseElementNode(rootElementObj, complexTypesMap, simpleTypesMap);

  return {
    interfaceName,
    targetNamespace,
    rootElementName: rootNode.name,
    rootNode
  };
}

export interface SchemaFieldStats {
  totalFields: number;
  requiredFields: number;
  optionalFields: number;
}

export function computeSchemaFieldStats(node: SchemaNode): SchemaFieldStats {
  let totalFields = 0;
  let requiredFields = 0;
  let optionalFields = 0;

  function traverse(n: SchemaNode) {
    if (n.type === "complex" && n.children && n.children.length > 0) {
      for (const child of n.children) {
        traverse(child);
      }
    } else {
      totalFields++;
      if (n.minOccurs === 0) {
        optionalFields++;
      } else {
        requiredFields++;
      }
    }
  }

  traverse(node);
  return { totalFields, requiredFields, optionalFields };
}

import type { SchemaNode, SchemaTree } from "./schema-parser.js";
import type { ExtractedMappingRules } from "./mapping-rule-extractor.js";
import type { Layer1Options } from "./layer1-generator.js";
import { evaluateMacros } from "./macro-evaluator.js";

export interface Layer2Options extends Layer1Options {
  mappingRules?: ExtractedMappingRules | null;
  /**
   * Layer 3 User/Scenario Overrides.
   * Supports static values or generative macros, e.g.:
   *   GL_DATE: "{{rand_month}}/{{rand_day}}/{{rand_year}}"
   *   AMOUNT: "{{rand_decimal:100,5000,2}}"
   */
  overrides?: Record<string, string>;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateFieldValue(
  node: SchemaNode,
  options: Layer2Options,
  rowOverrides?: Record<string, string>,
  rowIndex: number = 0,
  rowRole: "header" | "detail" | "trailer" = "detail",
  recordCount: number = 1
): string {
  const mockDate = options.mockDate ? new Date(options.mockDate) : undefined;
  const macroCtx = { rowIndex, mockDate, recordCount };

  // 1. Layer 3: Check for row-scoped User Overrides (e.g. trailer.RECORD_COUNT, EOF.RECORD_COUNT, trailer.INVOICE_TYPE_LOOKUP_CODE)
  if (options.overrides) {
    const rolePrefixes = [rowRole, rowRole === "header" ? "BEG" : rowRole === "trailer" ? "EOF" : "detail"];
    for (const prefix of rolePrefixes) {
      if (options.overrides[`${prefix}.${node.name}`] !== undefined) {
        return evaluateMacros(options.overrides[`${prefix}.${node.name}`]!, macroCtx);
      }
    }

    // Check alias by target field name (e.g. RECORD_COUNT in trailer row, VERSION in header row)
    const targetMap = rowRole === "header"
      ? options.mappingRules?.headerFieldTargets
      : rowRole === "trailer"
      ? options.mappingRules?.trailerFieldTargets
      : undefined;

    if (targetMap) {
      for (const [targetLeaf, srcField] of Object.entries(targetMap)) {
        if (srcField === node.name) {
          if (options.overrides[targetLeaf] !== undefined) {
            return evaluateMacros(options.overrides[targetLeaf]!, macroCtx);
          }
          for (const prefix of rolePrefixes) {
            if (options.overrides[`${prefix}.${targetLeaf}`] !== undefined) {
              return evaluateMacros(options.overrides[`${prefix}.${targetLeaf}`]!, macroCtx);
            }
          }
        }
      }
    }
  }

  // 2. Specific row override from Mapping Rules (Header / Trailer)
  if (rowOverrides && rowOverrides[node.name] !== undefined) {
    return evaluateMacros(rowOverrides[node.name]!, macroCtx);
  }

  // 3. Layer 3: Unscoped User/Scenario Overrides with generative macro resolution (applies to detail rows)
  if (options.overrides && options.overrides[node.name] !== undefined && rowRole === "detail") {
    const template = options.overrides[node.name]!;
    return evaluateMacros(template, macroCtx);
  }

  // 4. General field override from Mapping Rules
  if (options.mappingRules?.fieldOverrides[node.name] !== undefined) {
    return options.mappingRules.fieldOverrides[node.name]!;
  }

  // 5. XSD Default value
  if (node.defaultValue !== undefined) {
    return node.defaultValue;
  }

  // 6. XSD Enumeration restriction
  if (node.enumerations && node.enumerations.length > 0 && node.enumerations[0] !== undefined) {
    return node.enumerations[0];
  }

  // 7. Layer 1 Primitive types
  switch (node.type) {
    case "date":
      return options.mockDate ? options.mockDate.slice(0, 10) : "2026-10-22";

    case "time":
      return "12:00:00";

    case "dateTime":
      return options.mockDate ? options.mockDate : "2026-10-22T12:00:00Z";

    case "decimal": {
      const decimals = node.fractionDigits !== undefined ? node.fractionDigits : 2;
      return (100.0).toFixed(decimals);
    }

    case "integer":
      return "1001";

    case "boolean":
      return "true";

    case "string":
    default: {
      let val = `TEST_${node.name}`;
      if (node.maxLength && val.length > node.maxLength) {
        val = val.slice(0, node.maxLength);
      }
      return val;
    }
  }
}

function renderNode(
  node: SchemaNode,
  options: Layer2Options,
  indent: string = "  ",
  rowOverrides?: Record<string, string>,
  currentRowIndex: number = 0,
  currentRowRole: "header" | "detail" | "trailer" = "detail"
): string[] {
  const isRepeating =
    node.maxOccurs === "unbounded" || (typeof node.maxOccurs === "number" && node.maxOccurs > 1);
  const totalCount = isRepeating ? options.repeatCount ?? 1 : 1;

  const headerOverrides = options.mappingRules?.headerOverrides;
  const trailerOverrides = options.mappingRules?.trailerOverrides;
  const hasHeader = headerOverrides && Object.keys(headerOverrides).length > 0;
  const hasTrailer = trailerOverrides && Object.keys(trailerOverrides).length > 0;
  const detailCount = Math.max(1, totalCount - (hasHeader ? 1 : 0) - (hasTrailer ? 1 : 0));

  // A field is a discriminator if it appears in an equality condition rule (e.g. INVOICE_NUM == "BEG")
  const isDiscriminatorField = Boolean(
    options.mappingRules?.rules?.some(
      (r) => (r.role === "header" || r.role === "trailer") && r.srcField === node.name
    )
  );

  // Check if primitive node has explicit override or is discriminator
  const hasUserOverride = Boolean(
    options.overrides && (
      (currentRowRole === "detail" && options.overrides[node.name] !== undefined) ||
      options.overrides[`${currentRowRole}.${node.name}`] !== undefined ||
      (currentRowRole === "header" && options.mappingRules?.headerFieldTargets && Object.entries(options.mappingRules.headerFieldTargets).some(([t, s]) => s === node.name && (options.overrides![t] !== undefined || options.overrides![`header.${t}`] !== undefined || options.overrides![`BEG.${t}`] !== undefined))) ||
      (currentRowRole === "trailer" && options.mappingRules?.trailerFieldTargets && Object.entries(options.mappingRules.trailerFieldTargets).some(([t, s]) => s === node.name && (options.overrides![t] !== undefined || options.overrides![`trailer.${t}`] !== undefined || options.overrides![`EOF.${t}`] !== undefined)))
    )
  );

  let isTransitivelyMandatory = false;
  if (options.mappingRules) {
    if (currentRowRole === "header") {
      isTransitivelyMandatory = Boolean(
        options.mappingRules.headerMandatorySourceFields?.includes(node.name) ||
        (options.mappingRules.headerOverrides && options.mappingRules.headerOverrides[node.name] !== undefined) ||
        (options.mappingRules.headerFieldTargets && Object.values(options.mappingRules.headerFieldTargets).includes(node.name))
      );
    } else if (currentRowRole === "trailer") {
      isTransitivelyMandatory = Boolean(
        options.mappingRules.trailerMandatorySourceFields?.includes(node.name) ||
        (options.mappingRules.trailerOverrides && options.mappingRules.trailerOverrides[node.name] !== undefined) ||
        (options.mappingRules.trailerFieldTargets && Object.values(options.mappingRules.trailerFieldTargets).includes(node.name))
      );
    } else {
      isTransitivelyMandatory = Boolean(
        options.mappingRules.detailMandatorySourceFields?.includes(node.name)
      );
    }
  }

  const hasExplicitOverride =
    (rowOverrides && rowOverrides[node.name] !== undefined) ||
    hasUserOverride ||
    (options.mappingRules?.fieldOverrides && options.mappingRules.fieldOverrides[node.name] !== undefined) ||
    isDiscriminatorField ||
    isTransitivelyMandatory;

  // If primitive node is optional and populateOptional is false, skip unless overridden
  if (node.type !== "complex" && node.minOccurs === 0 && options.populateOptional === false && !hasExplicitOverride) {
    return [];
  }

  const lines: string[] = [];

  for (let i = 0; i < totalCount; i++) {
    // Determine active overrides for this specific repeating row
    let activeRowOverrides: Record<string, string> | undefined = rowOverrides;
    const rowIndex = isRepeating ? i : currentRowIndex;
    let rowRole: "header" | "detail" | "trailer" = isRepeating ? "detail" : currentRowRole;

    if (isRepeating && node.type === "complex") {
      if (i === 0 && hasHeader) {
        activeRowOverrides = headerOverrides;
        rowRole = "header";
      } else if (i === totalCount - 1 && hasTrailer && totalCount > 1) {
        activeRowOverrides = trailerOverrides;
        rowRole = "trailer";
      } else {
        activeRowOverrides = undefined;
        rowRole = "detail";
      }
    }

    if (node.type === "complex" && node.children && node.children.length > 0) {
      const childLines: string[] = [];
      for (const child of node.children) {
        childLines.push(...renderNode(child, options, indent + "  ", activeRowOverrides, rowIndex, rowRole));
      }
      // If all children were omitted and the complex element itself is optional, skip this complex element
      if (childLines.length === 0 && node.minOccurs === 0 && !isRepeating) {
        continue;
      }
      lines.push(`${indent}<${node.name}>`);
      lines.push(...childLines);
      lines.push(`${indent}</${node.name}>`);
    } else {
      const val = generateFieldValue(node, options, activeRowOverrides, rowIndex, rowRole, detailCount);
      if (val === "" && node.minOccurs === 0) {
        lines.push(`${indent}<${node.name}/>`);
      } else {
        lines.push(`${indent}<${node.name}>${escapeXml(val)}</${node.name}>`);
      }
    }
  }

  return lines;
}

/**
 * Generates valid XML for a SchemaTree enforcing Layer 1 (Schema), Layer 2 (Mapping Rules),
 * and Layer 3 (User/Scenario Overrides with Generative Macros)
 */
export function generateLayer2Xml(
  tree: SchemaTree,
  options: Layer2Options = {}
): string {
  const root = tree.rootNode;
  const nsDecl = tree.targetNamespace ? ` xmlns:p1="${tree.targetNamespace}"` : "";
  const rootTag = tree.targetNamespace ? `p1:${root.name}` : root.name;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<${rootTag}${nsDecl}>`);

  if (root.type === "complex" && root.children) {
    for (const child of root.children) {
      lines.push(...renderNode(child, options, "  "));
    }
  } else {
    lines.push(`  ${generateFieldValue(root, options, undefined, 0)}`);
  }

  lines.push(`</${rootTag}>`);

  return lines.join("\n");
}

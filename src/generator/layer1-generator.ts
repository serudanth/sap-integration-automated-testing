import type { SchemaNode, SchemaTree } from "./schema-parser.js";

export interface Layer1Options {
  /**
   * Number of repetitions for unbounded/repeating elements (default: 1)
   */
  repeatCount?: number;

  /**
   * Whether to populate optional fields (minOccurs === 0) with valid mock data.
   * Default: true (so mapping has realistic fields to work with).
   */
  populateOptional?: boolean;

  /**
   * Custom date override (defaults to current date ISO)
   */
  mockDate?: string;
}

function generatePrimitiveValue(node: SchemaNode, options: Layer1Options): string {
  if (node.defaultValue !== undefined) {
    return node.defaultValue;
  }

  // Enumeration enforcement: always pick first valid enumeration
  if (node.enumerations && node.enumerations.length > 0 && node.enumerations[0] !== undefined) {
    return node.enumerations[0];
  }

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
  options: Layer1Options,
  indent: string = "  "
): string[] {
  const isRepeating =
    node.maxOccurs === "unbounded" || (typeof node.maxOccurs === "number" && node.maxOccurs > 1);

  // If leaf primitive node is optional and populateOptional is false, skip
  if (node.type !== "complex" && node.minOccurs === 0 && options.populateOptional === false) {
    return [];
  }

  const lines: string[] = [];

  // Determine how many times to repeat this element
  const count = isRepeating ? options.repeatCount ?? 1 : 1;

  for (let i = 0; i < count; i++) {
    if (node.type === "complex" && node.children && node.children.length > 0) {
      const childLines: string[] = [];
      for (const child of node.children) {
        childLines.push(...renderNode(child, options, indent + "  "));
      }
      // If all children were omitted and the complex element itself is optional, skip this complex element
      if (childLines.length === 0 && node.minOccurs === 0 && !isRepeating) {
        continue;
      }
      lines.push(`${indent}<${node.name}>`);
      lines.push(...childLines);
      lines.push(`${indent}</${node.name}>`);
    } else {
      const val = generatePrimitiveValue(node, options);
      if (val === "" && node.minOccurs === 0) {
        lines.push(`${indent}<${node.name}/>`);
      } else {
        lines.push(`${indent}<${node.name}>${escapeXml(val)}</${node.name}>`);
      }
    }
  }

  return lines;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates valid XML for a SchemaTree enforcing Layer 1 schema-level constraints
 */
export function generateLayer1Xml(
  tree: SchemaTree,
  options: Layer1Options = {}
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
    lines.push(`  ${generatePrimitiveValue(root, options)}`);
  }

  lines.push(`</${rootTag}>`);

  return lines.join("\n");
}

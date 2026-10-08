import { XMLParser } from 'fast-xml-parser';
import type { DiffOptions, DiffResult, DifferenceItem } from '../types/index.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false
});

const DEFAULT_VOLATILE_FIELDS = [
  'uuid',
  'guid',
  'timestamp',
  'time',
  'date',
  'creationdatetime',
  'changedatetime',
  'createdat',
  'sentat',
  'messageid',
  'correlationid',
  'sessionid',
  'sap_passport'
];

/**
 * Removes namespace prefixes from element tags and attribute names
 * (e.g. "ns0:PurchaseOrder" -> "PurchaseOrder", "@_xmlns:ns0" -> removed).
 */
export function stripNamespacePrefix(key: string): string {
  // If it's a namespace declaration attribute, return empty to filter it out
  if (key.startsWith('@_xmlns:') || key === '@_xmlns') {
    return '';
  }

  // If attribute with prefix: @_p1:attr -> @_attr
  if (key.startsWith('@_')) {
    const attrName = key.slice(2);
    const colonIndex = attrName.indexOf(':');
    return colonIndex !== -1 ? `@_${attrName.slice(colonIndex + 1)}` : key;
  }

  // Tag with prefix: ns0:Tag -> Tag
  const colonIndex = key.indexOf(':');
  return colonIndex !== -1 ? key.slice(colonIndex + 1) : key;
}

/**
 * Recursively normalizes a parsed data structure (object or array):
 * - Strips namespace prefixes
 * - Removes ignored/volatile fields
 * - Sorts object keys deterministically
 * - Trims strings
 */
export function normalizeAst(
  node: any,
  options: DiffOptions = {}
): any {
  if (node === null || node === undefined) {
    return null;
  }

  if (typeof node === 'string') {
    return options.ignoreWhitespace ? node.trim() : node;
  }

  if (typeof node !== 'object') {
    return node;
  }

  if (Array.isArray(node)) {
    const normalizedArray = node.map((item) => normalizeAst(item, options));
    if (options.arrayOrderInsensitive) {
      // Sort array items deterministically by JSON representation
      return normalizedArray.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    return normalizedArray;
  }

  const ignoreList = [
    ...DEFAULT_VOLATILE_FIELDS,
    ...(options.ignorePaths || []).map((p) => p.toLowerCase())
  ];

  const result: Record<string, any> = {};
  const keys = Object.keys(node);

  for (const rawKey of keys) {
    const normalizedKey = options.normalizeNamespaces !== false
      ? stripNamespacePrefix(rawKey)
      : rawKey;

    if (!normalizedKey) {
      // Namespace declaration attribute, ignore
      continue;
    }

    // Check volatile field list
    const lowerKey = normalizedKey.replace(/^@_/, '').toLowerCase();
    if (ignoreList.includes(lowerKey)) {
      continue;
    }

    // Check regex ignores
    if (options.ignoreRegex && options.ignoreRegex.some((pattern) => new RegExp(pattern, 'i').test(lowerKey))) {
      continue;
    }

    const value = node[rawKey];
    result[normalizedKey] = normalizeAst(value, options);
  }

  // Sort keys alphabetically
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(result).sort()) {
    sorted[k] = result[k];
  }

  return sorted;
}

/**
 * Parses a string content into an AST object (auto-detects XML or JSON).
 */
export function parseContentToAst(content: string): { ast: any; type: 'xml' | 'json' | 'text' } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ast: {}, type: 'text' };
  }

  if (trimmed.startsWith('<')) {
    try {
      const parsed = xmlParser.parse(trimmed);
      return { ast: parsed, type: 'xml' };
    } catch {
      // Fallback
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return { ast: parsed, type: 'json' };
    } catch {
      // Fallback
    }
  }

  return { ast: trimmed, type: 'text' };
}

/**
 * Compares two normalized ASTs and returns list of structural differences.
 */
export function compareAstNodes(
  expected: any,
  actual: any,
  currentPath = '$'
): DifferenceItem[] {
  const diffs: DifferenceItem[] = [];

  if (expected === actual) {
    return diffs;
  }

  if (typeof expected !== typeof actual) {
    diffs.push({
      path: currentPath,
      reason: `Type mismatch: expected "${typeof expected}", received "${typeof actual}"`,
      expected,
      actual
    });
    return diffs;
  }

  if (typeof expected !== 'object' || expected === null || actual === null) {
    if (expected !== actual) {
      diffs.push({
        path: currentPath,
        reason: `Value mismatch: expected "${expected}", received "${actual}"`,
        expected,
        actual
      });
    }
    return diffs;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push({
        path: currentPath,
        reason: 'Type mismatch: expected Array, received Object',
        expected,
        actual
      });
      return diffs;
    }

    if (expected.length !== actual.length) {
      diffs.push({
        path: currentPath,
        reason: `Array length mismatch: expected ${expected.length} items, received ${actual.length}`,
        expected: expected.length,
        actual: actual.length
      });
    }

    const minLen = Math.min(expected.length, actual.length);
    for (let i = 0; i < minLen; i++) {
      diffs.push(...compareAstNodes(expected[i], actual[i], `${currentPath}[${i}]`));
    }
    return diffs;
  }

  // Object comparison
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);

  // Check missing keys in actual
  for (const key of expectedKeys) {
    if (!(key in actual)) {
      diffs.push({
        path: `${currentPath}.${key}`,
        reason: `Missing key in actual: "${key}"`,
        expected: expected[key],
        actual: undefined
      });
    } else {
      diffs.push(...compareAstNodes(expected[key], actual[key], `${currentPath}.${key}`));
    }
  }

  // Check unexpected keys in actual
  for (const key of actualKeys) {
    if (!(key in expected)) {
      diffs.push({
        path: `${currentPath}.${key}`,
        reason: `Unexpected key in actual: "${key}"`,
        expected: undefined,
        actual: actual[key]
      });
    }
  }

  return diffs;
}

/**
 * Performs canonical XML or JSON diffing between response A and response B.
 */
export function canonicalDiff(
  responseA: string,
  responseB: string,
  options: DiffOptions = {}
): DiffResult {
  const parsedA = parseContentToAst(responseA);
  const parsedB = parseContentToAst(responseB);

  const normalizedA = normalizeAst(parsedA.ast, options);
  const normalizedB = normalizeAst(parsedB.ast, options);

  const differences = compareAstNodes(normalizedA, normalizedB);
  const matched = differences.length === 0;

  const canonicalA = JSON.stringify(normalizedA, null, 2);
  const canonicalB = JSON.stringify(normalizedB, null, 2);

  const summary = matched
    ? 'Canonical Parity Certified: 100% equivalence (0 differences)'
    : `Parity Discrepancy: ${differences.length} difference(s) detected`;

  return {
    matched,
    differences,
    canonicalA,
    canonicalB,
    summary
  };
}

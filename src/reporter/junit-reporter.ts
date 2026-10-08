import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { SmokeTestSummary, ParityTestResult } from '../types/index.js';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates JUnit XML string from smoke test results.
 */
export function generateSmokeJunitXml(summary: SmokeTestSummary): string {
  const timeSeconds = (summary.durationMs / 1000).toFixed(3);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites name="AetherFlow Smoke Tests" tests="${summary.total}" failures="${summary.failed}" errors="0" time="${timeSeconds}">\n`;
  xml += `  <testsuite name="SAP PI/PO Smoke Verification" tests="${summary.total}" failures="${summary.failed}" errors="0" time="${timeSeconds}">\n`;

  for (const r of summary.results) {
    const testTime = (r.durationMs / 1000).toFixed(3);
    const caseName = escapeXml(`${r.endpoint.senderComponent} -> ${r.endpoint.interfaceName} (${r.endpoint.qos})`);
    const className = escapeXml(r.endpoint.interfaceNamespace || 'SAP.PIPO.Interface');

    xml += `    <testcase name="${caseName}" classname="${className}" time="${testTime}">\n`;
    if (!r.passed) {
      const msg = escapeXml(r.error || `HTTP ${r.statusCode} Error`);
      xml += `      <failure message="${msg}" type="SmokeTestFailure">\n`;
      xml += `Endpoint: ${escapeXml(r.endpoint.urlPath)}\n`;
      xml += `HTTP Status: ${r.statusCode}\n`;
      xml += `SOAP Fault: ${r.isSoapFault}\n`;
      if (r.error) xml += `Details: ${escapeXml(r.error)}\n`;
      xml += `      </failure>\n`;
    }
    xml += `    </testcase>\n`;
  }

  xml += `  </testsuite>\n`;
  xml += `</testsuites>\n`;
  return xml;
}

/**
 * Generates JUnit XML string from parity test results.
 */
export function generateParityJunitXml(result: ParityTestResult): string {
  const timeSeconds = (result.durationMs / 1000).toFixed(3);
  const failures = result.passed ? 0 : 1;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites name="AetherFlow Parity Tests" tests="1" failures="${failures}" errors="0" time="${timeSeconds}">\n`;
  xml += `  <testsuite name="Migration Parity" tests="1" failures="${failures}" errors="0" time="${timeSeconds}">\n`;
  xml += `    <testcase name="Dual-Run Parity: ${escapeXml(result.interfaceName)}" classname="SAP.Migration.Parity" time="${timeSeconds}">\n`;

  if (!result.passed) {
    const msg = escapeXml(result.diff.summary);
    xml += `      <failure message="${msg}" type="ParityDifference">\n`;
    xml += `Differences found: ${result.diff.differences.length}\n`;
    for (const d of result.diff.differences.slice(0, 20)) {
      xml += `Path: ${escapeXml(d.path)} - ${escapeXml(d.reason)}\n`;
    }
    xml += `      </failure>\n`;
  }

  xml += `    </testcase>\n`;
  xml += `  </testsuite>\n`;
  xml += `</testsuites>\n`;
  return xml;
}

/**
 * Saves JUnit XML to file, ensuring parent directory exists.
 */
export async function saveJunitReport(filePath: string, xmlContent: string): Promise<void> {
  const fullPath = resolve(filePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, xmlContent, 'utf-8');
}

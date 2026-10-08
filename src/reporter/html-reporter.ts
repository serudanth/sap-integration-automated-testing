import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ParityTestResult, StressMetrics } from '../types/index.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an interactive HTML report for a migration parity test.
 */
export function generateParityHtmlReport(result: ParityTestResult): string {
  const statusColor = result.passed ? '#10b981' : '#ef4444';
  const statusText = result.passed ? 'PASSED: 100% PARITY CERTIFIED' : 'FAILED: DISCREPANCY DETECTED';

  const diffRows = result.diff.differences.map((d) => `
    <tr>
      <td class="code-font">${escapeHtml(d.path)}</td>
      <td>${escapeHtml(d.reason)}</td>
      <td class="code-font diff-expected">${escapeHtml(JSON.stringify(d.expected, null, 2) || 'undefined')}</td>
      <td class="code-font diff-actual">${escapeHtml(JSON.stringify(d.actual, null, 2) || 'undefined')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AetherFlow Parity Report - ${escapeHtml(result.interfaceName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 1300px; margin: 0 auto; }
    h1 { margin-bottom: 8px; color: #38bdf8; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-weight: bold; font-size: 14px; background: ${statusColor}; color: #000; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-top: 20px; border: 1px solid #334155; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 16px; }
    .metric { background: #0f172a; padding: 14px; border-radius: 8px; }
    .metric-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; }
    .metric-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #334155; font-size: 14px; }
    th { background: #0f172a; color: #94a3b8; }
    .code-font { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
    .diff-expected { color: #facc15; }
    .diff-actual { color: #f87171; }
    .dual-pane { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
    pre { background: #0f172a; padding: 14px; border-radius: 8px; overflow-x: auto; max-height: 400px; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AetherFlow Migration Parity Report</h1>
    <div class="badge">${statusText}</div>

    <div class="card">
      <h2>Execution Overview</h2>
      <div class="grid">
        <div class="metric"><div class="metric-title">Interface</div><div class="metric-value">${escapeHtml(result.interfaceName)}</div></div>
        <div class="metric"><div class="metric-title">Duration</div><div class="metric-value">${result.durationMs}ms</div></div>
        <div class="metric"><div class="metric-title">PI/PO Status</div><div class="metric-value">${result.pipoResponse.statusCode} (${result.pipoResponse.durationMs}ms)</div></div>
        <div class="metric"><div class="metric-title">CPI Status</div><div class="metric-value">${result.cpiResponse.statusCode} (${result.cpiResponse.durationMs}ms)</div></div>
        <div class="metric"><div class="metric-title">Differences</div><div class="metric-value">${result.diff.differences.length}</div></div>
      </div>
    </div>

    ${result.diff.differences.length > 0 ? `
    <div class="card">
      <h2>Differences Detail</h2>
      <table>
        <thead>
          <tr>
            <th>Field Path</th>
            <th>Reason</th>
            <th>PI/PO Expected</th>
            <th>CPI Actual</th>
          </tr>
        </thead>
        <tbody>
          ${diffRows}
        </tbody>
      </table>
    </div>` : ''}

    <div class="card">
      <h2>Canonical Normalized Payloads</h2>
      <div class="dual-pane">
        <div>
          <h3>SAP PI/PO (Target A)</h3>
          <pre><code>${escapeHtml(result.diff.canonicalA)}</code></pre>
        </div>
        <div>
          <h3>SAP BTP CPI (Target B)</h3>
          <pre><code>${escapeHtml(result.diff.canonicalB)}</code></pre>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates an interactive HTML report for stress test benchmark results.
 */
export function generateStressHtmlReport(metrics: StressMetrics): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AetherFlow Stress Benchmark - ${escapeHtml(metrics.interfaceName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #38bdf8; margin-bottom: 8px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-top: 20px; border: 1px solid #334155; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 16px; }
    .metric { background: #0f172a; padding: 14px; border-radius: 8px; }
    .metric-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; }
    .metric-value { font-size: 22px; font-weight: bold; margin-top: 4px; color: #38bdf8; }
    .green { color: #10b981; }
    .red { color: #ef4444; }
    .yellow { color: #facc15; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AetherFlow High-Throughput Stress Benchmark</h1>
    <div class="card">
      <h2>Benchmark Summary: ${escapeHtml(metrics.interfaceName)}</h2>
      <div class="grid">
        <div class="metric"><div class="metric-title">Dispatched</div><div class="metric-value">${metrics.totalRequests}</div></div>
        <div class="metric"><div class="metric-title">Successful</div><div class="metric-value green">${metrics.successfulRequests}</div></div>
        <div class="metric"><div class="metric-title">Failed</div><div class="metric-value ${metrics.failedRequests > 0 ? 'red' : 'green'}">${metrics.failedRequests}</div></div>
        <div class="metric"><div class="metric-title">Achieved Throughput</div><div class="metric-value">${metrics.achievedTps} TPS</div></div>
        <div class="metric"><div class="metric-title">Target Throughput</div><div class="metric-value">${metrics.targetTps} TPS</div></div>
        <div class="metric"><div class="metric-title">Duration</div><div class="metric-value">${metrics.totalDurationSeconds}s</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Latency Distribution (ms)</h2>
      <div class="grid">
        <div class="metric"><div class="metric-title">Min Latency</div><div class="metric-value">${metrics.latencies.min}ms</div></div>
        <div class="metric"><div class="metric-title">Median (p50)</div><div class="metric-value">${metrics.latencies.median}ms</div></div>
        <div class="metric"><div class="metric-title">Mean Latency</div><div class="metric-value">${metrics.latencies.mean}ms</div></div>
        <div class="metric"><div class="metric-title">90th Percentile (p90)</div><div class="metric-value">${metrics.latencies.p90}ms</div></div>
        <div class="metric"><div class="metric-title">95th Percentile (p95)</div><div class="metric-value yellow">${metrics.latencies.p95}ms</div></div>
        <div class="metric"><div class="metric-title">99th Percentile (p99)</div><div class="metric-value red">${metrics.latencies.p99}ms</div></div>
        <div class="metric"><div class="metric-title">Max Latency</div><div class="metric-value red">${metrics.latencies.max}ms</div></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Saves HTML content to a file, creating parent directories if needed.
 */
export async function saveHtmlReport(filePath: string, htmlContent: string): Promise<void> {
  const fullPath = resolve(filePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, htmlContent, 'utf-8');
}

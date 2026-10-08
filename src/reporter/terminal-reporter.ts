import Table from 'cli-table3';
import pc from 'picocolors';
import type {
  DiscoveredEndpoint,
  SmokeTestSummary,
  ParityTestResult,
  StressMetrics
} from '../types/index.js';

/**
 * Prints a formatted CLI table of discovered integration endpoints.
 */
export function printDiscoveryTable(endpoints: DiscoveredEndpoint[]): void {
  console.log(pc.bold(pc.cyan(`\nDiscovered ${endpoints.length} Runtime Integration Endpoints:`)));

  const table = new Table({
    head: [
      pc.bold('Interface Name'),
      pc.bold('Sender Component'),
      pc.bold('Receiver Component'),
      pc.bold('QoS'),
      pc.bold('Endpoint Path')
    ],
    colWidths: [30, 20, 20, 8, 45],
    wordWrap: true
  });

  for (const ep of endpoints) {
    table.push([
      pc.yellow(ep.interfaceName),
      ep.senderComponent,
      ep.receiverComponent || pc.dim('N/A'),
      ep.qos === 'BE' ? pc.magenta(ep.qos) : pc.blue(ep.qos),
      pc.dim(ep.urlPath.length > 42 ? ep.urlPath.slice(0, 39) + '...' : ep.urlPath)
    ]);
  }

  console.log(table.toString());
}

/**
 * Prints a summary table of smoke test results.
 */
export function printSmokeSummary(summary: SmokeTestSummary): void {
  console.log(pc.bold(pc.cyan(`\nSmoke Test Execution Summary:`)));

  const table = new Table({
    head: [
      pc.bold('Status'),
      pc.bold('Interface'),
      pc.bold('HTTP Code'),
      pc.bold('Latency (ms)'),
      pc.bold('MessageID / Error')
    ],
    colWidths: [10, 32, 12, 15, 38],
    wordWrap: true
  });

  for (const res of summary.results) {
    const statusCol = res.passed ? pc.green('PASSED') : pc.red('FAILED');
    const msgOrErr = res.error
      ? pc.red(res.error)
      : res.messageId
      ? pc.green(res.messageId)
      : pc.dim('-');

    table.push([
      statusCol,
      pc.yellow(res.endpoint.interfaceName),
      res.statusCode > 0 ? String(res.statusCode) : pc.dim('ERR'),
      `${res.durationMs}ms`,
      msgOrErr
    ]);
  }

  console.log(table.toString());

  const rateColor = summary.failed === 0 ? pc.green : pc.red;
  console.log(
    `Total: ${summary.total} | ` +
    `Passed: ${pc.green(summary.passed)} | ` +
    `Failed: ${rateColor(summary.failed)} | ` +
    `Duration: ${Math.round(summary.durationMs / 1000 * 10) / 10}s\n`
  );
}

/**
 * Prints the results of a migration parity dual-run test.
 */
export function printParityResult(result: ParityTestResult): void {
  console.log(pc.bold(pc.cyan(`\nMigration Parity Test Result: ${result.interfaceName}`)));

  const statusBadge = result.passed
    ? pc.bgGreen(pc.black(' PARITY CERTIFIED (PASSED) '))
    : pc.bgRed(pc.white(' PARITY DISCREPANCY (FAILED) '));

  console.log(`\nOutcome: ${statusBadge}\n`);
  console.log(`Payload File:    ${pc.dim(result.payloadFile)}`);
  console.log(`Duration:        ${result.durationMs}ms`);
  console.log(`PI/PO Status:    ${result.pipoResponse.statusCode} (${result.pipoResponse.durationMs}ms)`);
  console.log(`BTP CPI Status:  ${result.cpiResponse.statusCode} (${result.cpiResponse.durationMs}ms)`);
  console.log(`Summary:         ${result.diff.summary}\n`);

  if (!result.diff.matched && result.diff.differences.length > 0) {
    console.log(pc.bold(pc.red(`Detected ${result.diff.differences.length} Structural / Content Differences:`)));

    const diffTable = new Table({
      head: [pc.bold('Field Path'), pc.bold('Reason'), pc.bold('PI/PO (Expected)'), pc.bold('CPI (Actual)')],
      colWidths: [25, 30, 25, 25],
      wordWrap: true
    });

    for (const d of result.diff.differences.slice(0, 15)) {
      diffTable.push([
        pc.yellow(d.path),
        d.reason,
        pc.dim(JSON.stringify(d.expected) || 'N/A'),
        pc.red(JSON.stringify(d.actual) || 'N/A')
      ]);
    }

    console.log(diffTable.toString());
    if (result.diff.differences.length > 15) {
      console.log(pc.dim(`... and ${result.diff.differences.length - 15} more differences (see HTML report).`));
    }
  }
}

/**
 * Prints high-throughput stress test metrics and latency histograms.
 */
export function printStressMetrics(metrics: StressMetrics): void {
  console.log(pc.bold(pc.cyan(`\nStress Test Benchmark Metrics: ${metrics.interfaceName}`)));

  const table = new Table({
    head: [pc.bold('Metric'), pc.bold('Value')],
    colWidths: [30, 30]
  });

  table.push(
    ['Interface Tested', pc.yellow(metrics.interfaceName)],
    ['Total Requests Dispatched', metrics.totalRequests.toString()],
    ['Successful (2xx)', pc.green(metrics.successfulRequests.toString())],
    ['Failed Requests', metrics.failedRequests > 0 ? pc.red(metrics.failedRequests.toString()) : pc.green('0')],
    ['Target Throughput', `${metrics.targetTps} TPS`],
    ['Achieved Throughput', pc.bold(pc.cyan(`${metrics.achievedTps} TPS`))],
    ['Total Test Duration', `${metrics.totalDurationSeconds}s`],
    ['Latency: Min', `${metrics.latencies.min}ms`],
    ['Latency: Mean', `${metrics.latencies.mean}ms`],
    ['Latency: Median (p50)', `${metrics.latencies.median}ms`],
    ['Latency: p90', `${metrics.latencies.p90}ms`],
    ['Latency: p95', pc.yellow(`${metrics.latencies.p95}ms`)],
    ['Latency: p99', pc.red(`${metrics.latencies.p99}ms`)],
    ['Latency: Max', `${metrics.latencies.max}ms`]
  );

  console.log(table.toString());

  if (Object.keys(metrics.errors).length > 0) {
    console.log(pc.bold(pc.red('\nEncountered Error Breakdown:')));
    for (const [err, count] of Object.entries(metrics.errors)) {
      console.log(` - ${pc.red(err)}: ${count} occurrences`);
    }
  }
}

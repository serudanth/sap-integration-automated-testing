#!/usr/bin/env node
import { Command } from 'commander';
import dotenv from 'dotenv';
import ora from 'ora';
import pc from 'picocolors';
import { loadInventory, filterEndpoints } from '../discovery/inventory-loader.js';
import { discoverEndpoints } from '../discovery/endpoint-generator.js';
import { loadHostsConfig, resolveHostConfig, assertNonProduction } from '../config/index.js';
import { runSmokeTests } from '../engine/smoke-runner.js';
import { runParityTest } from '../engine/parity-runner.js';
import { runStressTest, parseDurationToSeconds } from '../engine/load-generator.js';
import {
  printDiscoveryTable,
  printSmokeSummary,
  printParityResult,
  printStressMetrics
} from '../reporter/terminal-reporter.js';
import { generateSmokeJunitXml, generateParityJunitXml, saveJunitReport } from '../reporter/junit-reporter.js';
import { generateParityHtmlReport, generateStressHtmlReport, saveHtmlReport } from '../reporter/html-reporter.js';

dotenv.config();

const program = new Command();

program
  .name('aetherflow')
  .description('AetherFlow Test Engine: SAP PI/PO & SAP Integration Suite Automated Test, Parity & Stress Harness')
  .version('1.0.0');

// 1. COMMAND: DISCOVER
program
  .command('discover')
  .description('Discover runtime messaging endpoints from an exported ICO inventory')
  .requiredOption('-i, --inventory <path>', 'Path or ID of the inventory JSON file')
  .option('--filter <interfaceName>', 'Filter endpoints by interface name')
  .option('--sender <senderComponent>', 'Filter by sender component')
  .option('--receiver <receiverComponent>', 'Filter by receiver component')
  .option('--qos <qos>', 'Filter by Quality of Service (BE or EO)')
  .option('--limit <number>', 'Limit number of results', parseInt)
  .action(async (options) => {
    const spinner = ora('Loading inventory and extracting endpoints...').start();
    try {
      const inventory = await loadInventory(options.inventory);
      const endpoints = discoverEndpoints(inventory);
      const filtered = filterEndpoints(endpoints, {
        interfaceName: options.filter,
        senderComponent: options.sender,
        receiverComponent: options.receiver,
        qos: options.qos,
        limit: options.limit
      });

      spinner.succeed(`Discovered ${filtered.length} endpoints from inventory.`);
      printDiscoveryTable(filtered);
    } catch (err: any) {
      spinner.fail(`Discovery failed: ${err.message}`);
      process.exit(1);
    }
  });

// 2. COMMAND: SMOKE
program
  .command('smoke')
  .description('Execute technical smoke tests against discovered SAP PI/PO endpoints')
  .requiredOption('-i, --inventory <path>', 'Path or ID of the inventory JSON file')
  .requiredOption('-h, --host <host>', 'SAP PI/PO host identifier, hostname, or full URL')
  .option('-p, --port <number>', 'SAP PI/PO HTTP port (default: 50000 or 50001 for HTTPS)', parseInt)
  .option('-u, --user <username>', 'SAP user account for basic authentication')
  .option('-w, --password <password>', 'SAP password for basic authentication')
  .option('--https', 'Use HTTPS protocol')
  .option('--insecure', 'Ignore SSL certificate errors')
  .option('-c, --concurrency <number>', 'Concurrent test dispatchers', parseInt, 5)
  .option('-t, --timeout <ms>', 'Per-request timeout in milliseconds', parseInt, 10000)
  .option('--filter <interfaceName>', 'Filter by interface name')
  .option('--qos <qos>', 'Filter by Quality of Service (BE or EO)')
  .option('--verify-async', 'Poll AdapterMessageMonitoring for EO interfaces', false)
  .option('--junit <path>', 'Save results to JUnit XML report')
  .action(async (options) => {
    const spinner = ora('Preparing smoke test execution...').start();
    try {
      const knownHosts = await loadHostsConfig();
      const hostConfig = resolveHostConfig(options.host, knownHosts, {
        port: options.port,
        user: options.user,
        password: options.password,
        https: options.https,
        insecure: options.insecure
      });

      const inventory = await loadInventory(options.inventory);
      const allEndpoints = discoverEndpoints(inventory, hostConfig);
      const endpoints = filterEndpoints(allEndpoints, {
        interfaceName: options.filter,
        qos: options.qos
      });

      if (endpoints.length === 0) {
        spinner.warn('No endpoints matched the specified criteria.');
        return;
      }

      spinner.text = `Executing smoke tests across ${endpoints.length} endpoints (concurrency: ${options.concurrency})...`;

      const summary = await runSmokeTests(endpoints, hostConfig, {
        concurrency: options.concurrency,
        timeoutMs: options.timeout,
        verifyAsync: options.verifyAsync,
        onProgress: (result, index, total) => {
          spinner.text = `[${index}/${total}] ${result.endpoint.interfaceName}: ${result.passed ? 'OK' : 'FAIL'} (${result.durationMs}ms)`;
        }
      });

      spinner.stop();
      printSmokeSummary(summary);

      if (options.junit) {
        const junitXml = generateSmokeJunitXml(summary);
        await saveJunitReport(options.junit, junitXml);
        console.log(pc.green(`JUnit report saved to: ${options.junit}`));
      }

      if (summary.failed > 0) {
        process.exit(1);
      }
    } catch (err: any) {
      spinner.fail(`Smoke test failed: ${err.message}`);
      process.exit(1);
    }
  });

// 3. COMMAND: PARITY
program
  .command('parity')
  .description('Run dual-run parity tests comparing SAP PI/PO 7.5 against SAP BTP CPI')
  .requiredOption('--pipo-host <host>', 'SAP PI/PO host or URL')
  .requiredOption('--cpi-host <host>', 'SAP BTP Cloud Integration tenant host or URL')
  .requiredOption('--interface <interfaceName>', 'Target interface name')
  .requiredOption('--payload <path>', 'Golden production payload file (.xml or .json)')
  .option('--config <path>', 'Path to custom payload config.yaml')
  .option('--pipo-port <number>', 'PI/PO port', parseInt)
  .option('--cpi-port <number>', 'CPI port (default 443)', parseInt)
  .option('--timeout <ms>', 'Timeout in milliseconds', parseInt, 20000)
  .option('--html <path>', 'Save interactive HTML diff report')
  .option('--junit <path>', 'Save JUnit XML parity report')
  .action(async (options) => {
    const spinner = ora('Executing migration dual-run parity comparison...').start();
    try {
      const knownHosts = await loadHostsConfig();
      const pipoHost = resolveHostConfig(options.pipoHost, knownHosts, { port: options.pipoPort });
      const cpiHost = resolveHostConfig(options.cpiHost, knownHosts, { port: options.cpiPort || 443, https: true });

      const result = await runParityTest({
        pipoHost,
        cpiHost,
        interfaceName: options.interface,
        payloadPath: options.payload,
        configPath: options.config,
        timeoutMs: options.timeout
      });

      spinner.stop();
      printParityResult(result);

      if (options.html) {
        const html = generateParityHtmlReport(result);
        await saveHtmlReport(options.html, html);
        console.log(pc.green(`Interactive HTML report saved to: ${options.html}`));
      }

      if (options.junit) {
        const junit = generateParityJunitXml(result);
        await saveJunitReport(options.junit, junit);
        console.log(pc.green(`JUnit XML report saved to: ${options.junit}`));
      }

      if (!result.passed) {
        process.exit(1);
      }
    } catch (err: any) {
      spinner.fail(`Parity test failed: ${err.message}`);
      process.exit(1);
    }
  });

// 4. COMMAND: STRESS
program
  .command('stress')
  .description('Benchmark throughput (TPS) and latency percentiles under high load')
  .requiredOption('--interface <interfaceName>', 'Target interface name')
  .requiredOption('--payload <path>', 'Test payload file (.xml or .json)')
  .option('-i, --inventory <path>', 'Inventory JSON path to resolve endpoint')
  .option('-h, --host <host>', 'SAP host identifier or URL')
  .option('-p, --port <number>', 'SAP port', parseInt)
  .option('--target-url <url>', 'Explicit target URL to test')
  .option('--tps <number>', 'Target transactions per second', parseInt, 20)
  .option('--duration <duration>', 'Benchmark duration (e.g. 30s, 60s, 2m)', '30s')
  .option('--i-understand-this-is-production', 'Explicitly allow running stress tests on production environments', false)
  .option('--html <path>', 'Save benchmark HTML report')
  .action(async (options) => {
    const spinner = ora('Configuring benchmark harness...').start();
    try {
      const knownHosts = await loadHostsConfig();
      const hostParam = options.host || 'localhost';
      const hostConfig = resolveHostConfig(hostParam, knownHosts, { port: options.port });

      // Safety fence verification
      assertNonProduction(hostConfig.host, options.iUnderstandThisIsProduction, 'High-Throughput Stress Test');

      let targetUrl = options.targetUrl;
      if (!targetUrl) {
        if (options.inventory) {
          const inv = await loadInventory(options.inventory);
          const endpoints = discoverEndpoints(inv, hostConfig);
          const matched = endpoints.find((e) => e.interfaceName === options.interface);
          if (matched && matched.fullUrl) {
            targetUrl = matched.fullUrl;
          }
        }
        if (!targetUrl) {
          const scheme = hostConfig.https ? 'https' : 'http';
          targetUrl = `${scheme}://${hostConfig.host}:${hostConfig.port}/XISOAPAdapter/MessageServlet?interface=${encodeURIComponent(options.interface)}&qos=EO`;
        }
      }

      const durationSeconds = parseDurationToSeconds(options.duration);
      spinner.text = `Firing stress test at ${options.tps} TPS for ${durationSeconds}s against ${options.interface}...`;

      const metrics = await runStressTest({
        hostConfig,
        targetUrl,
        interfaceName: options.interface,
        payloadPath: options.payload,
        targetTps: options.tps,
        durationSeconds,
        isProductionOverride: options.iUnderstandThisIsProduction
      });

      spinner.stop();
      printStressMetrics(metrics);

      if (options.html) {
        const html = generateStressHtmlReport(metrics);
        await saveHtmlReport(options.html, html);
        console.log(pc.green(`Stress benchmark HTML report saved to: ${options.html}`));
      }
    } catch (err: any) {
      spinner.fail(`Stress test failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

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
import { configureLogger, LogLevel } from '../logger/index.js';
import { generateFileFromSpec } from '../generator/file-generator.js';
import { dacApInvoiceSpec } from '../generator/specs/dac-ap-invoice.js';
import { lazadaArReceiptSpec } from '../generator/specs/lazada-ar-receipt.js';
import { synthesizeSpecFromChannel } from '../generator/auto-synthesizer.js';
import { validateDacApInvoiceCompliance } from '../generator/compliance-validator.js';
import { convertCsvToPostFccXml } from '../generator/wsdl-parser.js';
import { generateMappingTestPayload } from '../generator/mapping-test-module.js';
import {
  loadScenario,
  saveScenario,
  sanitizeOverrides,
  type ScenarioCase
} from '../generator/scenario-manager.js';
import { startCockpitServer } from '../web/server.js';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const program = new Command();

program
  .name('aetherflow')
  .description('AetherFlow Test Engine: SAP PI/PO & SAP Integration Suite Automated Test, Parity & Stress Harness')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose console logging (INFO level)')
  .option('-d, --debug', 'Enable debug console logging with full payloads and headers (DEBUG level)')
  .option('--log-file <path>', 'Write logs to the specified file (default: logs/aetherflow.log)')
  .option('--no-log-file', 'Disable log file persistence')
  .option('--log-level <level>', 'Explicit console log level (debug, info, warn, error, silent)')
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = actionCommand ? actionCommand.optsWithGlobals() : thisCommand.opts();
    let consoleLevel: LogLevel = 'warn';
    if (opts.logLevel) {
      consoleLevel = opts.logLevel as LogLevel;
    } else if (opts.debug) {
      consoleLevel = 'debug';
    } else if (opts.verbose) {
      consoleLevel = 'info';
    }

    const logFilePath = opts.logFile === false ? false : (opts.logFile || 'logs/aetherflow.log');
    configureLogger({
      level: consoleLevel,
      fileLevel: 'debug',
      logFile: logFilePath,
      enableFile: logFilePath !== false,
      enableConsole: true
    });
  });

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
  .action(async (options, command) => {
    const globals = command.optsWithGlobals();
    const isVerbose = Boolean(globals.verbose || globals.debug || (globals.logLevel && globals.logLevel !== 'silent' && globals.logLevel !== 'warn' && globals.logLevel !== 'error'));
    const spinner = ora({ text: 'Loading inventory and extracting endpoints...', isSilent: isVerbose }).start();
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
  .action(async (options, command) => {
    const globals = command.optsWithGlobals();
    const isVerbose = Boolean(globals.verbose || globals.debug || (globals.logLevel && globals.logLevel !== 'silent' && globals.logLevel !== 'warn' && globals.logLevel !== 'error'));
    const spinner = ora({ text: 'Preparing smoke test execution...', isSilent: isVerbose }).start();
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

      if (!isVerbose) {
        spinner.text = `Executing smoke tests across ${endpoints.length} endpoints (concurrency: ${options.concurrency})...`;
      }

      const summary = await runSmokeTests(endpoints, hostConfig, {
        concurrency: options.concurrency,
        timeoutMs: options.timeout,
        verifyAsync: options.verifyAsync,
        onProgress: (result, index, total) => {
          if (!isVerbose) {
            spinner.text = `[${index}/${total}] ${result.endpoint.interfaceName}: ${result.passed ? 'OK' : 'FAIL'} (${result.durationMs}ms)`;
          }
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
  .action(async (options, command) => {
    const globals = command.optsWithGlobals();
    const isVerbose = Boolean(globals.verbose || globals.debug || (globals.logLevel && globals.logLevel !== 'silent' && globals.logLevel !== 'warn' && globals.logLevel !== 'error'));
    const spinner = ora({ text: 'Executing migration dual-run parity comparison...', isSilent: isVerbose }).start();
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
  .action(async (options, command) => {
    const globals = command.optsWithGlobals();
    const isVerbose = Boolean(globals.verbose || globals.debug || (globals.logLevel && globals.logLevel !== 'silent' && globals.logLevel !== 'warn' && globals.logLevel !== 'error'));
    const spinner = ora({ text: 'Configuring benchmark harness...', isSilent: isVerbose }).start();
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

// 5. COMMAND: GENERATE
program
  .command('generate')
  .description('Generate synthetic flat files and post-FCC XML payloads from canonical interface specifications')
  .option('-s, --spec <name>', 'Specification ID or Interface Name (default: dac-ap-invoice)', 'dac-ap-invoice')
  .option('--interface <name>', 'Auto-synthesize spec directly from any sender interface in inventory')
  .option('-i, --inventory <path>', 'Path or ID of the inventory JSON file (default: 586a8bff-329b-47c1-927d-f19c165f6d9c)')
  .option('-c, --count <number>', 'Number of detail records to generate', (v) => parseInt(v, 10), 1)
  .option('-o, --out <path>', 'Output file or directory path (default: testbed/generated/)', 'testbed/generated')
  .option('--mode <mode>', 'Output mode: flat (CSV), xml (post-FCC XML), or both', 'both')
  .option('--filename <name>', 'Explicit output base filename (e.g. 138100000531261.DAC33)')
  .option('--batch-date <date>', 'Explicit 8-digit batch date for BEG header (e.g. 06022026)')
  .option('--date <date>', 'Explicit generation date in YYYY-MM-DD format (default: today)')
  .action(async (options) => {
    try {
      const specMap: Record<string, any> = {
        'dac-ap-invoice': dacApInvoiceSpec,
        'i001': dacApInvoiceSpec,
        'lazada-ar-receipt': lazadaArReceiptSpec,
        'i025': lazadaArReceiptSpec,
        'lazada': lazadaArReceiptSpec,
        'si_i025_ar_lazada_ob_as': lazadaArReceiptSpec
      };

      const selectedSpecKey = options.spec ? options.spec.toLowerCase() : '';
      let spec = specMap[selectedSpecKey];
      let rootElementName = 'I001_DAC_AP_Invoice_Out';
      let targetNamespace = 'http://smretail.com/xi/SMRI/S4HANA/FI';
      let recordsetWrapperName: string | undefined = 'I001_AP_INVOICE';
      let itemElementName = 'AP_INVOICE';
      let skipHeaderRow = false;

      const targetInterfaceName = options.interface || (spec ? undefined : options.spec);

      if (targetInterfaceName) {
        const invId = options.inventory || '586a8bff-329b-47c1-927d-f19c165f6d9c';
        const inv = await loadInventory(invId);
        const ico = inv.integratedConfigurations.find((i: any) =>
          i.IntegratedConfigurationID?.InterfaceName?.toLowerCase() === targetInterfaceName.toLowerCase()
        );
        if (!ico) {
          console.error(pc.red(`Error: Interface "${targetInterfaceName}" not found in inventory.`));
          process.exit(1);
        }
        const channelId = ico.InboundProcessing?.CommunicationChannel?.ChannelID;
        const channel = inv.communicationChannels.find((c: any) => c.CommunicationChannelID?.ChannelID === channelId);
        if (!channel) {
          console.error(pc.red(`Error: Sender channel "${channelId}" not found for interface "${targetInterfaceName}".`));
          process.exit(1);
        }

        const syn = synthesizeSpecFromChannel(targetInterfaceName, ico, channel);
        spec = syn.spec;
        rootElementName = syn.rootElementName;
        targetNamespace = syn.targetNamespace;
        recordsetWrapperName = syn.recordsetWrapperName;
        itemElementName = syn.itemElementName;
        skipHeaderRow = !!syn.skipHeaderRow;
        console.log(pc.magenta(`✦ Auto-synthesized specification directly from sender channel: ${pc.bold(channelId)}`));
      } else if (spec?.id === 'lazada-ar-receipt') {
        rootElementName = 'MT_AR_LazadaStdReceipt';
        targetNamespace = 'http://smretail.com/xi/SMRI/Lazada/FI/I025';
        recordsetWrapperName = undefined;
        itemElementName = 'Record';
        skipHeaderRow = true;
      }

      if (!spec) {
        console.error(pc.red(`Error: Unsupported specification "${options.spec}". Use --interface <InterfaceName> to synthesize from inventory.`));
        process.exit(1);
      }

      const outDir = fs.existsSync(options.out) && fs.statSync(options.out).isDirectory()
        ? options.out
        : path.dirname(options.out);

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const defaultFilename = spec.name || `${spec.id}.csv`;
      const filename = options.filename || defaultFilename;
      const overrides: Record<string, any> = {};
      if (options.batchDate && spec.id === 'dac-ap-invoice') {
        overrides.BEG = { BATCH_DATE: options.batchDate };
      }

      const fixedDate = options.date ? new Date(options.date) : new Date();

      const genResult = generateFileFromSpec(spec, {
        filename,
        date: fixedDate,
        detailCount: options.count,
        overrides
      });

      const detailRecordset = spec.recordsets.find((r: any) => r.role === 'detail') || spec.recordsets[spec.recordsets.length - 1];
      const detailRecordsetName = detailRecordset?.name || 'Record';
      const detailCount = genResult.recordCounts[detailRecordsetName] || 0;

      console.log(pc.cyan(`\n=== AetherFlow File & Payload Generator ===`));
      console.log(`Spec:        ${pc.bold(spec.id)} (${spec.name})`);
      console.log(`Filename:    ${pc.bold(genResult.filename)}`);
      console.log(`Details:     ${detailCount} records`);
      console.log(`Lines:       ${genResult.lineCount} total (Header, Details${spec.recordsets.some((r: any) => r.role === 'trailer') ? ', Trailer' : ''})\n`);

      const outFlatPath = path.join(outDir, filename);
      if (options.mode === 'flat' || options.mode === 'both') {
        fs.writeFileSync(outFlatPath, genResult.content, 'utf8');
        console.log(pc.green(`✔ Mode 2 Flat File written to: ${outFlatPath}`));

        if (spec.id === 'dac-ap-invoice') {
          const comp = validateDacApInvoiceCompliance(genResult.content, filename);
          if (comp.compliant) {
            console.log(pc.green(`✔ Base file compliance: 100% compliant (0 errors)`));
          } else {
            console.log(pc.yellow(`⚠ Compliance warnings:`));
            comp.errors.forEach(e => console.log(pc.yellow(`  - ${e}`)));
          }
        } else {
          console.log(pc.green(`✔ Schema compliance: ${genResult.lineCount} rows verified`));
        }
      }

      if (options.mode === 'xml' || options.mode === 'both') {
        const detailFields = detailRecordset?.fields.map((f: any) => f.name) || [];
        const postFccXml = convertCsvToPostFccXml(genResult.content, {
          rootElementName,
          targetNamespace,
          recordsetWrapperName,
          itemElementName,
          fieldNames: detailFields,
          skipHeaderRow
        });

        const outXmlPath = path.join(outDir, `${path.parse(filename).name}.post-fcc.xml`);
        fs.writeFileSync(outXmlPath, postFccXml, 'utf8');
        console.log(pc.green(`✔ Mode 1 Post-FCC XML written to: ${outXmlPath}`));
      }
      console.log('');
    } catch (err: any) {
      console.error(pc.red(`Generation failed: ${err.message}`));
      process.exit(1);
    }
  });

// 6. COMMAND: GENERATE-MAPPING-TEST
program
  .command('generate-mapping-test')
  .description('Extract technical schema and mapping dependencies from SAP PI/PO to generate compliant XML for mapping injection')
  .argument('[interfaceName]', 'Sender Interface Name (optional if --scenario is specified)')
  .option('-c, --count <number>', 'Number of detail/repeating records to generate', (v) => parseInt(v, 10))
  .option('-l, --layer <layer>', 'Modifier layer to enforce: 1 (Schema Only), 2 (Schema + Mapping Rules), 3 (With Custom Overrides)', (v) => parseInt(v, 10) as 1 | 2 | 3)
  .option('--set <pair>', 'Field override with optional macros (e.g. --set GL_DATE="{{rand_month}}/{{rand_day}}/{{rand_year}}")', (val: string, prev: Record<string, string> = {}) => {
    const eqIdx = val.indexOf('=');
    if (eqIdx !== -1) {
      const k = val.slice(0, eqIdx).trim();
      const v = val.slice(eqIdx + 1).trim();
      prev[k] = v;
    }
    return prev;
  }, {})
  .option('--all-optional [boolean]', 'Populate all optional schema fields (default: true)', (v: string) => v.toLowerCase() !== 'false' && v !== '0')
  .option('--no-all-optional', 'Omit optional schema fields (generates minimal required payload adhering to schema and overrides)')
  .option('--scenario <path>', 'Path to scenario file (.yaml or .json) with predefined parameters and macros')
  .option('--save-scenario <path>', 'Save the active test configuration to a sanitized scenario file (.scenario.yaml)')
  .option('-o, --out <path>', 'Output file or directory path (default: testbed/generated/)', 'testbed/generated')
  .action(async (interfaceName, options) => {
    let activeInterface = interfaceName;
    let activeCount = options.count ?? 1;
    let activeAllOptional = options.allOptional !== undefined ? options.allOptional : true;
    let activeOverrides = options.set || {};
    let activeLayer = options.layer;
    let loadedScenario: ScenarioCase | null = null;

    if (options.scenario) {
      loadedScenario = loadScenario(options.scenario);
      if (!activeInterface) {
        activeInterface = loadedScenario.interface;
      }
      if (options.count === undefined && loadedScenario.count !== undefined) {
        activeCount = loadedScenario.count;
      }
      if (options.allOptional === undefined && loadedScenario.allOptional !== undefined) {
        activeAllOptional = loadedScenario.allOptional;
      }
      if (options.layer === undefined && loadedScenario.layer !== undefined) {
        activeLayer = loadedScenario.layer;
      }
      // Merge overrides: scenario overrides first, CLI --set takes precedence
      activeOverrides = {
        ...loadedScenario.overrides,
        ...activeOverrides
      };
    }

    if (!activeInterface) {
      console.error(pc.red("Error: Missing interface name. Please specify <interfaceName> or provide --scenario <path>."));
      process.exit(1);
    }

    const hasOverrides = Object.keys(activeOverrides).length > 0;
    const layer = activeLayer ?? (hasOverrides ? 3 : 2);
    const spinner = ora(`Extracting schema & mapping rules from SAP PI/PO for ${activeInterface}...`).start();
    try {
      const result = await generateMappingTestPayload(activeInterface, {
        layer,
        allOptional: activeAllOptional,
        overrides: activeOverrides,
        layerOptions: { repeatCount: activeCount }
      });
      spinner.succeed(`Extracted & synthesized payload for ${pc.bold(activeInterface)} (Layer ${result.activeLayer})`);

      let outPath: string;
      if (options.out.endsWith('.xml')) {
        outPath = path.resolve(options.out);
        const parentDir = path.dirname(outPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
      } else {
        const outDir = path.resolve(options.out);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        outPath = path.join(outDir, `${interfaceName}.mapping-test.xml`);
      }
      fs.writeFileSync(outPath, result.xmlPayload, 'utf8');

      console.log(pc.cyan(`\n=== Mapping Test Payload Generation ===`));
      console.log(`Interface:        ${pc.bold(result.interfaceName)}`);
      console.log(`Namespace:        ${result.interfaceNamespace}`);
      console.log(`Root Element:     <${result.rootElementName}>`);
      console.log(`Active Layer:     Layer ${result.activeLayer} (${result.activeLayer === 3 ? 'Layer 3: Schema + Mapping AST + Custom Macros' : result.activeLayer === 2 ? 'Layer 2: Schema + Mapping Dependencies' : 'Layer 1: Schema-Enforced Only'})`);
      console.log(`Optional Fields:  ${result.allOptional ? pc.green('All Populated (Full Payload)') : pc.yellow('Omitted (Minimal Required Payload)')}`);
      console.log(`Field Statistics: ${result.fieldStats.totalFields} leaf fields (${result.fieldStats.requiredFields} required, ${result.fieldStats.optionalFields} optional)`);

      if (result.mappingRules) {
        console.log(pc.yellow(`\n--- Discovered Mapping Dependencies (ESR AST) ---`));
        console.log(`Mapping Name:   ${result.mappingRules.mappingName}`);
        if (result.mappingRules.targetMessageName) {
          console.log(`Target Message: ${result.mappingRules.targetMessageName}`);
        }
        if (result.transitivelyMandatoryFields && result.transitivelyMandatoryFields.length > 0) {
          console.log(`Transitively Mandatory Fields: ${pc.bold(pc.green(result.transitivelyMandatoryFields.join(', ')))}`);
        }
        if (result.targetCardinalities && result.targetCardinalities.some((t) => t.isMandatory)) {
          const mandatoryTargets = result.targetCardinalities.filter((t) => t.isMandatory);
          console.log(`Mandatory Target Fields (${mandatoryTargets.length}):`);
          for (const mt of mandatoryTargets) {
            const srcStr = mt.mappedSourceFields.length > 0 ? ` <- [${mt.mappedSourceFields.join(', ')}]` : '';
            console.log(`  - ${mt.targetPath} (minOccurs=${mt.minOccurs})${srcStr}`);
          }
        }
        if (Object.keys(result.mappingRules.headerOverrides).length > 0) {
          console.log(`Header Rules:   ${JSON.stringify(result.mappingRules.headerOverrides)}`);
        }
        if (Object.keys(result.mappingRules.trailerOverrides).length > 0) {
          console.log(`Trailer Rules:  ${JSON.stringify(result.mappingRules.trailerOverrides)}`);
        }
        if (Object.keys(result.mappingRules.fieldOverrides).length > 0) {
          console.log(`Field Rules:    ${JSON.stringify(result.mappingRules.fieldOverrides)}`);
        }
      }

      if (result.appliedOverrides && Object.keys(result.appliedOverrides).length > 0) {
        console.log(pc.magenta(`\n--- Layer 3 Custom Overrides (Macros Evaluated) ---`));
        for (const [k, v] of Object.entries(result.appliedOverrides)) {
          console.log(`  ${k} = "${v}"`);
        }
      }

      console.log(`\nOutput File:    ${pc.green(outPath)}`);
      if (options.saveScenario) {
        const scenarioToSave: ScenarioCase = {
          name: loadedScenario?.name || `${activeInterface} Test Scenario`,
          interface: activeInterface,
          description: loadedScenario?.description || `Sanitized automated test scenario for ${activeInterface}`,
          layer: result.activeLayer,
          count: activeCount,
          allOptional: activeAllOptional,
          overrides: sanitizeOverrides(activeOverrides)
        };
        const savedScenarioPath = saveScenario(options.saveScenario, scenarioToSave);
        console.log(`Saved Scenario: ${pc.green(savedScenarioPath)} (Data sanitized with synthetic macros/masks)`);
      }
      console.log(`Status:         ✔ Ready for mapping test injection\n`);
    } catch (err: any) {
      spinner.fail(`Generation failed: ${err.message}`);
      process.exit(1);
    }
  });

// 7. COMMAND: UI (WEB INTERFACE)
program
  .command('ui')
  .description('Launch the SM Retail Integration Testing & Metadata Web UI')
  .option('-p, --port <number>', 'HTTP port to listen on', (v) => parseInt(v, 10), 4300)
  .option('--host <address>', 'Bind address (default: 127.0.0.1)', '127.0.0.1')
  .action(async (options) => {
    try {
      const { url } = await startCockpitServer({
        port: options.port,
        host: options.host
      });
      console.log(`SM Retail Integration Suite UI listening on ${pc.bold(pc.blue(url))}`);
    } catch (err: any) {
      console.error(pc.red(`Failed to start Web UI: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);



import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  HostConfig,
  ParityTestResult,
  PayloadConfig,
  HttpResponse
} from '../types/index.js';
import { resolveTemplate } from '../protocols/template-engine.js';
import { dispatchRequest } from './dispatcher.js';
import { canonicalDiff } from '../verifier/canonical-diff.js';
import { logger } from '../logger/index.js';

const log = logger.child({ module: 'parity' });

export interface ParityRunnerOptions {
  pipoHost: HostConfig;
  cpiHost: HostConfig;
  interfaceName: string;
  payloadPath: string;
  expectedResponsePath?: string;
  configPath?: string;
  pipoUrlPath?: string;
  cpiUrlPath?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  customDispatcher?: (options: any, hostConfig?: HostConfig) => Promise<HttpResponse>;
}

/**
 * Loads payload configuration from config.yaml if present in the same directory.
 */
export async function loadPayloadConfig(payloadPath: string, explicitConfigPath?: string): Promise<PayloadConfig> {
  const candidate = explicitConfigPath
    ? resolve(explicitConfigPath)
    : join(dirname(resolve(payloadPath)), 'config.yaml');

  if (existsSync(candidate)) {
    try {
      const raw = await readFile(candidate, 'utf-8');
      return (parseYaml(raw) as PayloadConfig) || {};
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Runs a dual-run migration parity test comparing SAP PI/PO and SAP BTP CPI.
 */
export async function runParityTest(
  options: ParityRunnerOptions
): Promise<ParityTestResult> {
  const startTime = performance.now();
  const dispatcher = options.customDispatcher || dispatchRequest;

  // Load payload file
  const fullPayloadPath = resolve(options.payloadPath);
  if (!existsSync(fullPayloadPath)) {
    throw new Error(`Payload file not found at: ${fullPayloadPath}`);
  }

  const rawPayload = await readFile(fullPayloadPath, 'utf-8');
  const payloadConfig = await loadPayloadConfig(fullPayloadPath, options.configPath);

  // Template token replacement
  const resolvedPayload = resolveTemplate(rawPayload);

  // Resolve target URLs
  const pipoScheme = options.pipoHost.https ? 'https' : 'http';
  const pipoPath = options.pipoUrlPath || `/XISOAPAdapter/MessageServlet?interface=${encodeURIComponent(options.interfaceName)}&qos=BE`;
  const pipoUrl = `${pipoScheme}://${options.pipoHost.host}:${options.pipoHost.port}${pipoPath}`;

  const cpiScheme = options.cpiHost.https ? 'https' : 'http';
  const cpiPath = options.cpiUrlPath || payloadConfig.targetPath || `/http/${options.interfaceName}`;
  const cpiUrl = `${cpiScheme}://${options.cpiHost.host}:${options.cpiHost.port}${cpiPath}`;

  log.info(`Starting parity dual-run comparison for interface: ${options.interfaceName}`);
  log.debug(`PI/PO target: ${pipoUrl}, CPI target: ${cpiUrl}`);

  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    ...(payloadConfig.headers || {})
  };

  const timeoutMs = options.timeoutMs || payloadConfig.timeoutMs || 20000;

  // Execute requests (can run in parallel)
  const [pipoResponse, cpiResponse] = await Promise.all([
    dispatcher(
      {
        url: pipoUrl,
        method: 'POST',
        headers,
        body: resolvedPayload,
        timeoutMs,
        abortSignal: options.abortSignal
      },
      options.pipoHost
    ),
    dispatcher(
      {
        url: cpiUrl,
        method: 'POST',
        headers,
        body: resolvedPayload,
        timeoutMs,
        abortSignal: options.abortSignal
      },
      options.cpiHost
    )
  ]);

  // Execute canonical diffing
  const diff = canonicalDiff(pipoResponse.body, cpiResponse.body, {
    ignorePaths: payloadConfig.ignorePaths,
    ignoreRegex: payloadConfig.ignoreRegex,
    normalizeNamespaces: true,
    arrayOrderInsensitive: false
  });

  const durationMs = Math.round(performance.now() - startTime);

  // If status codes are both 2xx and diff matches, passed
  const passed =
    pipoResponse.statusCode >= 200 &&
    pipoResponse.statusCode < 300 &&
    cpiResponse.statusCode >= 200 &&
    cpiResponse.statusCode < 300 &&
    diff.matched;

  log.info(`Parity comparison finished for ${options.interfaceName}: ${passed ? 'PASSED' : 'FAILED'} (matched: ${diff.matched}, differences: ${diff.differences.length})`);
  if (!passed && diff.differences.length > 0) {
    log.warn(`Discrepancies found in ${options.interfaceName} (${diff.differences.length}):`, diff.differences.slice(0, 5));
  }

  return {
    interfaceName: options.interfaceName,
    payloadFile: fullPayloadPath,
    passed,
    pipoResponse,
    cpiResponse,
    diff,
    durationMs
  };
}

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  DiscoveredEndpoint,
  HostConfig,
  SmokeTestResult,
  SmokeTestSummary,
  HttpResponse
} from '../types/index.js';
import { buildMinimalSmokePayload } from '../protocols/soap-message-builder.js';
import { resolveTemplate } from '../protocols/template-engine.js';
import { dispatchRequest } from './dispatcher.js';
import { resolveTargetUrl } from '../discovery/endpoint-generator.js';
import { pollAsyncMessageStatus } from '../verifier/async-poller.js';
import { logger } from '../logger/index.js';

const log = logger.child({ module: 'smoke' });

export interface SmokeRunnerOptions {
  concurrency?: number;
  timeoutMs?: number;
  payloadDir?: string;
  verifyAsync?: boolean;
  abortSignal?: AbortSignal;
  onProgress?: (result: SmokeTestResult, index: number, total: number) => void;
  customDispatcher?: (options: any, hostConfig?: HostConfig) => Promise<HttpResponse>;
}

/**
 * Searches for a test payload file for a given interface name.
 */
async function findCustomPayload(
  interfaceName: string,
  payloadDir = 'payloads'
): Promise<string | null> {
  const possiblePaths = [
    resolve(process.cwd(), payloadDir, interfaceName, 'test-01.xml'),
    resolve(process.cwd(), payloadDir, interfaceName, 'test-case-01.xml'),
    resolve(process.cwd(), payloadDir, `${interfaceName}.xml`),
    resolve(process.cwd(), payloadDir, interfaceName, 'payload.xml')
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return await readFile(p, 'utf-8');
    }
  }

  return null;
}

/**
 * Executes smoke tests across a collection of endpoints with bounded concurrency.
 */
export async function runSmokeTests(
  endpoints: DiscoveredEndpoint[],
  hostConfig: HostConfig,
  options: SmokeRunnerOptions = {}
): Promise<SmokeTestSummary> {
  const concurrency = Math.max(1, options.concurrency || 5);
  const timeoutMs = options.timeoutMs || 10000;
  const results: SmokeTestResult[] = [];
  const startTime = Date.now();
  log.info(`Executing smoke tests across ${endpoints.length} endpoints (concurrency: ${concurrency}, timeout: ${timeoutMs}ms)`);

  const dispatcher = options.customDispatcher || dispatchRequest;

  // Worker queue
  let currentIndex = 0;
  const total = endpoints.length;

  async function worker(): Promise<void> {
    while (currentIndex < total) {
      if (options.abortSignal?.aborted) break;

      const idx = currentIndex++;
      const endpoint = endpoints[idx]!;

      let result: SmokeTestResult;
      try {
        const fullUrl = endpoint.fullUrl || resolveTargetUrl(hostConfig, endpoint.urlPath);

        // Load custom payload or generate minimal smoke XML
        let rawPayload = await findCustomPayload(endpoint.interfaceName, options.payloadDir);
        if (!rawPayload) {
          rawPayload = buildMinimalSmokePayload(endpoint.interfaceName, endpoint.interfaceNamespace);
        }

        const resolvedPayload = resolveTemplate(rawPayload);

        const response = await dispatcher(
          {
            url: fullUrl,
            method: 'POST',
            headers: endpoint.headers,
            body: resolvedPayload,
            timeoutMs,
            abortSignal: options.abortSignal
          },
          hostConfig
        );

        const isSuccessStatus = response.statusCode >= 200 && response.statusCode < 300;
        let passed = isSuccessStatus && !response.isSoapFault;

        let asyncStatus = undefined;
        if (passed && endpoint.qos === 'EO' && options.verifyAsync && response.messageId) {
          asyncStatus = await pollAsyncMessageStatus(response.messageId, hostConfig, {
            maxTimeoutMs: 15000,
            initialIntervalMs: 50,
            abortSignal: options.abortSignal,
            httpDispatcher: options.customDispatcher
              ? async (url, body, headers) => {
                  const r = await options.customDispatcher!(
                    { url, body, headers, method: 'POST' },
                    hostConfig
                  );
                  return { statusCode: r.statusCode, body: r.body };
                }
              : undefined
          });
          if (asyncStatus.state === 'SYSTEM_ERROR' || asyncStatus.state === 'HOLDING') {
            passed = false;
          }
        }

        result = {
          endpoint,
          passed,
          statusCode: response.statusCode,
          durationMs: response.durationMs,
          messageId: response.messageId,
          isSoapFault: response.isSoapFault,
          error: response.isSoapFault
            ? `SOAP Fault: ${response.soapFaultDetails?.faultString || 'Unknown'}`
            : !isSuccessStatus
            ? `HTTP Error: ${response.statusCode}`
            : undefined,
          asyncStatus
        };
      } catch (err: any) {
        result = {
          endpoint,
          passed: false,
          statusCode: 0,
          durationMs: 0,
          isSoapFault: false,
          error: err.message || 'Execution error'
        };
      }

      results.push(result);
      if (result.passed) {
        log.info(`[${results.length}/${total}] PASSED: ${endpoint.interfaceName} (${result.durationMs}ms)`);
      } else {
        log.warn(`[${results.length}/${total}] FAILED: ${endpoint.interfaceName} - ${result.error || 'Unknown error'}`);
      }

      if (options.onProgress) {
        options.onProgress(result, results.length, total);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  log.info(`Smoke test run complete: ${passedCount} passed, ${failedCount} failed (${Date.now() - startTime}ms)`);

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    durationMs: Date.now() - startTime,
    results
  };
}

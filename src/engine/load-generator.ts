import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  HostConfig,
  StressMetrics,
  LatencyDistribution,
  HttpResponse
} from '../types/index.js';
import { assertNonProduction } from '../config/index.js';
import { resolveTemplate } from '../protocols/template-engine.js';
import { dispatchRequest } from './dispatcher.js';

export interface StressRunnerOptions {
  hostConfig: HostConfig;
  targetUrl: string;
  interfaceName: string;
  payloadPath: string;
  targetTps: number;
  durationSeconds: number;
  isProductionOverride?: boolean;
  abortSignal?: AbortSignal;
  onProgress?: (currentCount: number, currentTps: number, elapsedSec: number) => void;
  customDispatcher?: (options: any, hostConfig?: HostConfig) => Promise<HttpResponse>;
}

/**
 * Parses duration strings like "60s", "2m", "120" into seconds.
 */
export function parseDurationToSeconds(durationInput: string | number): number {
  if (typeof durationInput === 'number') {
    return Math.max(1, durationInput);
  }

  const str = String(durationInput).trim().toLowerCase();
  if (str.endsWith('s')) {
    return Math.max(1, parseInt(str.slice(0, -1), 10));
  }
  if (str.endsWith('m')) {
    return Math.max(1, parseInt(str.slice(0, -1), 10) * 60);
  }
  if (str.endsWith('h')) {
    return Math.max(1, parseInt(str.slice(0, -1), 10) * 3600);
  }

  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 10 : Math.max(1, parsed);
}

/**
 * Calculates latency distribution percentiles from an array of millisecond timings.
 */
export function calculateLatencyStats(latencies: number[]): LatencyDistribution {
  if (latencies.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  const count = sorted.length;

  const min = sorted[0]!;
  const max = sorted[count - 1]!;
  const mean = Math.round((total / count) * 100) / 100;

  function percentile(p: number): number {
    const idx = Math.min(count - 1, Math.floor((p / 100) * count));
    return sorted[idx]!;
  }

  return {
    min,
    max,
    mean,
    median: percentile(50),
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99)
  };
}

/**
 * Executes a high-throughput load and stress test against a target endpoint.
 */
export async function runStressTest(
  options: StressRunnerOptions
): Promise<StressMetrics> {
  // 1. NON-PRODUCTION SAFETY FENCE ENFORCEMENT
  assertNonProduction(
    options.hostConfig.host,
    options.isProductionOverride,
    `Stress test on ${options.interfaceName}`
  );

  const payloadFilePath = resolve(options.payloadPath);
  if (!existsSync(payloadFilePath)) {
    throw new Error(`Stress test payload not found: ${payloadFilePath}`);
  }

  const rawTemplate = await readFile(payloadFilePath, 'utf-8');
  const dispatcher = options.customDispatcher || dispatchRequest;

  const durationSec = Math.max(1, options.durationSeconds);
  const targetTps = Math.max(1, options.targetTps);
  const totalTargetRequests = targetTps * durationSec;

  const latencies: number[] = [];
  const statusCodes: Record<number, number> = {};
  const errors: Record<string, number> = {};

  let successfulRequests = 0;
  let failedRequests = 0;

  const startTime = performance.now();
  const endTime = startTime + durationSec * 1000;

  // Track inflight promises
  const inflight: Promise<void>[] = [];
  let dispatched = 0;

  const intervalBetweenRequestsMs = 1000 / targetTps;

  while (performance.now() < endTime && dispatched < totalTargetRequests) {
    if (options.abortSignal?.aborted) break;

    const requestBody = resolveTemplate(rawTemplate);
    dispatched++;

    const p = (async () => {
      const reqStart = performance.now();
      try {
        const res = await dispatcher(
          {
            url: options.targetUrl,
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'X-AetherFlow-Test': 'true'
            },
            body: requestBody,
            timeoutMs: 15000,
            abortSignal: options.abortSignal
          },
          options.hostConfig
        );

        const latency = Math.round(performance.now() - reqStart);
        latencies.push(latency);

        statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;

        if (res.statusCode >= 200 && res.statusCode < 300 && !res.isSoapFault) {
          successfulRequests++;
        } else {
          failedRequests++;
          const errKey = res.isSoapFault
            ? `SOAP_FAULT: ${res.soapFaultDetails?.faultCode || 'Unknown'}`
            : `HTTP_${res.statusCode}`;
          errors[errKey] = (errors[errKey] || 0) + 1;
        }
      } catch (err: any) {
        failedRequests++;
        const errKey = err?.name || 'NetworkError';
        errors[errKey] = (errors[errKey] || 0) + 1;
      }
    })();

    inflight.push(p);

    // Rate pacing
    const nextExpectedTime = startTime + dispatched * intervalBetweenRequestsMs;
    const delayNeeded = nextExpectedTime - performance.now();
    if (delayNeeded > 0) {
      await new Promise((r) => setTimeout(r, delayNeeded));
    }
  }

  // Wait for inflight requests to complete
  await Promise.allSettled(inflight);

  const actualDurationSec = Math.max(0.1, (performance.now() - startTime) / 1000);
  const totalRequests = successfulRequests + failedRequests;
  const achievedTps = Math.round((totalRequests / actualDurationSec) * 100) / 100;

  const latencyStats = calculateLatencyStats(latencies);

  return {
    interfaceName: options.interfaceName,
    totalRequests,
    successfulRequests,
    failedRequests,
    targetTps,
    achievedTps,
    totalDurationSeconds: Math.round(actualDurationSec * 10) / 10,
    statusCodes,
    errors,
    latencies: latencyStats,
    allLatencies: latencies
  };
}

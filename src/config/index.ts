import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HostConfig } from '../types/index.js';

export * from './aetherflow-config.js';
export * from './heuristics.js';

export class SafetyFenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyFenceError';
  }
}

/**
 * Checks if a given host or URL indicates a production environment.
 */
export function isProductionHost(hostOrUrl: string): boolean {
  if (!hostOrUrl) return false;
  const lower = hostOrUrl.toLowerCase();
  
  // Explicit regex patterns matching production host naming conventions
  const prodPatterns = [
    /(^|[.-])prod([.-]|$)/i,
    /(^|[.-])prd([.-]|$)/i,
    /(^|[.-])production([.-]|$)/i,
    /(^|[.-])live([.-]|$)/i,
    /pipo.*prd/i,
    /sap.*prd/i,
    /spp[0-9]+/i // Common SAP PROD system ID convention (e.g., SPP100 vs SPD100/SPQ100)
  ];

  return prodPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Asserts that the target environment is safe for testing.
 * Blocks high-throughput stress tests if directed against production
 * without the explicit `--i-understand-this-is-production` override flag.
 */
export function assertNonProduction(
  hostOrUrl: string,
  isProductionOverride = false,
  context = 'Stress test'
): void {
  if (isProductionHost(hostOrUrl) && !isProductionOverride) {
    throw new SafetyFenceError(
      `[SAFETY FENCE TRIGGERED] ${context} blocked against production host: "${hostOrUrl}". ` +
      `Executing destructive or high-throughput benchmarks against production systems is prevented. ` +
      `To explicitly bypass this safety fence, pass the flag --i-understand-this-is-production.`
    );
  }
}

/**
 * Masks sensitive headers (e.g. Authorization, Cookie, API keys).
 */
export function maskHeaders(
  headers: Record<string, string | undefined>
): Record<string, string> {
  const masked: Record<string, string> = {};
  const sensitiveHeaderKeys = [
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'api-key',
    'sap-password'
  ];

  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    if (sensitiveHeaderKeys.includes(key.toLowerCase())) {
      masked[key] = '******** (REDACTED)';
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Masks basic authentication credentials embedded in a URL string.
 */
export function maskUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    // If not a valid URL (e.g., partial path), return as is
    return rawUrl;
  }
}

/**
 * Recursively masks sensitive fields in an object or log entry.
 */
export function sanitizeForLogging<T>(obj: T, seen = new WeakSet<object>()): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (seen.has(obj as object)) {
    return '[Circular]' as unknown as T;
  }
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, seen)) as unknown as T;
  }

  const copy: Record<string, any> = {};
  const sensitiveKeys = ['password', 'auth', 'authorization', 'token', 'secret', 'apikey', 'key'];

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null) {
      copy[k] = sanitizeForLogging(v, seen);
    } else if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      copy[k] = '******** (REDACTED)';
    } else {
      copy[k] = v;
    }
  }

  return copy as T;
}

/**
 * Loads host configurations from a JSON file (e.g., hosts.json)
 */
export async function loadHostsConfig(filePath?: string): Promise<Record<string, HostConfig>> {
  const targetPath = filePath ? resolve(filePath) : resolve(process.cwd(), 'hosts.json');
  if (!existsSync(targetPath)) {
    return {};
  }

  try {
    const raw = await readFile(targetPath, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Support array or dictionary format
    const result: Record<string, HostConfig> = {};
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.id) result[item.id] = item;
      }
    } else if (typeof parsed === 'object') {
      return parsed;
    }
    return result;
  } catch (err) {
    throw new Error(`Failed to parse hosts config from ${targetPath}: ${(err as Error).message}`);
  }
}

/**
 * Resolves HostConfig from host string/ID or env vars
 */
export function resolveHostConfig(
  hostOrId: string,
  knownHosts: Record<string, HostConfig> = {},
  options: Partial<HostConfig> = {}
): HostConfig {
  if (knownHosts[hostOrId]) {
    return {
      ...knownHosts[hostOrId],
      ...options
    };
  }

  // Parse if full URL
  if (hostOrId.startsWith('http://') || hostOrId.startsWith('https://')) {
    const parsed = new URL(hostOrId);
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80),
      https: parsed.protocol === 'https:',
      user: options.user || parsed.username || process.env.SAP_PO_USER || '',
      password: options.password || parsed.password || process.env.SAP_PO_PASSWORD || '',
      insecure: options.insecure ?? false,
      isProduction: isProductionHost(parsed.hostname)
    };
  }

  // Standard hostname with optional :port
  let host = hostOrId;
  let port = options.port || (options.https ? 50001 : 50000);
  if (hostOrId.includes(':')) {
    const parts = hostOrId.split(':');
    host = parts[0]!;
    port = parseInt(parts[1]!, 10);
  }

  return {
    host,
    port,
    user: options.user || process.env.SAP_PO_USER || '',
    password: options.password || process.env.SAP_PO_PASSWORD || '',
    https: options.https ?? false,
    insecure: options.insecure ?? false,
    isProduction: isProductionHost(host)
  };
}

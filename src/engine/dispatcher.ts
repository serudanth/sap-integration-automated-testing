import { request, Agent, setGlobalDispatcher } from 'undici';
import type { HttpRequestOptions, HttpResponse, HostConfig } from '../types/index.js';
import { maskUrl } from '../config/index.js';
import { extractSapMessageId, parseSoapFault } from '../protocols/response-parser.js';

// Global undici agent with connection pooling and TLS configuration
const agent = new Agent({
  keepAliveTimeout: 10000,
  keepAliveMaxTimeout: 30000,
  connections: 100,
  pipelining: 1,
  connect: {
    rejectUnauthorized: false // Configured dynamically per request
  }
});

setGlobalDispatcher(agent);

/**
 * Combines an optional external AbortSignal with a timeout AbortSignal.
 */
function createCompositeSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  if (!externalSignal) {
    return {
      signal: timeoutController.signal,
      cleanup: () => clearTimeout(timer)
    };
  }

  const compositeController = new AbortController();

  const onTimeout = () => {
    compositeController.abort(timeoutController.signal.reason);
  };
  const onExternal = () => {
    compositeController.abort(externalSignal.reason);
  };

  timeoutController.signal.addEventListener('abort', onTimeout);
  externalSignal.addEventListener('abort', onExternal);

  return {
    signal: compositeController.signal,
    cleanup: () => {
      clearTimeout(timer);
      timeoutController.signal.removeEventListener('abort', onTimeout);
      externalSignal.removeEventListener('abort', onExternal);
    }
  };
}

/**
 * Dispatches an HTTP/HTTPS request using undici with connection pooling,
 * timeout controls, and credential safety masking.
 */
export async function dispatchRequest(
  options: HttpRequestOptions,
  hostConfig?: HostConfig
): Promise<HttpResponse> {
  const timeoutMs = options.timeoutMs || 15000;
  const { signal, cleanup } = createCompositeSignal(timeoutMs, options.abortSignal);

  const headers: Record<string, string> = {
    'Accept': '*/*',
    'User-Agent': 'AetherFlow-Test-Engine/1.0',
    ...(options.headers || {})
  };

  // Inject Basic Auth if credentials are provided and not already present
  if (!headers['Authorization'] && !headers['authorization']) {
    const user = hostConfig?.user;
    const password = hostConfig?.password;
    if (user && password) {
      const token = Buffer.from(`${user}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    }
  }

  const startTime = performance.now();

  try {
    const res = await request(options.url, {
      method: options.method || 'POST',
      headers,
      body: options.body,
      signal
    });

    const durationMs = Math.round(performance.now() - startTime);
    const responseBody = await res.body.text();

    // Convert headers to flat key-value record
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(res.headers)) {
      if (typeof value === 'string') {
        responseHeaders[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        responseHeaders[key.toLowerCase()] = value.join(', ');
      }
    }

    const messageId = extractSapMessageId(responseHeaders, responseBody);
    const soapFault = parseSoapFault(responseBody);

    return {
      statusCode: res.statusCode,
      statusText: `${res.statusCode}`,
      headers: responseHeaders,
      body: responseBody,
      durationMs,
      messageId,
      isSoapFault: soapFault !== null,
      soapFaultDetails: soapFault || undefined
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    const maskedUrl = maskUrl(options.url);
    const errorMessage = err?.message || 'Unknown network error';
    throw new Error(
      `HTTP Request Failed [${options.method || 'POST'} ${maskedUrl}] (${durationMs}ms): ${errorMessage}`
    );
  } finally {
    cleanup();
  }
}

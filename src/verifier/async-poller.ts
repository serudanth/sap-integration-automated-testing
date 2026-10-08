import type { HostConfig, AsyncPollResult, AsyncMessageState } from '../types/index.js';
import { dispatchRequest } from '../engine/dispatcher.js';

export interface AsyncPollOptions {
  initialIntervalMs?: number;
  backoffFactor?: number;
  maxIntervalMs?: number;
  maxTimeoutMs?: number;
  abortSignal?: AbortSignal;
  httpDispatcher?: (url: string, body: string, headers: Record<string, string>) => Promise<{ statusCode: number; body: string }>;
}

/**
 * Builds the SOAP envelope for querying AdapterMessageMonitoring web service.
 */
export function buildMonitoringQueryEnvelope(messageId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bas="http://sap.com/xi/BASIS">
  <soapenv:Header/>
  <soapenv:Body>
    <bas:getMessageDataById>
      <bas:messageKey>${messageId}</bas:messageKey>
    </bas:getMessageDataById>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Parses message status and error diagnostics from AdapterMessageMonitoring response.
 */
export function parseMonitoringResponse(responseBody: string): {
  state: AsyncMessageState;
  terminal: boolean;
  errorCategory?: string;
  errorText?: string;
  failingStep?: 'Mapping' | 'Routing' | 'Adapter Call' | 'Inbound' | 'Unknown';
} {
  if (!responseBody) {
    return { state: 'UNKNOWN', terminal: false };
  }

  const upper = responseBody.toUpperCase();

  // Determine state
  let state: AsyncMessageState = 'UNKNOWN';
  let terminal = false;

  if (upper.includes('DELIVERED') || upper.includes('SUCCESS') || upper.includes('DELIVERY_CONFIRMED')) {
    state = 'DELIVERED';
    terminal = true;
  } else if (upper.includes('WAITING') || upper.includes('SCHEDULED') || upper.includes('QUEUED')) {
    state = 'WAITING';
    terminal = false;
  } else if (upper.includes('SYSTEM_ERROR') || upper.includes('SYSTEM ERROR') || upper.includes('FAILED')) {
    state = 'SYSTEM_ERROR';
    terminal = true;
  } else if (upper.includes('HOLDING') || upper.includes('ON_HOLD') || upper.includes('MANUAL_RESTART')) {
    state = 'HOLDING';
    terminal = true;
  }

  // Extract error diagnostics if failed
  let errorCategory: string | undefined;
  let errorText: string | undefined;
  let failingStep: 'Mapping' | 'Routing' | 'Adapter Call' | 'Inbound' | 'Unknown' | undefined;

  if (state === 'SYSTEM_ERROR' || state === 'HOLDING') {
    // Check error category & failing step
    if (upper.includes('MAPPING') || upper.includes('TRANSFORMATION') || upper.includes('XSLT') || upper.includes('JAVA_MAPPING')) {
      failingStep = 'Mapping';
      errorCategory = 'MAPPING_EXECUTION_ERROR';
    } else if (upper.includes('ROUTING') || upper.includes('RECEIVER_NOT_DETERMINED') || upper.includes('INTERFACE_DETERMINATION')) {
      failingStep = 'Routing';
      errorCategory = 'RECEIVER_DETERMINATION_ERROR';
    } else if (upper.includes('ADAPTER') || upper.includes('CHANNEL') || upper.includes('CONNECTION') || upper.includes('TIMEOUT') || upper.includes('BACKEND')) {
      failingStep = 'Adapter Call';
      errorCategory = 'OUTBOUND_ADAPTER_ERROR';
    } else {
      failingStep = 'Unknown';
      errorCategory = 'PROCESSING_ERROR';
    }

    // Try extracting error description
    const textMatch = responseBody.match(/<(?:\w+:)?errorText[^>]*>([^<]+)<\/(?:\w+:)?errorText>/i) ||
      responseBody.match(/<(?:\w+:)?faultstring[^>]*>([^<]+)<\/(?:\w+:)?faultstring>/i) ||
      responseBody.match(/<(?:\w+:)?details?[^>]*>([^<]+)<\/(?:\w+:)?details?>/i);

    if (textMatch && textMatch[1]) {
      errorText = textMatch[1].trim();
    } else {
      errorText = `SAP asynchronous processing failed with status ${state}`;
    }
  }

  return {
    state,
    terminal,
    errorCategory,
    errorText,
    failingStep
  };
}

/**
 * Polls SAP PI/PO AdapterMessageMonitoring with exponential backoff until a terminal state
 * (DELIVERED, SYSTEM_ERROR, HOLDING) or timeout is reached.
 */
export async function pollAsyncMessageStatus(
  messageId: string,
  hostConfig: HostConfig,
  options: AsyncPollOptions = {}
): Promise<AsyncPollResult> {
  const initialInterval = options.initialIntervalMs ?? 500;
  const backoffFactor = options.backoffFactor ?? 1.5;
  const maxInterval = options.maxIntervalMs ?? 5000;
  const maxTimeout = options.maxTimeoutMs ?? 30000;

  const scheme = hostConfig.https ? 'https' : 'http';
  const url = `${scheme}://${hostConfig.host}:${hostConfig.port}/AdapterMessageMonitoring/basic`;
  const envelope = buildMonitoringQueryEnvelope(messageId);

  const startTime = Date.now();
  let currentInterval = initialInterval;
  let pollCount = 0;
  let lastResult: ReturnType<typeof parseMonitoringResponse> = { state: 'UNKNOWN', terminal: false };
  let lastRawResponse = '';

  while (Date.now() - startTime < maxTimeout) {
    if (options.abortSignal?.aborted) {
      break;
    }

    pollCount++;

    try {
      let body = '';

      if (options.httpDispatcher) {
        const res = await options.httpDispatcher(url, envelope, {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '""'
        });
        body = res.body;
      } else {
        const res = await dispatchRequest({
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '""'
          },
          body: envelope,
          timeoutMs: currentInterval,
          abortSignal: options.abortSignal
        }, hostConfig);
        body = res.body;
      }

      lastRawResponse = body;
      lastResult = parseMonitoringResponse(body);

      if (lastResult.terminal) {
        return {
          messageId,
          state: lastResult.state,
          terminal: true,
          pollCount,
          durationMs: Date.now() - startTime,
          errorCategory: lastResult.errorCategory,
          errorText: lastResult.errorText,
          failingStep: lastResult.failingStep,
          rawResponse: lastRawResponse
        };
      }
    } catch {
      // Continue polling on transient errors during backoff
    }

    // Wait for next backoff interval
    await new Promise((resolve) => setTimeout(resolve, currentInterval));
    currentInterval = Math.min(Math.floor(currentInterval * backoffFactor), maxInterval);
  }

  return {
    messageId,
    state: lastResult.state,
    terminal: lastResult.terminal,
    pollCount,
    durationMs: Date.now() - startTime,
    errorCategory: lastResult.errorCategory,
    errorText: lastResult.errorText,
    failingStep: lastResult.failingStep,
    rawResponse: lastRawResponse
  };
}

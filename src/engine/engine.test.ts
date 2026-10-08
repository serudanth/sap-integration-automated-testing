import { describe, it, expect } from 'vitest';
import { parseDurationToSeconds, calculateLatencyStats, runStressTest } from './load-generator.js';
import { runSmokeTests } from './smoke-runner.js';
import { runParityTest } from './parity-runner.js';
import { SafetyFenceError } from '../config/index.js';
import type { DiscoveredEndpoint, HostConfig } from '../types/index.js';

describe('Engine Module', () => {
  describe('load-generator utilities', () => {
    it('parses duration strings properly', () => {
      expect(parseDurationToSeconds('60s')).toBe(60);
      expect(parseDurationToSeconds('2m')).toBe(120);
      expect(parseDurationToSeconds('1h')).toBe(3600);
      expect(parseDurationToSeconds(45)).toBe(45);
      expect(parseDurationToSeconds('invalid')).toBe(10);
    });

    it('calculates latency stats correctly', () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = calculateLatencyStats(latencies);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBe(55);
      expect(stats.median).toBe(60);
      expect(stats.p90).toBe(100);
      expect(stats.p95).toBe(100);
      expect(stats.p99).toBe(100);
    });

    it('handles empty latency list gracefully', () => {
      const stats = calculateLatencyStats([]);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.mean).toBe(0);
    });
  });

  describe('runSmokeTests', () => {
    const mockEndpoints: DiscoveredEndpoint[] = [
      {
        id: 'SYS:Order:BE',
        protocol: 'soap',
        urlPath: '/XISOAPAdapter/MessageServlet?interface=Order',
        method: 'POST',
        interfaceName: 'Order',
        interfaceNamespace: 'http://company.com',
        senderComponent: 'SYS',
        qos: 'BE',
        headers: {}
      },
      {
        id: 'SYS:FaultInterface:BE',
        protocol: 'soap',
        urlPath: '/XISOAPAdapter/MessageServlet?interface=FaultInterface',
        method: 'POST',
        interfaceName: 'FaultInterface',
        interfaceNamespace: 'http://company.com',
        senderComponent: 'SYS',
        qos: 'BE',
        headers: {}
      }
    ];

    const hostConfig: HostConfig = {
      host: 'sap-qa.corp',
      port: 50000,
      https: false
    };

    it('executes smoke tests and evaluates success/fault responses', async () => {
      const mockDispatcher = async (opts: any) => {
        if (opts.url.includes('FaultInterface')) {
          return {
            statusCode: 500,
            statusText: '500',
            headers: {},
            body: '<soap:Fault><faultstring>General Error</faultstring></soap:Fault>',
            durationMs: 45,
            isSoapFault: true,
            soapFaultDetails: { faultCode: 'SOAP:Server', faultString: 'General Error' }
          };
        }
        return {
          statusCode: 200,
          statusText: '200',
          headers: { 'x-message-id': 'b999-123' },
          body: '<OrderResponse><Status>OK</Status></OrderResponse>',
          durationMs: 30,
          messageId: 'b999-123',
          isSoapFault: false
        };
      };

      const summary = await runSmokeTests(mockEndpoints, hostConfig, {
        concurrency: 2,
        customDispatcher: mockDispatcher
      });

      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);

      const passedResult = summary.results.find((r) => r.passed);
      expect(passedResult?.messageId).toBe('b999-123');

      const failedResult = summary.results.find((r) => !r.passed);
      expect(failedResult?.isSoapFault).toBe(true);
      expect(failedResult?.error).toContain('SOAP Fault: General Error');
    });
  });

  describe('runParityTest', () => {
    it('executes dual-run requests and asserts parity equivalence', async () => {
      const pipoHost: HostConfig = { host: 'sap-qa', port: 50000, https: false };
      const cpiHost: HostConfig = { host: 'cpi-dev', port: 443, https: true };

      const mockDispatcher = async (opts: any) => {
        // Both return semantically identical payloads
        const isPipo = opts.url.includes('50000');
        const body = isPipo
          ? '<ns1:Response xmlns:ns1="http://sap.com"><Id>100</Id><Time>2026-10-08T01:00:00Z</Time></ns1:Response>'
          : '<p2:Response xmlns:p2="http://sap.com"><Id>100</Id><Time>2026-10-08T01:00:05Z</Time></p2:Response>';

        return {
          statusCode: 200,
          statusText: '200',
          headers: {},
          body,
          durationMs: isPipo ? 50 : 35,
          isSoapFault: false
        };
      };

      const result = await runParityTest({
        pipoHost,
        cpiHost,
        interfaceName: 'SalesOrder_OB',
        payloadPath: './payloads/SalesOrder_OB/test-01.xml',
        customDispatcher: mockDispatcher
      });

      expect(result.passed).toBe(true);
      expect(result.diff.matched).toBe(true);
      expect(result.pipoResponse.durationMs).toBe(50);
      expect(result.cpiResponse.durationMs).toBe(35);
    });
  });

  describe('runStressTest', () => {
    it('blocks running stress test against production without override', async () => {
      const prodHost: HostConfig = { host: 'sap-prod.company.com', port: 50000, https: false };

      await expect(
        runStressTest({
          hostConfig: prodHost,
          targetUrl: 'http://sap-prod.company.com:50000/XISOAPAdapter/MessageServlet',
          interfaceName: 'SalesOrder_OB',
          payloadPath: './payloads/SalesOrder_OB/test-01.xml',
          targetTps: 5,
          durationSeconds: 1
        })
      ).rejects.toThrow(SafetyFenceError);
    });

    it('executes load test and records metrics with mock dispatcher', async () => {
      const devHost: HostConfig = { host: 'sap-dev.internal', port: 50000, https: false };

      const mockDispatcher = async () => {
        await new Promise((r) => setTimeout(r, 2));
        return {
          statusCode: 200,
          statusText: '200',
          headers: {},
          body: '<Ack/>',
          durationMs: 15,
          isSoapFault: false
        };
      };

      const metrics = await runStressTest({
        hostConfig: devHost,
        targetUrl: 'http://sap-dev.internal:50000/XISOAPAdapter/MessageServlet',
        interfaceName: 'SalesOrder_OB',
        payloadPath: './payloads/SalesOrder_OB/test-01.xml',
        targetTps: 10,
        durationSeconds: 1,
        customDispatcher: mockDispatcher
      });

      expect(metrics.totalRequests).toBeGreaterThanOrEqual(5);
      expect(metrics.successfulRequests).toBe(metrics.totalRequests);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.latencies.min).toBeGreaterThanOrEqual(0);
    });
  });
});

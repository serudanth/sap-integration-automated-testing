import { describe, it, expect, vi } from 'vitest';
import { generateSmokeJunitXml, generateParityJunitXml, saveJunitReport } from './junit-reporter.js';
import { generateParityHtmlReport, generateStressHtmlReport, saveHtmlReport } from './html-reporter.js';
import {
  printDiscoveryTable,
  printSmokeSummary,
  printParityResult,
  printStressMetrics
} from './terminal-reporter.js';
import type { SmokeTestSummary, ParityTestResult, StressMetrics, DiscoveredEndpoint } from '../types/index.js';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

describe('Reporter Module', () => {
  const dummyEndpoint: DiscoveredEndpoint = {
    id: 'SYS:Test:BE',
    protocol: 'soap',
    urlPath: '/XISOAPAdapter/MessageServlet?interface=Test',
    method: 'POST',
    interfaceName: 'Test_OB',
    interfaceNamespace: 'http://test.com',
    senderComponent: 'SYS_SRC',
    receiverComponent: 'SYS_TGT',
    qos: 'BE',
    headers: {}
  };

  const sampleSummary: SmokeTestSummary = {
    total: 2,
    passed: 1,
    failed: 1,
    durationMs: 500,
    results: [
      {
        endpoint: dummyEndpoint,
        passed: true,
        statusCode: 200,
        durationMs: 150,
        messageId: 'M123',
        isSoapFault: false
      },
      {
        endpoint: dummyEndpoint,
        passed: false,
        statusCode: 500,
        durationMs: 350,
        isSoapFault: true,
        error: 'SOAP Fault'
      }
    ]
  };

  const sampleParityResult: ParityTestResult = {
    interfaceName: 'Test_OB',
    payloadFile: '/path/to/payload.xml',
    passed: false,
    pipoResponse: {
      statusCode: 200,
      statusText: '200',
      headers: {},
      body: '<Response><Id>1</Id></Response>',
      durationMs: 120,
      isSoapFault: false
    },
    cpiResponse: {
      statusCode: 200,
      statusText: '200',
      headers: {},
      body: '<Response><Id>2</Id></Response>',
      durationMs: 95,
      isSoapFault: false
    },
    diff: {
      matched: false,
      differences: [
        { path: '$.Response.Id', reason: 'Value mismatch', expected: '1', actual: '2' }
      ],
      canonicalA: '{"Response":{"Id":"1"}}',
      canonicalB: '{"Response":{"Id":"2"}}',
      summary: 'Parity Discrepancy: 1 difference(s) detected'
    },
    durationMs: 250
  };

  const sampleStressMetrics: StressMetrics = {
    interfaceName: 'Test_OB',
    totalRequests: 100,
    successfulRequests: 95,
    failedRequests: 5,
    targetTps: 50,
    achievedTps: 48.5,
    totalDurationSeconds: 2,
    statusCodes: { 200: 95, 500: 5 },
    errors: { 'HTTP_500': 5 },
    latencies: {
      min: 10,
      max: 120,
      mean: 25,
      median: 20,
      p50: 20,
      p90: 50,
      p95: 75,
      p99: 110
    },
    allLatencies: [10, 20, 30]
  };

  describe('JUnit Reporter', () => {
    it('generates valid JUnit XML for smoke tests', () => {
      const xml = generateSmokeJunitXml(sampleSummary);
      expect(xml).toContain('<testsuites name="AetherFlow Smoke Tests" tests="2" failures="1"');
      expect(xml).toContain('<testcase name="SYS_SRC -&gt; Test_OB (BE)"');
      expect(xml).toContain('<failure message="SOAP Fault"');
    });

    it('generates valid JUnit XML for parity tests', () => {
      const xml = generateParityJunitXml(sampleParityResult);
      expect(xml).toContain('<testsuites name="AetherFlow Parity Tests" tests="1" failures="1"');
      expect(xml).toContain('<failure message="Parity Discrepancy: 1 difference(s) detected"');
    });

    it('writes JUnit XML to disk', async () => {
      const testPath = './reports/test-junit.xml';
      await saveJunitReport(testPath, '<testsuites/>');
      expect(existsSync(testPath)).toBe(true);
      await unlink(testPath);
    });
  });

  describe('HTML Reporter', () => {
    it('generates interactive HTML report for parity results', () => {
      const html = generateParityHtmlReport(sampleParityResult);
      expect(html).toContain('AetherFlow Migration Parity Report');
      expect(html).toContain('Test_OB');
      expect(html).toContain('$.Response.Id');
      expect(html).toContain('Value mismatch');
    });

    it('generates interactive HTML report for stress metrics', () => {
      const html = generateStressHtmlReport(sampleStressMetrics);
      expect(html).toContain('AetherFlow High-Throughput Stress Benchmark');
      expect(html).toContain('48.5 TPS');
      expect(html).toContain('95th Percentile (p95)');
    });

    it('writes HTML report to disk', async () => {
      const testPath = './reports/test-report.html';
      await saveHtmlReport(testPath, '<html></html>');
      expect(existsSync(testPath)).toBe(true);
      await unlink(testPath);
    });
  });

  describe('Terminal Reporter', () => {
    it('prints formatted tables without throwing', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      printDiscoveryTable([dummyEndpoint]);
      printSmokeSummary(sampleSummary);
      printParityResult(sampleParityResult);
      printStressMetrics(sampleStressMetrics);

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});

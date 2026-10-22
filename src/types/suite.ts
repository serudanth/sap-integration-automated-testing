/**
 * Test Suite Manifest Schema (suite.yaml)
 * Defines metadata and assertions for persistent scenario fixtures.
 */

import type { PlatformEcosystem } from './scenario.js';

export interface TestCaseDescriptor {
  id: string;                                // e.g. "01-happy-path", "02-negative-missing-mandatory"
  title: string;
  file: string;                              // Relative path to fixture file: "01-happy-path.xml"
  type: 'positive' | 'negative' | 'boundary';
  expectedStatusCode: number;                // Expected HTTP status code (200, 400, 500)
  expectedIsFault: boolean;                  // True if this test expects a SOAP Fault or error
  expectedFaultCode?: string;                // e.g. "SERVER.SYSTEM_ERROR"
  expectedAsyncStatus?: 'DELIVERED' | 'WAITING' | 'SYSTEM_ERROR';
  timeoutMs?: number;
}

export interface TestSuiteManifest {
  scenarioId: string;
  ecosystem: PlatformEcosystem;
  generatedAt: string;
  schemaSource: string;                      // WSDL URL or local schema filename
  testCases: TestCaseDescriptor[];
  volatileFieldIgnores: string[];
  customHeaders?: Record<string, string>;
}

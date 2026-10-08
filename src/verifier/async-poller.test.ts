import { describe, it, expect } from 'vitest';
import {
  buildMonitoringQueryEnvelope,
  parseMonitoringResponse,
  pollAsyncMessageStatus
} from './async-poller.js';

describe('Asynchronous Telemetry Poller', () => {
  describe('buildMonitoringQueryEnvelope', () => {
    it('constructs valid SOAP envelope with messageKey', () => {
      const env = buildMonitoringQueryEnvelope('MSG-12345-ABC');
      expect(env).toContain('<bas:messageKey>MSG-12345-ABC</bas:messageKey>');
      expect(env).toContain('xmlns:bas="http://sap.com/xi/BASIS"');
    });
  });

  describe('parseMonitoringResponse', () => {
    it('recognizes DELIVERED terminal status as success', () => {
      const xml = '<Response><status>DELIVERED</status></Response>';
      const parsed = parseMonitoringResponse(xml);
      expect(parsed.state).toBe('DELIVERED');
      expect(parsed.terminal).toBe(true);
      expect(parsed.errorCategory).toBeUndefined();
    });

    it('recognizes WAITING non-terminal status', () => {
      const xml = '<Response><status>WAITING</status></Response>';
      const parsed = parseMonitoringResponse(xml);
      expect(parsed.state).toBe('WAITING');
      expect(parsed.terminal).toBe(false);
    });

    it('recognizes SYSTEM_ERROR and extracts mapping failure step', () => {
      const xml = '<Response><status>SYSTEM_ERROR</status><errorText>Java Mapping Exception: field missing</errorText></Response>';
      const parsed = parseMonitoringResponse(xml);
      expect(parsed.state).toBe('SYSTEM_ERROR');
      expect(parsed.terminal).toBe(true);
      expect(parsed.failingStep).toBe('Mapping');
      expect(parsed.errorCategory).toBe('MAPPING_EXECUTION_ERROR');
      expect(parsed.errorText).toContain('Java Mapping Exception');
    });

    it('recognizes routing failure step', () => {
      const xml = '<Response><status>SYSTEM_ERROR</status><errorText>Receiver_Not_Determined for interface</errorText></Response>';
      const parsed = parseMonitoringResponse(xml);
      expect(parsed.failingStep).toBe('Routing');
      expect(parsed.errorCategory).toBe('RECEIVER_DETERMINATION_ERROR');
    });

    it('recognizes outbound adapter call failure step', () => {
      const xml = '<Response><status>HOLDING</status><errorText>HTTP Adapter connection timeout to backend</errorText></Response>';
      const parsed = parseMonitoringResponse(xml);
      expect(parsed.state).toBe('HOLDING');
      expect(parsed.terminal).toBe(true);
      expect(parsed.failingStep).toBe('Adapter Call');
      expect(parsed.errorCategory).toBe('OUTBOUND_ADAPTER_ERROR');
    });

    it('handles empty response gracefully', () => {
      const parsed = parseMonitoringResponse('');
      expect(parsed.state).toBe('UNKNOWN');
      expect(parsed.terminal).toBe(false);
    });
  });

  describe('pollAsyncMessageStatus', () => {
    it('polls with mock dispatcher until DELIVERED terminal state', async () => {
      let callCount = 0;
      const mockDispatcher = async () => {
        callCount++;
        if (callCount === 1) {
          return { statusCode: 200, body: '<status>WAITING</status>' };
        }
        return { statusCode: 200, body: '<status>DELIVERED</status>' };
      };

      const result = await pollAsyncMessageStatus(
        'MSG-UUID-1',
        { host: 'sap-qa', port: 50000, https: false },
        {
          initialIntervalMs: 10,
          backoffFactor: 1.1,
          maxTimeoutMs: 2000,
          httpDispatcher: mockDispatcher
        }
      );

      expect(result.terminal).toBe(true);
      expect(result.state).toBe('DELIVERED');
      expect(result.pollCount).toBe(2);
    });

    it('stops and returns immediately upon failure state', async () => {
      const mockDispatcher = async () => ({
        statusCode: 200,
        body: '<status>SYSTEM_ERROR</status><errorText>Mapping error</errorText>'
      });

      const result = await pollAsyncMessageStatus(
        'MSG-UUID-2',
        { host: 'sap-qa', port: 50000, https: false },
        {
          initialIntervalMs: 10,
          maxTimeoutMs: 1000,
          httpDispatcher: mockDispatcher
        }
      );

      expect(result.terminal).toBe(true);
      expect(result.state).toBe('SYSTEM_ERROR');
      expect(result.failingStep).toBe('Mapping');
    });
  });
});

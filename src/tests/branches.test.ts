import { describe, it, expect } from 'vitest';
import { resolveHostConfig } from '../config/index.js';
import { filterEndpoints, loadInventory } from '../discovery/inventory-loader.js';
import { runSmokeTests } from '../engine/smoke-runner.js';
import { pollAsyncMessageStatus, parseMonitoringResponse } from '../verifier/async-poller.js';
import { compareAstNodes, normalizeAst } from '../verifier/canonical-diff.js';
import { formatDate } from '../protocols/template-engine.js';
import type { DiscoveredEndpoint, HostConfig } from '../types/index.js';

describe('Branch Coverage Enhancements', () => {
  it('covers resolveHostConfig URL credentials and custom port combinations', () => {
    const config1 = resolveHostConfig('http://testuser:testpass@sap-qa:8080');
    expect(config1.user).toBe('testuser');
    expect(config1.password).toBe('testpass');
    expect(config1.port).toBe(8080);
    expect(config1.https).toBe(false);

    const config2 = resolveHostConfig('https://sap-qa');
    expect(config2.port).toBe(443);
    expect(config2.https).toBe(true);
  });

  it('covers filterEndpoints with namespace, receiverComponent, and zero limit', () => {
    const endpoints: DiscoveredEndpoint[] = [
      {
        id: 'A:B:EO',
        protocol: 'soap',
        urlPath: '/path1',
        method: 'POST',
        interfaceName: 'Order_OB',
        interfaceNamespace: 'http://test.com/orders',
        senderComponent: 'POS',
        receiverComponent: 'SAP_ECC',
        qos: 'EO',
        headers: {}
      },
      {
        id: 'C:D:BE',
        protocol: 'soap',
        urlPath: '/path2',
        method: 'POST',
        interfaceName: 'Customer_OB',
        interfaceNamespace: 'http://test.com/customers',
        senderComponent: 'CRM',
        receiverComponent: 'SAP_S4',
        qos: 'BE',
        headers: {}
      }
    ];

    const filteredNs = filterEndpoints(endpoints, { interfaceNamespace: 'customers' });
    expect(filteredNs).toHaveLength(1);
    expect(filteredNs[0]!.interfaceName).toBe('Customer_OB');

    const filteredRc = filterEndpoints(endpoints, { receiverComponent: 'sap_ecc' });
    expect(filteredRc).toHaveLength(1);
    expect(filteredRc[0]!.interfaceName).toBe('Order_OB');

    const filteredNoLimit = filterEndpoints(endpoints, { limit: 0 });
    expect(filteredNoLimit).toHaveLength(2);
  });

  it('covers loadInventory validation failure cases', async () => {
    // Non-existent path
    await expect(loadInventory('./non-existent-sample.json')).rejects.toThrow();
  });

  it('covers smoke-runner with verifyAsync on EO interface', async () => {
    const eoEndpoint: DiscoveredEndpoint = {
      id: 'SYS:AsyncTest:EO',
      protocol: 'soap',
      urlPath: '/XISOAPAdapter/MessageServlet?interface=AsyncTest',
      method: 'POST',
      interfaceName: 'AsyncTest',
      interfaceNamespace: 'http://test.com',
      senderComponent: 'SYS',
      qos: 'EO',
      headers: {}
    };

    const hostConfig: HostConfig = { host: 'sap-qa', port: 50000, https: false };

    const mockDispatcher = async (opts: any) => {
      if (opts.url.includes('AdapterMessageMonitoring')) {
        return {
          statusCode: 200,
          statusText: '200',
          headers: {},
          body: '<status>DELIVERED</status>',
          durationMs: 20,
          isSoapFault: false
        };
      }
      return {
        statusCode: 200,
        statusText: '200',
        headers: { 'x-message-id': 'uuid-msg-123' },
        body: '<Ack/>',
        durationMs: 25,
        messageId: 'uuid-msg-123',
        isSoapFault: false
      };
    };

    const summary = await runSmokeTests([eoEndpoint], hostConfig, {
      verifyAsync: true,
      customDispatcher: mockDispatcher
    });

    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(1);
    expect(summary.results[0]!.passed).toBe(true);
    expect(summary.results[0]!.asyncStatus?.state).toBe('DELIVERED');
  });

  it('covers smoke-runner error handling when dispatcher throws', async () => {
    const endpoint: DiscoveredEndpoint = {
      id: 'SYS:Throw:BE',
      protocol: 'soap',
      urlPath: '/path',
      method: 'POST',
      interfaceName: 'ThrowTest',
      interfaceNamespace: 'http://test.com',
      senderComponent: 'SYS',
      qos: 'BE',
      headers: {}
    };

    const hostConfig: HostConfig = { host: 'sap-qa', port: 50000, https: false };
    const throwingDispatcher = async () => {
      throw new Error('Connection refused');
    };

    const summary = await runSmokeTests([endpoint], hostConfig, {
      customDispatcher: throwingDispatcher
    });

    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.results[0]!.error).toBe('Connection refused');
  });

  it('covers async-poller timeout expiration and unknown status', async () => {
    const mockDispatcher = async () => ({
      statusCode: 200,
      body: '<status>WAITING</status>'
    });

    const result = await pollAsyncMessageStatus(
      'UUID-TIMEOUT',
      { host: 'sap-qa', port: 50000, https: false },
      {
        initialIntervalMs: 5,
        maxTimeoutMs: 20,
        httpDispatcher: mockDispatcher
      }
    );

    expect(result.terminal).toBe(false);
    expect(result.state).toBe('WAITING');
  });

  it('covers parseMonitoringResponse inbound/generic error step categorization', () => {
    const res = parseMonitoringResponse('<status>SYSTEM_ERROR</status><errorText>Internal error</errorText>');
    expect(res.state).toBe('SYSTEM_ERROR');
    expect(res.failingStep).toBe('Unknown');
    expect(res.errorCategory).toBe('PROCESSING_ERROR');
  });

  it('covers canonical-diff array vs object type mismatch and array sorting', () => {
    const diffs1 = compareAstNodes([1, 2], { a: 1 });
    expect(diffs1[0]!.reason).toContain('Type mismatch: expected Array, received Object');

    const normalized = normalizeAst([3, 1, 2], { arrayOrderInsensitive: true });
    expect(normalized).toEqual([1, 2, 3]);
  });

  it('covers formatDate with other format string', () => {
    const date = new Date('2026-05-15T00:00:00Z');
    expect(formatDate(date, 'CUSTOM')).toBe('20260515');
  });
});

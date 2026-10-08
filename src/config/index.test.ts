import { describe, it, expect } from 'vitest';
import {
  isProductionHost,
  assertNonProduction,
  SafetyFenceError,
  maskHeaders,
  maskUrl,
  sanitizeForLogging,
  resolveHostConfig,
  loadHostsConfig
} from './index.js';

describe('Config & Safety Fence', () => {
  describe('isProductionHost', () => {
    it('detects production hosts accurately', () => {
      expect(isProductionHost('sap-prod.company.com')).toBe(true);
      expect(isProductionHost('pipo-prd-01.corp')).toBe(true);
      expect(isProductionHost('spp100.smretail.com')).toBe(true);
      expect(isProductionHost('production-sap.internal')).toBe(true);
      expect(isProductionHost('live-gateway.sap.com')).toBe(true);
    });

    it('identifies non-production hosts as safe', () => {
      expect(isProductionHost('sap-dev.company.com')).toBe(false);
      expect(isProductionHost('spd100.smretail.com')).toBe(false);
      expect(isProductionHost('sap-qa.corp')).toBe(false);
      expect(isProductionHost('cpi-dev.cfapps.ondemand.com')).toBe(false);
      expect(isProductionHost('localhost')).toBe(false);
      expect(isProductionHost('')).toBe(false);
    });
  });

  describe('assertNonProduction', () => {
    it('throws SafetyFenceError on production host without override', () => {
      expect(() => {
        assertNonProduction('sap-prod.company.com', false);
      }).toThrow(SafetyFenceError);
    });

    it('allows execution against production when explicit override is provided', () => {
      expect(() => {
        assertNonProduction('sap-prod.company.com', true);
      }).not.toThrow();
    });

    it('allows execution against non-production without override', () => {
      expect(() => {
        assertNonProduction('sap-dev.internal', false);
      }).not.toThrow();
    });
  });

  describe('maskHeaders', () => {
    it('redacts sensitive headers', () => {
      const headers = {
        'Authorization': 'Basic dXNlcjpwYXNz',
        'Cookie': 'JSESSIONID=12345678',
        'X-Api-Key': 'secret-api-key',
        'Content-Type': 'application/xml',
        'X-Requested-With': 'AetherFlow'
      };

      const masked = maskHeaders(headers);
      expect(masked['Authorization']).toBe('******** (REDACTED)');
      expect(masked['Cookie']).toBe('******** (REDACTED)');
      expect(masked['X-Api-Key']).toBe('******** (REDACTED)');
      expect(masked['Content-Type']).toBe('application/xml');
      expect(masked['X-Requested-With']).toBe('AetherFlow');
    });

    it('ignores undefined values', () => {
      const masked = maskHeaders({ 'Authorization': undefined, 'Host': 'sap-qa' });
      expect(masked['Host']).toBe('sap-qa');
      expect(masked['Authorization']).toBeUndefined();
    });
  });

  describe('maskUrl', () => {
    it('redacts username and password in URLs', () => {
      const url = 'https://admin:SuperSecret123@pipo-host:50001/XISOAPAdapter/MessageServlet';
      const masked = maskUrl(url);
      expect(masked).toBe('https://***:***@pipo-host:50001/XISOAPAdapter/MessageServlet');
      expect(masked).not.toContain('SuperSecret123');
    });

    it('leaves standard URLs unchanged', () => {
      const url = 'https://pipo-host:50001/XISOAPAdapter/MessageServlet?qos=EO';
      expect(maskUrl(url)).toBe(url);
    });

    it('handles invalid URL strings gracefully', () => {
      expect(maskUrl('not a url')).toBe('not a url');
    });
  });

  describe('sanitizeForLogging', () => {
    it('recursively redacts sensitive keys in objects and arrays', () => {
      const payload = {
        user: 'admin',
        password: 'secretPassword',
        tokens: [{ auth: 'token-abc' }, { normal: 'public' }],
        nested: {
          apiKey: 'key-123',
          endpoint: '/test'
        }
      };

      const sanitized = sanitizeForLogging(payload);
      expect(sanitized.password).toBe('******** (REDACTED)');
      expect(sanitized.tokens[0].auth).toBe('******** (REDACTED)');
      expect(sanitized.tokens[1].normal).toBe('public');
      expect(sanitized.nested.apiKey).toBe('******** (REDACTED)');
      expect(sanitized.nested.endpoint).toBe('/test');
    });

    it('returns primitive values as-is', () => {
      expect(sanitizeForLogging('string')).toBe('string');
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(null)).toBe(null);
    });
  });

  describe('resolveHostConfig', () => {
    it('resolves from known hosts dictionary', () => {
      const known = {
        'sap-dev': { host: 'sap-dev.internal', port: 50000, https: false }
      };
      const resolved = resolveHostConfig('sap-dev', known);
      expect(resolved.host).toBe('sap-dev.internal');
      expect(resolved.port).toBe(50000);
    });

    it('parses full HTTP URL', () => {
      const resolved = resolveHostConfig('https://my-sap-host:50001');
      expect(resolved.host).toBe('my-sap-host');
      expect(resolved.port).toBe(50001);
      expect(resolved.https).toBe(true);
    });

    it('parses host with port string', () => {
      const resolved = resolveHostConfig('my-sap-host:50000');
      expect(resolved.host).toBe('my-sap-host');
      expect(resolved.port).toBe(50000);
      expect(resolved.https).toBe(false);
    });

    it('defaults ports based on https flag', () => {
      const resolvedHttp = resolveHostConfig('my-sap-host', {}, { https: false });
      expect(resolvedHttp.port).toBe(50000);

      const resolvedHttps = resolveHostConfig('my-sap-host', {}, { https: true });
      expect(resolvedHttps.port).toBe(50001);
    });
  });

  describe('loadHostsConfig', () => {
    it('returns empty object if hosts file does not exist', async () => {
      const hosts = await loadHostsConfig('non-existent-hosts.json');
      expect(hosts).toEqual({});
    });
  });
});

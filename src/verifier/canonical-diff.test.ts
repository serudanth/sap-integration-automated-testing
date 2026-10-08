import { describe, it, expect } from 'vitest';
import {
  canonicalDiff,
  stripNamespacePrefix,
  normalizeAst,
  parseContentToAst,
  compareAstNodes
} from './canonical-diff.js';

describe('Canonical Diffing & Verification', () => {
  describe('stripNamespacePrefix', () => {
    it('strips element tag namespace prefixes', () => {
      expect(stripNamespacePrefix('ns0:SalesOrder')).toBe('SalesOrder');
      expect(stripNamespacePrefix('p1:Item')).toBe('Item');
      expect(stripNamespacePrefix('Order')).toBe('Order');
    });

    it('strips attribute namespace prefixes', () => {
      expect(stripNamespacePrefix('@_ns1:id')).toBe('@_id');
      expect(stripNamespacePrefix('@_type')).toBe('@_type');
    });

    it('filters out xmlns namespace declarations', () => {
      expect(stripNamespacePrefix('@_xmlns:ns0')).toBe('');
      expect(stripNamespacePrefix('@_xmlns')).toBe('');
    });
  });

  describe('normalizeAst', () => {
    it('strips default volatile fields', () => {
      const ast = {
        'ns0:Order': {
          'id': '1001',
          'uuid': '88888888-4444-4444-4444-121212121212',
          'timestamp': '2026-10-08T10:00:00Z',
          'messageId': 'MSG-999',
          'amount': 250
        }
      };

      const normalized = normalizeAst(ast);
      expect(normalized.Order.id).toBe('1001');
      expect(normalized.Order.amount).toBe(250);
      expect(normalized.Order.uuid).toBeUndefined();
      expect(normalized.Order.timestamp).toBeUndefined();
      expect(normalized.Order.messageId).toBeUndefined();
    });

    it('strips custom ignore paths and regexes', () => {
      const ast = {
        'Header': {
          'sessionCookie': 'XYZ123',
          'tempTracking': 'TRACK_01',
          'validField': 'OK'
        }
      };

      const normalized = normalizeAst(ast, {
        ignorePaths: ['sessionCookie'],
        ignoreRegex: ['^temp.*']
      });

      expect(normalized.Header.sessionCookie).toBeUndefined();
      expect(normalized.Header.tempTracking).toBeUndefined();
      expect(normalized.Header.validField).toBe('OK');
    });

    it('sorts keys deterministically', () => {
      const obj = { z: 1, a: 2, m: 3 };
      const normalized = normalizeAst(obj);
      expect(Object.keys(normalized)).toEqual(['a', 'm', 'z']);
    });
  });

  describe('parseContentToAst', () => {
    it('parses valid XML string', () => {
      const res = parseContentToAst('<root><item>val</item></root>');
      expect(res.type).toBe('xml');
      expect(res.ast.root.item).toBe('val');
    });

    it('parses valid JSON string', () => {
      const res = parseContentToAst('{"root":{"item":"val"}}');
      expect(res.type).toBe('json');
      expect(res.ast.root.item).toBe('val');
    });

    it('handles empty content gracefully', () => {
      const res = parseContentToAst('');
      expect(res.type).toBe('text');
      expect(res.ast).toEqual({});
    });
  });

  describe('canonicalDiff', () => {
    it('certifies parity on identical XML structures with different prefixes', () => {
      const xmlA = `
        <ns0:SalesOrderResponse xmlns:ns0="http://sap.com/order">
          <ns0:OrderId>4500123</ns0:OrderId>
          <ns0:Status>CONFIRMED</ns0:Status>
          <ns0:Timestamp>2026-10-08T01:00:00Z</ns0:Timestamp>
        </ns0:SalesOrderResponse>
      `;

      const xmlB = `
        <p1:SalesOrderResponse xmlns:p1="http://sap.com/order">
          <p1:OrderId>4500123</p1:OrderId>
          <p1:Status>CONFIRMED</p1:Status>
          <p1:Timestamp>2026-10-08T01:05:30Z</p1:Timestamp>
        </p1:SalesOrderResponse>
      `;

      const result = canonicalDiff(xmlA, xmlB);
      expect(result.matched).toBe(true);
      expect(result.differences).toHaveLength(0);
      expect(result.summary).toContain('100% equivalence');
    });

    it('detects structural and value differences accurately', () => {
      const xmlA = `
        <Response>
          <ItemCount>2</ItemCount>
          <Total>100.00</Total>
        </Response>
      `;

      const xmlB = `
        <Response>
          <ItemCount>3</ItemCount>
          <Discount>5.00</Discount>
        </Response>
      `;

      const result = canonicalDiff(xmlA, xmlB);
      expect(result.matched).toBe(false);
      expect(result.differences.length).toBeGreaterThanOrEqual(2);

      const paths = result.differences.map((d) => d.path);
      expect(paths).toContain('$.Response.ItemCount');
      expect(paths).toContain('$.Response.Total');
      expect(paths).toContain('$.Response.Discount');
    });

    it('supports canonical diffing between JSON responses', () => {
      const jsonA = JSON.stringify({ id: 100, name: 'Prod A', timestamp: '2026-01-01' });
      const jsonB = JSON.stringify({ id: 100, name: 'Prod A', timestamp: '2026-02-02' });

      const result = canonicalDiff(jsonA, jsonB);
      expect(result.matched).toBe(true); // timestamp is ignored by default
    });
  });

  describe('compareAstNodes', () => {
    it('detects type mismatches', () => {
      const diffs = compareAstNodes({ val: '123' }, { val: 123 });
      expect(diffs).toHaveLength(1);
      expect(diffs[0]!.reason).toContain('Type mismatch');
    });

    it('detects array length mismatches', () => {
      const diffs = compareAstNodes([1, 2], [1, 2, 3]);
      expect(diffs.length).toBeGreaterThanOrEqual(1);
      expect(diffs[0]!.reason).toContain('Array length mismatch');
    });
  });
});

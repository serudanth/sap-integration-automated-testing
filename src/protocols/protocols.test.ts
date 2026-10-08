import { describe, it, expect } from 'vitest';
import { resolveTemplate, getRandomInt, formatDate } from './template-engine.js';
import {
  buildSoapEnvelope,
  buildXi3Envelope,
  buildMinimalSmokePayload
} from './soap-message-builder.js';
import { extractSapMessageId, parseSoapFault } from './response-parser.js';

describe('Protocols & Templates Module', () => {
  describe('template-engine', () => {
    it('generates random integer within bounds', () => {
      for (let i = 0; i < 20; i++) {
        const val = getRandomInt(10, 50);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThanOrEqual(50);
      }
    });

    it('formats date to YYYYMMDD by default', () => {
      const fixedDate = new Date('2026-10-08T12:00:00Z');
      expect(formatDate(fixedDate)).toBe('20261008');
      expect(formatDate(fixedDate, 'YYYY-MM-DD')).toBe('2026-10-08');
    });

    it('resolves dynamic tokens: guid, timestamp, date, randomInt, and variables', () => {
      const template = `
        <Test>
          <Id>{{$guid}}</Id>
          <Timestamp>{{$isoTimestamp}}</Timestamp>
          <Date>{{$date}}</Date>
          <Epoch>{{$timestamp}}</Epoch>
          <Number>{{$randomInt(100, 200)}}</Number>
          <Custom>{{customKey}}</Custom>
        </Test>
      `;

      const resolved = resolveTemplate(template, { customKey: 'CUSTOM_VAL_123' });

      expect(resolved).not.toContain('{{$guid}}');
      expect(resolved).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      expect(resolved).not.toContain('{{$isoTimestamp}}');
      expect(resolved).not.toContain('{{$date}}');
      expect(resolved).not.toContain('{{$timestamp}}');
      expect(resolved).toContain('CUSTOM_VAL_123');

      const numMatch = resolved.match(/<Number>(\d+)<\/Number>/);
      expect(numMatch).not.toBeNull();
      const num = parseInt(numMatch![1]!, 10);
      expect(num).toBeGreaterThanOrEqual(100);
      expect(num).toBeLessThanOrEqual(200);
    });

    it('returns empty string on empty template', () => {
      expect(resolveTemplate('')).toBe('');
    });
  });

  describe('soap-message-builder', () => {
    it('builds standard SOAP 1.1 envelope', () => {
      const env = buildSoapEnvelope('<Payload>test</Payload>');
      expect(env).toContain('xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"');
      expect(env).toContain('<soapenv:Body>');
      expect(env).toContain('<Payload>test</Payload>');
    });

    it('builds SOAP 1.2 envelope when requested', () => {
      const env = buildSoapEnvelope('<Data/>', { soapVersion: '1.2' });
      expect(env).toContain('xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"');
    });

    it('builds SAP XI 3.0 envelope with XI headers', () => {
      const xi = buildXi3Envelope({
        senderService: 'BC_DMALL',
        interfaceName: 'OrderCreate_OB',
        interfaceNamespace: 'http://smretail.com/xi/Sales',
        receiverService: 'S4HANA',
        qos: 'EO',
        messageId: 'M12345678',
        payload: '<Order><Item>1</Item></Order>'
      });

      expect(xi).toContain('xmlns:xi="http://sap.com/xi/XI/Message/30"');
      expect(xi).toContain('<xi:MessageId>M12345678</xi:MessageId>');
      expect(xi).toContain('<xi:Service>BC_DMALL</xi:Service>');
      expect(xi).toContain('<xi:Interface>OrderCreate_OB</xi:Interface>');
      expect(xi).toContain('<xi:Service>S4HANA</xi:Service>');
      expect(xi).toContain('<xi:QualityOfService>EO</xi:QualityOfService>');
    });

    it('generates minimal smoke payload', () => {
      const smoke = buildMinimalSmokePayload('Invoice_OB', 'urn:company:invoice');
      expect(smoke).toContain('<ns:Invoice_OB xmlns:ns="urn:company:invoice">');
      expect(smoke).toContain('<SmokeTestHeader>');
      expect(smoke).toContain('<Ping>true</Ping>');
    });
  });

  describe('response-parser', () => {
    it('extracts SAP MessageID from HTTP headers', () => {
      const headers = {
        'x-message-id': 'b1c3a647-7589-4e78-98e3-513d6a2f91a0',
        'content-type': 'text/xml'
      };
      const id = extractSapMessageId(headers, '');
      expect(id).toBe('b1c3a647-7589-4e78-98e3-513d6a2f91a0');
    });

    it('extracts SAP MessageID from XML body tag', () => {
      const xml = '<soap:Envelope><soap:Body><SAP:MessageId>a9999999-1111-2222-3333-444444444444</SAP:MessageId></soap:Body></soap:Envelope>';
      const id = extractSapMessageId({}, xml);
      expect(id).toBe('a9999999-1111-2222-3333-444444444444');
    });

    it('extracts SAP MessageID from plain text body with UUID fallback', () => {
      const text = 'Message accepted successfully with id c0000000-2222-3333-4444-555555555555';
      const id = extractSapMessageId({}, text);
      expect(id).toBe('c0000000-2222-3333-4444-555555555555');
    });

    it('returns undefined if no MessageID is found', () => {
      expect(extractSapMessageId({}, '<NoIdHere/>')).toBeUndefined();
    });

    it('parses SOAP Fault from XML response', () => {
      const faultXml = `
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
          <soapenv:Body>
            <soapenv:Fault>
              <faultcode>SOAP:Server</faultcode>
              <faultstring>Mapping failed: NullPointerException</faultstring>
              <detail>Error at line 42</detail>
            </soapenv:Fault>
          </soapenv:Body>
        </soapenv:Envelope>
      `;

      const fault = parseSoapFault(faultXml);
      expect(fault).not.toBeNull();
      expect(fault!.faultCode).toBe('SOAP:Server');
      expect(fault!.faultString).toBe('Mapping failed: NullPointerException');
      expect(fault!.detail).toBe('Error at line 42');
    });

    it('returns null when response is not a SOAP fault', () => {
      const normalXml = '<OrderResponse><Status>OK</Status></OrderResponse>';
      expect(parseSoapFault(normalXml)).toBeNull();
    });
  });
});

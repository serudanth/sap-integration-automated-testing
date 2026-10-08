import { XMLParser } from 'fast-xml-parser';
import type { SoapFaultDetails } from '../types/index.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  trimValues: true
});

/**
 * Inspects response headers and body to extract the SAP MessageID.
 */
export function extractSapMessageId(
  headers: Record<string, string>,
  body: string
): string | undefined {
  // 1. Inspect HTTP Headers (case-insensitive lookup)
  const headerKeys = [
    'x-message-id',
    'x-sap-messageid',
    'sap-message-id',
    'message-id',
    'x-correlation-id',
    'sap-passport'
  ];

  for (const [k, v] of Object.entries(headers)) {
    if (headerKeys.includes(k.toLowerCase()) && v) {
      const match = v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (match) return match[0];
      return v.trim();
    }
  }

  if (!body) return undefined;

  // 2. Body XML tag patterns
  const tagPatterns = [
    /<(?:[a-zA-Z0-9_-]+:)?MessageId[^>]*>([^<]+)<\/(?:[a-zA-Z0-9_-]+:)?MessageId>/i,
    /<(?:[a-zA-Z0-9_-]+:)?MessageID[^>]*>([^<]+)<\/(?:[a-zA-Z0-9_-]+:)?MessageID>/i,
    /<(?:SAP|xi):MessageId>([^<]+)<\/(?:SAP|xi):MessageId>/i,
    /SAP\s+Message\s+ID[:=]\s*([0-9a-fA-F-]{32,36})/i
  ];

  for (const regex of tagPatterns) {
    const match = body.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // 3. Fallback UUID regex in response body
  const uuidMatch = body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) {
    return uuidMatch[0];
  }

  return undefined;
}

/**
 * Checks if the body contains a SOAP Fault and extracts details.
 */
export function parseSoapFault(body: string): SoapFaultDetails | null {
  if (!body || (!body.includes('Fault') && !body.includes('faultcode'))) {
    return null;
  }

  try {
    const parsed = xmlParser.parse(body);

    // Look for Envelope -> Body -> Fault
    const envelope =
      parsed['soapenv:Envelope'] ||
      parsed['soap:Envelope'] ||
      parsed['Envelope'] ||
      parsed;

    const envBody = envelope['soapenv:Body'] || envelope['soap:Body'] || envelope['Body'];
    const fault = envBody ? (envBody['soapenv:Fault'] || envBody['soap:Fault'] || envBody['Fault']) : null;

    if (fault) {
      const faultCode = fault.faultcode || fault['soapenv:faultcode'] || fault.Code?.Value || 'SOAP:Server';
      const faultString = fault.faultstring || fault['soapenv:faultstring'] || fault.Reason?.Text || 'Unknown SOAP Fault';
      const detail = typeof fault.detail === 'object' ? JSON.stringify(fault.detail) : (fault.detail || '');

      return {
        faultCode: String(faultCode),
        faultString: String(faultString),
        detail: detail ? String(detail) : undefined
      };
    }
  } catch {
    // If XML parsing fails, perform regex match
  }

  // Regex fallback
  const faultCodeMatch = body.match(/<faultcode>([^<]+)<\/faultcode>/i);
  const faultStringMatch = body.match(/<faultstring>([^<]+)<\/faultstring>/i);

  if (faultCodeMatch || faultStringMatch) {
    return {
      faultCode: faultCodeMatch ? faultCodeMatch[1]!.trim() : 'SOAP:Fault',
      faultString: faultStringMatch ? faultStringMatch[1]!.trim() : 'SOAP Fault occurred'
    };
  }

  return null;
}

import { randomUUID } from 'node:crypto';
import type { QualityOfService } from '../types/index.js';

export interface SoapEnvelopeOptions {
  soapVersion?: '1.1' | '1.2';
  headerXml?: string;
  namespaces?: Record<string, string>;
}

export interface Xi3MessageOptions {
  senderService: string;
  interfaceName: string;
  interfaceNamespace: string;
  receiverService?: string;
  qos?: QualityOfService;
  messageId?: string;
  payload: string;
}

/**
 * Wraps payload inside a standard SOAP Envelope (1.1 or 1.2).
 */
export function buildSoapEnvelope(
  bodyContent: string,
  options: SoapEnvelopeOptions = {}
): string {
  const version = options.soapVersion || '1.1';
  const soapEnvNs =
    version === '1.2'
      ? 'http://www.w3.org/2003/05/soap-envelope'
      : 'http://schemas.xmlsoap.org/soap/envelope/';

  const extraNs = options.namespaces
    ? Object.entries(options.namespaces)
        .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
        .join(' ')
    : '';

  const header = options.headerXml
    ? `  <soapenv:Header>\n${options.headerXml}\n  </soapenv:Header>\n`
    : '  <soapenv:Header/>\n';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${soapEnvNs}" ${extraNs}>
${header}  <soapenv:Body>
${bodyContent}
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Wraps payload inside an SAP XI 3.0 Protocol SOAP Envelope.
 * Simulates direct SAP ABAP Proxy / S/4HANA calls.
 */
export function buildXi3Envelope(options: Xi3MessageOptions): string {
  const messageId = options.messageId || randomUUID().replace(/-/g, '').toUpperCase();
  const timestamp = new Date().toISOString();
  const qos = options.qos || 'EO';

  const xiHeader = `    <xi:Main xmlns:xi="http://sap.com/xi/XI/Message/30">
      <xi:MessageId>${messageId}</xi:MessageId>
      <xi:Sender>
        <xi:Service>${options.senderService}</xi:Service>
        <xi:Interface>${options.interfaceName}</xi:Interface>
      </xi:Sender>
      ${options.receiverService ? `<xi:Receiver><xi:Service>${options.receiverService}</xi:Service></xi:Receiver>` : ''}
      <xi:SentAt>${timestamp}</xi:SentAt>
      <xi:QualityOfService>${qos}</xi:QualityOfService>
    </xi:Main>`;

  return buildSoapEnvelope(options.payload, {
    headerXml: xiHeader,
    namespaces: {
      xi: 'http://sap.com/xi/XI/Message/30'
    }
  });
}

/**
 * Generates a minimal, schema-valid XML smoke test payload for an interface.
 */
export function buildMinimalSmokePayload(
  interfaceName: string,
  interfaceNamespace: string
): string {
  const cleanNs = interfaceNamespace.trim();
  const cleanName = interfaceName.trim();
  const testId = randomUUID();
  const timestamp = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<ns:${cleanName} xmlns:ns="${cleanNs}">
  <SmokeTestHeader>
    <TestExecutionId>${testId}</TestExecutionId>
    <Timestamp>${timestamp}</Timestamp>
    <Client>AetherFlow-Test-Engine</Client>
  </SmokeTestHeader>
  <SmokeTestData>
    <Ping>true</Ping>
  </SmokeTestData>
</ns:${cleanName}>`;
}

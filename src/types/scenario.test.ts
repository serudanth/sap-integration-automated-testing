import { describe, it, expect, vi } from 'vitest';
import {
  scenarioToDiscoveredEndpoint,
  type CanonicalScenario,
  type HostConfig,
  type AuthProvider
} from './index.js';

describe('Agnostic EIP Canonical Scenario & Compatibility Bridge', () => {
  // Pure platform-neutral EIP scenario
  const eipScenario: CanonicalScenario = {
    id: 'POS_SYSTEM_SalesOrder_OB_S4HANA',
    name: 'SalesOrder_OB',
    namespace: 'http://company.com/xi/Sales',
    description: 'Outbound sales order integration to S/4HANA',
    functionalDomain: 'Sales & Distribution (SD)',
    integrationPattern: 'sync-request-reply',
    folderPath: ['EnterpriseServices', 'Sales'],
    lastChanged: {
      user: 'integration_dev',
      timestamp: '2026-10-19T10:00:00Z'
    },
    lineage: {
      ecosystem: 'sap-pipo',
      sourceArtifactType: 'ICO',
      sourceArtifactId: 'ico-guid-12345',
      sourceContainer: 'EnterpriseServices/Sales',
      version: '2026-10-19T10:00:00Z',
      sourceInventoryId: 'inv-001'
    },
    routing: {
      sender: 'POS_SYSTEM',
      receiver: 'S4HANA',
      qos: 'BE'
    },
    runtimeEndpoint: {
      protocol: 'soap',
      path: '/XISOAPAdapter/MessageServlet?senderService=POS_SYSTEM&interface=SalesOrder_OB',
      httpMethod: 'POST',
      requiredHeaders: {
        'content-type': 'text/xml; charset=utf-8',
        'soapaction': 'http://sap.com/xi/WebService/soap1.1'
      },
      schemaValidationEnabled: true,
      auth: {
        type: 'basic'
      }
    },
    contract: {
      format: 'wsdl',
      url: '/dir/wsdl?p=ic/ico-guid-12345',
      rootEntity: 'SalesOrder_Request',
      targetNamespace: 'http://company.com/xi/Sales'
    },
    inboundAdapter: {
      name: 'CC_SOAP_IN',
      adapterType: 'SOAP',
      transport: 'HTTP',
      protocol: 'SOAP 1.1',
      attributes: {
        qualityOfService: 'BestEffort'
      },
      pipeline: [
        { step: 1, name: 'SapXieModule', type: 'JavaModule', description: 'XI header transformation' }
      ]
    },
    transformation: {
      name: 'OM_SalesOrder_To_S4',
      engine: 'graphical-mapping',
      targetInterface: 'SalesOrder_In'
    },
    outboundAdapter: {
      name: 'CC_REST_OUT',
      adapterType: 'REST',
      transport: 'HTTP',
      protocol: 'JSON',
      endpointUrl: 'https://s4hana.internal/api/orders'
    },
    testing: {
      safetyTier: 'read-only',
      timeoutMs: 15000,
      volatileFieldIgnores: ['orderId', 'timestamp'],
      expectedTerminalStatus: 'DELIVERED',
      responseType: 'xml'
    },
    parity: {
      targetEcosystem: 'sap-cpi',
      targetPath: '/http/v2/SalesOrders',
      httpMethod: 'POST'
    }
  };

  it('converts agnostic EIP CanonicalScenario to DiscoveredEndpoint with hostConfig', () => {
    const host: HostConfig = {
      host: 'sap-po-dev.internal',
      port: 50001,
      https: true
    };

    const endpoint = scenarioToDiscoveredEndpoint(eipScenario, host);

    expect(endpoint.id).toBe('POS_SYSTEM_SalesOrder_OB_S4HANA');
    expect(endpoint.interfaceName).toBe('SalesOrder_OB');
    expect(endpoint.interfaceNamespace).toBe('http://company.com/xi/Sales');
    expect(endpoint.senderComponent).toBe('POS_SYSTEM');
    expect(endpoint.receiverComponent).toBe('S4HANA');
    expect(endpoint.senderChannel).toBe('CC_SOAP_IN');
    expect(endpoint.protocol).toBe('soap');
    expect(endpoint.method).toBe('POST');
    expect(endpoint.qos).toBe('BE');
    expect(endpoint.urlPath).toBe(eipScenario.runtimeEndpoint.path);
    expect(endpoint.fullUrl).toBe('https://sap-po-dev.internal:50001/XISOAPAdapter/MessageServlet?senderService=POS_SYSTEM&interface=SalesOrder_OB');
    expect(endpoint.headers['soapaction']).toBe('http://sap.com/xi/WebService/soap1.1');
  });

  it('converts CanonicalScenario without hostConfig (omits fullUrl)', () => {
    const endpoint = scenarioToDiscoveredEndpoint(eipScenario);

    expect(endpoint.fullUrl).toBeUndefined();
    expect(endpoint.urlPath).toBe(eipScenario.runtimeEndpoint.path);
    expect(endpoint.qos).toBe('BE');
  });

  it('preserves backward compatibility when legacy properties are used', () => {
    const legacyScenario: CanonicalScenario = {
      id: 'LEGACY_SCENARIO',
      icoId: 'ico-legacy-999',
      name: 'Legacy_OB',
      functionalDomain: 'Finance (FI)',
      integrationPattern: 'async-event-message',
      lineage: {
        ecosystem: 'sap-pipo',
        sourceArtifactType: 'ICO',
        sourceArtifactId: 'ico-legacy-999'
      },
      routing: {
        sender: 'LEGACY_SENDER',
        receiver: 'LEGACY_RECEIVER',
        senderComponent: 'LEGACY_SENDER',
        receiverComponent: 'LEGACY_RECEIVER',
        qos: 'EO'
      },
      runtimeEndpoint: {
        protocol: 'soap',
        path: '/XISOAPAdapter/MessageServlet?interface=Legacy_OB',
        servletPath: '/XISOAPAdapter/MessageServlet?interface=Legacy_OB',
        httpMethod: 'POST',
        requiredHeaders: {},
        schemaValidationEnabled: false
      },
      inboundAdapter: {
        name: 'CC_LEGACY_IN',
        adapterType: 'SOAP',
        transport: 'HTTP',
        protocol: 'SOAP 1.1',
        attributes: {}
      },
      inboundChannel: {
        channelName: 'CC_LEGACY_IN',
        adapterType: 'SOAP',
        transportProtocol: 'HTTP',
        messageProtocol: 'SOAP 1.1',
        adapterAttributes: {}
      },
      testing: {
        safetyTier: 'unknown',
        timeoutMs: 10000,
        volatileFieldIgnores: [],
        expectedTerminalStatus: 'DELIVERED',
        responseType: 'xml'
      }
    };

    const host: HostConfig = { host: 'sap-qa', port: 50000, https: false };
    const endpoint = scenarioToDiscoveredEndpoint(legacyScenario, host);

    expect(endpoint.senderComponent).toBe('LEGACY_SENDER');
    expect(endpoint.receiverComponent).toBe('LEGACY_RECEIVER');
    expect(endpoint.senderChannel).toBe('CC_LEGACY_IN');
    expect(endpoint.urlPath).toBe('/XISOAPAdapter/MessageServlet?interface=Legacy_OB');
    expect(endpoint.fullUrl).toBe('http://sap-qa:50000/XISOAPAdapter/MessageServlet?interface=Legacy_OB');
  });

  it('correctly maps EOIO QoS to EO in DiscoveredEndpoint', () => {
    const asyncScenario: CanonicalScenario = {
      ...eipScenario,
      routing: {
        ...eipScenario.routing,
        qos: 'EOIO',
        queueName: 'SALES_QUEUE_01'
      }
    };

    const endpoint = scenarioToDiscoveredEndpoint(asyncScenario);
    expect(endpoint.qos).toBe('EO');
  });

  it('supports BTP CPI scenarios with OAuth2 and REST protocols', () => {
    const cpiScenario: CanonicalScenario = {
      id: 'Shopify_ProcessOrders_S4HANA',
      name: 'ProcessOrders',
      description: 'Shopify order intake via BTP CPI iFlow',
      functionalDomain: 'Sales & Distribution (SD)',
      integrationPattern: 'sync-request-reply',
      lineage: {
        ecosystem: 'sap-cpi',
        sourceArtifactType: 'iFlow',
        sourceArtifactId: 'Shopify_Process_Orders',
        sourceContainer: 'ECommerce_Integration_Package',
        version: '1.2.0'
      },
      routing: {
        sender: 'Shopify',
        receiver: 'S4HANA',
        qos: 'BE'
      },
      runtimeEndpoint: {
        protocol: 'rest',
        path: '/http/v1/orders',
        httpMethod: 'POST',
        requiredHeaders: {
          'content-type': 'application/json'
        },
        schemaValidationEnabled: true,
        auth: {
          type: 'oauth2',
          csrfProtection: true
        }
      },
      contract: {
        format: 'openapi',
        url: '/http/v1/orders/$openapi',
        rootEntity: 'OrderPayload'
      },
      inboundAdapter: {
        name: 'HTTPS_Sender',
        adapterType: 'HTTPS',
        transport: 'HTTP',
        protocol: 'JSON',
        attributes: {
          userRole: 'ESBMessaging.send'
        }
      },
      testing: {
        safetyTier: 'state-mutating',
        timeoutMs: 30000,
        volatileFieldIgnores: ['clientTxId', 'createdAt'],
        expectedTerminalStatus: 'COMPLETED',
        responseType: 'json'
      }
    };

    const host: HostConfig = {
      host: 'cpi-tenant.it-cpi001-rt.cfapps.eu10.hana.ondemand.com',
      port: 443,
      https: true
    };

    const endpoint = scenarioToDiscoveredEndpoint(cpiScenario, host);
    expect(endpoint.protocol).toBe('rest');
    expect(endpoint.urlPath).toBe('/http/v1/orders');
    expect(endpoint.fullUrl).toBe('https://cpi-tenant.it-cpi001-rt.cfapps.eu10.hana.ondemand.com:443/http/v1/orders');
    expect(endpoint.senderComponent).toBe('Shopify');
    expect(endpoint.receiverComponent).toBe('S4HANA');
    expect(endpoint.senderChannel).toBe('HTTPS_Sender');
  });

  it('implements AuthProvider SPI contract correctly', async () => {
    const mockAuthProvider: AuthProvider = {
      id: 'auth:mock-oauth2',
      ecosystem: 'sap-cpi',
      buildAuthHeaders: vi.fn().mockResolvedValue({
        Authorization: 'Bearer test-token-123',
        'X-CSRF-Token': 'csrf-token-abc'
      }),
      preFlightHandshake: vi.fn().mockResolvedValue({
        'X-CSRF-Token': 'csrf-token-abc',
        Cookie: 'JSESSIONID=xyz'
      })
    };

    const hostConfig: HostConfig = { host: 'cpi-tenant', port: 443, https: true };
    const headers = await mockAuthProvider.buildAuthHeaders(hostConfig);
    expect(headers.Authorization).toBe('Bearer test-token-123');
    expect(headers['X-CSRF-Token']).toBe('csrf-token-abc');

    const preFlight = await mockAuthProvider.preFlightHandshake!(hostConfig, '/http/orders');
    expect(preFlight['X-CSRF-Token']).toBe('csrf-token-abc');
  });
});


import { describe, it, expect } from 'vitest';
import { normalizeCpiSnapshot } from './cpi-normalizer.js';
import type { RawCpiInventorySnapshot } from '../types/raw-cpi.js';

describe('SAP BTP CPI Normalizer Engine', () => {
  const sampleCpiSnapshot: RawCpiInventorySnapshot = {
    _meta: {
      id: 'cpi-snap-01',
      tenantId: 'my-cpi-tenant',
      extractedAt: '2026-10-20T10:00:00Z',
      artifactCount: 2
    },
    artifacts: [
      {
        Id: 'Shopify_Order_Intake',
        Name: 'Shopify Order Intake Service',
        PackageId: 'Ecommerce_SAP_Package',
        Version: '1.4.0',
        Participants: [
          { Role: 'Sender', Name: 'Shopify' },
          { Role: 'Receiver', Name: 'SAP_S4HANA' }
        ],
        SenderChannels: [
          {
            Name: 'HTTPS_Order_In',
            AdapterType: 'HTTPS',
            TransportProtocol: 'HTTPS',
            MessageProtocol: 'JSON',
            EndpointAddress: '/http/v2/orders',
            Parameters: {
              userRole: 'ESBMessaging.send'
            }
          }
        ],
        ReceiverChannels: [
          {
            Name: 'OData_S4_Orders',
            AdapterType: 'HTTP',
            TransportProtocol: 'HTTP',
            MessageProtocol: 'OData V2',
            EndpointAddress: 'https://s4.internal/sap/opu/odata/sap/API_SALES_ORDER_SRV'
          }
        ]
      },
      {
        Id: 'QueryInventoryStatus',
        Name: 'Query Warehouse Inventory Status',
        PackageId: 'SCM_Package',
        Version: '1.0.0',
        SenderChannels: [
          {
            Name: 'SOAP_Inbound',
            AdapterType: 'SOAP',
            TransportProtocol: 'HTTPS',
            MessageProtocol: 'SOAP 1.1',
            EndpointAddress: '/cxf/InventoryQuery'
          }
        ]
      }
    ]
  };

  it('normalizes CPI artifacts into platform-neutral CanonicalScenarios', () => {
    const scenarios = normalizeCpiSnapshot(sampleCpiSnapshot);

    expect(scenarios).toHaveLength(2);

    const [orderScenario, invScenario] = scenarios;

    expect(orderScenario.id).toBe('Shopify_Shopify_Order_Intake_SAP_S4HANA');
    expect(orderScenario.lineage.ecosystem).toBe('sap-cpi');
    expect(orderScenario.lineage.sourceArtifactType).toBe('iFlow');
    expect(orderScenario.lineage.sourceArtifactId).toBe('Shopify_Order_Intake');
    expect(orderScenario.runtimeEndpoint.path).toBe('/http/v2/orders');
    expect(orderScenario.runtimeEndpoint.auth?.type).toBe('oauth2');
    expect(orderScenario.runtimeEndpoint.auth?.csrfProtection).toBe(true);
    expect(orderScenario.contract?.format).toBe('openapi');

    expect(invScenario.id).toBe('EXTERNAL_QueryInventoryStatus_BACKEND');
    expect(invScenario.functionalDomain).toBe('Supply Chain & Warehousing (SCM)');
    expect(invScenario.testing.safetyTier).toBe('read-only');
    expect(invScenario.runtimeEndpoint.protocol).toBe('soap');
    expect(invScenario.contract?.format).toBe('wsdl');
  });

  it('correctly populates inbound and outbound adapters', () => {
    const scenarios = normalizeCpiSnapshot(sampleCpiSnapshot);
    const orderScenario = scenarios[0];

    expect(orderScenario.inboundAdapter.name).toBe('HTTPS_Order_In');
    expect(orderScenario.inboundAdapter.adapterType).toBe('HTTPS');
    expect(orderScenario.inboundAdapter.attributes['userRole']).toBe('ESBMessaging.send');

    expect(orderScenario.outboundAdapter).toBeDefined();
    expect(orderScenario.outboundAdapter?.name).toBe('OData_S4_Orders');
    expect(orderScenario.outboundAdapter?.endpointUrl).toBe('https://s4.internal/sap/opu/odata/sap/API_SALES_ORDER_SRV');
  });

  it('handles array input, missing sender channels, multiple sender channels, and XI protocol', () => {
    const artifacts = [
      // 1. Missing sender channels -> defaults to /http/{id}
      {
        Id: 'Default_Flow',
        Name: 'Default Flow Without Channels',
        PackageId: 'DefaultPkg',
        Version: '1.0.0'
      },
      // 2. Multiple sender channels -> explodes with _ch0, _ch1
      {
        Id: 'Multi_Channel_Flow',
        Name: 'Multi Channel Flow',
        PackageId: 'Pkg2',
        Version: '1.0.0',
        SenderChannels: [
          { Name: 'CH_REST', AdapterType: 'HTTPS', TransportProtocol: 'HTTPS', MessageProtocol: 'JSON', EndpointAddress: 'http/orders' },
          { Name: 'CH_XI', AdapterType: 'XI', TransportProtocol: 'HTTP', MessageProtocol: 'XI 3.0', EndpointAddress: '/xi/orders' }
        ]
      }
    ];

    const scenarios = normalizeCpiSnapshot(artifacts);
    expect(scenarios).toHaveLength(3);

    // Default channel
    expect(scenarios[0].id).toBe('EXTERNAL_Default_Flow_BACKEND');
    expect(scenarios[0].runtimeEndpoint.path).toBe('/http/Default_Flow');
    expect(scenarios[0].outboundAdapter).toBeUndefined();

    // Multi-channel
    expect(scenarios[1].id).toBe('EXTERNAL_Multi_Channel_Flow_BACKEND_ch0');
    expect(scenarios[1].runtimeEndpoint.path).toBe('/http/orders'); // prepends /
    expect(scenarios[2].id).toBe('EXTERNAL_Multi_Channel_Flow_BACKEND_ch1');
    expect(scenarios[2].runtimeEndpoint.protocol).toBe('xi3');
  });
});

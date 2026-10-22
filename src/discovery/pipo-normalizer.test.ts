import { describe, it, expect } from 'vitest';
import { normalizePipoInventory } from './pipo-normalizer.js';
import type { InventoryFile } from '../types/index.js';
import type { AetherFlowConfig } from '../config/aetherflow-config.js';

describe('SAP PI/PO Normalizer Engine', () => {
  const sampleInventory: InventoryFile = {
    _meta: {
      id: 'inv-test-01',
      hostId: 'spd100',
      hostLabel: 'SPD QA',
      sapUser: 'testuser',
      extractedAt: '2026-10-20T10:00:00Z',
      icoCount: 2,
      channelCount: 3
    },
    summary: {
      icoCount: 2,
      icoQueriedCount: 2,
      channelCount: 3,
      channelQueriedCount: 3,
      senderChannelCount: 2,
      receiverChannelCount: 1,
      warnings: []
    },
    integratedConfigurations: [
      {
        MasterLanguage: 'EN',
        IntegratedConfigurationID: {
          SenderPartyID: '',
          SenderComponentID: 'POS_SYSTEM',
          InterfaceName: 'SalesOrder_Create_OB',
          InterfaceNamespace: 'http://company.com/xi/Sales',
          ReceiverPartyID: '',
          ReceiverComponentID: 'S4HANA'
        },
        AdministrativeData: {
          FolderPathID: ['Sales', 'NorthAmerica'],
          LastChangeDateTime: '2026-10-18T14:30:00Z',
          LastChangeUserAccountID: 'sap_admin'
        },
        InboundProcessing: {
          CommunicationChannel: {
            PartyID: '',
            ComponentID: 'POS_SYSTEM',
            ChannelID: 'CC_SOAP_IN'
          },
          SchemaValidationIndicator: 'true'
        },
        // Multi-receiver route explosion! 2 receivers
        ReceiverInterfaces: [
          {
            Receiver: { PartyID: '', ComponentID: 'S4HANA' },
            QualityOfService: 'BE'
          },
          {
            Receiver: { PartyID: '', ComponentID: 'ANALYTICS_LAKE' },
            QualityOfService: 'EO'
          }
        ],
        OutboundProcessing: [
          {
            Receiver: { PartyID: '', ComponentID: 'S4HANA' },
            CommunicationChannel: { PartyID: '', ComponentID: 'S4HANA', ChannelID: 'CC_REST_OUT' }
          }
        ]
      }
    ],
    communicationChannels: [
      {
        CommunicationChannelID: { PartyID: '', ComponentID: 'POS_SYSTEM', ChannelID: 'CC_SOAP_IN' },
        Direction: 'Sender',
        TransportProtocol: 'HTTP',
        MessageProtocol: 'SOAP 1.1',
        AdapterSpecificAttribute: [
          { Name: 'qualityOfService', Value: 'BestEffort' }
        ],
        ModuleProcess: {
          ProcessStep: [
            { StepNumber: 1, ModuleName: 'SapXieModule', ModuleType: 'JavaModule' }
          ]
        }
      },
      {
        CommunicationChannelID: { PartyID: '', ComponentID: 'S4HANA', ChannelID: 'CC_REST_OUT' },
        Direction: 'Receiver',
        TransportProtocol: 'HTTP',
        MessageProtocol: 'REST',
        AdapterSpecificAttribute: [
          { Name: 'targetUrl', Value: 'https://s4.internal/orders' }
        ]
      }
    ]
  };

  it('performs multi-receiver route explosion and sets deterministic IDs', () => {
    const scenarios = normalizePipoInventory(sampleInventory);

    expect(scenarios).toHaveLength(2);

    const [route0, route1] = scenarios;
    expect(route0.id).toBe('POS_SYSTEM_SalesOrder_Create_OB_S4HANA_route0');
    expect(route0.routing.receiver).toBe('S4HANA');
    expect(route0.routing.qos).toBe('BE');
    expect(route0.routeIndex).toBe(0);
    expect(route0.totalRoutes).toBe(2);

    expect(route1.id).toBe('POS_SYSTEM_SalesOrder_Create_OB_ANALYTICS_LAKE_route1');
    expect(route1.routing.receiver).toBe('ANALYTICS_LAKE');
    expect(route1.routing.qos).toBe('EO');
    expect(route1.routeIndex).toBe(1);
  });

  it('dereferences inbound and outbound communication channel details', () => {
    const scenarios = normalizePipoInventory(sampleInventory);
    const route0 = scenarios[0];

    expect(route0.inboundAdapter.name).toBe('CC_SOAP_IN');
    expect(route0.inboundAdapter.transport).toBe('HTTP');
    expect(route0.inboundAdapter.protocol).toBe('SOAP 1.1');
    expect(route0.inboundAdapter.attributes['qualityOfService']).toBe('BestEffort');
    expect(route0.inboundAdapter.pipeline).toHaveLength(1);
    expect(route0.inboundAdapter.pipeline?.[0].name).toBe('SapXieModule');

    expect(route0.outboundAdapter).toBeDefined();
    expect(route0.outboundAdapter?.name).toBe('CC_REST_OUT');
    expect(route0.outboundAdapter?.attributes?.['targetUrl']).toBe('https://s4.internal/orders');
  });

  it('infers functional domain, integration pattern, and safety tier', () => {
    const scenarios = normalizePipoInventory(sampleInventory);
    const route0 = scenarios[0];

    expect(route0.functionalDomain).toBe('Logistics: Sales & Distribution (SD)');
    expect(route0.integrationPattern).toBe('sync-request-reply');
    expect(route0.testing.safetyTier).toBe('state-mutating');
  });

  it('interpolates target parity endpoint pattern from configuration', () => {
    const config: AetherFlowConfig = {
      version: '1.1',
      parity: {
        targetEndpointPattern: '/http/{sender}/{interfaceName}'
      }
    };

    const scenarios = normalizePipoInventory(sampleInventory, config);
    expect(scenarios[0].parity?.targetPath).toBe('/http/POS_SYSTEM/SalesOrder_Create_OB');
  });

  it('handles REST, HTTP, and XI wire protocol inference and channel fallback', () => {
    const inv: InventoryFile = {
      _meta: { id: 'test-2', hostId: 'h1', hostLabel: 'H', sapUser: 'u', extractedAt: '', icoCount: 3, channelCount: 0 },
      summary: { icoCount: 3, icoQueriedCount: 3, channelCount: 0, channelQueriedCount: 0, senderChannelCount: 0, receiverChannelCount: 0, warnings: [] },
      integratedConfigurations: [
        // 1. REST protocol
        {
          IntegratedConfigurationID: { SenderPartyID: '', SenderComponentID: 'REST_CLIENT', InterfaceName: 'Customer_REST', InterfaceNamespace: 'urn:test', ReceiverPartyID: '', ReceiverComponentID: 'BACKEND' },
          InboundProcessing: { CommunicationChannel: { PartyID: '', ComponentID: 'REST_CLIENT', ChannelID: 'CC_REST_IN' } }
        },
        // 2. HTTP protocol
        {
          IntegratedConfigurationID: { SenderPartyID: '', SenderComponentID: 'HTTP_CLIENT', InterfaceName: 'Invoice_HTTP', InterfaceNamespace: 'urn:test', ReceiverPartyID: '', ReceiverComponentID: 'BACKEND' },
          InboundProcessing: { CommunicationChannel: { PartyID: '', ComponentID: 'HTTP_CLIENT', ChannelID: 'CC_HTTP_IN' } }
        },
        // 3. XI protocol
        {
          IntegratedConfigurationID: { SenderPartyID: '', SenderComponentID: 'XI_CLIENT', InterfaceName: 'Order_XI', InterfaceNamespace: 'urn:test', ReceiverPartyID: '', ReceiverComponentID: 'BACKEND' },
          InboundProcessing: { CommunicationChannel: { PartyID: '', ComponentID: 'XI_CLIENT', ChannelID: 'CC_XI_IN' } }
        },
        // 4. Missing interfaceName -> skipped
        {
          IntegratedConfigurationID: { SenderPartyID: '', SenderComponentID: 'SKIP_ME', InterfaceName: '', InterfaceNamespace: '', ReceiverPartyID: '', ReceiverComponentID: '' }
        }
      ],
      communicationChannels: [
        { CommunicationChannelID: { PartyID: '', ComponentID: 'REST_CLIENT', ChannelID: 'CC_REST_IN' }, Direction: 'Sender', TransportProtocol: 'HTTP', MessageProtocol: 'REST' },
        { CommunicationChannelID: { PartyID: '', ComponentID: 'HTTP_CLIENT', ChannelID: 'CC_HTTP_IN' }, Direction: 'Sender', TransportProtocol: 'HTTP', MessageProtocol: 'HTTP' },
        { CommunicationChannelID: { PartyID: '', ComponentID: 'XI_CLIENT', ChannelID: 'CC_XI_IN' }, Direction: 'Sender', TransportProtocol: 'HTTP', MessageProtocol: 'XI 3.0' }
      ]
    };

    const scenarios = normalizePipoInventory(inv);
    expect(scenarios).toHaveLength(3);
    expect(scenarios[0].runtimeEndpoint.protocol).toBe('rest');
    expect(scenarios[1].runtimeEndpoint.protocol).toBe('http');
    expect(scenarios[2].runtimeEndpoint.protocol).toBe('xi3');
  });

  it('respects scenario targetPath overrides and cpiEndpointOverrides', () => {
    const config: AetherFlowConfig = {
      version: '1.1',
      scenarios: {
        'POS_SYSTEM_SalesOrder_Create_OB_S4HANA_route0': {
          targetPath: '/cpi/custom/orders'
        }
      },
      parity: {
        cpiEndpointOverrides: {
          'POS_SYSTEM_SalesOrder_Create_OB_ANALYTICS_LAKE_route1': '/cpi/lake/orders'
        }
      }
    };

    const scenarios = normalizePipoInventory(sampleInventory, config);
    expect(scenarios[0].parity?.targetPath).toBe('/cpi/custom/orders');
    expect(scenarios[1].parity?.targetPath).toBe('/cpi/lake/orders');
  });
});

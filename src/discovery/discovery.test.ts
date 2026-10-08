import { describe, it, expect } from 'vitest';
import { loadInventory, filterEndpoints } from './inventory-loader.js';
import {
  extractQoS,
  buildMessageServletQuery,
  buildChannelDirectPath,
  discoverEndpoints,
  resolveTargetUrl
} from './endpoint-generator.js';
import type { InventoryFile } from '../types/index.js';

describe('Discovery Module', () => {
  const sampleInventory: InventoryFile = {
    _meta: {
      id: 'test-inv',
      hostId: 'spd100',
      hostLabel: 'SPD',
      sapUser: 'tester',
      extractedAt: '2026-10-08T00:00:00Z',
      icoCount: 2,
      channelCount: 2
    },
    summary: {
      icoCount: 2,
      icoQueriedCount: 2,
      channelCount: 2,
      channelQueriedCount: 2,
      senderChannelCount: 1,
      receiverChannelCount: 1,
      warnings: []
    },
    integratedConfigurations: [
      {
        IntegratedConfigurationID: {
          SenderPartyID: 'PARTY_A',
          SenderComponentID: 'SRC_SYS',
          InterfaceName: 'Order_OB',
          InterfaceNamespace: 'http://test.com/xi',
          ReceiverPartyID: 'PARTY_B',
          ReceiverComponentID: 'TGT_SYS'
        },
        InboundProcessing: {
          CommunicationChannel: {
            ChannelID: 'CC_SOAP_IN'
          }
        },
        ReceiverInterfaces: [
          {
            QualityOfService: 'BE'
          }
        ]
      },
      {
        IntegratedConfigurationID: {
          SenderComponentID: 'POS_SYS',
          InterfaceName: 'Receipt_OB',
          InterfaceNamespace: 'http://test.com/pos'
        },
        ReceiverInterfaces: [
          {
            QualityOfService: 'EO'
          }
        ]
      }
    ],
    communicationChannels: []
  };

  describe('extractQoS', () => {
    it('returns BE when specified in ReceiverInterfaces', () => {
      const qos = extractQoS(sampleInventory.integratedConfigurations[0]!);
      expect(qos).toBe('BE');
    });

    it('returns EO when specified', () => {
      const qos = extractQoS(sampleInventory.integratedConfigurations[1]!);
      expect(qos).toBe('EO');
    });

    it('defaults to EO when missing or empty', () => {
      expect(extractQoS({})).toBe('EO');
      expect(extractQoS({ ReceiverInterfaces: [] })).toBe('EO');
    });
  });

  describe('buildMessageServletQuery', () => {
    it('constructs query string with all parameters', () => {
      const qs = buildMessageServletQuery({
        senderService: 'SRC_SYS',
        interfaceName: 'Order_OB',
        interfaceNamespace: 'http://test.com/xi',
        qos: 'BE',
        senderParty: 'PARTY_A',
        receiverParty: 'PARTY_B',
        receiverService: 'TGT_SYS'
      });

      expect(qs).toContain('senderService=SRC_SYS');
      expect(qs).toContain('interface=Order_OB');
      expect(qs).toContain('qos=BE');
      expect(qs).toContain('senderParty=PARTY_A');
      expect(qs).toContain('receiverParty=PARTY_B');
      expect(qs).toContain('receiverService=TGT_SYS');
    });

    it('omits optional parties and receiver services if empty', () => {
      const qs = buildMessageServletQuery({
        senderService: 'SRC_SYS',
        interfaceName: 'Order_OB',
        interfaceNamespace: 'http://test.com/xi',
        qos: 'EO'
      });

      expect(qs).toContain('senderService=SRC_SYS');
      expect(qs).not.toContain('senderParty');
      expect(qs).not.toContain('receiverService');
    });
  });

  describe('buildChannelDirectPath', () => {
    it('generates channel-direct path correctly', () => {
      const path = buildChannelDirectPath('BC_DMALL', 'CC_RFC_SENDER');
      expect(path).toBe('/XISOAPAdapter/MessageServlet?channel=:BC_DMALL:CC_RFC_SENDER');
    });
  });

  describe('discoverEndpoints', () => {
    it('extracts endpoints from inventory', () => {
      const endpoints = discoverEndpoints(sampleInventory);
      expect(endpoints).toHaveLength(2);

      const first = endpoints[0]!;
      expect(first.interfaceName).toBe('Order_OB');
      expect(first.senderComponent).toBe('SRC_SYS');
      expect(first.senderParty).toBe('PARTY_A');
      expect(first.receiverParty).toBe('PARTY_B');
      expect(first.qos).toBe('BE');
      expect(first.senderChannel).toBe('CC_SOAP_IN');
      expect(first.urlPath).toContain('/XISOAPAdapter/MessageServlet?');
    });

    it('resolves full URLs when hostConfig is provided', () => {
      const endpoints = discoverEndpoints(sampleInventory, {
        host: 'sap-qa.corp',
        port: 50000,
        https: false
      });

      expect(endpoints[0]!.fullUrl).toContain('http://sap-qa.corp:50000/XISOAPAdapter/MessageServlet');
    });
  });

  describe('filterEndpoints', () => {
    const endpoints = discoverEndpoints(sampleInventory);

    it('filters by interface name', () => {
      const filtered = filterEndpoints(endpoints, { interfaceName: 'Order' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.interfaceName).toBe('Order_OB');
    });

    it('filters by sender component', () => {
      const filtered = filterEndpoints(endpoints, { senderComponent: 'pos_sys' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.senderComponent).toBe('POS_SYS');
    });

    it('filters by QoS', () => {
      const beOnly = filterEndpoints(endpoints, { qos: 'BE' });
      expect(beOnly).toHaveLength(1);
      expect(beOnly[0]!.qos).toBe('BE');

      const eoOnly = filterEndpoints(endpoints, { qos: 'EO' });
      expect(eoOnly).toHaveLength(1);
      expect(eoOnly[0]!.qos).toBe('EO');
    });

    it('respects limit', () => {
      const limited = filterEndpoints(endpoints, { limit: 1 });
      expect(limited).toHaveLength(1);
    });
  });

  describe('resolveTargetUrl', () => {
    it('resolves https and http target URLs', () => {
      const httpUrl = resolveTargetUrl({ host: 'sap-qa', port: 50000, https: false }, '/test');
      expect(httpUrl).toBe('http://sap-qa:50000/test');

      const httpsUrl = resolveTargetUrl({ host: 'sap-qa', port: 50001, https: true }, 'test');
      expect(httpsUrl).toBe('https://sap-qa:50001/test');
    });
  });

  describe('loadInventory', () => {
    it('loads inventory file from path', async () => {
      const inv = await loadInventory('./inventories/sample-inventory.json');
      expect(inv._meta.id).toBe('sample-inventory-01');
      expect(inv.integratedConfigurations.length).toBeGreaterThan(0);
    });

    it('throws descriptive error if inventory file does not exist', async () => {
      await expect(loadInventory('non-existent-inventory-xyz.json')).rejects.toThrow('Inventory file not found');
    });
  });
});

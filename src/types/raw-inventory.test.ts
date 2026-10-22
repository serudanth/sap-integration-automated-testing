import { describe, it, expect } from 'vitest';
import { toArray, type RawIntegratedConfiguration, type RawCommunicationChannel } from './raw-inventory.js';

describe('Raw Inventory Types & Utilities', () => {
  it('toArray normalizes undefined, null, single items and arrays', () => {
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
    expect(toArray({ id: 1 })).toEqual([{ id: 1 }]);
    expect(toArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('can type-check a mock RawIntegratedConfiguration', () => {
    const rawIco: RawIntegratedConfiguration = {
      IntegratedConfigurationID: {
        SenderPartyID: '',
        SenderComponentID: 'BC_ERP',
        InterfaceName: 'Order_OB',
        InterfaceNamespace: 'urn:sap:orders',
        ReceiverPartyID: '',
        ReceiverComponentID: 'S4HANA'
      },
      InboundProcessing: {
        CommunicationChannel: {
          PartyID: '',
          ComponentID: 'BC_ERP',
          ChannelID: 'CC_SOAP_IN'
        },
        SchemaValidationIndicator: 'true'
      },
      ReceiverInterfaces: [
        {
          Receiver: {
            PartyID: '',
            ComponentID: 'S4HANA'
          },
          QualityOfService: 'BE'
        }
      ]
    };

    expect(rawIco.IntegratedConfigurationID.SenderComponentID).toBe('BC_ERP');
    expect(rawIco.InboundProcessing?.SchemaValidationIndicator).toBe('true');
  });

  it('can type-check a mock RawCommunicationChannel', () => {
    const rawChannel: RawCommunicationChannel = {
      CommunicationChannelID: {
        PartyID: '',
        ComponentID: 'BC_ERP',
        ChannelID: 'CC_SOAP_IN'
      },
      Direction: 'Sender',
      TransportProtocol: 'HTTP',
      MessageProtocol: 'SOAP 1.1',
      AdapterSpecificAttribute: [
        { Name: 'server', Value: 'sap-host' }
      ]
    };

    expect(rawChannel.Direction).toBe('Sender');
    expect(rawChannel.TransportProtocol).toBe('HTTP');
  });
});

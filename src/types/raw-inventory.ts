/**
 * Raw SAP PI/PO Inventory Snapshot Type Definitions
 * Matches extraction schema from sap-po-ico-reader
 */

export interface RawIcoIdentifier {
  SenderPartyID: string;
  SenderComponentID: string;
  InterfaceName: string;
  InterfaceNamespace: string;
  ReceiverPartyID: string;
  ReceiverComponentID: string;
}

export interface RawAdministrativeData {
  ResponsibleUserAccountID?: string;
  LastChangeUserAccountID?: string;
  LastChangeDateTime?: string;
  FolderPathID?: string[];
}

export interface RawInboundProcessing {
  SenderInterfaceSoftwareComponentVersion?: string;
  CommunicationChannel?: {
    PartyID: string;
    ComponentID: string;
    ChannelID: string;
  };
  SchemaValidationIndicator?: string | boolean;
  VirusScan?: string;
}

export interface RawReceiverRule {
  Receiver: {
    PartyID: string;
    ComponentID: string;
  };
  Condition?: {
    XPath?: string;
  };
}

export interface RawReceiverInterfaceRule {
  Operation?: string;
  Mapping?: {
    Name: string;
    Namespace: string;
    SoftwareComponentVersionID?: string;
  };
  Interface?: {
    Name: string;
    Namespace: string;
    SoftwareComponentVersionID?: string;
  };
}

export interface RawReceiverInterface {
  Receiver: {
    PartyID: string;
    ComponentID: string;
  };
  QualityOfService?: string;
  ReceiverInterfaceRule?: RawReceiverInterfaceRule | RawReceiverInterfaceRule[];
}

export interface RawOutboundProcessing {
  Receiver: {
    PartyID: string;
    ComponentID: string;
  };
  ReceiverInterface?: {
    Name: string;
    Namespace: string;
  };
  CommunicationChannel?: {
    PartyID: string;
    ComponentID: string;
    ChannelID: string;
  };
  SchemaValidationIndicator?: string | boolean;
  HeaderMapping?: {
    Sender?: { PartyID?: string; ComponentID?: string };
    Receiver?: { PartyID?: string; ComponentID?: string };
  };
  AdapterSpecificAttribute?: Array<{
    Name: string;
    Namespace?: string;
    Value: string | number | boolean;
  }>;
}

export interface RawIntegratedConfiguration {
  MasterLanguage?: string;
  IntegratedConfigurationID: RawIcoIdentifier;
  AdministrativeData?: RawAdministrativeData;
  InboundProcessing?: RawInboundProcessing;
  Receivers?: {
    ReceiverRule?: RawReceiverRule | RawReceiverRule[];
    NoReceiverBehaviour?: string;
  };
  ReceiverInterfaces?: RawReceiverInterface | RawReceiverInterface[];
  OutboundProcessing?: RawOutboundProcessing | RawOutboundProcessing[];
  Logging?: {
    UseGlobal?: string | boolean;
    SpecificConfiguration?: string;
  };
}

export interface RawCommunicationChannel {
  CommunicationChannelID: {
    PartyID: string;
    ComponentID: string;
    ChannelID: string;
  };
  Direction: 'Sender' | 'Receiver' | string;
  AdapterMetadata?: {
    Name: string;
    Namespace?: string;
    SoftwareComponentVersionID?: string;
  };
  TransportProtocol: string;
  TransportProtocolVersion?: string;
  MessageProtocol: string;
  MessageProtocolVersion?: string;
  AdapterEngineName?: string;
  AdapterSpecificAttribute?: Array<{
    Name: string;
    Namespace?: string;
    Value: string | number | boolean;
  }>;
  AdapterSpecificTableAttribute?: Array<{
    Name: string;
    Namespace?: string;
    ValueTableRow?: Array<{
      ValueTableCell: Array<{ ColumnName: string; Value: string }>;
    }>;
  }>;
  ModuleProcess?: {
    ProcessStep?: Array<{
      StepNumber?: number;
      ModuleName: string;
      ModuleType: string;
      ParameterGroupID?: string;
    }>;
    ParameterGroup?: Array<{
      ParameterGroupID: string;
      Parameter: Array<{ Name: string; Value: string }>;
    }>;
  };
  AdministrativeData?: RawAdministrativeData;
}

/**
 * Utility to safely normalize single objects or arrays from XML/JSON into an array.
 */
export function toArray<T>(item: T | T[] | undefined | null): T[] {
  if (item === undefined || item === null) {
    return [];
  }
  return Array.isArray(item) ? item : [item];
}

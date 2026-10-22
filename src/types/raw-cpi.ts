/**
 * Raw SAP BTP Integration Suite (Cloud Integration / CPI) Snapshot Types
 * Represents exported iFlow metadata bundles and configuration definitions.
 */

export interface RawCpiSenderChannel {
  Name: string;
  AdapterType: string;                 // e.g. "HTTPS", "SOAP", "ProcessDirect", "SFTP"
  TransportProtocol: string;           // e.g. "HTTPS", "SOAP 1.x"
  MessageProtocol: string;             // e.g. "None", "SOAP 1.1", "JSON"
  EndpointAddress: string;             // e.g. "/http/v2/orders", "/soap/invoice"
  Parameters?: Record<string, any>;
}

export interface RawCpiReceiverChannel {
  Name: string;
  AdapterType: string;                 // e.g. "HTTP", "OData", "SFTP", "SOAP"
  TransportProtocol?: string;
  MessageProtocol?: string;
  EndpointAddress?: string;            // Target destination URL or address
  Parameters?: Record<string, any>;
}

export interface RawCpiParticipant {
  Role: 'Sender' | 'Receiver';
  Name: string;                        // Participant component name (e.g. "Shopify", "SAP_S4HANA")
  Description?: string;
}

export interface RawCpiArtifact {
  Id: string;                          // iFlow ID (e.g. "Process_Sales_Orders")
  Name: string;                        // Display name
  PackageId: string;                   // Parent BTP package ID
  Version: string;                     // Semantic version (e.g. "1.0.4")
  Description?: string;
  CreatedAt?: string;                  // ISO 8601 timestamp
  CreatedBy?: string;
  ModifiedAt?: string;
  ModifiedBy?: string;
  SenderChannels?: RawCpiSenderChannel[];
  ReceiverChannels?: RawCpiReceiverChannel[];
  Participants?: RawCpiParticipant[];
  Configuration?: Record<string, any>;
}

export interface RawCpiInventorySnapshot {
  _meta: {
    id: string;
    tenantId: string;
    extractedAt: string;
    artifactCount: number;
  };
  artifacts: RawCpiArtifact[];
}

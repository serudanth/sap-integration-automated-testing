/**
 * Canonical Scenario & Ecosystem Platform Manifest Type Definitions
 * AetherFlow Test Engine 1.1.0+
 */

import type { DiscoveredEndpoint, EndpointProtocol, HostConfig, QualityOfService } from './index.js';

// ========================================================
// 1. Ecosystem Spheres & Capabilities
// ========================================================

export type PlatformEcosystem =
  | 'sap-pipo'                // SAP NetWeaver PI/PO 7.31 - 7.5 single/dual stack
  | 'sap-cpi'                 // SAP BTP Cloud Integration / Integration Suite
  | 'sap-xi'                  // Legacy SAP XI 2.0 / 3.0 dual-stack
  | 'sap-business-connector'  // Legacy SAP Business Connector / EDI
  | 'generic-http'            // Agnostic REST / SOAP HTTP services
  | (string & {});            // Open-ended for custom or legacy enterprise middleware plugins

export type ModuleCapability =
  | 'extraction'
  | 'normalization'
  | 'test-generation'
  | 'execution'
  | 'monitoring'
  | 'documentation'
  | 'auth';

export interface ModulePrerequisite {
  readonly type:
    | 'inventory-data'
    | 'host-connection'
    | 'test-fixtures'
    | 'wsdl-schemas'
    | 'oauth2-token'
    | (string & {});
  readonly description: string;
}

export interface ModuleDescriptor {
  readonly id: string;                     // e.g. "generator:sap-pipo-wsdl", "runner:pipo-smoke"
  readonly name: string;
  readonly ecosystem: PlatformEcosystem;   // Sphere: 'sap-pipo', 'sap-cpi', etc.
  readonly capabilities: ModuleCapability[];
  readonly prerequisites: ModulePrerequisite[];
  readonly dependencies?: string[];        // IDs of prerequisite modules (e.g. "normalizer:sap-pipo")

  // Validates if runtime context has required baseline data
  validatePrerequisites(context: ExecutionContext): Promise<{ satisfied: boolean; missing: string[] }>;
}

// ========================================================
// 2. Ecosystem Platform Manifest & Bindings
// ========================================================

export interface EcosystemDefinition {
  readonly id: PlatformEcosystem;
  readonly label: string;
  readonly description?: string;
  readonly enabled: boolean;

  // Capability -> Module Provider Binding identifier or object reference
  readonly providers: {
    readonly extraction?: string;
    readonly normalization?: string;
    readonly 'test-generation'?: string;
    readonly execution?: string;
    readonly monitoring?: string;
    readonly documentation?: string;
    readonly auth?: string;
    readonly [capability: string]: string | undefined;
  };

  // Default runtime transport protocols for this ecosystem
  readonly defaultProtocols?: EndpointProtocol[];
}

export interface PlatformManifest {
  readonly version: string;
  readonly defaultEcosystem: PlatformEcosystem;
  readonly ecosystems: Record<string, EcosystemDefinition>;
  readonly plugins?: string[];
}

// ========================================================
// 3. Execution Context
// ========================================================

export interface ExecutionContext {
  readonly ecosystem?: PlatformEcosystem;
  readonly hostConfig?: HostConfig;
  readonly inventoryPath?: string;
  readonly inventoryData?: any;
  readonly schemasDir?: string;
  readonly fixturesDir?: string;
  readonly allowMutating?: boolean;
  readonly extraVariables?: Record<string, any>;
}

// ========================================================
// 4. Canonical Scenario Contract (EIP Universal Model)
// ========================================================

export type ScenarioSafetyTier = 'read-only' | 'state-mutating' | 'unknown';
export type IntegrationPattern =
  | 'sync-request-reply'
  | 'async-event-message'
  | 'async-batch-file'
  | 'database-integration';

export type ContractFormat =
  | 'wsdl'
  | 'xsd'
  | 'openapi'
  | 'json-schema'
  | 'edmx'
  | 'opaque';

export interface CanonicalScenario {
  // ========================================================
  // 1. Identity, Governance & Provenance
  // ========================================================
  id: string;                               // Deterministic key: "<Sender>_<Interface>_<Receiver>[_<routeIndex>]"
  name: string;                             // Interface or iFlow Name (e.g. "SalesOrder_OB")
  namespace?: string;                       // Business Namespace URI (optional in REST/CPI flows)
  description?: string;                     // Functional summary or business narrative
  functionalDomain: string;                 // Inferred domain (e.g. "Sales & Distribution (SD)")
  integrationPattern: IntegrationPattern;   // Universal EIP architectural pattern
  folderPath?: string[];                    // Integration Directory folder hierarchy or CPI package path

  // Immutable Provenance & Source Metadata
  lineage: {
    ecosystem: PlatformEcosystem;           // 'sap-pipo' | 'sap-cpi' | 'generic-http'
    sourceArtifactType: 'ICO' | 'iFlow' | 'InterfaceDetermination' | string;
    sourceArtifactId: string;               // ICO GUID, iFlow ID, or technical artifact identifier
    sourceContainer?: string;               // PI/PO Folder path or BTP CPI Package ID
    version?: string;                       // Artifact version or revision timestamp
    sourceInventoryId?: string;             // Inventory snapshot UUID
  };

  routeIndex?: number;                      // 0-based receiver route index (for multi-route scenarios)
  totalRoutes?: number;                     // Total receiver routes in the parent artifact

  lastChanged?: {
    user: string;                           // Account ID of last modifier
    timestamp: string;                      // ISO 8601 timestamp
  };

  /** @deprecated Use lineage.sourceArtifactId */
  icoId?: string;

  // ========================================================
  // 2. Ingress & Runtime Dispatch Specification
  // ========================================================
  routing: {
    sender: string;                         // Sender System / Participant
    senderParty?: string;                   // Sender Party / Organization (if applicable)
    receiver: string;                       // Receiver System / Participant
    receiverParty?: string;                 // Receiver Party / Organization (if applicable)
    qos: QualityOfService;                  // BE (Best Effort), EO (Exactly Once), EOIO (In Order)
    queueName?: string;                     // Queue or Data Store name (when QoS = EOIO or JMS)
    conditionFilter?: string;               // Content-based routing XPath, header expression, or Camel condition

    /** @deprecated Use sender */
    senderComponent?: string;
    /** @deprecated Use receiver */
    receiverComponent?: string;
    /** @deprecated Use conditionFilter */
    conditionXPath?: string;
  };

  runtimeEndpoint: {
    protocol: EndpointProtocol;             // 'soap' | 'http' | 'rest' | 'xi3'
    path: string;                           // Relative URL path (e.g. "/XISOAPAdapter/MessageServlet?..." or "/http/orders")
    httpMethod: 'POST' | 'GET' | 'PUT';
    requiredHeaders: Record<string, string>;
    schemaValidationEnabled: boolean;
    auth?: {
      type: 'basic' | 'oauth2' | 'client-cert' | 'none';
      csrfProtection?: boolean;             // Flag indicating CSRF token pre-flight handshake requirement
    };

    /** @deprecated Use path */
    servletPath?: string;
  };

  // ========================================================
  // 3. Schema & Interface Contract Specification
  // ========================================================
  contract?: {
    format: ContractFormat;
    url?: string;                           // Remote schema/contract URL (e.g. /dir/wsdl?p=ic/... or OpenAPI endpoint)
    filePath?: string;                      // Path to cached or local contract file
    rootEntity?: string;                    // Top-level request XML element name or JSON Schema model
    targetNamespace?: string;               // Target XML schema namespace
  };

  /** @deprecated Use contract */
  schema?: {
    wsdlUrl?: string;
    schemaPath?: string;
    rootElementName?: string;
    targetNamespace?: string;
  };

  // ========================================================
  // 4. Technical As-Built Architecture (EIP Adapters)
  // ========================================================
  inboundAdapter: {
    name: string;                           // Channel or Adapter Name
    adapterType: string;                    // "SOAP", "HTTPS", "SFTP", "REST", "KAFKA", etc.
    transport: string;                      // "HTTP", "SSHFtp", "RFC", etc.
    protocol: string;                       // "SOAP 1.1", "JSON", "XI 3.0", "OData V2", etc.
    attributes: Record<string, any>;        // Flattened configuration parameters
    pipeline?: Array<{
      step: number;
      name: string;
      type: string;                         // "JavaModule", "GroovyScript", "ContentModifier", etc.
      description?: string;
    }>;
  };

  /** @deprecated Use inboundAdapter */
  inboundChannel?: {
    channelName: string;
    adapterType: string;
    transportProtocol: string;
    messageProtocol: string;
    adapterAttributes: Record<string, any>;
    modulePipeline?: Array<{
      step: number;
      moduleName: string;
      type: string;
      description?: string;
    }>;
  };

  transformation?: {
    name?: string;                          // Operation Mapping or Script identifier
    engine?: 'graphical-mapping' | 'xslt' | 'groovy-script' | 'javascript' | 'passthrough';
    targetInterface?: string;
    targetNamespace?: string;

    /** @deprecated Use name */
    operationMapping?: string;
    softwareComponentVersion?: string;
  };

  outboundAdapter?: {
    name: string;
    adapterType: string;
    endpointUrl?: string;                   // Backend target URL, RFC destination, or broker address
    transport: string;
    protocol: string;
    attributes?: Record<string, any>;
  };

  /** @deprecated Use outboundAdapter */
  outboundChannel?: {
    channelName: string;
    adapterType: string;
    targetEndpoint?: string;
    transportProtocol: string;
    messageProtocol: string;
    adapterAttributes?: Record<string, any>;
  };

  // ========================================================
  // 5. Testing & Verification Rules (Execution Engine)
  // ========================================================
  testing: {
    safetyTier: ScenarioSafetyTier;         // 'read-only' vs 'state-mutating' vs 'unknown'
    timeoutMs: number;                      // Per-interface SLA timeout threshold
    payloadFixturesDir?: string;            // Path to golden test payloads
    volatileFieldIgnores: string[];         // Fields stripped during canonical diffing
    expectedTerminalStatus: 'DELIVERED' | 'WAITING' | 'COMPLETED'; // Terminal status
    responseType: 'xml' | 'json' | 'opaque';
  };

  // ========================================================
  // 6. Dual-Run Parity Specification (Pre-to-Post Migration)
  // ========================================================
  parity?: {
    targetEcosystem: PlatformEcosystem;     // e.g. 'sap-cpi'
    targetPath?: string;                    // Relative endpoint path on target system
    targetScenarioId?: string;              // Direct link to target CanonicalScenario ID
    httpMethod?: 'POST' | 'GET';
    authType?: 'basic' | 'oauth2-client-credentials';

    /** @deprecated Use targetPath */
    cpiEndpointPath?: string;
  };
}

// ========================================================
// 5. Provider SPI Contracts
// ========================================================

export interface TestCaseGenerationResult {
  scenarioId: string;
  fixturesDir: string;
  generatedFiles: string[];
  manifestPath?: string;
}

export interface TestCaseGeneratorProvider {
  readonly id: string;
  readonly ecosystem: PlatformEcosystem;
  readonly capabilities: ModuleCapability[];

  validatePrerequisites(context: ExecutionContext): Promise<{ satisfied: boolean; missing: string[] }>;

  generateSuite(
    scenario: CanonicalScenario,
    context: ExecutionContext,
    options?: Record<string, any>
  ): Promise<TestCaseGenerationResult>;
}

export interface TelemetryPollerProvider {
  readonly id: string;
  readonly ecosystem: PlatformEcosystem;
  readonly capabilities: ModuleCapability[];

  pollStatus(
    messageId: string,
    context: ExecutionContext,
    options?: {
      maxWaitMs?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      abortSignal?: AbortSignal;
    }
  ): Promise<import('./index.js').AsyncPollResult>;
}

export interface AuthProvider {
  readonly id: string;
  readonly ecosystem: PlatformEcosystem;

  buildAuthHeaders(hostConfig: HostConfig, context?: ExecutionContext): Promise<Record<string, string>>;
  preFlightHandshake?(hostConfig: HostConfig, endpointPath: string): Promise<Record<string, string>>;
}

export interface AdapterRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers: Record<string, string>;
  body?: string | Buffer;
  timeoutMs: number;
}

export interface AdapterResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

export interface ProtocolAdapter {
  readonly protocolId: string;

  buildRequest(scenario: CanonicalScenario, rawPayload: string, customHeaders?: Record<string, string>): AdapterRequest;

  extractMessageId(response: AdapterResponse): string | undefined;

  parseFault(response: AdapterResponse): {
    isFault: boolean;
    code?: string;
    message?: string;
    detail?: string;
  };
}

// ========================================================
// 6. Backward Compatibility Bridge
// ========================================================

/**
 * Converts a CanonicalScenario to a legacy DiscoveredEndpoint
 * for interoperability with v1.0.0 runners and reporters.
 */
export function scenarioToDiscoveredEndpoint(
  scenario: CanonicalScenario,
  hostConfig?: HostConfig
): DiscoveredEndpoint {
  let fullUrl: string | undefined;
  const path = scenario.runtimeEndpoint.path ?? scenario.runtimeEndpoint.servletPath ?? '';

  if (hostConfig) {
    const scheme = hostConfig.https ? 'https' : 'http';
    const baseUrl = `${scheme}://${hostConfig.host}:${hostConfig.port}`;
    fullUrl = `${baseUrl}${path}`;
  }

  const sender = scenario.routing.sender ?? scenario.routing.senderComponent ?? '';
  const receiver = scenario.routing.receiver ?? scenario.routing.receiverComponent ?? '';
  const channelName = scenario.inboundAdapter?.name ?? scenario.inboundChannel?.channelName ?? '';
  const method = scenario.runtimeEndpoint.httpMethod === 'PUT' ? 'POST' : scenario.runtimeEndpoint.httpMethod;

  return {
    id: scenario.id,
    protocol: scenario.runtimeEndpoint.protocol,
    urlPath: path,
    fullUrl,
    method,
    interfaceName: scenario.name,
    interfaceNamespace: scenario.namespace ?? '',
    senderComponent: sender,
    senderParty: scenario.routing.senderParty,
    receiverComponent: receiver,
    receiverParty: scenario.routing.receiverParty,
    senderChannel: channelName,
    qos: scenario.routing.qos === 'BE' ? 'BE' : 'EO',
    headers: { ...scenario.runtimeEndpoint.requiredHeaders }
  };
}

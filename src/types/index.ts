/**
 * Core type definitions for AetherFlow SAP Test Harness
 */

export type QualityOfService = 'BE' | 'EO' | 'EOIO';

export * from './scenario.js';
export * from './suite.js';

export interface InventoryMeta {
  id: string;
  hostId: string;
  hostLabel: string;
  sapUser: string;
  extractedAt: string;
  partial?: boolean;
  icoCount: number;
  icoQueriedCount?: number;
  channelCount: number;
  channelQueriedCount?: number;
}

export interface ExtractionSummary {
  icoCount: number;
  icoQueriedCount: number;
  channelCount: number;
  channelQueriedCount: number;
  senderChannelCount: number;
  receiverChannelCount: number;
  warnings: string[];
}

export * from './raw-inventory.js';
export * from './raw-cpi.js';

export type IcoRecord = import('./raw-inventory.js').RawIntegratedConfiguration;
export type ChannelRecord = import('./raw-inventory.js').RawCommunicationChannel;

export interface InventoryFile {
  _meta: InventoryMeta;
  summary: ExtractionSummary;
  integratedConfigurations: IcoRecord[];
  communicationChannels: ChannelRecord[];
}

export type EndpointProtocol = 'soap' | 'http' | 'rest' | 'xi3';

export interface DiscoveredEndpoint {
  id: string;
  protocol: EndpointProtocol;
  urlPath: string;
  fullUrl?: string;
  method: 'POST' | 'GET';
  interfaceName: string;
  interfaceNamespace: string;
  senderComponent: string;
  senderParty?: string;
  receiverComponent?: string;
  receiverParty?: string;
  senderChannel?: string;
  qos: QualityOfService;
  headers: Record<string, string>;
  rawIco?: IcoRecord;
}

export interface EndpointFilter {
  interfaceName?: string;
  interfaceNamespace?: string;
  senderComponent?: string;
  receiverComponent?: string;
  qos?: QualityOfService;
  limit?: number;
}

export interface PayloadConfig {
  ignorePaths?: string[];
  ignoreRegex?: string[];
  headers?: Record<string, string>;
  timeoutMs?: number;
  qos?: QualityOfService;
  targetPath?: string; // Relative URL override for CPI or custom endpoints
}

export interface TestPayload {
  name: string;
  content: string;
  contentType: string;
  expectedResponse?: string;
  config?: PayloadConfig;
}

export interface HostConfig {
  id?: string;
  label?: string;
  host: string;
  port: number;
  user?: string;
  password?: string;
  https: boolean;
  insecure?: boolean;
  isProduction?: boolean;
  cpiTenant?: string;
  cpiBaseUrl?: string;
}

export interface HttpRequestOptions {
  url: string;
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  insecure?: boolean;
  abortSignal?: AbortSignal;
}

export interface HttpResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  messageId?: string;
  isSoapFault: boolean;
  soapFaultDetails?: SoapFaultDetails;
}

export interface SoapFaultDetails {
  faultCode: string;
  faultString: string;
  detail?: string;
}

export interface DifferenceItem {
  path: string;
  reason: string;
  expected?: any;
  actual?: any;
}

export interface DiffResult {
  matched: boolean;
  differences: DifferenceItem[];
  canonicalA: string;
  canonicalB: string;
  summary: string;
}

export interface DiffOptions {
  ignorePaths?: string[];
  ignoreRegex?: string[];
  normalizeNamespaces?: boolean;
  caseSensitive?: boolean;
  ignoreWhitespace?: boolean;
  arrayOrderInsensitive?: boolean;
}

export type AsyncMessageState =
  | 'DELIVERED'
  | 'WAITING'
  | 'SYSTEM_ERROR'
  | 'HOLDING'
  | 'UNKNOWN';

export interface AsyncPollResult {
  messageId: string;
  state: AsyncMessageState;
  terminal: boolean;
  pollCount: number;
  durationMs: number;
  errorCategory?: string;
  errorText?: string;
  failingStep?: 'Mapping' | 'Routing' | 'Adapter Call' | 'Inbound' | 'Unknown';
  rawResponse?: string;
}

export interface SmokeTestResult {
  endpoint: DiscoveredEndpoint;
  passed: boolean;
  statusCode: number;
  durationMs: number;
  messageId?: string;
  isSoapFault: boolean;
  error?: string;
  asyncStatus?: AsyncPollResult;
}

export interface SmokeTestSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: SmokeTestResult[];
}

export interface ParityTestResult {
  interfaceName: string;
  payloadFile: string;
  passed: boolean;
  pipoResponse: HttpResponse;
  cpiResponse: HttpResponse;
  diff: DiffResult;
  durationMs: number;
}

export interface LatencyDistribution {
  min: number;
  max: number;
  mean: number;
  median: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface StressMetrics {
  interfaceName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  targetTps: number;
  achievedTps: number;
  totalDurationSeconds: number;
  statusCodes: Record<number, number>;
  errors: Record<string, number>;
  latencies: LatencyDistribution;
  allLatencies: number[];
}

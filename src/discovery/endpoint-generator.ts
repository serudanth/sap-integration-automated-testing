import type {
  InventoryFile,
  IcoRecord,
  DiscoveredEndpoint,
  QualityOfService,
  HostConfig,
  EndpointProtocol
} from '../types/index.js';

/**
 * Extracts quality of service (QoS) from an Integrated Configuration (ICO) record.
 * Defaults to 'EO' (Exactly Once) if unspecified, or 'BE' (Best Effort) if found.
 */
export function extractQoS(ico: IcoRecord): QualityOfService {
  if (ico.ReceiverInterfaces) {
    const receiverInterfaces = Array.isArray(ico.ReceiverInterfaces)
      ? ico.ReceiverInterfaces
      : [ico.ReceiverInterfaces];

    for (const ri of receiverInterfaces) {
      if (ri && ri.QualityOfService) {
        const qos = String(ri.QualityOfService).toUpperCase();
        if (qos === 'BE' || qos === 'EO') {
          return qos;
        }
      }
    }
  }
  return 'EO';
}

/**
 * Builds the standard SAP PI/PO MessageServlet query string.
 */
export function buildMessageServletQuery(params: {
  senderService: string;
  interfaceName: string;
  interfaceNamespace: string;
  qos: QualityOfService;
  senderParty?: string;
  receiverParty?: string;
  receiverService?: string;
}): string {
  const query = new URLSearchParams();
  query.set('senderService', params.senderService);
  query.set('interface', params.interfaceName);
  query.set('interfaceNamespace', params.interfaceNamespace);
  query.set('qos', params.qos);

  if (params.senderParty) {
    query.set('senderParty', params.senderParty);
  }
  if (params.receiverParty) {
    query.set('receiverParty', params.receiverParty);
  }
  if (params.receiverService) {
    query.set('receiverService', params.receiverService);
  }

  return query.toString();
}

/**
 * Builds a direct channel trigger URL path.
 * Syntax: /XISOAPAdapter/MessageServlet?channel=:<SenderComponentID>:<ChannelName>
 */
export function buildChannelDirectPath(senderComponent: string, channelName: string): string {
  return `/XISOAPAdapter/MessageServlet?channel=:${encodeURIComponent(senderComponent)}:${encodeURIComponent(channelName)}`;
}

/**
 * Generates discovered endpoints from an InventoryFile.
 */
export function discoverEndpoints(
  inventory: InventoryFile,
  hostConfig?: HostConfig
): DiscoveredEndpoint[] {
  const endpoints: DiscoveredEndpoint[] = [];
  const icos = inventory.integratedConfigurations || [];

  for (const ico of icos) {
    const icoId = ico.IntegratedConfigurationID || {};
    const senderService = icoId.SenderComponentID || '';
    const interfaceName = icoId.InterfaceName || '';
    const interfaceNamespace = icoId.InterfaceNamespace || '';
    const senderParty = icoId.SenderPartyID || '';
    const receiverService = icoId.ReceiverComponentID || '';
    const receiverParty = icoId.ReceiverPartyID || '';

    if (!senderService || !interfaceName) {
      continue;
    }

    const qos = extractQoS(ico);

    // Extract sender channel if available
    let senderChannel: string | undefined;
    if (ico.InboundProcessing?.CommunicationChannel?.ChannelID) {
      senderChannel = ico.InboundProcessing.CommunicationChannel.ChannelID;
    }

    // Determine protocol: default is SOAP/MessageServlet
    const protocol: EndpointProtocol = 'soap';

    const queryString = buildMessageServletQuery({
      senderService,
      interfaceName,
      interfaceNamespace,
      qos,
      senderParty: senderParty || undefined,
      receiverParty: receiverParty || undefined,
      receiverService: receiverService || undefined
    });

    const urlPath = `/XISOAPAdapter/MessageServlet?${queryString}`;
    let fullUrl: string | undefined;

    if (hostConfig) {
      const scheme = hostConfig.https ? 'https' : 'http';
      fullUrl = `${scheme}://${hostConfig.host}:${hostConfig.port}${urlPath}`;
    }

    const id = `${senderService}:${interfaceName}:${qos}`;

    endpoints.push({
      id,
      protocol,
      urlPath,
      fullUrl,
      method: 'POST',
      interfaceName,
      interfaceNamespace,
      senderComponent: senderService,
      senderParty: senderParty || undefined,
      receiverComponent: receiverService || undefined,
      receiverParty: receiverParty || undefined,
      senderChannel,
      qos,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Requested-With': 'AetherFlow-Test-Engine'
      },
      rawIco: ico
    });
  }

  return endpoints;
}

/**
 * Formats a full target URL given a host configuration and relative path.
 */
export function resolveTargetUrl(hostConfig: HostConfig, relativePath: string): string {
  const scheme = hostConfig.https ? 'https' : 'http';
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${scheme}://${hostConfig.host}:${hostConfig.port}${cleanPath}`;
}

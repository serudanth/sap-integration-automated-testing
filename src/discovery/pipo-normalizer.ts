/**
 * SAP NetWeaver PI/PO Normalizer Engine
 * Normalizes raw ICO records into platform-neutral CanonicalScenario[] models
 * with multi-receiver route explosion and channel dereferencing.
 */

import type {
  InventoryFile,
  RawIntegratedConfiguration,
  RawCommunicationChannel,
  CanonicalScenario,
  QualityOfService,
  EndpointProtocol
} from '../types/index.js';
import { toArray } from '../types/raw-inventory.js';
import type { AetherFlowConfig } from '../config/aetherflow-config.js';
import {
  inferFunctionalDomain,
  inferIntegrationPattern,
  inferSafetyTier
} from '../config/heuristics.js';
import { buildMessageServletQuery } from './endpoint-generator.js';

/**
 * Normalizes a raw PI/PO inventory into an array of platform-neutral CanonicalScenarios.
 */
export function normalizePipoInventory(
  inventory: InventoryFile,
  config?: AetherFlowConfig | null
): CanonicalScenario[] {
  const scenarios: CanonicalScenario[] = [];
  const icos: RawIntegratedConfiguration[] = inventory.integratedConfigurations || [];
  const channels: RawCommunicationChannel[] = inventory.communicationChannels || [];

  // Index communication channels for fast dereferencing: key = ComponentID:ChannelID
  const channelIndex = new Map<string, RawCommunicationChannel>();
  for (const ch of channels) {
    const compId = ch.CommunicationChannelID?.ComponentID || '';
    const chId = ch.CommunicationChannelID?.ChannelID || '';
    if (chId) {
      channelIndex.set(`${compId}:${chId}`, ch);
      if (!channelIndex.has(chId)) {
        channelIndex.set(chId, ch); // Fallback by channel name only
      }
    }
  }

  for (const ico of icos) {
    const icoId = ico.IntegratedConfigurationID || ({} as any);
    const sender = icoId.SenderComponentID || '';
    const interfaceName = icoId.InterfaceName || '';
    const interfaceNamespace = icoId.InterfaceNamespace || '';
    const senderParty = icoId.SenderPartyID || undefined;

    if (!sender || !interfaceName) {
      continue;
    }

    // Administrative metadata
    const folderPath = ico.AdministrativeData?.FolderPathID || [];
    const lastChanged = ico.AdministrativeData?.LastChangeDateTime
      ? {
          user: ico.AdministrativeData.LastChangeUserAccountID || 'UNKNOWN',
          timestamp: ico.AdministrativeData.LastChangeDateTime
        }
      : undefined;

    // Inbound Channel & Adapter dereferencing
    const inboundChannelRef = ico.InboundProcessing?.CommunicationChannel;
    const inboundChannelId = inboundChannelRef?.ChannelID || '';
    const inboundChannelComponent = inboundChannelRef?.ComponentID || sender;
    const rawInboundChannel =
      channelIndex.get(`${inboundChannelComponent}:${inboundChannelId}`) ||
      channelIndex.get(inboundChannelId);

    const inboundAdapterType =
      rawInboundChannel?.AdapterMetadata?.Name ||
      rawInboundChannel?.MessageProtocol ||
      rawInboundChannel?.TransportProtocol ||
      'SOAP';
    const inboundTransport = rawInboundChannel?.TransportProtocol || 'HTTP';
    const inboundProtocol = rawInboundChannel?.MessageProtocol || 'SOAP 1.1';

    // Flatten adapter attributes
    const inboundAttributes: Record<string, any> = {};
    if (rawInboundChannel?.AdapterSpecificAttribute) {
      for (const attr of rawInboundChannel.AdapterSpecificAttribute) {
        inboundAttributes[attr.Name] = attr.Value;
      }
    }

    // Module processing pipeline
    const pipeline = rawInboundChannel?.ModuleProcess?.ProcessStep?.map((step, idx) => ({
      step: step.StepNumber || idx + 1,
      name: step.ModuleName,
      type: step.ModuleType || 'JavaModule',
      description: `Parameter Group: ${step.ParameterGroupID || 'None'}`
    }));

    // Receiver route explosion
    const rawReceiverInterfaces = toArray(ico.ReceiverInterfaces);
    const rawOutboundProcessing = toArray(ico.OutboundProcessing);

    // If no explicit receiver interfaces defined, fallback to single route from ICO ID
    const routesToExplode =
      rawReceiverInterfaces.length > 0
        ? rawReceiverInterfaces
        : [
            {
              Receiver: {
                PartyID: icoId.ReceiverPartyID || '',
                ComponentID: icoId.ReceiverComponentID || 'UNKNOWN_RECEIVER'
              },
              QualityOfService: 'EO'
            }
          ];

    const totalRoutes = routesToExplode.length;

    routesToExplode.forEach((route, routeIndex) => {
      const receiver = route.Receiver?.ComponentID || icoId.ReceiverComponentID || 'UNKNOWN_RECEIVER';
      const receiverParty = route.Receiver?.PartyID || icoId.ReceiverPartyID || undefined;
      const qos: QualityOfService = (route.QualityOfService as QualityOfService) || 'EO';

      // Deterministic ID formulation
      const baseId = `${sender}_${interfaceName}_${receiver}`;
      const id = totalRoutes > 1 ? `${baseId}_route${routeIndex}` : baseId;

      // Dereference outbound adapter
      const matchingOutbound = rawOutboundProcessing.find(
        (op) =>
          op.Receiver?.ComponentID === receiver &&
          (!route.Receiver?.PartyID || op.Receiver?.PartyID === route.Receiver.PartyID)
      );

      const outChannelRef = matchingOutbound?.CommunicationChannel;
      const outChannelId = outChannelRef?.ChannelID || '';
      const outChannelComponent = outChannelRef?.ComponentID || receiver;
      const rawOutboundChannel =
        channelIndex.get(`${outChannelComponent}:${outChannelId}`) ||
        channelIndex.get(outChannelId);

      let outboundAdapter: CanonicalScenario['outboundAdapter'];
      if (rawOutboundChannel || outChannelId) {
        const outAttributes: Record<string, any> = {};
        if (rawOutboundChannel?.AdapterSpecificAttribute) {
          for (const attr of rawOutboundChannel.AdapterSpecificAttribute) {
            outAttributes[attr.Name] = attr.Value;
          }
        }

        outboundAdapter = {
          name: outChannelId || 'DEFAULT_OUTBOUND',
          adapterType:
            rawOutboundChannel?.AdapterMetadata?.Name ||
            rawOutboundChannel?.TransportProtocol ||
            'SOAP',
          transport: rawOutboundChannel?.TransportProtocol || 'HTTP',
          protocol: rawOutboundChannel?.MessageProtocol || 'SOAP 1.1',
          attributes: outAttributes
        };
      }

      // Infer heuristics
      const functionalDomain = inferFunctionalDomain(interfaceName, config);
      const integrationPattern = inferIntegrationPattern(inboundAdapterType, qos, interfaceName, config);
      const safetyTier = inferSafetyTier(interfaceName, id, config);

      // Determine wire protocol
      let protocol: EndpointProtocol = 'soap';
      const lowerInbound = inboundAdapterType.toLowerCase();
      if (lowerInbound.includes('rest')) protocol = 'rest';
      else if (lowerInbound.includes('http')) protocol = 'http';
      else if (lowerInbound.includes('xi')) protocol = 'xi3';

      const queryString = buildMessageServletQuery({
        senderService: sender,
        interfaceName,
        interfaceNamespace,
        qos,
        senderParty,
        receiverParty,
        receiverService: receiver
      });

      const runtimePath = `/XISOAPAdapter/MessageServlet?${queryString}`;

      // Target parity resolution
      const scenarioOverride = config?.scenarios?.[id];
      let targetPath: string | undefined =
        scenarioOverride?.targetPath ??
        scenarioOverride?.cpiEndpointPath ??
        config?.parity?.targetEndpointOverrides?.[id] ??
        config?.parity?.cpiEndpointOverrides?.[id];

      if (!targetPath) {
        const pattern =
          config?.parity?.targetEndpointPattern ??
          config?.parity?.cpiEndpointPattern;
        if (pattern) {
          targetPath = pattern
            .replace('{sender}', sender)
            .replace('{interfaceName}', interfaceName)
            .replace('{receiver}', receiver);
        }
      }

      const canonical: CanonicalScenario = {
        id,
        name: interfaceName,
        namespace: interfaceNamespace,
        description: `SAP PI/PO integration from ${sender} to ${receiver}`,
        functionalDomain,
        integrationPattern,
        folderPath,
        lastChanged,
        lineage: {
          ecosystem: 'sap-pipo',
          sourceArtifactType: 'ICO',
          sourceArtifactId: (ico as any).id || id,
          sourceContainer: folderPath.join('/'),
          version: lastChanged?.timestamp,
          sourceInventoryId: inventory._meta?.id
        },
        routeIndex: totalRoutes > 1 ? routeIndex : undefined,
        totalRoutes: totalRoutes > 1 ? totalRoutes : undefined,
        routing: {
          sender,
          senderParty,
          receiver,
          receiverParty,
          qos,
          conditionFilter: (route as any).Condition?.XPath
        },
        runtimeEndpoint: {
          protocol,
          path: runtimePath,
          httpMethod: 'POST',
          requiredHeaders: {
            'content-type': 'text/xml; charset=utf-8',
            soapaction: 'http://sap.com/xi/WebService/soap1.1'
          },
          schemaValidationEnabled: String(ico.InboundProcessing?.SchemaValidationIndicator) === 'true',
          auth: {
            type: 'basic'
          }
        },
        contract: {
          format: 'wsdl',
          url: `/dir/wsdl?p=ic/${(ico as any).id || id}`,
          rootEntity: `${interfaceName}_Request`,
          targetNamespace: interfaceNamespace
        },
        inboundAdapter: {
          name: inboundChannelId || 'DEFAULT_INBOUND',
          adapterType: inboundAdapterType,
          transport: inboundTransport,
          protocol: inboundProtocol,
          attributes: inboundAttributes,
          pipeline
        },
        outboundAdapter,
        testing: {
          safetyTier,
          timeoutMs: scenarioOverride?.timeoutMs ?? 15000,
          volatileFieldIgnores: scenarioOverride?.volatileFieldIgnores ?? [
            'orderId',
            'timestamp',
            'uuid',
            'messageId',
            'guid'
          ],
          expectedTerminalStatus: scenarioOverride?.expectedTerminalStatus ?? 'DELIVERED',
          responseType: 'xml'
        },
        parity: targetPath
          ? {
              targetEcosystem: 'sap-cpi',
              targetPath,
              httpMethod: 'POST'
            }
          : undefined
      };

      scenarios.push(canonical);
    });
  }

  return scenarios;
}

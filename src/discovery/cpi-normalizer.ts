/**
 * SAP BTP Cloud Integration (CPI) Normalizer Engine
 * Normalizes raw BTP iFlow metadata artifacts into platform-neutral CanonicalScenario[] models.
 */

import type {
  CanonicalScenario,
  EndpointProtocol,
  QualityOfService
} from '../types/index.js';
import type {
  RawCpiArtifact,
  RawCpiInventorySnapshot
} from '../types/raw-cpi.js';
import type { AetherFlowConfig } from '../config/aetherflow-config.js';
import {
  inferFunctionalDomain,
  inferIntegrationPattern,
  inferSafetyTier
} from '../config/heuristics.js';

/**
 * Normalizes BTP CPI artifacts or snapshot into an array of platform-neutral CanonicalScenarios.
 */
export function normalizeCpiSnapshot(
  input: RawCpiInventorySnapshot | RawCpiArtifact[],
  config?: AetherFlowConfig | null
): CanonicalScenario[] {
  const artifacts: RawCpiArtifact[] = Array.isArray(input)
    ? input
    : input.artifacts || [];

  const snapshotId = !Array.isArray(input) ? input._meta?.id : undefined;

  const scenarios: CanonicalScenario[] = [];

  for (const artifact of artifacts) {
    const sender =
      artifact.Participants?.find((p) => p.Role === 'Sender')?.Name || 'EXTERNAL';
    const receiver =
      artifact.Participants?.find((p) => p.Role === 'Receiver')?.Name || 'BACKEND';

    const senderChannels =
      artifact.SenderChannels && artifact.SenderChannels.length > 0
        ? artifact.SenderChannels
        : [
            {
              Name: 'HTTPS_Default_Sender',
              AdapterType: 'HTTPS',
              TransportProtocol: 'HTTPS',
              MessageProtocol: 'JSON',
              EndpointAddress: `/http/${artifact.Id}`,
              Parameters: {}
            }
          ];

    const totalChannels = senderChannels.length;

    senderChannels.forEach((channel, chIndex) => {
      const baseId = `${sender}_${artifact.Id}_${receiver}`;
      const id = totalChannels > 1 ? `${baseId}_ch${chIndex}` : baseId;

      // Inbound adapter definition
      const adapterType = channel.AdapterType || 'HTTPS';
      const transport = channel.TransportProtocol || 'HTTPS';
      const protocol = channel.MessageProtocol || 'JSON';
      const path = channel.EndpointAddress.startsWith('/')
        ? channel.EndpointAddress
        : `/${channel.EndpointAddress}`;

      // Wire protocol
      let wireProtocol: EndpointProtocol = 'rest';
      const lowerType = adapterType.toLowerCase();
      if (lowerType.includes('soap')) {
        wireProtocol = 'soap';
      } else if (lowerType.includes('xi')) {
        wireProtocol = 'xi3';
      }

      // Outbound adapter matching
      let outboundAdapter: CanonicalScenario['outboundAdapter'];
      const outCh = artifact.ReceiverChannels?.[0];
      if (outCh) {
        outboundAdapter = {
          name: outCh.Name,
          adapterType: outCh.AdapterType || 'HTTP',
          transport: outCh.TransportProtocol || 'HTTP',
          protocol: outCh.MessageProtocol || 'OData V2',
          endpointUrl: outCh.EndpointAddress,
          attributes: outCh.Parameters || {}
        };
      }

      // Infer heuristics
      const functionalDomain = inferFunctionalDomain(artifact.Name || artifact.Id, config);
      const integrationPattern = inferIntegrationPattern(adapterType, 'BE', artifact.Name || artifact.Id, config);
      const safetyTier = inferSafetyTier(artifact.Name || artifact.Id, id, config);

      const scenarioOverride = config?.scenarios?.[id];

      const canonical: CanonicalScenario = {
        id,
        name: artifact.Name || artifact.Id,
        description: artifact.Description || `BTP CPI iFlow ${artifact.Id}`,
        functionalDomain,
        integrationPattern,
        folderPath: artifact.PackageId ? [artifact.PackageId] : [],
        lastChanged: artifact.ModifiedAt
          ? {
              user: artifact.ModifiedBy || 'UNKNOWN',
              timestamp: artifact.ModifiedAt
            }
          : undefined,
        lineage: {
          ecosystem: 'sap-cpi',
          sourceArtifactType: 'iFlow',
          sourceArtifactId: artifact.Id,
          sourceContainer: artifact.PackageId,
          version: artifact.Version,
          sourceInventoryId: snapshotId
        },
        routeIndex: totalChannels > 1 ? chIndex : undefined,
        totalRoutes: totalChannels > 1 ? totalChannels : undefined,
        routing: {
          sender,
          receiver,
          qos: 'BE' as QualityOfService
        },
        runtimeEndpoint: {
          protocol: wireProtocol,
          path,
          httpMethod: 'POST',
          requiredHeaders: {
            'content-type': wireProtocol === 'soap' ? 'text/xml; charset=utf-8' : 'application/json'
          },
          schemaValidationEnabled: true,
          auth: {
            type: 'oauth2',
            csrfProtection: true
          }
        },
        contract: {
          format: wireProtocol === 'soap' ? 'wsdl' : 'openapi',
          url: `${path}/$openapi`,
          rootEntity: `${artifact.Id}_Request`
        },
        inboundAdapter: {
          name: channel.Name,
          adapterType,
          transport,
          protocol,
          attributes: channel.Parameters || {}
        },
        outboundAdapter,
        testing: {
          safetyTier,
          timeoutMs: scenarioOverride?.timeoutMs ?? 20000,
          volatileFieldIgnores: scenarioOverride?.volatileFieldIgnores ?? [
            'clientTxId',
            'createdAt',
            'timestamp',
            'uuid'
          ],
          expectedTerminalStatus: 'COMPLETED',
          responseType: wireProtocol === 'soap' ? 'xml' : 'json'
        }
      };

      scenarios.push(canonical);
    });
  }

  return scenarios;
}

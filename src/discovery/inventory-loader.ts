import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import type { InventoryFile, DiscoveredEndpoint, EndpointFilter } from '../types/index.js';

/**
 * Loads an inventory JSON file exported by sap-po-ico-reader.
 * Supports explicit file paths or looking in standard locations:
 * - current directory / provided path
 * - ./inventories/<id>.json
 * - ./data/inventories/<id>.json
 */
export async function loadInventory(pathOrId: string): Promise<InventoryFile> {
  const candidates: string[] = [];

  if (isAbsolute(pathOrId) || pathOrId.startsWith('./') || pathOrId.startsWith('../')) {
    candidates.push(resolve(pathOrId));
  } else {
    candidates.push(resolve(pathOrId));
    candidates.push(resolve(process.cwd(), 'inventories', pathOrId.endsWith('.json') ? pathOrId : `${pathOrId}.json`));
    candidates.push(resolve(process.cwd(), 'data', 'inventories', pathOrId.endsWith('.json') ? pathOrId : `${pathOrId}.json`));
    candidates.push(resolve('/home/cpc9181/dev/sap-po-ico-reader/data/inventories', pathOrId.endsWith('.json') ? pathOrId : `${pathOrId}.json`));
  }

  let foundPath: string | null = null;
  for (const p of candidates) {
    if (existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (!foundPath) {
    throw new Error(
      `Inventory file not found: "${pathOrId}". Searched candidates:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
    );
  }

  try {
    const raw = await readFile(foundPath, 'utf-8');
    const data = JSON.parse(raw) as InventoryFile;

    if (!data.integratedConfigurations || !Array.isArray(data.integratedConfigurations)) {
      throw new Error(`Invalid inventory structure in ${foundPath}: missing "integratedConfigurations" array.`);
    }

    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON in ${foundPath}: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Filters discovered endpoints according to filtering criteria.
 */
export function filterEndpoints(
  endpoints: DiscoveredEndpoint[],
  filter?: EndpointFilter
): DiscoveredEndpoint[] {
  if (!filter) return endpoints;

  let filtered = endpoints;

  if (filter.interfaceName) {
    const nameLower = filter.interfaceName.toLowerCase();
    filtered = filtered.filter((ep) => ep.interfaceName.toLowerCase().includes(nameLower));
  }

  if (filter.interfaceNamespace) {
    const nsLower = filter.interfaceNamespace.toLowerCase();
    filtered = filtered.filter((ep) => ep.interfaceNamespace.toLowerCase().includes(nsLower));
  }

  if (filter.senderComponent) {
    const scLower = filter.senderComponent.toLowerCase();
    filtered = filtered.filter((ep) => ep.senderComponent.toLowerCase() === scLower);
  }

  if (filter.receiverComponent) {
    const rcLower = filter.receiverComponent.toLowerCase();
    filtered = filtered.filter((ep) => ep.receiverComponent?.toLowerCase() === rcLower);
  }

  if (filter.qos) {
    filtered = filtered.filter((ep) => ep.qos === filter.qos);
  }

  if (filter.limit && filter.limit > 0) {
    filtered = filtered.slice(0, filter.limit);
  }

  return filtered;
}

/**
 * AetherFlow Declarative Configuration Schema & Loader
 * Supports aetherflow.config.yaml and .aetherflow.yaml
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  EcosystemDefinition,
  ScenarioSafetyTier,
  IntegrationPattern
} from '../types/index.js';

export interface HeuristicRule {
  pattern: string;
  domain?: string;
  tier?: ScenarioSafetyTier;
  patternType?: IntegrationPattern;
}

export interface ScenarioOverrideConfig {
  safetyTier?: ScenarioSafetyTier;
  timeoutMs?: number;
  targetPath?: string;
  /** @deprecated Use targetPath */
  cpiEndpointPath?: string;
  volatileFieldIgnores?: string[];
  customHeaders?: Record<string, string>;
  expectedTerminalStatus?: 'DELIVERED' | 'WAITING' | 'COMPLETED';
}

export interface AetherFlowConfig {
  version: string;
  plugins?: string[];
  ecosystems?: Record<string, Partial<EcosystemDefinition>>;
  heuristics?: {
    domainRules?: HeuristicRule[];
    safetyRules?: HeuristicRule[];
    patternRules?: HeuristicRule[];
  };
  parity?: {
    targetEndpointPattern?: string;
    targetEndpointOverrides?: Record<string, string>;
    /** @deprecated Use targetEndpointPattern */
    cpiEndpointPattern?: string;
    /** @deprecated Use targetEndpointOverrides */
    cpiEndpointOverrides?: Record<string, string>;
  };
  scenarios?: Record<string, ScenarioOverrideConfig>;
}

const CONFIG_CANDIDATE_NAMES = [
  'aetherflow.config.yaml',
  'aetherflow.config.yml',
  '.aetherflow.yaml',
  '.aetherflow.yml'
];

/**
 * Loads and parses AetherFlow configuration from the workspace root or specified directory.
 * Returns null if no configuration file is present.
 */
export async function loadAetherFlowConfig(
  searchDir: string = process.cwd()
): Promise<AetherFlowConfig | null> {
  for (const filename of CONFIG_CANDIDATE_NAMES) {
    const fullPath = resolve(join(searchDir, filename));
    if (existsSync(fullPath)) {
      try {
        const raw = await readFile(fullPath, 'utf-8');
        const parsed = parseYaml(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as AetherFlowConfig;
        }
      } catch (err) {
        console.warn(`[WARN] Failed to parse AetherFlow config at ${fullPath}: ${(err as Error).message}`);
        return null;
      }
    }
  }

  return null;
}

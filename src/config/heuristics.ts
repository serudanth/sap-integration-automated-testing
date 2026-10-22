/**
 * Universal Heuristics Engine
 * Inferred Functional Domains, Integration Patterns, and Safety Tiers.
 * Precedence: CLI Flags > Scenario Overrides > Config Heuristics > Built-in Defaults
 */

import type {
  IntegrationPattern,
  QualityOfService,
  ScenarioSafetyTier
} from '../types/index.js';
import type { AetherFlowConfig } from './aetherflow-config.js';

export const BUILT_IN_DOMAIN_RULES: Array<{ regex: RegExp; domain: string }> = [
  { regex: /finance|payment|tax|\bfi\b/i, domain: 'Finance & Controlling (FI/CO)' },
  { regex: /procure|purchas|vendor|\bmm\b/i, domain: 'Procurement & Materials Management (MM)' },
  { regex: /sales|\bsd\b|order/i, domain: 'Logistics: Sales & Distribution (SD)' },
  { regex: /warehouse|wms|inventory|\bscm\b/i, domain: 'Supply Chain & Warehousing (SCM)' },
  { regex: /hr|employee|payroll|\bhcm\b/i, domain: 'Human Resources (HCM)' }
];

export const BUILT_IN_SAFETY_RULES: Array<{ regex: RegExp; tier: ScenarioSafetyTier }> = [
  { regex: /get|read|query|fetch|status|search|check|simulate/i, tier: 'read-only' },
  { regex: /create|post|update|cancel|submit|process|delete|insert|execute/i, tier: 'state-mutating' }
];

/**
 * Infers the functional business domain from interface name, namespace, or folder path.
 */
export function inferFunctionalDomain(
  targetName: string,
  config?: AetherFlowConfig | null
): string {
  // 1. Check declarative config domain rules
  if (config?.heuristics?.domainRules) {
    for (const rule of config.heuristics.domainRules) {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(targetName) && rule.domain) {
          return rule.domain;
        }
      } catch {
        // Skip invalid regex pattern safely
      }
    }
  }

  // 2. Built-in pattern matching
  for (const { regex, domain } of BUILT_IN_DOMAIN_RULES) {
    if (regex.test(targetName)) {
      return domain;
    }
  }

  return 'General Integration';
}

/**
 * Infers the Enterprise Integration Pattern from adapter type, QoS, and interface name.
 */
export function inferIntegrationPattern(
  adapterType: string,
  qos: QualityOfService,
  targetName?: string,
  config?: AetherFlowConfig | null
): IntegrationPattern {
  const normAdapter = (adapterType || '').toUpperCase();

  // 1. Check declarative config pattern rules
  if (config?.heuristics?.patternRules && targetName) {
    for (const rule of config.heuristics.patternRules) {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(targetName) && rule.patternType) {
          return rule.patternType;
        }
      } catch {
        // Skip invalid regex
      }
    }
  }

  // 2. Built-in heuristics
  if (normAdapter.includes('JDBC') || normAdapter.includes('DB')) {
    return 'database-integration';
  }

  if (
    normAdapter.includes('FILE') ||
    normAdapter.includes('SFTP') ||
    normAdapter.includes('FTP')
  ) {
    return 'async-batch-file';
  }

  if (qos === 'BE') {
    return 'sync-request-reply';
  }

  return 'async-event-message';
}

/**
 * Infers the mutability safety tier (read-only, state-mutating, unknown).
 */
export function inferSafetyTier(
  targetName: string,
  scenarioId?: string,
  config?: AetherFlowConfig | null
): ScenarioSafetyTier {
  // 1. Check exact scenario override in config
  if (scenarioId && config?.scenarios?.[scenarioId]?.safetyTier) {
    return config.scenarios[scenarioId].safetyTier!;
  }

  // 2. Check declarative config safety rules
  if (config?.heuristics?.safetyRules) {
    for (const rule of config.heuristics.safetyRules) {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(targetName) && rule.tier) {
          return rule.tier;
        }
      } catch {
        // Skip invalid regex
      }
    }
  }

  // 3. Built-in prefix/suffix rules
  for (const { regex, tier } of BUILT_IN_SAFETY_RULES) {
    if (regex.test(targetName)) {
      return tier;
    }
  }

  return 'unknown';
}

import { describe, it, expect, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { loadAetherFlowConfig } from './aetherflow-config.js';

describe('loadAetherFlowConfig', () => {
  it('returns null when no config file exists in the directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aetherflow-test-'));
    try {
      const config = await loadAetherFlowConfig(tempDir);
      expect(config).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('loads and parses a valid aetherflow.config.yaml', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aetherflow-test-'));
    try {
      const yamlContent = `
version: "1.1"
heuristics:
  domainRules:
    - pattern: ".*crm.*"
      domain: "Customer Relationship Management (CRM)"
scenarios:
  TEST_SCENARIO:
    safetyTier: "read-only"
    timeoutMs: 12000
`;
      await writeFile(join(tempDir, 'aetherflow.config.yaml'), yamlContent, 'utf-8');

      const config = await loadAetherFlowConfig(tempDir);
      expect(config).not.toBeNull();
      expect(config?.version).toBe('1.1');
      expect(config?.heuristics?.domainRules?.[0]?.domain).toBe('Customer Relationship Management (CRM)');
      expect(config?.scenarios?.TEST_SCENARIO?.timeoutMs).toBe(12000);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('handles invalid YAML gracefully with warning and returns null', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'aetherflow-test-'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await writeFile(join(tempDir, 'aetherflow.config.yaml'), 'invalid: [yaml: unclosed', 'utf-8');

      const config = await loadAetherFlowConfig(tempDir);
      expect(config).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

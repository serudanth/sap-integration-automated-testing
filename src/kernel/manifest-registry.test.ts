import { describe, it, expect, vi } from 'vitest';
import {
  EcosystemRegistry,
  DEFAULT_PLATFORM_MANIFEST
} from './manifest-registry.js';
import type {
  ModuleDescriptor,
  PlatformManifest,
  ExecutionContext
} from '../types/index.js';

describe('Ecosystem Platform Manifest & Registry', () => {
  it('initializes with default manifest containing sap-pipo and generic-http', () => {
    const registry = new EcosystemRegistry();
    const manifest = registry.getManifest();

    expect(manifest.version).toBe('1.1');
    expect(manifest.defaultEcosystem).toBe('sap-pipo');
    expect(manifest.ecosystems['sap-pipo']).toBeDefined();
    expect(manifest.ecosystems['sap-pipo'].enabled).toBe(true);
    expect(manifest.ecosystems['generic-http']).toBeDefined();
  });

  it('allows registering a custom ecosystem and listing all ecosystems', () => {
    const registry = new EcosystemRegistry();
    registry.registerEcosystem({
      id: 'sap-cpi',
      label: 'SAP BTP Cloud Integration',
      description: 'Cloud Integration Suite on SAP BTP',
      enabled: true,
      providers: {
        'test-generation': '@aetherflow/plugin-btp-cpi:generator',
        execution: 'built-in:runner:smoke'
      }
    });

    const cpi = registry.getEcosystem('sap-cpi');
    expect(cpi).toBeDefined();
    expect(cpi?.label).toBe('SAP BTP Cloud Integration');

    const all = registry.listEcosystems();
    expect(all.map((e) => e.id)).toContain('sap-pipo');
    expect(all.map((e) => e.id)).toContain('sap-cpi');
  });

  it('registers module descriptors and lists them with filters', () => {
    const registry = new EcosystemRegistry();

    const pipoGenDescriptor: ModuleDescriptor = {
      id: 'built-in:generator:sap-pipo-wsdl',
      name: 'SAP PI/PO WSDL Generator',
      ecosystem: 'sap-pipo',
      capabilities: ['test-generation'],
      prerequisites: [{ type: 'inventory-data', description: 'Requires PI/PO inventory snapshot' }],
      validatePrerequisites: vi.fn().mockResolvedValue({ satisfied: true, missing: [] })
    };

    const pipoNormalizerDescriptor: ModuleDescriptor = {
      id: 'built-in:normalizer:sap-pipo',
      name: 'SAP PI/PO Normalizer',
      ecosystem: 'sap-pipo',
      capabilities: ['normalization'],
      prerequisites: [{ type: 'inventory-data', description: 'Requires raw ICO records' }],
      validatePrerequisites: vi.fn().mockResolvedValue({ satisfied: true, missing: [] })
    };

    registry.registerModule(pipoGenDescriptor);
    registry.registerModule(pipoNormalizerDescriptor);

    expect(registry.getModuleDescriptor('built-in:generator:sap-pipo-wsdl')).toBe(pipoGenDescriptor);

    const testGenModules = registry.listModules({ capability: 'test-generation' });
    expect(testGenModules).toHaveLength(1);
    expect(testGenModules[0].id).toBe('built-in:generator:sap-pipo-wsdl');

    const pipoModules = registry.listModules({ ecosystem: 'sap-pipo' });
    expect(pipoModules).toHaveLength(2);
  });

  it('resolves provider IDs and registered live provider instances', () => {
    const registry = new EcosystemRegistry();
    const mockGenerator = {
      generateSuite: vi.fn()
    };

    registry.registerProviderInstance('built-in:generator:sap-pipo-wsdl', mockGenerator);

    const providerId = registry.resolveProviderId('test-generation', 'sap-pipo');
    expect(providerId).toBe('built-in:generator:sap-pipo-wsdl');

    const instance = registry.resolveProvider('test-generation', 'sap-pipo');
    expect(instance).toBe(mockGenerator);

    const orThrow = registry.getProviderOrThrow('test-generation', 'sap-pipo');
    expect(orThrow).toBe(mockGenerator);
  });

  it('throws descriptive diagnostic error when ecosystem is not registered', () => {
    const registry = new EcosystemRegistry();

    expect(() => {
      registry.getProviderOrThrow('test-generation', 'non-existent-ecosystem');
    }).toThrowError(/Ecosystem 'non-existent-ecosystem' is not registered/);
  });

  it('throws descriptive error when ecosystem is disabled', () => {
    const registry = new EcosystemRegistry({
      ...DEFAULT_PLATFORM_MANIFEST,
      ecosystems: {
        ...DEFAULT_PLATFORM_MANIFEST.ecosystems,
        'sap-pipo': {
          ...DEFAULT_PLATFORM_MANIFEST.ecosystems['sap-pipo'],
          enabled: false
        }
      }
    });

    expect(() => {
      registry.getProviderOrThrow('test-generation', 'sap-pipo');
    }).toThrowError(/is currently disabled in the platform manifest/);
  });

  it('throws descriptive error with actionable hints when capability provider is missing', () => {
    const registry = new EcosystemRegistry();
    registry.registerEcosystem({
      id: 'sap-cpi',
      label: 'SAP BTP Cloud Integration',
      enabled: true,
      providers: {}
    });

    expect(() => {
      registry.getProviderOrThrow('test-generation', 'sap-cpi');
    }).toThrowError(/Install '@aetherflow\/plugin-btp-cpi'/);
  });

  it('throws descriptive error when provider instance is not loaded into memory', () => {
    const registry = new EcosystemRegistry();
    // 'sap-pipo' has provider ID 'built-in:generator:sap-pipo-wsdl', but instance is not registered

    expect(() => {
      registry.getProviderOrThrow('test-generation', 'sap-pipo');
    }).toThrowError(/is not loaded/);
  });

  it('validates prerequisites through the registered module descriptor', async () => {
    const registry = new EcosystemRegistry();
    const validateMock = vi.fn().mockResolvedValue({
      satisfied: false,
      missing: ['Inventory file not found: missing.json']
    });

    const descriptor: ModuleDescriptor = {
      id: 'built-in:generator:sap-pipo-wsdl',
      name: 'PI/PO WSDL Generator',
      ecosystem: 'sap-pipo',
      capabilities: ['test-generation'],
      prerequisites: [{ type: 'inventory-data', description: 'Requires inventory' }],
      validatePrerequisites: validateMock
    };

    registry.registerModule(descriptor);

    const context: ExecutionContext = {
      ecosystem: 'sap-pipo',
      inventoryPath: 'missing.json'
    };

    const result = await registry.validatePrerequisites('test-generation', 'sap-pipo', context);
    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain('Inventory file not found: missing.json');
    expect(validateMock).toHaveBeenCalledWith(context);
  });

  it('returns satisfied if provider has no custom validator', async () => {
    const registry = new EcosystemRegistry();
    const context: ExecutionContext = { ecosystem: 'sap-pipo' };

    // Built-in ID exists in manifest, but no descriptor registered with validator
    const result = await registry.validatePrerequisites('test-generation', 'sap-pipo', context);
    expect(result.satisfied).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns unsatisfied if provider capability is not in manifest', async () => {
    const registry = new EcosystemRegistry();
    const context: ExecutionContext = { ecosystem: 'generic-http' };

    // generic-http does not have 'test-generation'
    const result = await registry.validatePrerequisites('test-generation', 'generic-http', context);
    expect(result.satisfied).toBe(false);
    expect(result.missing[0]).toContain("Provider for capability 'test-generation' in ecosystem 'generic-http' is not registered");
  });
});

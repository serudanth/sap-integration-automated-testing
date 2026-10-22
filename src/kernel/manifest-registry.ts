/**
 * Ecosystem Platform Manifest & Module Registry
 * AetherFlow Test Engine 1.1.0+
 */

import type {
  PlatformManifest,
  EcosystemDefinition,
  PlatformEcosystem,
  ModuleCapability,
  ModuleDescriptor,
  ExecutionContext
} from '../types/index.js';

/**
 * Built-in default platform manifest with pre-wired baseline ecosystems.
 */
export const DEFAULT_PLATFORM_MANIFEST: PlatformManifest = {
  version: '1.1',
  defaultEcosystem: 'sap-pipo',
  ecosystems: {
    'sap-pipo': {
      id: 'sap-pipo',
      label: 'SAP NetWeaver PI/PO 7.31 - 7.5',
      description: 'Enterprise on-premises integration platform with Integrated Configurations (ICO) and Adapter Engine.',
      enabled: true,
      providers: {
        normalization: 'built-in:normalizer:sap-pipo',
        'test-generation': 'built-in:generator:sap-pipo-wsdl',
        execution: 'built-in:runner:smoke',
        monitoring: 'built-in:poller:pipo-message-monitoring',
        documentation: 'built-in:doc:passport'
      },
      defaultProtocols: ['soap', 'xi3', 'http', 'rest']
    },
    'generic-http': {
      id: 'generic-http',
      label: 'Generic HTTP / REST',
      description: 'Agnostic HTTP, REST, and SOAP web services.',
      enabled: true,
      providers: {
        execution: 'built-in:runner:smoke'
      },
      defaultProtocols: ['http', 'rest']
    }
  }
};

/**
 * Central registry managing ecosystems, capability provider bindings,
 * module manifests, and prerequisite validation.
 */
export class EcosystemRegistry {
  private manifest: PlatformManifest;
  private readonly providerInstances = new Map<string, any>();
  private readonly moduleDescriptors = new Map<string, ModuleDescriptor>();

  constructor(manifest: PlatformManifest = DEFAULT_PLATFORM_MANIFEST) {
    // Deep clone to ensure mutation safety
    this.manifest = JSON.parse(JSON.stringify(manifest));
  }

  /**
   * Returns current active platform manifest.
   */
  public getManifest(): PlatformManifest {
    return this.manifest;
  }

  /**
   * Registers or updates an ecosystem definition.
   */
  public registerEcosystem(definition: EcosystemDefinition): void {
    this.manifest.ecosystems[definition.id] = definition;
  }

  /**
   * Retrieves an ecosystem definition by its ID.
   */
  public getEcosystem(id: PlatformEcosystem): EcosystemDefinition | undefined {
    return this.manifest.ecosystems[id];
  }

  /**
   * Lists all registered ecosystems.
   */
  public listEcosystems(): EcosystemDefinition[] {
    return Object.values(this.manifest.ecosystems);
  }

  /**
   * Registers a module descriptor and optionally its live implementation instance.
   */
  public registerModule(descriptor: ModuleDescriptor, implementation?: any): void {
    this.moduleDescriptors.set(descriptor.id, descriptor);
    if (implementation !== undefined) {
      this.providerInstances.set(descriptor.id, implementation);
    }
  }

  /**
   * Registers a live provider instance by provider ID.
   */
  public registerProviderInstance(providerId: string, instance: any): void {
    this.providerInstances.set(providerId, instance);
  }

  /**
   * Retrieves a module descriptor by ID.
   */
  public getModuleDescriptor(id: string): ModuleDescriptor | undefined {
    return this.moduleDescriptors.get(id);
  }

  /**
   * Lists all registered module descriptors with optional filtering.
   */
  public listModules(filter?: {
    ecosystem?: PlatformEcosystem;
    capability?: ModuleCapability;
  }): ModuleDescriptor[] {
    let list = Array.from(this.moduleDescriptors.values());

    if (filter?.ecosystem) {
      list = list.filter((m) => m.ecosystem === filter.ecosystem);
    }
    if (filter?.capability) {
      list = list.filter((m) => m.capabilities.includes(filter.capability!));
    }

    return list;
  }

  /**
   * Resolves the provider ID bound to a given capability within an ecosystem.
   */
  public resolveProviderId(
    capability: ModuleCapability,
    ecosystem: PlatformEcosystem = this.manifest.defaultEcosystem
  ): string | undefined {
    const ecoDef = this.manifest.ecosystems[ecosystem];
    if (!ecoDef || !ecoDef.enabled) {
      return undefined;
    }
    return ecoDef.providers[capability];
  }

  /**
   * Resolves the live provider implementation for a given capability within an ecosystem.
   */
  public resolveProvider<T = any>(
    capability: ModuleCapability,
    ecosystem: PlatformEcosystem = this.manifest.defaultEcosystem
  ): T | undefined {
    const providerId = this.resolveProviderId(capability, ecosystem);
    if (!providerId) {
      return undefined;
    }
    return this.providerInstances.get(providerId);
  }

  /**
   * Resolves the provider or throws an actionable, descriptive error with diagnostics and setup hints.
   */
  public getProviderOrThrow<T = any>(
    capability: ModuleCapability,
    ecosystem: PlatformEcosystem = this.manifest.defaultEcosystem
  ): T {
    const ecoDef = this.manifest.ecosystems[ecosystem];
    if (!ecoDef) {
      const known = Object.keys(this.manifest.ecosystems).join(', ');
      throw new Error(
        `Ecosystem '${ecosystem}' is not registered in the platform manifest. Known ecosystems: [${known}]. ` +
        `Register '${ecosystem}' in aetherflow.config.yaml under 'ecosystems'.`
      );
    }

    if (!ecoDef.enabled) {
      throw new Error(
        `Ecosystem '${ecosystem}' (${ecoDef.label}) is currently disabled in the platform manifest.`
      );
    }

    const providerId = ecoDef.providers[capability];
    if (!providerId) {
      let hint = `Configure a provider for '${capability}' in aetherflow.config.yaml under ecosystems.${ecosystem}.providers.`;
      if (ecosystem === 'sap-cpi') {
        hint = `Install '@aetherflow/plugin-btp-cpi' and register it in aetherflow.config.yaml.`;
      }
      throw new Error(
        `No provider registered for capability '${capability}' under ecosystem '${ecosystem}' (${ecoDef.label}). ${hint}`
      );
    }

    const instance = this.providerInstances.get(providerId);
    if (!instance) {
      throw new Error(
        `Provider implementation '${providerId}' for capability '${capability}' (${ecosystem}) is not loaded. ` +
        `Ensure the required plugin or module is initialized.`
      );
    }

    return instance as T;
  }

  /**
   * Validates prerequisite requirements for a module before execution.
   */
  public async validatePrerequisites(
    capability: ModuleCapability,
    ecosystem: PlatformEcosystem,
    context: ExecutionContext
  ): Promise<{ satisfied: boolean; missing: string[] }> {
    const providerId = this.resolveProviderId(capability, ecosystem);
    if (!providerId) {
      return {
        satisfied: false,
        missing: [`Provider for capability '${capability}' in ecosystem '${ecosystem}' is not registered`]
      };
    }

    const descriptor = this.moduleDescriptors.get(providerId);
    if (!descriptor || typeof descriptor.validatePrerequisites !== 'function') {
      // If no explicit validator, assume satisfied
      return { satisfied: true, missing: [] };
    }

    return descriptor.validatePrerequisites(context);
  }
}

import {
  extractSchemaFromPIPO,
  loadDefaultHostConfig,
  type HostConfig,
  type ExtractedSchemaResult
} from "./schema-extractor.js";
import {
  parseSchema,
  computeSchemaFieldStats,
  type SchemaTree,
  type SchemaFieldStats
} from "./schema-parser.js";
import { generateLayer1Xml, type Layer1Options } from "./layer1-generator.js";
import { generateLayer2Xml } from "./layer2-generator.js";
import {
  extractMappingRulesFromESR,
  type ExtractedMappingRules,
  type TargetFieldCardinality
} from "./mapping-rule-extractor.js";

export interface MappingTestOptions {
  hostConfig?: HostConfig;
  inventoryPath?: string;
  layer?: 1 | 2 | 3; // 1 = Schema only, 2 = Schema + Mapping AST, 3 = With Custom Overrides / Macros
  allOptional?: boolean; // Meta flag: true = populate all optional fields (default); false = minimal required fields only
  layerOptions?: Layer1Options;
  overrides?: Record<string, string>; // Layer 3 explicit field overrides (supports macros like {{rand_month}})
  rawSchemaOverride?: string; // Allows passing raw XSD/WSDL string directly for testing/offline use
}

export interface MappingTestPayloadResult {
  interfaceName: string;
  interfaceNamespace: string;
  rootElementName: string;
  xmlPayload: string;
  schemaTree: SchemaTree;
  extractedSchema: ExtractedSchemaResult | null;
  mappingRules: ExtractedMappingRules | null;
  activeLayer: 1 | 2 | 3;
  allOptional: boolean;
  fieldStats: SchemaFieldStats;
  appliedOverrides?: Record<string, string>;
  transitivelyMandatoryFields?: string[];
  targetCardinalities?: TargetFieldCardinality[];
}

/**
 * Generator sub-module for Mapping Test mode.
 * Takes an interface name, extracts its schema & mapping rules from PI/PO,
 * applies Layer 1 (Schema), Layer 2 (Mapping Dependencies), and Layer 3 (Macro Overrides),
 * and outputs valid XML ready for mapping injection.
 */
export async function generateMappingTestPayload(
  interfaceName: string,
  options: MappingTestOptions = {}
): Promise<MappingTestPayloadResult> {
  const hasOverrides = options.overrides && Object.keys(options.overrides).length > 0;
  const activeLayer = options.layer ?? (hasOverrides ? 3 : 2);
  const hostConfig = options.hostConfig || loadDefaultHostConfig();
  let rawSchemaXml: string;
  let extractedResult: ExtractedSchemaResult | null = null;
  let mappingRules: ExtractedMappingRules | null = null;

  if (options.rawSchemaOverride) {
    rawSchemaXml = options.rawSchemaOverride;
  } else {
    extractedResult = await extractSchemaFromPIPO(
      interfaceName,
      hostConfig,
      options.inventoryPath
    );
    rawSchemaXml = extractedResult.rawSchemaXml;

    // In Layer 2 and Layer 3, extract AST mapping rules from ESR
    if (activeLayer >= 2) {
      mappingRules = await extractMappingRulesFromESR(
        interfaceName,
        hostConfig,
        options.inventoryPath
      );
    }
  }

  // Parse schema into AST
  const schemaTree = parseSchema(rawSchemaXml);
  if (!schemaTree.targetNamespace && extractedResult?.interfaceNamespace) {
    schemaTree.targetNamespace = extractedResult.interfaceNamespace;
  }

  const allOptional = options.allOptional ?? options.layerOptions?.populateOptional ?? true;
  const mergedLayerOptions: Layer1Options = {
    ...options.layerOptions,
    populateOptional: allOptional
  };

  // Generate payload according to selected layer
  let xmlPayload: string;
  if (activeLayer === 1) {
    xmlPayload = generateLayer1Xml(schemaTree, mergedLayerOptions);
  } else {
    xmlPayload = generateLayer2Xml(schemaTree, {
      ...mergedLayerOptions,
      mappingRules,
      overrides: activeLayer === 3 ? options.overrides : undefined
    });
  }

  const fieldStats = computeSchemaFieldStats(schemaTree.rootNode);

  return {
    interfaceName: interfaceName || schemaTree.interfaceName || schemaTree.rootElementName,
    interfaceNamespace: schemaTree.targetNamespace || extractedResult?.interfaceNamespace || "",
    rootElementName: schemaTree.rootElementName,
    xmlPayload,
    schemaTree,
    extractedSchema: extractedResult,
    mappingRules,
    activeLayer,
    allOptional,
    fieldStats,
    appliedOverrides: options.overrides,
    transitivelyMandatoryFields: mappingRules?.transitivelyMandatorySourceFields,
    targetCardinalities: mappingRules?.targetCardinalities
  };
}

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export interface ScenarioCase {
  id?: string;
  name: string;
  interface: string;
  description?: string;
  layer?: 1 | 2 | 3;
  count?: number;
  allOptional?: boolean;
  overrides?: Record<string, string>;
  metadata?: {
    author?: string;
    createdAt?: string;
    tags?: string[];
    sanitized?: boolean;
  };
}

/**
 * Loads a scenario definition from a YAML or JSON file.
 */
export function loadScenario(filePath: string): ScenarioCase {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Scenario file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  const ext = path.extname(resolvedPath).toLowerCase();

  let parsed: any;
  if (ext === ".json") {
    parsed = JSON.parse(content);
  } else {
    parsed = YAML.parse(content);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid scenario file content in: ${resolvedPath}`);
  }

  if (!parsed.interface && !parsed.interfaceName) {
    throw new Error(`Scenario file must specify 'interface': ${resolvedPath}`);
  }

  return {
    id: parsed.id,
    name: parsed.name || path.basename(resolvedPath, ext),
    interface: parsed.interface || parsed.interfaceName,
    description: parsed.description,
    layer: parsed.layer ?? 3,
    count: parsed.count ?? 1,
    allOptional: parsed.allOptional !== undefined ? Boolean(parsed.allOptional) : true,
    overrides: parsed.overrides || {},
    metadata: parsed.metadata
  };
}

/**
 * Saves a scenario definition to a YAML or JSON file without exposing sensitive raw data.
 */
export function saveScenario(filePath: string, scenario: ScenarioCase): string {
  const resolvedPath = path.resolve(filePath);
  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  let content: string;

  const dataToSave = {
    name: scenario.name,
    interface: scenario.interface,
    description: scenario.description || `Automated test scenario for ${scenario.interface}`,
    layer: scenario.layer ?? 3,
    count: scenario.count ?? 1,
    allOptional: scenario.allOptional ?? false,
    overrides: scenario.overrides || {},
    metadata: {
      createdAt: scenario.metadata?.createdAt || new Date().toISOString(),
      sanitized: scenario.metadata?.sanitized ?? true,
      tags: scenario.metadata?.tags || ["automated-test", "aetherflow"],
      ...scenario.metadata
    }
  };

  if (ext === ".json") {
    content = JSON.stringify(dataToSave, null, 2);
  } else {
    content = YAML.stringify(dataToSave, { indent: 2 });
  }

  fs.writeFileSync(resolvedPath, content, "utf8");
  return resolvedPath;
}

/**
 * Sanitizes a dictionary of raw field overrides by replacing explicit production values
 * with dynamic generative macros or pattern masks to prevent confidential data leakage in save files.
 */
export function sanitizeOverrides(rawOverrides: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, rawVal] of Object.entries(rawOverrides)) {
    const val = String(rawVal).trim();

    // 1. If already a macro, preserve as is
    if (/^\{\{.*\}\}$/.test(val)) {
      sanitized[key] = val;
      continue;
    }

    // 2. Dates
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      sanitized[key] = "{{date:YYYY-MM-DD}}";
      continue;
    }
    // MM/DD/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      sanitized[key] = "{{date:MM/DD/YYYY}}";
      continue;
    }
    // YYYYMMDD
    if (/^\d{8}$/.test(val) && (key.toUpperCase().includes("DATE") || val.startsWith("20"))) {
      sanitized[key] = "{{date:YYYYMMDD}}";
      continue;
    }

    // 3. Monetary amounts / Decimals (e.g. 100.00, 2500.50)
    if (/^\d+\.\d{2}$/.test(val)) {
      const num = parseFloat(val);
      const min = Math.max(10, Math.floor(num * 0.5));
      const max = Math.ceil(num * 1.5);
      sanitized[key] = `{{rand_decimal:${min},${max},2}}`;
      continue;
    }

    // 4. Large ID numbers / Document numbers (e.g. 138100000531261)
    if (/^\d{6,}$/.test(val)) {
      const prefix = val.slice(0, Math.min(4, Math.floor(val.length / 2)));
      const mask = "#".repeat(val.length - prefix.length);
      sanitized[key] = `{{mask:${prefix}${mask}}}`;
      continue;
    }

    // 5. Preserved static discriminators (BEG, EOF, DAILY, etc.)
    sanitized[key] = val;
  }

  return sanitized;
}

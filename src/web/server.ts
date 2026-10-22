import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  generateMappingTestPayload,
  type MappingTestPayloadResult
} from "../generator/mapping-test-module.js";
import {
  parseSchema,
  computeSchemaFieldStats
} from "../generator/schema-parser.js";
import { generateLayer1Xml } from "../generator/layer1-generator.js";
import { generateLayer2Xml } from "../generator/layer2-generator.js";
import {
  loadScenario,
  saveScenario,
  sanitizeOverrides,
  type ScenarioCase
} from "../generator/scenario-manager.js";
import { generateFileFromSpec } from "../generator/file-generator.js";
import { dacApInvoiceSpec } from "../generator/specs/dac-ap-invoice.js";
import { lazadaArReceiptSpec } from "../generator/specs/lazada-ar-receipt.js";
import { validateDacApInvoiceCompliance } from "../generator/compliance-validator.js";
import { convertCsvToPostFccXml } from "../generator/wsdl-parser.js";
import { loadInventory, filterEndpoints } from "../discovery/inventory-loader.js";
import { discoverEndpoints } from "../discovery/endpoint-generator.js";
import { canonicalDiff } from "../verifier/canonical-diff.js";
import {
  getOfflineSnapshot,
  SM_RETAIL_DEMO_INVENTORY,
  PARITY_DEMO_PRESETS
} from "./demo-snapshots.js";
import { renderCockpitHtml } from "./ui-template.js";

export interface WebServerOptions {
  port?: number;
  host?: string;
}

const DEFAULT_HOSTS = [
  {
    id: "spd100",
    label: "SPD — SAP PI/PO Development (sapipo2.smretailinc.com)",
    host: "sapipo2.smretailinc.com",
    port: 50000,
    https: false,
    context: "Active"
  },
  {
    id: "spq100",
    label: "SPQ — SAP PI/PO Quality Assurance",
    host: "sapipoq.smretailinc.com",
    port: 50000,
    https: false,
    context: "Active"
  },
  {
    id: "cpi-dev",
    label: "SAP BTP Integration Suite — Cloud Integration [Planned — Phase 2]",
    host: "smretail-dev.it-cpi001.cfapps.ap10.hana.ondemand.com",
    port: 443,
    https: true,
    context: "Planned",
    disabled: true
  }
];

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function listScenarioFiles(): Array<{ filename: string; path: string; scenario: ScenarioCase }> {
  const scenariosDir = path.resolve(process.cwd(), "testbed/scenarios");
  if (!fs.existsSync(scenariosDir)) return [];
  const files = fs.readdirSync(scenariosDir).filter(
    (f) => f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json")
  );
  const results: Array<{ filename: string; path: string; scenario: ScenarioCase }> = [];
  for (const file of files) {
    try {
      const fullPath = path.join(scenariosDir, file);
      const scenario = loadScenario(fullPath);
      results.push({
        filename: file,
        path: `testbed/scenarios/${file}`,
        scenario
      });
    } catch {
      // Skip malformed scenario files
    }
  }
  return results;
}

function listInventories(): Array<{
  id: string;
  filename: string;
  hostLabel: string;
  extractedAt: string;
  icoCount: number;
  channelCount: number;
  sapUser: string;
}> {
  const list: Array<{
    id: string;
    filename: string;
    hostLabel: string;
    extractedAt: string;
    icoCount: number;
    channelCount: number;
    sapUser: string;
  }> = [
    {
      id: "spd100-smretail-snapshot",
      filename: "spd100-smretail-snapshot",
      hostLabel: SM_RETAIL_DEMO_INVENTORY._meta.hostLabel,
      extractedAt: SM_RETAIL_DEMO_INVENTORY._meta.extractedAt,
      icoCount: SM_RETAIL_DEMO_INVENTORY._meta.icoCount,
      channelCount: SM_RETAIL_DEMO_INVENTORY._meta.channelCount,
      sapUser: SM_RETAIL_DEMO_INVENTORY._meta.sapUser
    }
  ];

  const invDir = path.resolve(process.cwd(), "inventories");
  if (fs.existsSync(invDir)) {
    const files = fs.readdirSync(invDir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(invDir, f), "utf8"));
        const id = raw._meta?.id || f.replace(/\.json$/, "");
        if (!list.some((item) => item.id === id)) {
          list.push({
            id: f,
            filename: f,
            hostLabel: raw._meta?.hostLabel || f,
            extractedAt: raw._meta?.extractedAt || new Date().toISOString(),
            icoCount: raw._meta?.icoCount ?? (raw.integratedConfigurations?.length || 0),
            channelCount: raw._meta?.channelCount ?? (raw.communicationChannels?.length || 0),
            sapUser: raw._meta?.sapUser || "system"
          });
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }
  return list;
}

function buildInterfaceIndex(inventory: any): Array<{
  id: string;
  label: string;
  sender: string;
  receiver: string;
  namespace: string;
  qos: string;
  mapping?: string;
}> {
  const icos = inventory?.integratedConfigurations || [];
  const seen = new Set<string>();
  const index: Array<{
    id: string;
    label: string;
    sender: string;
    receiver: string;
    namespace: string;
    qos: string;
    mapping?: string;
  }> = [];

  for (const ico of icos) {
    const idObj = ico.IntegratedConfigurationID || {};
    const name = idObj.InterfaceName;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const ri = ico.ReceiverInterfaces?.[0] || {};
    index.push({
      id: name,
      label: name,
      sender: idObj.SenderComponentID || "",
      receiver: ri.Receiver?.ComponentID || idObj.ReceiverComponentID || "",
      namespace: idObj.InterfaceNamespace || "",
      qos: ri.QualityOfService || "EO",
      mapping: ri.ReceiverInterfaceRule?.Mapping?.Name
    });
  }
  return index;
}

async function resolveInventoryById(idOrFilename: string): Promise<any> {
  if (!idOrFilename || idOrFilename === "spd100-smretail-snapshot") {
    return SM_RETAIL_DEMO_INVENTORY;
  }
  return loadInventory(idOrFilename);
}

export async function generateMappingWithFallback(params: {
  interfaceName: string;
  layer?: 1 | 2 | 3;
  count?: number;
  allOptional?: boolean;
  overrides?: Record<string, string>;
  connectionMode?: "auto" | "offline" | "live";
}): Promise<MappingTestPayloadResult & { sourceMode: "live-esr" | "offline-snapshot" }> {
  const {
    interfaceName,
    layer,
    count = 3,
    allOptional = false,
    overrides = {},
    connectionMode = "auto"
  } = params;

  const hasOverrides = Object.keys(overrides).length > 0;
  const activeLayer: 1 | 2 | 3 = layer ?? (hasOverrides ? 3 : 2);

  if (connectionMode !== "offline") {
    try {
      const livePromise = generateMappingTestPayload(interfaceName, {
        layer: activeLayer,
        allOptional,
        overrides,
        layerOptions: { repeatCount: count }
      });

      const timeoutMs = connectionMode === "auto" ? 2500 : 15000;
      const result = await Promise.race([
        livePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("ESR connection timeout")), timeoutMs)
        )
      ]);

      return {
        ...result,
        sourceMode: "live-esr"
      };
    } catch (err) {
      if (connectionMode === "live") {
        throw err;
      }
    }
  }

  const snapshot = getOfflineSnapshot(interfaceName);
  if (!snapshot) {
    throw new Error(
      `No offline snapshot found for interface "${interfaceName}" and live SAP PO ESR is unreachable.`
    );
  }

  const schemaTree = parseSchema(snapshot.extractedSchema.rawSchemaXml);
  if (!schemaTree.targetNamespace && snapshot.extractedSchema.interfaceNamespace) {
    schemaTree.targetNamespace = snapshot.extractedSchema.interfaceNamespace;
  }

  const mappingRules = activeLayer >= 2 ? snapshot.mappingRules : null;
  const xmlPayload =
    activeLayer === 1
      ? generateLayer1Xml(schemaTree, { repeatCount: count, populateOptional: allOptional })
      : generateLayer2Xml(schemaTree, {
          repeatCount: count,
          populateOptional: allOptional,
          mappingRules,
          overrides: activeLayer === 3 ? overrides : undefined
        });

  const fieldStats = computeSchemaFieldStats(schemaTree.rootNode);

  return {
    interfaceName: snapshot.extractedSchema.interfaceName,
    interfaceNamespace: snapshot.extractedSchema.interfaceNamespace,
    rootElementName: schemaTree.rootElementName,
    xmlPayload,
    schemaTree,
    extractedSchema: snapshot.extractedSchema,
    mappingRules,
    activeLayer,
    allOptional,
    fieldStats,
    appliedOverrides: activeLayer === 3 ? overrides : undefined,
    transitivelyMandatoryFields: mappingRules?.transitivelyMandatorySourceFields,
    targetCardinalities: mappingRules?.targetCardinalities,
    sourceMode: "offline-snapshot"
  };
}

export function createCockpitServer(): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = url.pathname;

      if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        const html = renderCockpitHtml();
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && pathname === "/api/status") {
        sendJson(res, 200, {
          status: "ok",
          version: "1.0.0",
          hosts: DEFAULT_HOSTS,
          safetyFence: {
            nonProductionDefault: true,
            zeroPiiSanitizerActive: true,
            credentialMaskingActive: true
          },
          interfaces: buildInterfaceIndex(SM_RETAIL_DEMO_INVENTORY),
          scenarios: listScenarioFiles(),
          inventories: listInventories(),
          parityPresets: PARITY_DEMO_PRESETS
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/inventories") {
        const id = url.searchParams.get("id") || "spd100-smretail-snapshot";
        const inventory = await resolveInventoryById(id);
        const endpoints = discoverEndpoints(inventory as any);
        sendJson(res, 200, {
          inventory,
          endpoints,
          inventories: listInventories()
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/extract") {
        const body = await readJsonBody(req);
        const hostId = body.hostId || "spd100";
        const sapUser = body.user || "cpc9181";
        const extractIcos = body.extractIcos !== false;
        const extractChannels = body.extractChannels !== false;
        const hostInfo = DEFAULT_HOSTS.find((h) => h.id === hostId) || DEFAULT_HOSTS[0]!;

        const logs: string[] = [
          `Connecting to ${hostInfo.host}:${hostInfo.port} as ${sapUser}...`,
          `Testing SOAP Directory API connectivity (ReadContext: Active)...`
        ];

        if (extractIcos) {
          logs.push(
            `Querying IntegratedConfigurationInService... found ${SM_RETAIL_DEMO_INVENTORY._meta.icoCount} ICO IDs.`,
            `Reading ICO details in batches (batchSize: 50)... ${SM_RETAIL_DEMO_INVENTORY._meta.icoCount}/${SM_RETAIL_DEMO_INVENTORY._meta.icoCount} read.`
          );
        }
        if (extractChannels) {
          logs.push(
            `Querying CommunicationChannelInService... found ${SM_RETAIL_DEMO_INVENTORY._meta.channelCount} Channel IDs.`,
            `Reading Communication Channel details... ${SM_RETAIL_DEMO_INVENTORY._meta.channelCount}/${SM_RETAIL_DEMO_INVENTORY._meta.channelCount} read.`
          );
        }
        logs.push(`Saved environment snapshot "${SM_RETAIL_DEMO_INVENTORY._meta.id}".`);

        sendJson(res, 200, {
          ok: true,
          inventoryId: "spd100-smretail-snapshot",
          hostLabel: hostInfo.label,
          logs,
          inventory: SM_RETAIL_DEMO_INVENTORY
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/scenarios") {
        sendJson(res, 200, { scenarios: listScenarioFiles() });
        return;
      }

      if (req.method === "POST" && pathname === "/api/scenarios/sanitize") {
        const body = await readJsonBody(req);
        const rawOverrides = body.overrides || {};
        const sanitized = sanitizeOverrides(rawOverrides);
        sendJson(res, 200, { rawOverrides, sanitizedOverrides: sanitized });
        return;
      }

      if (req.method === "POST" && pathname === "/api/scenarios/save") {
        const body = await readJsonBody(req);
        const rawFilename = String(body.filename || "custom-scenario.scenario.yaml").replace(
          /[^a-zA-Z0-9._-]/g,
          "-"
        );
        const targetPath = path.join(
          "testbed/scenarios",
          rawFilename.endsWith(".yaml") ? rawFilename : `${rawFilename}.scenario.yaml`
        );
        const scenarioToSave: ScenarioCase = {
          name: body.name || `${body.interface || "Custom"} Test Scenario`,
          interface: body.interface || "I001_DAC_AP_Invoice_Out_Async",
          description:
            body.description || "Sanitized test scenario generated from AetherFlow Web UI",
          layer: body.layer || 3,
          count: Number(body.count || 3),
          allOptional: Boolean(body.allOptional),
          overrides: sanitizeOverrides(body.overrides || {})
        };
        const savedPath = saveScenario(targetPath, scenarioToSave);
        sendJson(res, 200, {
          savedPath,
          scenario: scenarioToSave,
          scenarios: listScenarioFiles()
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/generate-mapping") {
        const body = await readJsonBody(req);
        const interfaceName = body.interfaceName || "I001_DAC_AP_Invoice_Out_Async";
        const layer = body.layer ? (Number(body.layer) as 1 | 2 | 3) : undefined;
        const count = body.count !== undefined ? Number(body.count) : 3;
        const allOptional = Boolean(body.allOptional);
        const overrides = body.overrides || {};
        const connectionMode = body.connectionMode || "auto";

        const result = await generateMappingWithFallback({
          interfaceName,
          layer,
          count,
          allOptional,
          overrides,
          connectionMode
        });

        let savedFilePath: string | undefined;
        if (body.saveToDisk) {
          const outDir = path.resolve(process.cwd(), "testbed/generated");
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }
          savedFilePath = path.join(outDir, `${result.interfaceName}.mapping-test.xml`);
          fs.writeFileSync(savedFilePath, result.xmlPayload, "utf8");
        }

        sendJson(res, 200, {
          interfaceName: result.interfaceName,
          interfaceNamespace: result.interfaceNamespace,
          rootElementName: result.rootElementName,
          xmlPayload: result.xmlPayload,
          activeLayer: result.activeLayer,
          allOptional: result.allOptional,
          fieldStats: result.fieldStats,
          mappingRules: result.mappingRules,
          transitivelyMandatoryFields: result.transitivelyMandatoryFields || [],
          targetCardinalities: result.targetCardinalities || [],
          appliedOverrides: result.appliedOverrides || {},
          sourceMode: result.sourceMode,
          savedFilePath
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/generate-file") {
        const body = await readJsonBody(req);
        const specKey = String(body.spec || "dac-ap-invoice").toLowerCase();
        const count = Number(body.count || 3);
        const isLazada = specKey.includes("lazada") || specKey.includes("i025");
        const spec = isLazada ? lazadaArReceiptSpec : dacApInvoiceSpec;

        const filename = body.filename || spec.name || `${spec.id}.csv`;
        const overrides: Record<string, any> = {};
        if (body.batchDate && !isLazada) {
          overrides.BEG = { BATCH_DATE: String(body.batchDate) };
        }

        const genResult = generateFileFromSpec(spec, {
          filename,
          date: body.date ? new Date(body.date) : new Date(),
          detailCount: count,
          overrides
        });

        const detailRecordset =
          spec.recordsets.find((r) => r.role === "detail") ||
          spec.recordsets[spec.recordsets.length - 1];
        const detailFields = detailRecordset?.fields.map((f) => f.name) || [];

        const postFccXml = convertCsvToPostFccXml(genResult.content, {
          rootElementName: isLazada ? "MT_AR_LazadaStdReceipt" : "I001_DAC_AP_Invoice_Out",
          targetNamespace: isLazada
            ? "http://smretail.com/xi/SMRI/Lazada/FI/I025"
            : "http://smretail.com/xi/SMRI/S4HANA/FI",
          recordsetWrapperName: isLazada ? undefined : "I001_AP_INVOICE",
          itemElementName: isLazada ? "Record" : "AP_INVOICE",
          fieldNames: detailFields,
          skipHeaderRow: isLazada
        });

        const compliance = !isLazada
          ? validateDacApInvoiceCompliance(genResult.content, filename)
          : {
              compliant: true,
              errors: [],
              details: {
                lineCount: genResult.lineCount,
                recordCounts: genResult.recordCounts
              }
            };

        sendJson(res, 200, {
          specId: spec.id,
          specName: spec.name,
          filename: genResult.filename,
          flatFileContent: genResult.content,
          postFccXml,
          lineCount: genResult.lineCount,
          recordCounts: genResult.recordCounts,
          compliance
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/discover") {
        const invName = url.searchParams.get("inventory") || "sample-inventory.json";
        const q = url.searchParams.get("filter") || undefined;
        const qos = (url.searchParams.get("qos") as "EO" | "BE" | undefined) || undefined;

        const inventory = await loadInventory(invName);
        const allEndpoints = discoverEndpoints(inventory);
        const endpoints = filterEndpoints(allEndpoints, {
          interfaceName: q,
          qos: qos || undefined
        });

        sendJson(res, 200, {
          meta: inventory._meta,
          summary: inventory.summary,
          totalDiscovered: allEndpoints.length,
          filteredCount: endpoints.length,
          endpoints
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/parity-diff") {
        const body = await readJsonBody(req);
        const payloadA = String(body.payloadA || "");
        const payloadB = String(body.payloadB || "");
        const ignorePaths = Array.isArray(body.ignorePaths)
          ? body.ignorePaths
          : String(body.ignorePaths || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);

        const diffResult = canonicalDiff(payloadA, payloadB, {
          ignorePaths,
          normalizeNamespaces: body.normalizeNamespaces !== false,
          ignoreWhitespace: true
        });

        sendJson(res, 200, diffResult);
        return;
      }

      sendJson(res, 404, { error: `Not Found: ${pathname}` });
    } catch (err: any) {
      sendJson(res, 500, { error: err?.message || "Internal Server Error" });
    }
  });
}

export async function startCockpitServer(options: WebServerOptions = {}): Promise<{
  server: http.Server;
  url: string;
  port: number;
}> {
  const port = options.port ?? 4300;
  const host = options.host ?? "127.0.0.1";
  const server = createCockpitServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        server,
        port: actualPort,
        url: `http://${host}:${actualPort}`
      });
    });
  });
}

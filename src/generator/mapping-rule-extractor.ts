import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { request } from "undici";
import {
  loadDefaultHostConfig,
  lookupInterfaceInInventory,
  type HostConfig
} from "./schema-extractor.js";
import {
  parseSchema,
  type SchemaNode,
  type SchemaTree
} from "./schema-parser.js";

export interface MappingConditionRule {
  targetPath: string;
  srcField: string;
  expectedValue: string;
  role: "header" | "trailer" | "field";
}

export interface TargetFieldCardinality {
  targetPath: string;
  targetField: string;
  minOccurs: number;
  maxOccurs: number | "unbounded";
  isMandatory: boolean;
  mappedSourceFields: string[];
}

export interface ExtractedMappingRules {
  mappingName: string;
  mappingNamespace: string;
  targetMessageName?: string;
  targetMessageNamespace?: string;
  rules: MappingConditionRule[];
  headerOverrides: Record<string, string>;
  trailerOverrides: Record<string, string>;
  fieldOverrides: Record<string, string>;
  headerFieldTargets?: Record<string, string>;
  trailerFieldTargets?: Record<string, string>;
  targetCardinalities?: TargetFieldCardinality[];
  transitivelyMandatorySourceFields?: string[];
  headerMandatorySourceFields?: string[];
  trailerMandatorySourceFields?: string[];
  detailMandatorySourceFields?: string[];
}

/**
 * Traverses an AST brick and its nested arguments to find equality conditions
 */
function walkBrick(node: any, targetPath: string, collector: MappingConditionRule[]): void {
  if (!node || typeof node !== "object") return;

  if (node["@_fname"] === "stringEquals" || node["@_fname"] === "equals") {
    const rawArgs = node.arg || [];
    const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
    let srcField = "";
    let expectedValue = "";

    for (const a of args) {
      const b = a.brick || a;
      if (b["@_type"] === "Src" && b["@_path"]) {
        srcField = b["@_path"].split("/").pop() || "";
      }
      if (b["@_fname"] === "const" && b.bindings?.param?.value !== undefined) {
        expectedValue = String(b.bindings.param.value);
      }
      // Check nested wrappers like collapseContexts -> removeContexts -> Src
      const bStr = JSON.stringify(b);
      const srcMatch = bStr.match(/"@_type":"Src","@_gid":"0","@_path":"([^"]+)"/);
      if (srcMatch && !srcField && srcMatch[1]) {
        srcField = srcMatch[1].split("/").pop() || "";
      }
    }

    if (srcField && expectedValue) {
      const upperPath = targetPath.toUpperCase();
      let role: "header" | "trailer" | "field" = "field";
      if (upperPath.includes("/BEG") || upperPath.includes("/HEADER")) {
        role = "header";
      } else if (upperPath.includes("/EOF") || upperPath.includes("/TRAILER")) {
        role = "trailer";
      }

      // Avoid duplicates
      const exists = collector.some(
        (r) => r.srcField === srcField && r.expectedValue === expectedValue && r.role === role
      );
      if (!exists) {
        collector.push({ targetPath, srcField, expectedValue, role });
      }
    }
  }

  for (const k of Object.keys(node)) {
    if (k !== "@_path" && typeof node[k] === "object") {
      walkBrick(node[k], targetPath, collector);
    }
  }
}

/**
 * Fetches the target XSD schema from ESR by querying ifmtypedef, ifmmessage, or ifmextdef
 */
async function fetchTargetSchema(
  targetName: string,
  targetNs: string,
  swcGuid: string,
  baseUrl: string,
  authHeader: string
): Promise<SchemaTree | null> {
  const key = encodeURIComponent(`${targetName}|${targetNs}`);

  // 1. Try ifmtypedef directly
  try {
    const tdUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=ifmtypedef&KEY=${key}&VC=SWC&SWCGUID=${swcGuid}&SP=-1&UC=false&release=7.0`;
    const tdRes = await request(tdUrl, { headers: { Authorization: authHeader } });
    if (tdRes.statusCode === 200) {
      const text = await tdRes.body.text();
      const schemaMatch = text.match(/<xsd:schema[\s\S]*?<\/xsd:schema>/);
      if (schemaMatch) return parseSchema(schemaMatch[0]);
    }
  } catch {}

  // 2. Try ifmmessage -> look for TYPE lnkRole -> ifmtypedef or ifmextdef
  try {
    const msgUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=ifmmessage&KEY=${key}&VC=SWC&SWCGUID=${swcGuid}&SP=-1&UC=false&release=7.0`;
    const msgRes = await request(msgUrl, { headers: { Authorization: authHeader } });
    if (msgRes.statusCode === 200) {
      const text = await msgRes.body.text();
      const lnkMatch = text.match(/<p1:lnkRole role="TYPE"[^>]*>([\s\S]*?)<\/p1:lnkRole>/);
      if (lnkMatch && lnkMatch[1]) {
        const typeMatch = lnkMatch[1].match(/typeID="([^"]+)"/);
        const typeID = typeMatch ? typeMatch[1] : "ifmtypedef";
        const elems = [...lnkMatch[1].matchAll(/<p1:elem>(.*?)<\/p1:elem>/g)].map((m) => m[1] || "");
        if (elems[0] && elems[1]) {
          const dtKey = encodeURIComponent(`${elems[0]}|${elems[1]}`);
          const dtUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=${typeID}&KEY=${dtKey}&VC=SWC&SWCGUID=${swcGuid}&SP=-1&UC=false&release=7.0`;
          const dtRes = await request(dtUrl, { headers: { Authorization: authHeader } });
          if (dtRes.statusCode === 200) {
            const dtText = await dtRes.body.text();
            const schemaMatch = dtText.match(/<xsd:schema[\s\S]*?<\/xsd:schema>/);
            if (schemaMatch) return parseSchema(schemaMatch[0]);
          }
        }
      }
    }
  } catch {}

  // 3. Try ifmextdef
  try {
    const extUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=ifmextdef&KEY=${key}&VC=SWC&SWCGUID=${swcGuid}&SP=-1&UC=false&release=7.0`;
    const extRes = await request(extUrl, { headers: { Authorization: authHeader } });
    if (extRes.statusCode === 200) {
      const text = await extRes.body.text();
      const schemaMatch = text.match(/<xsd:schema[\s\S]*?<\/xsd:schema>/);
      if (schemaMatch) return parseSchema(schemaMatch[0]);
    }
  } catch {}

  return null;
}

/**
 * Extracts AST mapping rules programmatically from SAP PO ESR
 */
export async function extractMappingRulesFromESR(
  interfaceName: string,
  hostConfig: HostConfig = loadDefaultHostConfig(),
  inventoryPath?: string
): Promise<ExtractedMappingRules | null> {
  const meta = lookupInterfaceInInventory(interfaceName, inventoryPath);
  if (!meta?.operationMapping || !meta.operationMappingNamespace || !meta.swcGuid) {
    return null;
  }

  const protocol = hostConfig.https ? "https" : "http";
  const baseUrl = `${protocol}://${hostConfig.host}:${hostConfig.port}`;
  const authHeader = "Basic " + Buffer.from(`${hostConfig.user}:${hostConfig.password}`).toString("base64");

  // Step 1: Query Operation Mapping to find Message Mapping (REQUEST_TRAFO)
  const omKey = encodeURIComponent(`${meta.operationMapping}|${meta.operationMappingNamespace}`);
  const omUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=MAPPING&KEY=${omKey}&VC=SWC&SWCGUID=${meta.swcGuid}&SP=-1&UC=false&release=7.0`;

  let mmName = "";
  let mmNs = "";
  let omXml = "";

  try {
    const omRes = await request(omUrl, { headers: { Authorization: authHeader } });
    if (omRes.statusCode !== 200) return null;
    omXml = await omRes.body.text();

    const trafoMatches = [...omXml.matchAll(/<p1:lnkRole role="REQUEST_TRAFO"[^>]*>([\s\S]*?)<\/p1:lnkRole>/g)];
    if (trafoMatches.length === 0) return null;

    // Find the Message Mapping (typeID="XI_TRAFO")
    const xiTrafoMatch = trafoMatches.find((t) => (t[1] || "").includes('typeID="XI_TRAFO"')) || trafoMatches[0];
    const trafoBlock = xiTrafoMatch?.[1] || "";
    const elems = [...trafoBlock.matchAll(/<p1:elem>(.*?)<\/p1:elem>/g)].map((m) => m[1] || "");
    mmName = elems[0] || "";
    mmNs = elems[1] || "";
  } catch {
    return null;
  }

  if (!mmName || !mmNs) return null;

  // Step 2: Query Message Mapping (TYPE=XI_TRAFO)
  const mmKey = encodeURIComponent(`${mmName}|${mmNs}`);
  const mmUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=XI_TRAFO&KEY=${mmKey}&VC=SWC&SWCGUID=${meta.swcGuid}&SP=-1&UC=false&release=7.0`;

  try {
    const mmRes = await request(mmUrl, { headers: { Authorization: authHeader } });
    if (mmRes.statusCode !== 200) return null;
    const mmXml = await mmRes.body.text();

    // Step 3: Extract and unzip the metadata blob
    const match = mmXml.match(/<tr:MetaData><tr:blob[^>]*>!zip!([\s\S]*?)<\/tr:blob>/);
    if (!match || !match[1]) return null;

    const zip1Buf = Buffer.from(match[1].trim(), "base64");
    const zip1 = new AdmZip(zip1Buf);
    const firstEntry = zip1.getEntries()[0];
    if (!firstEntry) return null;

    const zip2 = new AdmZip(firstEntry.getData());
    const metadataText = zip2.readAsText("metadata");
    if (!metadataText) return null;

    // Step 4: Parse AST bricks in mappingtool
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(metadataText);
    const bricks = parsed.mappingtool?.project?.transformation?.brick || [];
    const bricksList = Array.isArray(bricks) ? bricks : [bricks];

    const rules: MappingConditionRule[] = [];
    for (const b of bricksList) {
      const targetPath = b["@_path"] || "";
      walkBrick(b, targetPath, rules);
    }

    const headerOverrides: Record<string, string> = {};
    const trailerOverrides: Record<string, string> = {};
    const fieldOverrides: Record<string, string> = {};
    const headerDiscriminators = new Set<string>();
    const trailerDiscriminators = new Set<string>();

    for (const r of rules) {
      if (r.role === "header") {
        headerOverrides[r.srcField] = r.expectedValue;
        headerDiscriminators.add(r.srcField);
      } else if (r.role === "trailer") {
        trailerOverrides[r.srcField] = r.expectedValue;
        trailerDiscriminators.add(r.srcField);
      } else {
        fieldOverrides[r.srcField] = r.expectedValue;
      }
    }

    function getSourceLeaves(node: any, res: string[] = []): string[] {
      if (!node || typeof node !== "object") return res;
      if (node["@_type"] === "Src" && node["@_path"]) {
        const f = node["@_path"].split("/").pop();
        if (f && !res.includes(f)) res.push(f);
      }
      for (const k of Object.keys(node)) {
        getSourceLeaves(node[k], res);
      }
      return res;
    }

    const headerFieldTargets: Record<string, string> = {};
    const trailerFieldTargets: Record<string, string> = {};

    // Step 5: Discover mapped header and trailer fields feeding into target mandatory structures
    for (const b of bricksList) {
      const targetPath = b["@_path"] || "";
      const upperPath = targetPath.toUpperCase();
      const isHdr = upperPath.includes("/BEG/") || upperPath.includes("/HEADER/");
      const isTrl = upperPath.includes("/EOF/") || upperPath.includes("/TRAILER/");
      if (!isHdr && !isTrl) continue;

      const sources = getSourceLeaves(b);
      const targetLeaf = targetPath.split("/").pop() || "";
      if (!targetLeaf || targetLeaf === "BEG" || targetLeaf === "EOF") continue;

      if (isHdr) {
        const valueSources = sources.filter((s) => !headerDiscriminators.has(s));
        for (const s of valueSources) {
          headerFieldTargets[targetLeaf] = s;
          if (headerOverrides[s] === undefined) {
            const tUpper = targetLeaf.toUpperCase();
            if (tUpper.includes("VERSION")) headerOverrides[s] = "1.0";
            else if (tUpper.includes("FREQUENCY")) headerOverrides[s] = "DAILY";
            else if (tUpper.includes("FILE")) headerOverrides[s] = "INVOICE.TXT";
            else if (tUpper.includes("DATE")) headerOverrides[s] = "{{date:YYYYMMDD}}";
            else headerOverrides[s] = `HEADER_${targetLeaf}`;
          }
        }
      }

      if (isTrl) {
        const valueSources = sources.filter((s) => !trailerDiscriminators.has(s));
        for (const s of valueSources) {
          trailerFieldTargets[targetLeaf] = s;
          if (trailerOverrides[s] === undefined) {
            const tUpper = targetLeaf.toUpperCase();
            if (tUpper.includes("COUNT")) trailerOverrides[s] = "{{count}}";
            else if (tUpper.includes("AMOUNT") || tUpper.includes("TOTAL") || tUpper.includes("SUM")) trailerOverrides[s] = "100.00";
            else if (tUpper.includes("DATE")) trailerOverrides[s] = "{{date:YYYYMMDD}}";
            else trailerOverrides[s] = `TRAILER_${targetLeaf}`;
          }
        }
      }
    }

    // Step 6: Target Schema Inspection & Transitive Mandatory Cardinality Analysis
    let targetMsgName = "";
    let targetMsgNs = "";
    const tgtMatch = mmXml.match(/<[^>]*lnkRole[^>]*role="TARGET_IFR_MESS"[^>]*>([\s\S]*?)<\/[^>]*lnkRole>/);
    if (tgtMatch && tgtMatch[1]) {
      const elems = [...tgtMatch[1].matchAll(/<p1:elem>(.*?)<\/p1:elem>/g)].map((m) => m[1] || "");
      targetMsgName = elems[0] || "";
      targetMsgNs = elems[1] || "";
    } else {
      const omTgtMatch = omXml.match(/<[^>]*lnkRole[^>]*role="REQUEST_IN_MES"[^>]*>([\s\S]*?)<\/[^>]*lnkRole>/);
      if (omTgtMatch && omTgtMatch[1]) {
        const elems = [...omTgtMatch[1].matchAll(/<p1:elem>(.*?)<\/p1:elem>/g)].map((m) => m[1] || "");
        targetMsgName = elems[0] || "";
        targetMsgNs = elems[1] || "";
      }
    }

    const targetCardinalities: TargetFieldCardinality[] = [];
    const headerMandatorySet = new Set<string>();
    const trailerMandatorySet = new Set<string>();
    const detailMandatorySet = new Set<string>();
    const transitivelyMandatorySet = new Set<string>();

    if (targetMsgName && targetMsgNs) {
      const targetSchemaTree = await fetchTargetSchema(
        targetMsgName,
        targetMsgNs,
        meta.swcGuid,
        baseUrl,
        authHeader
      );

      if (targetSchemaTree) {
        // Index all nodes in target schema tree
        const schemaNodes = new Map<string, { minOccurs: number; maxOccurs: number | "unbounded"; name: string }>();
        function indexNodes(n: SchemaNode, currentPath: string = "") {
          const fullPath = currentPath ? `${currentPath}/${n.name}` : `/${n.name}`;
          schemaNodes.set(fullPath, { minOccurs: n.minOccurs, maxOccurs: n.maxOccurs, name: n.name });
          if (n.type === "complex" && n.children) {
            for (const c of n.children) {
              indexNodes(c, fullPath);
            }
          }
        }
        indexNodes(targetSchemaTree.rootNode);

        for (const b of bricksList) {
          const rawPath = b["@_path"] || "";
          const cleanPath = rawPath.replace(/\/([a-zA-Z0-9_]+:)/g, "/");
          const subPath = cleanPath.split("/").slice(2).join("/"); // skip root
          const leaf = cleanPath.split("/").pop() || "";
          if (!leaf) continue;

          // Match against schema nodes
          let matchedInfo: { minOccurs: number; maxOccurs: number | "unbounded"; name: string } | null = null;
          for (const [sPath, sInfo] of schemaNodes.entries()) {
            if (sPath === cleanPath || (subPath && sPath.endsWith(subPath))) {
              matchedInfo = sInfo;
              break;
            }
          }

          if (matchedInfo) {
            const sources = getSourceLeaves(b);
            const isMandatory = matchedInfo.minOccurs >= 1;
            targetCardinalities.push({
              targetPath: cleanPath,
              targetField: leaf,
              minOccurs: matchedInfo.minOccurs,
              maxOccurs: matchedInfo.maxOccurs,
              isMandatory,
              mappedSourceFields: sources
            });

            if (isMandatory) {
              const upper = cleanPath.toUpperCase();
              const isHdr = upper.includes("/BEG/") || upper.includes("/HEADER/");
              const isTrl = upper.includes("/EOF/") || upper.includes("/TRAILER/");

              for (const s of sources) {
                transitivelyMandatorySet.add(s);
                if (isHdr) {
                  headerMandatorySet.add(s);
                } else if (isTrl) {
                  trailerMandatorySet.add(s);
                } else {
                  detailMandatorySet.add(s);
                }
              }
            }
          }
        }
      }
    }

    return {
      mappingName: mmName,
      mappingNamespace: mmNs,
      targetMessageName: targetMsgName || undefined,
      targetMessageNamespace: targetMsgNs || undefined,
      rules,
      headerOverrides,
      trailerOverrides,
      fieldOverrides,
      headerFieldTargets,
      trailerFieldTargets,
      targetCardinalities,
      transitivelyMandatorySourceFields: Array.from(transitivelyMandatorySet),
      headerMandatorySourceFields: Array.from(headerMandatorySet),
      trailerMandatorySourceFields: Array.from(trailerMandatorySet),
      detailMandatorySourceFields: Array.from(detailMandatorySet)
    };
  } catch {
    return null;
  }
}

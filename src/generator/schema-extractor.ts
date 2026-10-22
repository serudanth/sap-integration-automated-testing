import fs from "node:fs";
import path from "node:path";
import { request } from "undici";

export interface HostConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  https?: boolean;
}

export interface ExtractedSchemaResult {
  interfaceName: string;
  interfaceNamespace: string;
  rootElementName: string;
  rawSchemaXml: string;
  schemaType: "wsdl" | "xsd";
  swcGuid?: string;
  operationMapping?: string;
}

/**
 * Loads credentials from .cred/.spd or environment
 */
export function loadDefaultHostConfig(): HostConfig {
  let user = process.env.SAP_PO_USER || "cpc9181";
  let password = process.env.SAP_PO_PASSWORD || "";

  const credPath = path.resolve(process.cwd(), ".cred/.spd");
  if (!password && fs.existsSync(credPath)) {
    const lines = fs.readFileSync(credPath, "utf8").trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && lines[0] !== undefined && lines[1] !== undefined) {
      user = lines[0];
      password = lines[1];
    }
  }

  return {
    host: process.env.SAP_PO_HOST || "sapipo2.smretailinc.com",
    port: Number(process.env.SAP_PO_PORT || 50000),
    user,
    password,
    https: process.env.SAP_PO_HTTPS === "true"
  };
}

/**
 * Finds interface details from the local ICO inventory
 */
export function lookupInterfaceInInventory(
  interfaceName: string,
  inventoryPath?: string
): {
  senderComponent: string;
  interfaceNamespace: string;
  operationMapping?: string;
  operationMappingNamespace?: string;
  swcGuid?: string;
} | null {
  const defaultInventoryPath = "/home/cpc9181/dev/sap-po-ico-reader/data/inventories/586a8bff-329b-47c1-927d-f19c165f6d9c.json";
  const targetPath = inventoryPath || defaultInventoryPath;

  if (!fs.existsSync(targetPath)) {
    return null;
  }

  const inventory = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  const icos = inventory.integratedConfigurations || [];

  const matched = icos.find(
    (ico: any) =>
      ico.IntegratedConfigurationID?.InterfaceName === interfaceName ||
      ico.IntegratedConfigurationID?.InterfaceName?.toLowerCase() === interfaceName.toLowerCase()
  );

  if (!matched) {
    return null;
  }

  const senderComponent = matched.IntegratedConfigurationID?.SenderComponentID || "";
  const interfaceNamespace = matched.IntegratedConfigurationID?.InterfaceNamespace || "";
  const rule = matched.ReceiverInterfaces?.[0]?.ReceiverInterfaceRule;
  const operationMapping = rule?.Mapping?.Name;
  const operationMappingNamespace = rule?.Mapping?.Namespace;
  const swcGuid = (rule?.Mapping?.SoftwareComponentVersionID || "").replace(/-/g, "");

  return {
    senderComponent,
    interfaceNamespace,
    operationMapping,
    operationMappingNamespace,
    swcGuid
  };
}

/**
 * Extracts schema live from SAP PI/PO for the given interface name
 */
export async function extractSchemaFromPIPO(
  interfaceName: string,
  hostConfig: HostConfig = loadDefaultHostConfig(),
  inventoryPath?: string
): Promise<ExtractedSchemaResult> {
  const protocol = hostConfig.https ? "https" : "http";
  const baseUrl = `${protocol}://${hostConfig.host}:${hostConfig.port}`;
  const authHeader = "Basic " + Buffer.from(`${hostConfig.user}:${hostConfig.password}`).toString("base64");

  // Step 1: Look up interface metadata in inventory
  const meta = lookupInterfaceInInventory(interfaceName, inventoryPath);
  const interfaceNamespace = meta?.interfaceNamespace || "";
  const senderComponent = meta?.senderComponent || "";

  // Step 2: Try /dir/wsdl first (gives complete WSDL for interfaces with standard portType/binding)
  if (senderComponent && interfaceNamespace) {
    const wsdlUrl = `${baseUrl}/dir/wsdl?senderParty=&senderService=${encodeURIComponent(
      senderComponent
    )}&receiverParty=&receiverService=&interface=${encodeURIComponent(
      interfaceName
    )}&interfaceNamespace=${encodeURIComponent(interfaceNamespace)}`;

    try {
      const res = await request(wsdlUrl, { headers: { Authorization: authHeader } });
      if (res.statusCode === 200) {
        const text = await res.body.text();
        if (text.includes("<wsdl:definitions") || text.includes("<definitions")) {
          // Extract root element name
          const rootMatch = text.match(/<xsd:element\s+name="([^"]+)"/);
          const rootElementName = rootMatch?.[1] ? rootMatch[1] : interfaceName;

          return {
            interfaceName,
            interfaceNamespace,
            rootElementName,
            rawSchemaXml: text,
            schemaType: "wsdl",
            swcGuid: meta?.swcGuid,
            operationMapping: meta?.operationMapping
          };
        }
      }
    } catch {
      // Continue to ESR fallback
    }
  }

  // Step 3: ESR /rep/read/ext Fallback
  // If the interface has an Operation Mapping, query it to find the Source Message
  if (meta?.operationMapping && meta.operationMappingNamespace && meta.swcGuid) {
    const omKey = encodeURIComponent(`${meta.operationMapping}|${meta.operationMappingNamespace}`);
    const omUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=MAPPING&KEY=${omKey}&VC=SWC&SWCGUID=${meta.swcGuid}&SP=-1&UC=false&release=7.0`;

    const omRes = await request(omUrl, { headers: { Authorization: authHeader } });
    if (omRes.statusCode === 200) {
      const omXml = await omRes.body.text();

      // Check for REQUEST_OUT_MES link (Source Message from Sender)
      const outMesMatch = omXml.match(/<p1:lnkRole role="REQUEST_OUT_MES"[^>]*>[\s\S]*?<\/p1:lnkRole>/) ||
                          omXml.match(/<p1:lnkRole role="REQUEST_IN_MES"[^>]*>[\s\S]*?<\/p1:lnkRole>/);
      if (outMesMatch) {
        const block = outMesMatch[0];
        const isExt = block.includes('typeID="ifmextmes"') || block.includes('typeID="ifmextdef"');
        const elems = [...block.matchAll(/<p1:elem>(.*?)<\/p1:elem>/g)].map((m) => m[1]);
        const name = elems[0] || "";
        const ns = elems[1] || "";
        const rootElementName = elems[2] || name;

        // Extract SWC if different
        const swcMatch = block.match(/swcGuid="([^"]+)"/);
        const sourceSwc = swcMatch?.[1] ? swcMatch[1].replace(/-/g, "") : meta.swcGuid;

        if (isExt) {
          // External Definition: fetch ifmextdef
          const extKey = encodeURIComponent(`${name}|${ns}`);
          const extUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=ifmextdef&KEY=${extKey}&VC=SWC&SWCGUID=${sourceSwc}&SP=-1&UC=false&release=7.0`;
          const extRes = await request(extUrl, { headers: { Authorization: authHeader } });
          if (extRes.statusCode === 200) {
            const extXml = await extRes.body.text();
            const xmlStart = extXml.indexOf("<xml>");
            const xmlEnd = extXml.indexOf("</xml>");
            const xsdContent = xmlStart !== -1 && xmlEnd !== -1 ? extXml.slice(xmlStart + 5, xmlEnd).trim() : extXml;

            return {
              interfaceName,
              interfaceNamespace: ns,
              rootElementName,
              rawSchemaXml: xsdContent,
              schemaType: "xsd",
              swcGuid: sourceSwc,
              operationMapping: meta.operationMapping
            };
          }
        } else {
          // Standard Data Type: fetch ifmtypedef
          const dtKey = encodeURIComponent(`${name}|${ns}`);
          const dtUrl = `${baseUrl}/rep/read/ext?method=PLAIN&TYPE=ifmtypedef&KEY=${dtKey}&VC=SWC&SWCGUID=${sourceSwc}&SP=-1&UC=false&release=7.0`;
          const dtRes = await request(dtUrl, { headers: { Authorization: authHeader } });
          if (dtRes.statusCode === 200) {
            const dtXml = await dtRes.body.text();
            const schemaStart = dtXml.indexOf("<xsd:schema");
            const schemaEnd = dtXml.indexOf("</xsd:schema>");
            const xsdContent = schemaStart !== -1 && schemaEnd !== -1 ? dtXml.slice(schemaStart, schemaEnd + 13).trim() : dtXml;

            return {
              interfaceName,
              interfaceNamespace: ns,
              rootElementName: name,
              rawSchemaXml: xsdContent,
              schemaType: "xsd",
              swcGuid: sourceSwc,
              operationMapping: meta.operationMapping
            };
          }
        }
      }
    }
  }

  throw new Error(`Unable to extract schema for interface "${interfaceName}" from SAP PI/PO.`);
}

import { describe, it, expect } from "vitest";
import { parseSchema } from "./schema-parser.js";
import { generateLayer1Xml } from "./layer1-generator.js";
import { generateMappingTestPayload } from "./mapping-test-module.js";
import { XMLValidator } from "fast-xml-parser";

describe("Mapping Test Generator & Layer 1 Modifiers", () => {
  it("correctly parses XSD with constraints and applies Layer 1 modifiers", () => {
    const sampleXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://test.com/xi">
  <xsd:element name="MT_TestOrder" type="OrderType"/>
  <xsd:complexType name="OrderType">
    <xsd:sequence>
      <xsd:element name="OrderHeader">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="OrderId" type="xsd:string"/>
            <xsd:element name="OrderDate" type="xsd:date"/>
            <xsd:element name="OrderTotal" type="xsd:decimal"/>
            <xsd:element name="StatusCode">
              <xsd:simpleType>
                <xsd:restriction base="xsd:string">
                  <xsd:enumeration value="NEW"/>
                  <xsd:enumeration value="PROCESSING"/>
                  <xsd:enumeration value="COMPLETED"/>
                </xsd:restriction>
              </xsd:simpleType>
            </xsd:element>
            <xsd:element name="ShortCode">
              <xsd:simpleType>
                <xsd:restriction base="xsd:string">
                  <xsd:maxLength value="4"/>
                </xsd:restriction>
              </xsd:simpleType>
            </xsd:element>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="Items" minOccurs="0" maxOccurs="unbounded">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="LineNum" type="xsd:integer"/>
            <xsd:element name="ItemSku" type="xsd:string"/>
            <xsd:element name="Quantity" type="xsd:decimal"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    const tree = parseSchema(sampleXsd);
    expect(tree.rootElementName).toBe("MT_TestOrder");
    expect(tree.targetNamespace).toBe("http://test.com/xi");

    const xml = generateLayer1Xml(tree, { repeatCount: 2, mockDate: "2026-10-22" });

    // Validate XML syntax
    const valid = XMLValidator.validate(xml);
    expect(valid).toBe(true);

    // Verify Layer 1 schema-enforced modifiers
    expect(xml).toContain("<OrderDate>2026-10-22</OrderDate>");
    expect(xml).toContain("<OrderTotal>100.00</OrderTotal>");
    expect(xml).toContain("<StatusCode>NEW</StatusCode>"); // Picked first valid enum
    expect(xml).toContain("<ShortCode>TEST</ShortCode>"); // Sliced to maxLength 4
    expect(xml).toContain("<LineNum>1001</LineNum>");
    expect(xml).toContain("<Quantity>100.00</Quantity>");

    // Check repeat count for unbounded Items (2 instances)
    const matches = xml.match(/<Items>/g);
    expect(matches?.length).toBe(2);
  });

  it("extracts live schema and generates Layer 1 payload for I001_DAC_AP_Invoice_Out_Async", async () => {
    const result = await generateMappingTestPayload("I001_DAC_AP_Invoice_Out_Async", {
      layer: 1,
      layerOptions: { repeatCount: 2 }
    });

    expect(result.interfaceName).toBe("I001_DAC_AP_Invoice_Out_Async");
    expect(result.interfaceNamespace).toBe("http://smretail.com/xi/SMRI/S4HANA/FI");
    expect(result.rootElementName).toBe("I001_DAC_AP_Invoice_Out");

    // Validate syntax
    const valid = XMLValidator.validate(result.xmlPayload);
    expect(valid).toBe(true);

    // Verify elements
    expect(result.xmlPayload).toContain("<I001_AP_INVOICE>");
    expect(result.xmlPayload).toContain("<AP_INVOICE>");
    expect(result.xmlPayload).toContain("<INVOICE_NUM>");
    expect(result.xmlPayload).toContain("<INVOICE_AMOUNT>");
  });

  it("extracts live schema and generates Layer 1 payload for SI_I025_AR_Lazada_OB_AS", async () => {
    const result = await generateMappingTestPayload("SI_I025_AR_Lazada_OB_AS", {
      layer: 1,
      layerOptions: { repeatCount: 3 }
    });

    expect(result.interfaceName).toBe("SI_I025_AR_Lazada_OB_AS");
    expect(result.interfaceNamespace).toBe("http://smretail.com/xi/SMRI/Lazada/FI/I025");
    expect(result.rootElementName).toBe("MT_AR_LazadaStdReceipt");

    // Validate syntax
    const valid = XMLValidator.validate(result.xmlPayload);
    expect(valid).toBe(true);

    // Check fields inside MT_AR_LazadaStdReceipt
    expect(result.xmlPayload).toContain("MT_AR_LazadaStdReceipt");
    expect(result.xmlPayload).toContain("<Record>");
    expect(result.xmlPayload).toContain("<Trxn_Date>");
    expect(result.xmlPayload).toContain("<Amount>");
    expect(result.xmlPayload).toContain("<Seller_SKU>");

    // Check 3 records repeated
    const matches = result.xmlPayload.match(/<Record>/g);
    expect(matches?.length).toBe(3);
  });

  it("extracts ESR AST mapping dependencies in Layer 2 and extrapolates Header/Trailer row rules for I001", async () => {
    const result = await generateMappingTestPayload("I001_DAC_AP_Invoice_Out_Async", {
      layer: 2,
      layerOptions: { repeatCount: 3 }
    });

    expect(result.activeLayer).toBe(2);
    expect(result.mappingRules).not.toBeNull();

    // Check that AST pattern matcher discovered BEG and EOF
    expect(result.mappingRules?.headerOverrides["INVOICE_NUM"]).toBe("BEG");
    expect(result.mappingRules?.trailerOverrides["INVOICE_NUM"]).toBe("EOF");

    // Validate XML syntax
    const valid = XMLValidator.validate(result.xmlPayload);
    expect(valid).toBe(true);

    // In a 3-record repeating sequence:
    // Row 1 (Header): INVOICE_NUM == "BEG"
    // Row 2 (Detail): INVOICE_NUM == "TEST_INVOICE_NUM"
    // Row 3 (Trailer): INVOICE_NUM == "EOF"
    expect(result.xmlPayload).toContain("<INVOICE_NUM>BEG</INVOICE_NUM>");
    expect(result.xmlPayload).toContain("<INVOICE_NUM>TEST_INVOICE_NUM</INVOICE_NUM>");
    expect(result.xmlPayload).toContain("<INVOICE_NUM>EOF</INVOICE_NUM>");
  });

  it("respects allOptional meta flag (omits non-overridden optional fields when allOptional=false)", async () => {
    // When allOptional: false, optional fields without overrides are omitted
    const minimalResult = await generateMappingTestPayload("I001_DAC_AP_Invoice_Out_Async", {
      layer: 3,
      allOptional: false,
      overrides: {
        GL_DATE: "10/22/2026"
      },
      layerOptions: { repeatCount: 3 }
    });

    expect(minimalResult.allOptional).toBe(false);
    expect(minimalResult.fieldStats.totalFields).toBeGreaterThan(0);
    expect(minimalResult.fieldStats.optionalFields).toBeGreaterThan(0);

    // Overridden field and discriminator fields are present
    expect(minimalResult.xmlPayload).toContain("<GL_DATE>10/22/2026</GL_DATE>");
    expect(minimalResult.xmlPayload).toContain("<INVOICE_NUM>BEG</INVOICE_NUM>");
    expect(minimalResult.xmlPayload).toContain("<INVOICE_NUM>EOF</INVOICE_NUM>");

    // Trailer row populates RECORD_COUNT via INVOICE_TYPE_LOOKUP_CODE
    expect(minimalResult.xmlPayload).toContain("<INVOICE_TYPE_LOOKUP_CODE>1</INVOICE_TYPE_LOOKUP_CODE>");

    // Non-overridden unmapped optional field (e.g. TAX_CODE) should NOT be present
    expect(minimalResult.xmlPayload).not.toContain("<TAX_CODE>");

    // When allOptional: true, non-overridden optional fields ARE present
    const fullResult = await generateMappingTestPayload("I001_DAC_AP_Invoice_Out_Async", {
      layer: 3,
      allOptional: true,
      overrides: {
        GL_DATE: "10/22/2026"
      },
      layerOptions: { repeatCount: 3 }
    });

    expect(fullResult.allOptional).toBe(true);
    expect(fullResult.xmlPayload).toContain("<TAX_CODE>");
  }, 20000);

  it("extracts target schema cardinalities and enforces transitively mandatory fields in Layer 2", async () => {
    const result = await generateMappingTestPayload("I001_DAC_AP_Invoice_Out_Async", {
      layer: 2,
      allOptional: false,
      layerOptions: { repeatCount: 3 }
    });

    // 1. Verify target schema was discovered and inspected
    expect(result.mappingRules?.targetMessageName).toBe("I001_DAC_AP_Invoice_IN");
    expect(result.targetCardinalities).toBeDefined();
    expect(result.targetCardinalities!.length).toBeGreaterThan(0);

    // 2. Verify mandatory target fields were indexed
    const recordCountTarget = result.targetCardinalities?.find((t) => t.targetPath.endsWith("/EOF/RECORD_COUNT"));
    expect(recordCountTarget).toBeDefined();
    expect(recordCountTarget?.minOccurs).toBe(1);
    expect(recordCountTarget?.isMandatory).toBe(true);
    expect(recordCountTarget?.mappedSourceFields).toContain("INVOICE_TYPE_LOOKUP_CODE");

    const totalAmountTarget = result.targetCardinalities?.find((t) => t.targetPath.endsWith("/EOF/TOTAL_RECEIPT_AMOUNT"));
    expect(totalAmountTarget).toBeDefined();
    expect(totalAmountTarget?.minOccurs).toBe(1);
    expect(totalAmountTarget?.isMandatory).toBe(true);
    expect(totalAmountTarget?.mappedSourceFields).toContain("INVOICE_DATE");

    // 3. Verify transitively mandatory source fields
    expect(result.transitivelyMandatoryFields).toContain("INVOICE_NUM");
    expect(result.transitivelyMandatoryFields).toContain("INVOICE_TYPE_LOOKUP_CODE");
    expect(result.transitivelyMandatoryFields).toContain("INVOICE_DATE");
    expect(result.transitivelyMandatoryFields).toContain("VENDOR_NUM");
    expect(result.transitivelyMandatoryFields).toContain("VENDOR_SITE_CODE");

    // 4. In minimal payload (allOptional=false), transitively mandatory header and trailer fields MUST be present
    expect(result.xmlPayload).toContain("<INVOICE_NUM>BEG</INVOICE_NUM>");
    expect(result.xmlPayload).toContain("<INVOICE_TYPE_LOOKUP_CODE>1.0</INVOICE_TYPE_LOOKUP_CODE>");
    expect(result.xmlPayload).toContain("<INVOICE_DATE>DAILY</INVOICE_DATE>");
    expect(result.xmlPayload).toContain("<VENDOR_NUM>INVOICE.TXT</VENDOR_NUM>");

    expect(result.xmlPayload).toContain("<INVOICE_NUM>EOF</INVOICE_NUM>");
    expect(result.xmlPayload).toContain("<INVOICE_TYPE_LOOKUP_CODE>1</INVOICE_TYPE_LOOKUP_CODE>");
    expect(result.xmlPayload).toContain("<INVOICE_DATE>100.00</INVOICE_DATE>");

    // 5. Unmapped optional fields must NOT be present
    expect(result.xmlPayload).not.toContain("<TAX_CODE>");
    expect(result.xmlPayload).not.toContain("<HOLD_NAME>");

    // Syntax validity
    const valid = XMLValidator.validate(result.xmlPayload);
    expect(valid).toBe(true);
  }, 20000);
});

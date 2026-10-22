import fs from "node:fs";
import path from "node:path";
import type { ExtractedSchemaResult } from "../generator/schema-extractor.js";
import type { ExtractedMappingRules } from "../generator/mapping-rule-extractor.js";

export interface InterfaceSnapshot {
  extractedSchema: ExtractedSchemaResult;
  mappingRules: ExtractedMappingRules;
}

const I001_INLINE_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema targetNamespace="http://smretail.com/xi/SMRI/S4HANA/FI" xmlns="http://smretail.com/xi/SMRI/S4HANA/FI" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="I001_DAC_AP_Invoice_Out" type="I001_DAC_AP_Invoice_OUT"/>
  <xsd:complexType name="I001_DAC_AP_Invoice_OUT">
    <xsd:sequence>
      <xsd:element name="I001_AP_INVOICE">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="AP_INVOICE" minOccurs="0" maxOccurs="unbounded">
              <xsd:complexType>
                <xsd:sequence>
                  <xsd:element name="INVOICE_NUM" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="INVOICE_TYPE_LOOKUP_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="INVOICE_DATE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="VENDOR_NUM" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="VENDOR_SITE_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="INVOICE_AMOUNT" type="xsd:string" minOccurs="0" default="0.00"/>
                  <xsd:element name="INVOICE_CURRENCY_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="TERMS_NAME" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="DESCRIPTION" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="AWT_GROUP_NAME" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE_CATEGORY" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE1" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE2" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE3" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE4" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE5" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE6" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE7" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE8" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE9" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE10" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ATTRIBUTE11" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="SOURCE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="GROUP_ID" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="PAYMENT_CURRENCY_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="DOC_CATEGORY_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="VOUCHER_NUM" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="PAYMENT_METHOD_LOOKUP_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="PAY_GROUP_LOOKUP_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="GL_DATE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ACCTS_PAY_CC_CONCATENATED" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="OPERATING_UNIT" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="PAYMENT_PRIORITY" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="HOLD_NAME" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="LINE_NUMBER" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="LINE_TYPE_LOOKUP_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="AMOUNT" type="xsd:string" minOccurs="0" default="0.00"/>
                  <xsd:element name="ACCOUNTING_DATE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="DESCRIPTION_2" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="TAX_CODE" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ITEM_DESCRIPTION" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="QUANTITY_INVOICED" type="xsd:string" minOccurs="0" default="0.00"/>
                  <xsd:element name="UNIT_PRICE" type="xsd:string" minOccurs="0" default="0.00"/>
                  <xsd:element name="DISTRIBUTION_SET_NAME" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="DIST_CODE_CONCATENATED" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="AWT_GROUP_NAME_2" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="FILE_NAME" type="xsd:string" minOccurs="0"/>
                  <xsd:element name="ORDER_NUMBER" type="xsd:string" minOccurs="0"/>
                </xsd:sequence>
              </xsd:complexType>
            </xsd:element>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

const LAZADA_INLINE_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema targetNamespace="http://smretail.com/xi/SMRI/Lazada/FI/I025" xmlns="http://smretail.com/xi/SMRI/Lazada/FI/I025" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="MT_AR_LazadaStdReceipt" type="DT_AR_LazadaStdReceipt"/>
  <xsd:complexType name="DT_AR_LazadaStdReceipt">
    <xsd:sequence>
      <xsd:element name="Record" minOccurs="1" maxOccurs="unbounded">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Trxn_Date" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Trxn_Type" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Fee_Name" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Trxn_Number" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Details" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Seller_SKU" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Lazada_SKU" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Amount" type="xsd:string" minOccurs="0"/>
            <xsd:element name="VAT_Amount" type="xsd:string" minOccurs="0"/>
            <xsd:element name="WHT_Amount" type="xsd:string" minOccurs="0"/>
            <xsd:element name="WHT_Amount_Included" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Statement" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Paid_Status" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Order_No" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Order_Item_No" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Order_Item_Status" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Shipping_Provider" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Shipping_Speed" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Shipment_Type" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Reference" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Comment" type="xsd:string" minOccurs="0"/>
            <xsd:element name="PaymentRefID" type="xsd:string" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

const SALES_ORDER_INLINE_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://company.com/xi/Sales" xmlns="http://company.com/xi/Sales">
  <xsd:element name="SalesOrder_OB" type="DT_SalesOrder"/>
  <xsd:complexType name="DT_SalesOrder">
    <xsd:sequence>
      <xsd:element name="OrderHeader" minOccurs="1">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="OrderId" type="xsd:string" minOccurs="1"/>
            <xsd:element name="OrderDate" type="xsd:date" minOccurs="1"/>
            <xsd:element name="CustomerCode" type="xsd:string" minOccurs="1"/>
            <xsd:element name="CurrencyCode" minOccurs="1">
              <xsd:simpleType>
                <xsd:restriction base="xsd:string">
                  <xsd:enumeration value="PHP"/>
                  <xsd:enumeration value="USD"/>
                  <xsd:enumeration value="SGD"/>
                </xsd:restriction>
              </xsd:simpleType>
            </xsd:element>
            <xsd:element name="SalesOrg" type="xsd:string" minOccurs="0"/>
            <xsd:element name="PromotionCode" type="xsd:string" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="OrderItems" minOccurs="1" maxOccurs="unbounded">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="ItemNumber" type="xsd:integer" minOccurs="1"/>
            <xsd:element name="MaterialSku" type="xsd:string" minOccurs="1"/>
            <xsd:element name="Quantity" type="xsd:decimal" minOccurs="1"/>
            <xsd:element name="NetPrice" type="xsd:decimal" minOccurs="1"/>
            <xsd:element name="TaxCode" type="xsd:string" minOccurs="0"/>
            <xsd:element name="BatchNumber" type="xsd:string" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

function loadI001SchemaXml(): string {
  const wsdlPath = path.resolve(process.cwd(), "testbed/schemas/I001_DAC_AP_Invoice_Out_Async.wsdl");
  if (fs.existsSync(wsdlPath)) {
    return fs.readFileSync(wsdlPath, "utf8");
  }
  return I001_INLINE_XSD;
}

export function getOfflineSnapshot(interfaceName: string): InterfaceSnapshot | null {
  const norm = interfaceName.trim().toLowerCase();

  if (norm === "i001_dac_ap_invoice_out_async" || norm === "i001") {
    return {
      extractedSchema: {
        interfaceName: "I001_DAC_AP_Invoice_Out_Async",
        interfaceNamespace: "http://smretail.com/xi/SMRI/S4HANA/FI",
        rootElementName: "I001_DAC_AP_Invoice_Out",
        rawSchemaXml: loadI001SchemaXml(),
        schemaType: "wsdl",
        swcGuid: "7cfc3440c95711e988ef0205857feb80",
        operationMapping: "OM_I001_DAC_AP_Invoice_out_to_I001_AP_Invoice_in"
      },
      mappingRules: {
        mappingName: "I001_DAC_AP_Invoice_out_to_I001_AP_Invoice_in",
        mappingNamespace: "http://smretail.com/xi/SMRI/S4HANA/FI",
        targetMessageName: "I001_DAC_AP_Invoice_IN",
        targetMessageNamespace: "http://smretail.com/xi/SMRI/S4HANA/FI",
        rules: [
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/BEG",
            srcField: "INVOICE_NUM",
            expectedValue: "BEG",
            role: "header"
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/EOF",
            srcField: "INVOICE_NUM",
            expectedValue: "EOF",
            role: "trailer"
          }
        ],
        headerOverrides: {
          INVOICE_NUM: "BEG",
          INVOICE_TYPE_LOOKUP_CODE: "1.0",
          INVOICE_DATE: "DAILY",
          VENDOR_NUM: "INVOICE.TXT",
          VENDOR_SITE_CODE: "{{today}}"
        },
        trailerOverrides: {
          INVOICE_NUM: "EOF",
          INVOICE_TYPE_LOOKUP_CODE: "{{count}}",
          INVOICE_DATE: "100.00"
        },
        fieldOverrides: {},
        headerFieldTargets: {
          INVOICE_TYPE_LOOKUP_CODE: "VERSION",
          INVOICE_DATE: "EXTRACT_FREQUENCY_CODE",
          VENDOR_NUM: "FILENAME_WITH_EXTENSION",
          VENDOR_SITE_CODE: "ZDATE"
        },
        trailerFieldTargets: {
          INVOICE_TYPE_LOOKUP_CODE: "RECORD_COUNT",
          INVOICE_DATE: "TOTAL_RECEIPT_AMOUNT"
        },
        targetCardinalities: [
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/BEG/RECORD_IDENTIFIER",
            targetField: "RECORD_IDENTIFIER",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["INVOICE_NUM"]
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/BEG/VERSION",
            targetField: "VERSION",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["INVOICE_TYPE_LOOKUP_CODE"]
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/BEG/EXTRACT_FREQUENCY_CODE",
            targetField: "EXTRACT_FREQUENCY_CODE",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["INVOICE_DATE"]
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/BEG/FILENAME_WITH_EXTENSION",
            targetField: "FILENAME_WITH_EXTENSION",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["VENDOR_NUM"]
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/BEG/ZDATE",
            targetField: "ZDATE",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["VENDOR_SITE_CODE"]
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/EOF/RECORD_IDENTIFIER",
            targetField: "RECORD_IDENTIFIER",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["INVOICE_NUM"]
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/EOF/RECORD_COUNT",
            targetField: "RECORD_COUNT",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["INVOICE_TYPE_LOOKUP_CODE"]
          },
          {
            targetPath: "/I001_DAC_AP_Invoice_In/I001_AP_INVOICE/EOF/TOTAL_RECEIPT_AMOUNT",
            targetField: "TOTAL_RECEIPT_AMOUNT",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["INVOICE_DATE"]
          }
        ],
        transitivelyMandatorySourceFields: [
          "INVOICE_NUM",
          "INVOICE_TYPE_LOOKUP_CODE",
          "INVOICE_DATE",
          "VENDOR_NUM",
          "VENDOR_SITE_CODE"
        ],
        headerMandatorySourceFields: [
          "INVOICE_NUM",
          "INVOICE_TYPE_LOOKUP_CODE",
          "INVOICE_DATE",
          "VENDOR_NUM",
          "VENDOR_SITE_CODE"
        ],
        trailerMandatorySourceFields: [
          "INVOICE_NUM",
          "INVOICE_TYPE_LOOKUP_CODE",
          "INVOICE_DATE"
        ],
        detailMandatorySourceFields: [
          "INVOICE_NUM",
          "INVOICE_TYPE_LOOKUP_CODE",
          "INVOICE_DATE",
          "VENDOR_NUM",
          "VENDOR_SITE_CODE",
          "INVOICE_AMOUNT"
        ]
      }
    };
  }

  if (norm === "si_i025_ar_lazada_ob_as" || norm === "i025" || norm === "lazada") {
    return {
      extractedSchema: {
        interfaceName: "SI_I025_AR_Lazada_OB_AS",
        interfaceNamespace: "http://smretail.com/xi/SMRI/Lazada/FI/I025",
        rootElementName: "MT_AR_LazadaStdReceipt",
        rawSchemaXml: LAZADA_INLINE_XSD,
        schemaType: "xsd",
        swcGuid: "a28f09c032d111ec9c8e00000075dbae",
        operationMapping: "OM_I025_AR_Lazada_to_AR_StdReceiptsProxy"
      },
      mappingRules: {
        mappingName: "MM_I025_AR_Lazada_to_AR_StdReceiptsProxy",
        mappingNamespace: "http://smretail.com/xi/SMRI/Lazada/FI/I025",
        targetMessageName: "DT_AR_Other_Tenders_StdReceipts",
        targetMessageNamespace: "http://smretail.com/xi/SMRI/S4HANA/AR",
        rules: [],
        headerOverrides: {},
        trailerOverrides: {},
        fieldOverrides: {
          Paid_Status: "PAID"
        },
        targetCardinalities: [
          {
            targetPath: "/MT_AR_Other_Tenders_StdReceipts/Record/Trxn_Date",
            targetField: "Trxn_Date",
            minOccurs: 0,
            maxOccurs: 1,
            isMandatory: false,
            mappedSourceFields: ["Trxn_Date"]
          },
          {
            targetPath: "/MT_AR_Other_Tenders_StdReceipts/Record/Trxn_Number",
            targetField: "Trxn_Number",
            minOccurs: 0,
            maxOccurs: 1,
            isMandatory: false,
            mappedSourceFields: ["Trxn_Number"]
          },
          {
            targetPath: "/MT_AR_Other_Tenders_StdReceipts/Record/Amount",
            targetField: "Amount",
            minOccurs: 0,
            maxOccurs: 1,
            isMandatory: false,
            mappedSourceFields: ["Amount"]
          },
          {
            targetPath: "/MT_AR_Other_Tenders_StdReceipts/Record/Order_No",
            targetField: "Order_No",
            minOccurs: 0,
            maxOccurs: 1,
            isMandatory: false,
            mappedSourceFields: ["Order_No"]
          }
        ],
        transitivelyMandatorySourceFields: ["Trxn_Date", "Trxn_Type", "Trxn_Number", "Amount", "Order_No", "Seller_SKU", "Paid_Status"],
        headerMandatorySourceFields: [],
        trailerMandatorySourceFields: [],
        detailMandatorySourceFields: ["Trxn_Date", "Trxn_Type", "Trxn_Number", "Amount", "Order_No", "Seller_SKU", "Paid_Status"]
      }
    };
  }

  if (norm === "salesorder_ob") {
    return {
      extractedSchema: {
        interfaceName: "SalesOrder_OB",
        interfaceNamespace: "http://company.com/xi/Sales",
        rootElementName: "SalesOrder_OB",
        rawSchemaXml: SALES_ORDER_INLINE_XSD,
        schemaType: "xsd",
        operationMapping: "OM_SalesOrder_OB_to_S4HANA_SO"
      },
      mappingRules: {
        mappingName: "MM_SalesOrder_OB_to_S4HANA_BAPI_SALESORDER",
        mappingNamespace: "http://company.com/xi/Sales",
        targetMessageName: "BAPI_SALESORDER_CREATEFROMDAT2",
        targetMessageNamespace: "urn:sap-com:document:sap:rfc:functions",
        rules: [],
        headerOverrides: {},
        trailerOverrides: {},
        fieldOverrides: {},
        targetCardinalities: [
          {
            targetPath: "/BAPI_SALESORDER_CREATEFROMDAT2/ORDER_HEADER_IN/PURCH_NO_C",
            targetField: "PURCH_NO_C",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["OrderId"]
          },
          {
            targetPath: "/BAPI_SALESORDER_CREATEFROMDAT2/ORDER_HEADER_IN/DOC_DATE",
            targetField: "DOC_DATE",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["OrderDate"]
          },
          {
            targetPath: "/BAPI_SALESORDER_CREATEFROMDAT2/ORDER_ITEMS_IN/MATERIAL",
            targetField: "MATERIAL",
            minOccurs: 1,
            maxOccurs: 1,
            isMandatory: true,
            mappedSourceFields: ["MaterialSku"]
          }
        ],
        transitivelyMandatorySourceFields: ["OrderId", "OrderDate", "CustomerCode", "CurrencyCode", "ItemNumber", "MaterialSku", "Quantity", "NetPrice"],
        headerMandatorySourceFields: [],
        trailerMandatorySourceFields: [],
        detailMandatorySourceFields: ["OrderId", "OrderDate", "CustomerCode", "CurrencyCode", "ItemNumber", "MaterialSku", "Quantity", "NetPrice"]
      }
    };
  }

  // Generic fallback for other interfaces in the inventory so every indexed interface can be synthesized
  return {
    extractedSchema: {
      interfaceName,
      interfaceNamespace: "http://smretail.com/xi/SMRI/Enterprise",
      rootElementName: interfaceName,
      rawSchemaXml: `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://smretail.com/xi/SMRI/Enterprise">
  <xsd:element name="${interfaceName}" type="DT_${interfaceName}"/>
  <xsd:complexType name="DT_${interfaceName}">
    <xsd:sequence>
      <xsd:element name="Record" minOccurs="1" maxOccurs="unbounded">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="DocumentId" type="xsd:string" minOccurs="1"/>
            <xsd:element name="PostingDate" type="xsd:date" minOccurs="1"/>
            <xsd:element name="CompanyCode" type="xsd:string" minOccurs="1"/>
            <xsd:element name="Amount" type="xsd:decimal" minOccurs="0"/>
            <xsd:element name="Remarks" type="xsd:string" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`,
      schemaType: "xsd"
    },
    mappingRules: {
      mappingName: `MM_${interfaceName}_to_Target`,
      mappingNamespace: "http://smretail.com/xi/SMRI/Enterprise",
      targetMessageName: `MT_${interfaceName}_In`,
      targetMessageNamespace: "http://smretail.com/xi/SMRI/Enterprise",
      rules: [],
      headerOverrides: {},
      trailerOverrides: {},
      fieldOverrides: {},
      targetCardinalities: [
        {
          targetPath: `/MT_${interfaceName}_In/Record/DocumentId`,
          targetField: "DocumentId",
          minOccurs: 1,
          maxOccurs: 1,
          isMandatory: true,
          mappedSourceFields: ["DocumentId"]
        },
        {
          targetPath: `/MT_${interfaceName}_In/Record/PostingDate`,
          targetField: "PostingDate",
          minOccurs: 1,
          maxOccurs: 1,
          isMandatory: true,
          mappedSourceFields: ["PostingDate"]
        }
      ],
      transitivelyMandatorySourceFields: ["DocumentId", "PostingDate", "CompanyCode"],
      headerMandatorySourceFields: [],
      trailerMandatorySourceFields: [],
      detailMandatorySourceFields: ["DocumentId", "PostingDate", "CompanyCode"]
    }
  };
}

export const SM_RETAIL_DEMO_INVENTORY = {
  _meta: {
    id: "spd100-smretail-snapshot",
    hostId: "spd100",
    hostLabel: "SPD — SAP PI/PO Development (sapipo2.smretailinc.com)",
    sapUser: "cpc9181",
    extractedAt: "2026-10-22T12:30:00.000Z",
    partial: false,
    icoCount: 5,
    icoQueriedCount: 5,
    channelCount: 4,
    channelQueriedCount: 4
  },
  summary: {
    icoCount: 5,
    icoQueriedCount: 5,
    channelCount: 4,
    channelQueriedCount: 4,
    senderChannelCount: 3,
    receiverChannelCount: 1,
    warnings: []
  },
  integratedConfigurations: [
    {
      MasterLanguage: "EN",
      IntegratedConfigurationID: {
        SenderPartyID: "",
        SenderComponentID: "SFTP100",
        InterfaceName: "I001_DAC_AP_Invoice_Out_Async",
        InterfaceNamespace: "http://smretail.com/xi/SMRI/S4HANA/FI",
        ReceiverPartyID: "",
        ReceiverComponentID: "S4DCLNT100"
      },
      InboundProcessing: {
        CommunicationChannel: {
          PartyID: "",
          ComponentID: "SFTP100",
          ChannelID: "CC_SFTP_DAC_AP_Invoice_Sender"
        }
      },
      ReceiverInterfaces: [
        {
          Receiver: {
            PartyID: "",
            ComponentID: "S4DCLNT100"
          },
          QualityOfService: "EO",
          ReceiverInterfaceRule: {
            Mapping: {
              Name: "OM_I001_DAC_AP_Invoice_out_to_I001_AP_Invoice_in",
              Namespace: "http://smretail.com/xi/SMRI/S4HANA/FI"
            }
          }
        }
      ]
    },
    {
      MasterLanguage: "EN",
      IntegratedConfigurationID: {
        SenderPartyID: "",
        SenderComponentID: "BC_HOCOPAY",
        InterfaceName: "SI_I025_AR_Lazada_OB_AS",
        InterfaceNamespace: "http://smretail.com/xi/SMRI/Lazada/FI/I025",
        ReceiverPartyID: "",
        ReceiverComponentID: "S4DCLNT100"
      },
      InboundProcessing: {
        CommunicationChannel: {
          PartyID: "",
          ComponentID: "BC_HOCOPAY",
          ChannelID: "CC_SFTP_Lazada_AR_Sender"
        }
      },
      ReceiverInterfaces: [
        {
          Receiver: {
            PartyID: "",
            ComponentID: "S4DCLNT100"
          },
          QualityOfService: "EO",
          ReceiverInterfaceRule: {
            Mapping: {
              Name: "OM_I025_AR_Lazada_to_AR_StdReceiptsProxy",
              Namespace: "http://smretail.com/xi/SMRI/Lazada/FI/I025"
            }
          }
        }
      ]
    },
    {
      MasterLanguage: "EN",
      IntegratedConfigurationID: {
        SenderPartyID: "",
        SenderComponentID: "POS_SYSTEM",
        InterfaceName: "SalesOrder_OB",
        InterfaceNamespace: "http://company.com/xi/Sales",
        ReceiverPartyID: "",
        ReceiverComponentID: "S4HANA"
      },
      InboundProcessing: {
        CommunicationChannel: {
          PartyID: "",
          ComponentID: "POS_SYSTEM",
          ChannelID: "CC_SOAP_IN"
        }
      },
      ReceiverInterfaces: [
        {
          Receiver: {
            PartyID: "",
            ComponentID: "S4HANA"
          },
          QualityOfService: "BE",
          ReceiverInterfaceRule: {
            Mapping: {
              Name: "OM_SalesOrder_OB_to_S4HANA_SO",
              Namespace: "http://company.com/xi/Sales"
            }
          }
        }
      ]
    },
    {
      MasterLanguage: "EN",
      IntegratedConfigurationID: {
        SenderPartyID: "",
        SenderComponentID: "BC_DMALL",
        InterfaceName: "ZRFC_MD_UPDATE_CUSTOMER",
        InterfaceNamespace: "urn:sap-com:document:sap:rfc:functions",
        ReceiverPartyID: "",
        ReceiverComponentID: "SRD100"
      },
      InboundProcessing: {
        CommunicationChannel: {
          PartyID: "",
          ComponentID: "BC_DMALL",
          ChannelID: "CC_SMM_RFC_SENDER"
        }
      },
      ReceiverInterfaces: [
        {
          Receiver: {
            PartyID: "",
            ComponentID: "SRD100"
          },
          QualityOfService: "EO"
        }
      ]
    },
    {
      MasterLanguage: "EN",
      IntegratedConfigurationID: {
        SenderPartyID: "",
        SenderComponentID: "LOGISTICS",
        InterfaceName: "ShipmentNotification_OB",
        InterfaceNamespace: "http://company.com/xi/Logistics",
        ReceiverPartyID: "",
        ReceiverComponentID: "WMS"
      },
      ReceiverInterfaces: [
        {
          Receiver: {
            PartyID: "",
            ComponentID: "WMS"
          },
          QualityOfService: "EO"
        }
      ]
    }
  ],
  communicationChannels: [
    {
      CommunicationChannelID: {
        PartyID: "",
        ComponentID: "SFTP100",
        ChannelID: "CC_SFTP_DAC_AP_Invoice_Sender"
      },
      Direction: "Sender",
      TransportProtocol: "SSHFtp",
      MessageProtocol: "FileCSV"
    },
    {
      CommunicationChannelID: {
        PartyID: "",
        ComponentID: "BC_HOCOPAY",
        ChannelID: "CC_SFTP_Lazada_AR_Sender"
      },
      Direction: "Sender",
      TransportProtocol: "SSHFtp",
      MessageProtocol: "FormatConversionBean"
    },
    {
      CommunicationChannelID: {
        PartyID: "",
        ComponentID: "POS_SYSTEM",
        ChannelID: "CC_SOAP_IN"
      },
      Direction: "Sender",
      TransportProtocol: "HTTP",
      MessageProtocol: "SOAP 1.1"
    },
    {
      CommunicationChannelID: {
        PartyID: "",
        ComponentID: "S4DCLNT100",
        ChannelID: "CC_XI_PROXY_RECEIVER"
      },
      Direction: "Receiver",
      TransportProtocol: "HTTP",
      MessageProtocol: "XI 3.0"
    }
  ]
};

export const PARITY_DEMO_PRESETS = {
  match: {
    name: "SalesOrder_OB — 100% Semantic Parity (Prefix & Volatile Stripping)",
    pipoXml: `<?xml version="1.0" encoding="UTF-8"?>
<ns0:SalesOrderResponse xmlns:ns0="http://company.com/xi/Sales">
  <ns0:MessageHeader>
    <ns0:MessageId>9f8e7d6c-1122-3344-5566-778899aabbcc</ns0:MessageId>
    <ns0:CreationDateTime>2026-10-22T20:14:01.102Z</ns0:CreationDateTime>
    <ns0:SenderSystem>SAP_PO_75_QAS</ns0:SenderSystem>
  </ns0:MessageHeader>
  <ns0:OrderConfirmation>
    <ns0:SalesOrderNumber>0050192834</ns0:SalesOrderNumber>
    <ns0:CustomerCode>CUST-88210</ns0:CustomerCode>
    <ns0:Currency>PHP</ns0:Currency>
    <ns0:TotalNetAmount>45200.00</ns0:TotalNetAmount>
    <ns0:TotalTaxAmount>5424.00</ns0:TotalTaxAmount>
    <ns0:Status>CONFIRMED</ns0:Status>
  </ns0:OrderConfirmation>
</ns0:SalesOrderResponse>`,
    cpiXml: `<?xml version="1.0" encoding="UTF-8"?>
<p1:SalesOrderResponse xmlns:p1="http://company.com/xi/Sales">
  <p1:MessageHeader>
    <p1:MessageId>e1a2b3c4-9988-7766-5544-33221100ffaa</p1:MessageId>
    <p1:CreationDateTime>2026-10-22T20:14:01.849Z</p1:CreationDateTime>
    <p1:SenderSystem>SAP_PO_75_QAS</p1:SenderSystem>
  </p1:MessageHeader>
  <p1:OrderConfirmation>
    <p1:SalesOrderNumber>0050192834</ns0:SalesOrderNumber>
    <p1:CustomerCode>CUST-88210</p1:CustomerCode>
    <p1:Currency>PHP</p1:Currency>
    <p1:TotalNetAmount>45200.00</p1:TotalNetAmount>
    <p1:TotalTaxAmount>5424.00</p1:TotalTaxAmount>
    <p1:Status>CONFIRMED</p1:Status>
  </p1:OrderConfirmation>
</p1:SalesOrderResponse>`.replace("</ns0:SalesOrderNumber>", "</p1:SalesOrderNumber>"),
    ignorePaths: ["MessageId", "CreationDateTime"]
  },
  mismatch: {
    name: "I001_DAC_AP_Invoice — Discrepancy (EOF Count & Currency Drift)",
    pipoXml: `<?xml version="1.0" encoding="UTF-8"?>
<ns0:I001_DAC_AP_Invoice_In xmlns:ns0="http://smretail.com/xi/SMRI/S4HANA/FI">
  <I001_AP_INVOICE>
    <BEG>
      <RECORD_IDENTIFIER>BEG</RECORD_IDENTIFIER>
      <VERSION>1.0</VERSION>
      <EXTRACT_FREQUENCY_CODE>DAILY</EXTRACT_FREQUENCY_CODE>
      <FILENAME_WITH_EXTENSION>INV_SMRI_482910.TXT</FILENAME_WITH_EXTENSION>
      <ZDATE>20261022</ZDATE>
    </BEG>
    <AP_INVOICE>
      <INVOICE_NUM>INV-392011</INVOICE_NUM>
      <VENDOR_NUM>VEND-10492</VENDOR_NUM>
      <INVOICE_AMOUNT>12500.50</INVOICE_AMOUNT>
      <INVOICE_CURRENCY_CODE>PHP</INVOICE_CURRENCY_CODE>
    </AP_INVOICE>
    <EOF>
      <RECORD_IDENTIFIER>EOF</RECORD_IDENTIFIER>
      <RECORD_COUNT>1</RECORD_COUNT>
      <TOTAL_RECEIPT_AMOUNT>12500.50</TOTAL_RECEIPT_AMOUNT>
    </EOF>
  </I001_AP_INVOICE>
</ns0:I001_DAC_AP_Invoice_In>`,
    cpiXml: `<?xml version="1.0" encoding="UTF-8"?>
<p2:I001_DAC_AP_Invoice_In xmlns:p2="http://smretail.com/xi/SMRI/S4HANA/FI">
  <I001_AP_INVOICE>
    <BEG>
      <RECORD_IDENTIFIER>BEG</RECORD_IDENTIFIER>
      <VERSION>1.0</VERSION>
      <EXTRACT_FREQUENCY_CODE>DAILY</EXTRACT_FREQUENCY_CODE>
      <FILENAME_WITH_EXTENSION>INV_SMRI_482910.TXT</FILENAME_WITH_EXTENSION>
      <ZDATE>20261022</ZDATE>
    </BEG>
    <AP_INVOICE>
      <INVOICE_NUM>INV-392011</INVOICE_NUM>
      <VENDOR_NUM>VEND-10492</VENDOR_NUM>
      <INVOICE_AMOUNT>12500.50</INVOICE_AMOUNT>
      <INVOICE_CURRENCY_CODE>USD</INVOICE_CURRENCY_CODE>
    </AP_INVOICE>
    <EOF>
      <RECORD_IDENTIFIER>EOF</RECORD_IDENTIFIER>
      <RECORD_COUNT>0</RECORD_COUNT>
      <TOTAL_RECEIPT_AMOUNT>0.00</TOTAL_RECEIPT_AMOUNT>
    </EOF>
  </I001_AP_INVOICE>
</p2:I001_DAC_AP_Invoice_In>`,
    ignorePaths: ["ZDATE"]
  }
};

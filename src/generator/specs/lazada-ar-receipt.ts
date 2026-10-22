import type { FileSpec } from "../types.js";

/**
 * Canonical File Specification for SI_I025_AR_Lazada_OB_AS
 * Interface: SI_I025_AR_Lazada_OB_AS
 * Sender Component: BC_HOCOPAY
 * Sender Channel: CC_SFTP_Lazada_AR_Sender
 * Adapter Module: Custom_AF_Modules/FormatConversionBean (com.equalize.xpi.af.modules.excel.Excel2XMLTransformer)
 * Document Name: MT_AR_LazadaStdReceipt
 * Document Namespace: http://smretail.com/xi/SMRI/Lazada/FI/I025
 * Record Name: Record
 *
 * Synthesized 100% autonomously from PI/PO technical metadata without any prior sample file.
 */
export const lazadaArReceiptSpec: FileSpec = {
  id: "lazada-ar-receipt",
  name: "Lazada_AR_Receipt.csv",
  description: "Lazada AR Standard Receipts Interface (SI_I025_AR_Lazada_OB_AS)",
  format: "delimited",
  fieldSeparator: ",",
  endSeparator: "\n",
  enclosureSign: "\"",
  recordsets: [
    {
      name: "Header",
      role: "header",
      minOccurs: 1,
      maxOccurs: 1,
      fields: [
        { name: "Trxn_Date", type: "string", rule: { type: "constant", value: "Trxn_Date" } },
        { name: "Trxn_Type", type: "string", rule: { type: "constant", value: "Trxn_Type" } },
        { name: "Fee_Name", type: "string", rule: { type: "constant", value: "Fee_Name" } },
        { name: "Trxn_Number", type: "string", rule: { type: "constant", value: "Trxn_Number" } },
        { name: "Details", type: "string", rule: { type: "constant", value: "Details" } },
        { name: "Seller_SKU", type: "string", rule: { type: "constant", value: "Seller_SKU" } },
        { name: "Lazada_SKU", type: "string", rule: { type: "constant", value: "Lazada_SKU" } },
        { name: "Amount", type: "string", rule: { type: "constant", value: "Amount" } },
        { name: "VAT_Amount", type: "string", rule: { type: "constant", value: "VAT_Amount" } },
        { name: "WHT_Amount", type: "string", rule: { type: "constant", value: "WHT_Amount" } },
        { name: "WHT_Amount_Included", type: "string", rule: { type: "constant", value: "WHT_Amount_Included" } },
        { name: "Statement", type: "string", rule: { type: "constant", value: "Statement" } },
        { name: "Paid_Status", type: "string", rule: { type: "constant", value: "Paid_Status" } },
        { name: "Order_No", type: "string", rule: { type: "constant", value: "Order_No" } },
        { name: "Order_Item_No", type: "string", rule: { type: "constant", value: "Order_Item_No" } },
        { name: "Order_Item_Status", type: "string", rule: { type: "constant", value: "Order_Item_Status" } },
        { name: "Shipping_Provider", type: "string", rule: { type: "constant", value: "Shipping_Provider" } },
        { name: "Shipping_Speed", type: "string", rule: { type: "constant", value: "Shipping_Speed" } },
        { name: "Shipment_Type", type: "string", rule: { type: "constant", value: "Shipment_Type" } },
        { name: "Reference", type: "string", rule: { type: "constant", value: "Reference" } },
        { name: "Comment", type: "string", rule: { type: "constant", value: "Comment" } },
        { name: "PaymentRefID", type: "string", rule: { type: "constant", value: "PaymentRefID" } }
      ]
    },
    {
      name: "Record",
      role: "detail",
      minOccurs: 1,
      defaultCount: 1,
      fields: [
        {
          name: "Trxn_Date",
          type: "date",
          rule: { type: "macro", token: "{{$date}}", format: "MM/DD/YYYY" }
        },
        {
          name: "Trxn_Type",
          type: "string",
          rule: {
            type: "pool",
            values: [
              "Item Price Credit",
              "Refunds",
              "Item Fee (Lazada Fee)",
              "Shipping Fee (Customer Paid)"
            ]
          }
        },
        {
          name: "Fee_Name",
          type: "string",
          rule: {
            type: "pool",
            values: ["Commission Fee", "Payment Fee", "Shipping Fee", "None"]
          }
        },
        {
          name: "Trxn_Number",
          type: "string",
          rule: { type: "counter", start: 1002340001, pad: 10 }
        },
        {
          name: "Details",
          type: "string",
          rule: { type: "constant", value: "Lazada Order Settlement" }
        },
        {
          name: "Seller_SKU",
          type: "string",
          rule: { type: "counter", start: 5001, pad: 8 }
        },
        {
          name: "Lazada_SKU",
          type: "string",
          rule: { type: "counter", start: 90001001, pad: 10 }
        },
        {
          name: "Amount",
          type: "number",
          rule: { type: "range", min: 150.0, max: 8500.0, decimals: 2 }
        },
        {
          name: "VAT_Amount",
          type: "number",
          rule: { type: "range", min: 18.0, max: 1020.0, decimals: 2 }
        },
        {
          name: "WHT_Amount",
          type: "number",
          rule: { type: "constant", value: "0.00" }
        },
        {
          name: "WHT_Amount_Included",
          type: "string",
          rule: { type: "constant", value: "No" }
        },
        {
          name: "Statement",
          type: "string",
          rule: { type: "macro", token: "{{$date}}", format: "YYYYMMDD" }
        },
        {
          name: "Paid_Status",
          type: "string",
          rule: { type: "constant", value: "Paid" }
        },
        {
          name: "Order_No",
          type: "string",
          rule: { type: "counter", start: 294819200001, pad: 14 }
        },
        {
          name: "Order_Item_No",
          type: "string",
          rule: { type: "counter", start: 1, pad: 1 }
        },
        {
          name: "Order_Item_Status",
          type: "string",
          rule: {
            type: "pool",
            values: ["Delivered", "Completed", "Returned"]
          }
        },
        {
          name: "Shipping_Provider",
          type: "string",
          rule: {
            type: "pool",
            values: ["LEX PH", "Ninja Van", "J&T Express"]
          }
        },
        {
          name: "Shipping_Speed",
          type: "string",
          rule: { type: "constant", value: "Standard" }
        },
        {
          name: "Shipment_Type",
          type: "string",
          rule: { type: "constant", value: "Dropship" }
        },
        {
          name: "Reference",
          type: "string",
          rule: { type: "counter", start: 880001, pad: 8 }
        },
        {
          name: "Comment",
          type: "string",
          rule: { type: "constant", value: "" }
        },
        {
          name: "PaymentRefID",
          type: "string",
          rule: { type: "counter", start: 770001, pad: 8 }
        }
      ]
    }
  ]
};

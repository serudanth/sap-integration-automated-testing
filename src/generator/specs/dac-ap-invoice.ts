import type { FileSpec } from "../types.js";

/**
 * FileSpec for I001_DAC_AP_Invoice_Out_Async (.DAC33, .DAC62, etc.)
 * Strictly models the SAP PI/PO sender channel FCC specification:
 * - Header: BEG,1,M,<filename>,<MMDDYYYY>
 * - Detail: 47 fields (AP_INVOICE) ending with self-referencing FILE_NAME
 * - Trailer: EOF,<detail_count>,<total_amount>
 */
export const dacApInvoiceSpec: FileSpec = {
  id: "I001_DAC_AP_Invoice_Out_Async",
  name: "138100000531261.DAC33",
  description: "SAP PI/PO I001 DAC AP Invoice Outbound Async File Specification",
  format: "delimited",
  fieldSeparator: ",",
  endSeparator: "\n",
  recordsets: [
    {
      name: "BEG",
      role: "header",
      fields: [
        { name: "RECORD_TYPE", rule: { type: "constant", value: "BEG" } },
        { name: "VERSION", rule: { type: "constant", value: "1" } },
        { name: "TYPE_FLAG", rule: { type: "constant", value: "M" } },
        { name: "FILE_NAME", rule: { type: "macro", token: "{{$filename}}" } },
        { name: "BATCH_DATE", rule: { type: "macro", token: "{{$headerDate}}", format: "MMDDYYYY" } }
      ]
    },
    {
      name: "AP_INVOICE",
      role: "detail",
      defaultCount: 1,
      fields: [
        { name: "INVOICE_NUM", rule: { type: "constant", value: "OLS38100000531261" } },
        { name: "INVOICE_TYPE_LOOKUP_CODE", rule: { type: "constant", value: "STANDARD" } },
        { name: "INVOICE_DATE", rule: { type: "macro", token: "{{$date}}", format: "MM/DD/YYYY" } },
        { name: "VENDOR_NUM", rule: { type: "constant", value: "023664" } },
        { name: "VENDOR_SITE_CODE", rule: { type: "constant", value: "HEAD OFFICE" } },
        { name: "INVOICE_AMOUNT", rule: { type: "constant", value: "307422.55" } },
        { name: "INVOICE_CURRENCY_CODE", rule: { type: "constant", value: "PHP" } },
        { name: "TERMS_NAME", rule: { type: "constant", value: "7th of the next month" } },
        { name: "DESCRIPTION", rule: { type: "constant", value: "SMAC Points Contributed" } },
        { name: "AWT_GROUP_NAME", rule: { type: "constant", value: "None" } },
        { name: "ATTRIBUTE_CATEGORY", rule: { type: "constant", value: "Invoice" } },
        { name: "ATTRIBUTE1", rule: { type: "constant", value: "SMAC Redemp 1" } },
        { name: "ATTRIBUTE2", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE3", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE4", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE5", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE6", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE7", rule: { type: "constant", value: "307422.55" } },
        { name: "ATTRIBUTE8", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE9", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE10", rule: { type: "constant", value: "" } },
        { name: "ATTRIBUTE11", rule: { type: "constant", value: "" } },
        { name: "SOURCE", rule: { type: "constant", value: "OLS" } },
        { name: "GROUP_ID", rule: { type: "constant", value: "OLS381000005312601-Y" } },
        { name: "PAYMENT_CURRENCY_CODE", rule: { type: "constant", value: "PHP" } },
        { name: "DOC_CATEGORY_CODE", rule: { type: "constant", value: "Invoice" } },
        { name: "VOUCHER_NUM", rule: { type: "constant", value: "" } },
        { name: "PAYMENT_METHOD_LOOKUP_CODE", rule: { type: "constant", value: "ELECTRONIC" } },
        { name: "PAY_GROUP_LOOKUP_CODE", rule: { type: "constant", value: "CONSO DATED" } },
        { name: "GL_DATE", rule: { type: "macro", token: "{{$date}}", format: "MM/DD/YYYY" } },
        { name: "ACCTS_PAY_CC_CONCATENATED", rule: { type: "constant", value: "381.0000.0000.2002160.0000.8888.000000.000000" } },
        { name: "OPERATING_UNIT", rule: { type: "constant", value: "381-0000" } },
        { name: "PAYMENT_PRIORITY", rule: { type: "constant", value: "88" } },
        { name: "HOLD_NAME", rule: { type: "constant", value: "" } },
        { name: "LINE_NUMBER", rule: { type: "counter", start: 1 } },
        { name: "LINE_TYPE_LOOKUP_CODE", rule: { type: "constant", value: "ITEM" } },
        { name: "AMOUNT", rule: { type: "constant", value: "307422.55" } },
        { name: "ACCOUNTING_DATE", rule: { type: "macro", token: "{{$date}}", format: "MM/DD/YYYY" } },
        { name: "DESCRIPTION_2", rule: { type: "constant", value: "SMAC Points Contributed" } },
        { name: "TAX_CODE", rule: { type: "constant", value: "INVAT-NONE" } },
        { name: "ITEM_DESCRIPTION", rule: { type: "constant", value: "" } },
        { name: "QUANTITY_INVOICED", rule: { type: "constant", value: "" } },
        { name: "UNIT_PRICE", rule: { type: "constant", value: "" } },
        { name: "DISTRIBUTION_SET_NAME", rule: { type: "constant", value: "" } },
        { name: "DIST_CODE_CONCATENATED", rule: { type: "constant", value: "381.0000.8040.6009230.0000.8888.000000.000000" } },
        { name: "AWT_GROUP_NAME_2", rule: { type: "constant", value: "None" } },
        { name: "FILE_NAME", rule: { type: "macro", token: "{{$filename}}" } }
      ]
    },
    {
      name: "EOF",
      role: "trailer",
      fields: [
        { name: "RECORD_TYPE", rule: { type: "constant", value: "EOF" } },
        { name: "TOTAL_COUNT", rule: { type: "autoCount", targetRecordset: "AP_INVOICE" } },
        { name: "TOTAL_AMOUNT", rule: { type: "autoSum", targetRecordset: "AP_INVOICE", targetField: "AMOUNT", decimals: 2 } }
      ]
    }
  ]
};

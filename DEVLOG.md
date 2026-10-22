# AetherFlow Engineering DevLog

This document serves as the persistent architectural log, engineering record, and technical decision journal for the **AetherFlow Test Engine** (`sap-integration-automated-testing`).

---

## [2026-10-22] - 3-Layer Payload Synthesis, Bidirectional ESR Target Inspection & Secure Scenario System

### 1. Context & Motivation
When testing SAP NetWeaver PI/PO 7.5 and SAP BTP Cloud Integration (CPI) interfaces, generating compliant synthetic test payloads is complicated by interface design asymmetries:
- In batch Flat File Conversion (FCC) interfaces (e.g. `I001_DAC_AP_Invoice_Out_Async`), all 48 sender fields are often declared as optional (`minOccurs="0"`) strings in the sender XSD schema.
- However, the ESR Message Mapping (`XI_TRAFO`) requires specific header discriminators (`BEG`), trailer discriminators (`EOF`), and trailer record counts.
- Crucially, target structures (such as `/EOF/RECORD_COUNT` and `/EOF/TOTAL_RECEIPT_AMOUNT`) have mandatory cardinality (`minOccurs="1"`) in the receiver schema. Omitting their source inputs causes runtime mapping failures in SAP PO.
- Furthermore, storing test cases in version control poses data security risks if developers copy production payloads with confidential vendor numbers, employee data, bank details, or live financial amounts.

To resolve these challenges without heuristic guesswork, we designed and implemented a **3-Layer Synthesis Engine** coupled with a **Secure Scenario Manager**.

---

### 2. Architectural Deliverables

#### Layer 1: Technical Schema Constraints
- **Module:** [`src/generator/schema-parser.ts`](file:///home/cpc9181/dev/sap-integration-automated-testing/src/generator/schema-parser.ts), [`src/generator/layer1-generator.ts`](file:///home/cpc9181/dev/sap-integration-automated-testing/src/generator/layer1-generator.ts)
- **Capabilities:**
  - Parses raw WSDL and XSD schemas into an abstract syntax tree (`SchemaTree`).
  - Supports top-level `<xsd:complexType>` schemas (`ifmtypedef`) without requiring explicit `<xsd:element>` roots.
  - Enforces schema-defined primitive datatypes (`date`, `dateTime`, `time`, `decimal`, `integer`, `boolean`, `string`).
  - Enforces field-level constraints: `maxLength`, `fractionDigits`, `totalDigits`, default values, and `enumeration` restrictions.
  - Computes comprehensive schema field statistics (total leaf fields, required fields, optional fields).

#### Layer 2: ESR Mapping AST & Bidirectional Target Inspection
- **Module:** [`src/generator/mapping-rule-extractor.ts`](file:///home/cpc9181/dev/sap-integration-automated-testing/src/generator/mapping-rule-extractor.ts), [`src/generator/layer2-generator.ts`](file:///home/cpc9181/dev/sap-integration-automated-testing/src/generator/layer2-generator.ts)
- **Capabilities:**
  - Resolves Operation Mapping (`MAPPING`) $\rightarrow$ Message Mapping (`XI_TRAFO`) links dynamically from the SAP PO ESR metadata repository.
  - Extracts and decompresses the internal `mappingtool` XML project blob from the ESR metadata stream.
  - Analyzes AST transformation bricks to discover:
    - Row discriminators (e.g. `INVOICE_NUM == "BEG"` for headers, `INVOICE_NUM == "EOF"` for trailers).
    - Mapped header fields (e.g. `VERSION`, `EXTRACT_FREQUENCY_CODE`, `FILENAME_WITH_EXTENSION`, `ZDATE`).
    - Mapped trailer fields (e.g. `RECORD_COUNT`, `TOTAL_RECEIPT_AMOUNT`).
  - **Bidirectional Target Schema Inspection:**
    - Resolves `TARGET_IFR_MESS` from `XI_TRAFO` (or `REQUEST_IN_MES` from `MAPPING`).
    - Fetches the target XSD via ESR `ifmtypedef` (with dynamic resolution through `ifmmessage` wrappers when Data Types and Message Types use disparate naming conventions).
    - Traverses the target schema to identify all mandatory nodes (`minOccurs >= 1`).
    - Traces transformation bricks from mandatory target nodes back to their source fields, marking them as **transitively mandatory**.
  - **Role-Aware Generation:**
    - Generates multi-record repeating structures with distinct row roles (`header`, `detail`, `trailer`).
    - Automatically evaluates `{{count}}` to the exact count of detail records generated.
    - Supports full payload mode (`--all-optional`) and minimal payload mode (`--no-all-optional`). In minimal mode, non-mandatory optional fields (such as `TAX_CODE`, `ATTRIBUTE1`–`11`) are pruned while transitively mandatory fields are strictly preserved in their appropriate row roles.

#### Layer 3: Scenario Overrides, Generative Macros & Secure Anonymization
- **Module:** [`src/generator/macro-evaluator.ts`](file:///home/cpc9181/dev/sap-integration-automated-testing/src/generator/macro-evaluator.ts), [`src/generator/scenario-manager.ts`](file:///home/cpc9181/dev/sap-integration-automated-testing/src/generator/scenario-manager.ts)
- **Expanded Macro Engine:**
  - `{{uuid}}`, `{{uuid:nodash}}`, `{{uuid:upper}}`: RFC4122 v4 UUIDs / SAP GUIDs.
  - `{{mask:PATTERN}}`: Pattern masking (`#` digit, `?` uppercase letter, `*` alphanumeric), e.g. `{{mask:INV-######}}` $\rightarrow$ `INV-398214`.
  - `{{rand_digits:N}}`, `{{rand_alpha:N}}`, `{{rand_alphanumeric:N}}`: Fixed-length randomized tokens.
  - `{{date:FORMAT}}`: Formatted dates (e.g. `MM/DD/YYYY`, `YYYYMMDD`).
  - `{{date_offset:+Nd,FORMAT}}`: Dynamic relative date offsets (`+30d`, `-7d`, `+1m`, `+1y`).
  - `{{yesterday}}`, `{{tomorrow}}`, `{{today}}`, `{{now_iso}}`, `{{epoch}}`, `{{epoch_ms}}`.
  - `{{rand_int:min,max}}`, `{{rand_decimal:min,max,dec}}`, `{{choice:a,b,c}}`.
  - `{{counter}}`, `{{counter:start,pad}}`.
  - `{{env:VAR,fallback}}`: Runtime environment variable injection.
- **Secure Scenario File Management:**
  - Declarative `.scenario.yaml` format for tracking test cases in Git without hardcoded production values.
  - Built-in automatic sanitization on save: abstracts explicit dates to `{{date:FORMAT}}`, document numbers to `{{mask:PREFIX####}}`, and monetary amounts to `{{rand_decimal:min,max,2}}`.

#### CLI Integration: `aetherflow generate-mapping-test`
- **Module:** [`src/cli/index.ts`](file:///home/cpc9181/dev/sap-integration-automated-testing/src/cli/index.ts)
- **Options:**
  - `[interfaceName]`: Sender interface name (optional if `--scenario` is specified).
  - `-c, --count <number>`: Number of detail records to generate.
  - `-l, --layer <layer>`: Modifier layer (1 = Schema only, 2 = Mapping rules, 3 = Custom overrides/macros).
  - `--all-optional` / `--no-all-optional`: Toggle between full schema and minimal required payloads.
  - `--set <pair>`: Explicit field override (supports generative macros and role prefixes).
  - `--scenario <path>`: Load case definition directly from `.scenario.yaml` or `.scenario.json`.
  - `--save-scenario <path>`: Automatically sanitize and export active CLI configuration into a reusable scenario file.
  - `-o, --out <path>`: XML output destination.

---

### 3. Verification & Live Systems Tested

1. **`I001_DAC_AP_Invoice_Out_Async` (FCC Flat-File Batch Pattern):**
   - Verified extraction of `I001_DAC_AP_Invoice_out_to_I001_AP_Invoice_in` Message Mapping and `I001_DAC_AP_Invoice_IN` target schema.
   - Identified 8 mandatory target fields across `/BEG` and `/EOF`.
   - Verified that `INVOICE_TYPE_LOOKUP_CODE` and `INVOICE_DATE` are correctly identified as transitively mandatory for `/EOF/RECORD_COUNT` and `/EOF/TOTAL_RECEIPT_AMOUNT`.
   - Verified that minimal payload generation (`--no-all-optional`) preserves required header/trailer parameters while pruning 35+ unmapped detail fields.
2. **`SI_I025_AR_Lazada_OB_AS` (Lazada AR Receipt Multi-Record Proxy):**
   - Verified extraction of `MM_I025_AR_Lazada_to_AR_StdReceiptsProxy` and target schema `DT_AR_Other_Tenders_StdReceipts`.
   - Indexed all 22 repeating `<Record>` fields and confirmed all target nodes are optional (`minOccurs="0"`).
   - Validated multi-record generation with custom scenario masks and payment status indicators.

---

### 4. Test Suite Status
- **Test Framework:** Vitest v3
- **Coverage:** 22 test suites, 178 unit & integration tests passing (100% pass rate).
- **Network Tests:** Configured with 20-second timeout for live SAP PO ESR read endpoints.

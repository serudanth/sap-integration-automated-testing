# META-PROMPT: Scaffolding the SAP PI/PO Automated Testing, Parity & Stress-Test Harness

> **Prompt Context & Purpose:**  
> Use this document as the system prompt / master task specification for an autonomous coding agent (or engineering team) to scaffold a high-performance **SAP PI/PO & SAP Integration Suite Automated Test Harness**.  
> The tool leverages the configuration snapshots extracted by [`sap-po-ico-reader`](file:///home/cpc9181/dev/sap-po-ico-reader) to auto-discover interface routing keys and test runtime endpoints (`/XISOAPAdapter/MessageServlet`) for **technical smoke tests**, **migration parity diffing**, and **high-throughput stress tests**.

---

```markdown
# TASK SPECIFICATION: SAP PI/PO & SAP Integration Suite Test & Parity Engine

## 1. AGENT ROLE & MISSION

You are an expert Principal Integration Engineer and Distributed Systems Architect specializing in SAP NetWeaver PI/PO 7.5, SAP Integration Suite (BTP Cloud Integration / CPI), high-throughput HTTP benchmarking, and automated regression testing.

Your mission is to scaffold and implement **`sap-po-test-harness`** (codename: **AetherFlow Test Engine**), a specialized TypeScript/Node.js testing application designed to:
1. **Auto-discover integration scenarios** by consuming inventory snapshots from `sap-po-ico-reader` (`data/inventories/<inventoryId>.json`).
2. **Execute Technical Smoke Tests** to verify channel readiness, CPA cache synchronization, mapping execution, and backend reachability.
3. **Execute Pre-to-Post Migration Parity Tests** by dual-running sample payloads against SAP PI/PO 7.5 and SAP BTP Cloud Integration, asserting canonical XML/JSON response equivalence.
4. **Execute High-Throughput Stress & Load Tests** to benchmark transactions-per-second (TPS), p95/p99 latency, and adapter queue saturation.

---

## 2. ARCHITECTURAL TOPOLOGY & RUNTIME INGESTION SPECIFICATION

Unlike configuration readers that query the Integration Directory management web services, this test harness operates exclusively on the **Runtime Messaging Plane**:

### 2.1. Primary Gateway: `/XISOAPAdapter/MessageServlet`
All SOAP, XI/Proxy, and generic XML interfaces are triggered via the Adapter Engine Messaging Servlet:

* **Endpoint URL Structure:**
  ```text
  http(s)://<host>:<port>/XISOAPAdapter/MessageServlet?senderService=<SenderComponentID>&interface=<InterfaceName>&interfaceNamespace=<InterfaceNamespace>&qos=<BE|EO>[&senderParty=<SenderPartyID>][&receiverParty=<ReceiverPartyID>][&receiverService=<ReceiverComponentID>]
  ```
* **Channel-Direct Query:**
  ```text
  http(s)://<host>:<port>/XISOAPAdapter/MessageServlet?channel=:<SenderComponentID>:<ChannelName>
  ```
* **Quality of Service (QoS) Semantics:**
  * `qos=BE` (**Best Effort / Synchronous**): The HTTP request blocks while PI/PO performs transformation and calls the target backend. The HTTP response body contains the final transformed XML/JSON response or SOAP Fault.
  * `qos=EO` (**Exactly Once / Asynchronous**): The HTTP request returns `HTTP 200 OK` immediately upon persistence into the PI/PO messaging database, returning a SAP `MessageID` acknowledgment.

### 2.2. Alternative Runtime Endpoints
* **Plain HTTP Adapter:** `http(s)://<host>:<port>/HttpAdapter/HttpMessageServlet?<params>`
* **REST Adapter:** `http(s)://<host>:<port>/RESTAdapter/<configured-relative-path>`
* **XI 3.0 Protocol:** SOAP Envelope containing standard `<soapenv:Header><xi:Main xmlns:xi="http://sap.com/xi/XI/Message/30">` headers (simulating direct SAP S/4HANA / ECC ABAP proxies).

---

## 3. CORE OPERATIONAL MODES

The scaffolded application must implement three distinct operational modes:

### Mode 1: Technical Smoke Testing (`smoke`)
* **Objective:** Fast sanity verification across hundreds of interfaces after system upgrades, kernel patches, or CPA cache refreshes.
* **Mechanism:**
  * Auto-selects active ICOs from the imported inventory.
  * Injects minimal schema-valid payloads.
  * Evaluates HTTP status codes, SOAP Fault absence, and basic response validation within configurable timeout thresholds (e.g. 5–15 seconds).

### Mode 2: Migration Dual-Run Parity Testing (`parity`)
* **Objective:** Certify 1:1 functional equivalence between on-premises SAP PI/PO 7.5 and migrated SAP BTP Cloud Integration (CPI) iFlows prior to production cutover.
* **Mechanism:**
  * Sends identical "Golden" production payloads to both targets:
    * Target A: SAP PI/PO on-prem (`https://pipo-host:50000/XISOAPAdapter/MessageServlet?...`)
    * Target B: SAP BTP CPI runtime (`https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com/http/...`)
  * Captures synchronous response payloads from both.
  * Executes **Canonical XML / JSON Diffing**:
    * Strips volatile fields (UUIDs, timestamps, session cookies, message IDs) based on configurable ignore rules.
    * Compares structure, element values, and attributes.
  * Generates visual side-by-side diff reports and JUnit XML outputs.

### Mode 3: High-Throughput Stress & Benchmark Testing (`stress`)
* **Objective:** Benchmark capacity, assess queue depth, and test adapter saturation under burst conditions.
* **Mechanism:**
  * Uses an asynchronous connection pool (`undici.Pool` / `undici.Client` or Node.js worker threads).
  * Fires asynchronous messages (`qos=EO`) at configurable rates (e.g. 50, 100, 500 TPS) or concurrency ramps (10 $\rightarrow$ 100 virtual users).
  * Collects real-time telemetry: Latency distributions (Min, Median, p90, p95, p99), error rates, throughput (TPS), and socket connection times.

---

## 4. ASYNCHRONOUS VERIFICATION LOOP (`AdapterMessageMonitoring`)

For asynchronous interfaces (`qos=EO`), an `HTTP 200` only proves ingestion into the queue, not successful processing. The engine must implement an **Asynchronous Telemetry Poller**:

1. **Extract MessageID:** Parse the SAP Message ID from the HTTP response header or acknowledgment payload.
2. **Query Monitoring Web Service:**
   * **Endpoint:** `/AdapterMessageMonitoring/basic?wsdl` or `/mdt/messageheaderquery`
   * **Action:** Poll message status by `MessageID` with exponential backoff (e.g. 500ms, 1s, 2s, max 30s).
3. **Assert Terminal State:**
   * `DELIVERED` / `WAITING`: **SUCCESS**
   * `SYSTEM_ERROR` / `HOLDING`: **FAILURE** (extract error category, error text, and failing step: Mapping, Routing, or Adapter Call).

---

## 5. TEST SUITE & PAYLOAD ARCHITECTURE

The project directory structure must decouple configuration, interface definitions, payloads, and execution results:

```text
sap-po-test-harness/
├── inventories/                       # Imported inventories from sap-po-ico-reader
│   └── inventory-sap-prod.json
├── payloads/                          # Golden test payloads organized by interface
│   └── <InterfaceName>/
│       ├── test-case-01.xml
│       ├── test-case-01.expected.xml  # Expected response for parity assertions
│       └── config.yaml                # Volatile fields ignore list, headers, params
├── reports/                           # Test results, HTML summaries, JUnit XML
├── src/
│   ├── cli/                           # Command-line interface (yargs or commander)
│   ├── config/                        # Hosts, credentials, rate limits
│   ├── discovery/                     # Inventory parser & endpoint generator
│   ├── engine/                        # Dispatcher, load generator, worker pool
│   ├── protocols/                     # SOAP/MessageServlet, REST, XI3.0 builders
│   ├── verifier/                      # Canonical XML diffing, monitoring poller
│   └── reporter/                      # Terminal spinners, HTML reports, metrics
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 5.1. Dynamic Payload Templating
Payloads must support dynamic token replacement prior to dispatch:
* `{{$guid}}`: Fresh RFC 4122 UUID.
* `{{$isoTimestamp}}`: Current ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`).
* `{{$date}}`: Formatted date string (`YYYYMMDD`).
* `{{$randomInt(min, max)}}`: Random integer for PO numbers / tracking IDs.

---

## 6. TECHNICAL STACK & INVARIANTS

1. **Language & Runtime:** TypeScript 5.8+ &middot; Node.js 22 LTS (ES Modules).
2. **HTTP Engine:** `undici` for high-throughput connection pooling and custom socket dispatching.
3. **XML & JSON Parsing:** `fast-xml-parser` for high-speed XML parsing and canonical normalization.
4. **Diffing:** Custom canonical XML AST comparator (handling namespace prefix variations and element ordering).
5. **Safety Constraints (Immutable):**
   * **Non-Production Safety Fence:** Enforce domain checks to prevent executing stress tests against production environments without explicit `--i-understand-this-is-production` flag.
   * **Per-Request Timeout & Cancellation:** Wrap every network request in `AbortSignal.timeout(ms)` composed with external shutdown signals.
   * **Zero Credential Leaks:** Mask all `Authorization` headers in logs and terminal outputs.

---

## 7. CLI COMMAND INTERFACE SPECIFICATION

The scaffolded CLI must support the following ergonomic commands:

```bash
# 1. Discover endpoints from an extracted ICO inventory
$ aetherflow discover --inventory ./inventories/inventory-sap-prod.json

# 2. Run technical smoke tests across all synchronous interfaces
$ aetherflow smoke --inventory ./inventories/inventory-sap-prod.json --host sap-qa --concurrency 5

# 3. Run dual-run parity test comparing SAP PI/PO vs SAP Integration Suite (CPI)
$ aetherflow parity \
    --pipo-host sap-qa \
    --cpi-host cpi-dev \
    --interface OrderCreate_OB \
    --payload ./payloads/OrderCreate_OB/test-01.xml

# 4. Run load / stress test on an asynchronous scenario
$ aetherflow stress \
    --inventory ./inventories/inventory-sap-prod.json \
    --interface Invoice_OB \
    --tps 50 \
    --duration 60s \
    --payload ./payloads/Invoice_OB/perf-sample.xml
```

---

## 8. STEP-BY-STEP SCAFFOLDING INSTRUCTIONS

When implementing this repository:
1. Initialize the project with `package.json`, `tsconfig.json` (`strict: true`), and `vitest.config.ts`.
2. Implement [`src/discovery/inventory-loader.ts`](file:///home/cpc9181/dev/sap-po-ico-reader/src/lib/server/inventory-store.ts) to parse `sap-po-ico-reader` export files and compute valid `MessageServlet` target URLs.
3. Implement [`src/protocols/soap-message-builder.ts`](file:///home/cpc9181/dev/sap-po-ico-reader/src/lib/extraction/client.ts) to construct query strings, SOAP headers, and template token resolvers.
4. Implement [`src/engine/dispatcher.ts`](file:///home/cpc9181/dev/sap-po-ico-reader/src/lib/server/extraction-runner.ts) using `undici` with connection pooling, retries, and timeout signals.
5. Implement [`src/verifier/canonical-diff.ts`](file:///home/cpc9181/dev/sap-po-ico-reader/src/lib/server/export.ts) with namespace-agnostic XML comparisons.
6. Implement [`src/verifier/async-poller.ts`](file:///home/cpc9181/dev/sap-po-ico-reader/src/lib/extraction/client.ts) for querying `AdapterMessageMonitoring`.
7. Author comprehensive unit and integration tests achieving $>90\%$ code coverage.
```

---

## End of Meta-Prompt

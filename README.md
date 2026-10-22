# AetherFlow Test Engine (`sap-po-test-harness`)

[![Build & Test](https://img.shields.io/badge/tests-112%20passed-brightgreen.svg)](#)
[![Coverage](https://img.shields.io/badge/coverage->93%25-brightgreen.svg)](#)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#)
[![Node](https://img.shields.io/badge/node->=20.0.0-informational.svg)](#)

**AetherFlow Test Engine** is an enterprise-grade automated testing, parity certification, high-throughput stress benchmarking, and living documentation harness for **SAP NetWeaver Process Integration / Process Orchestration (PI/PO 7.5)** and **SAP Integration Suite (BTP Cloud Integration / CPI)**.

Designed to operate seamlessly alongside [`sap-po-ico-reader`](https://github.com/serudanth/sap-po-ico-reader), AetherFlow ingests exported inventory snapshots to auto-discover interface routing keys and test runtime messaging plane endpoints (`/XISOAPAdapter/MessageServlet`).

> 📖 **Authoritative Specification:** For complete details on the modular engine architecture, `CanonicalScenario` model, ecosystem platform manifests, and implementation blueprints, see [docs/ARCHITECTURE_AND_CANONICAL_SPEC.md](file:///home/cpc9181/dev/sap-integration-automated-testing/docs/ARCHITECTURE_AND_CANONICAL_SPEC.md).

---

## 🌟 Key Capabilities

1. **Auto-Discovery & Canonical Scenario Normalization (`discover`)**
   - Ingests SAP PI/PO configuration snapshots exported by [`sap-po-ico-reader`](https://github.com/serudanth/sap-po-ico-reader) (`data/inventories/<inventoryId>.json`).
   - Normalizes raw ICO and channel definitions into a unified `CanonicalScenario` model with inferred functional domains, integration patterns, and mutability safety tiers.
   - Automatically builds target runtime endpoints with exact routing parameters (`senderService`, `interface`, `interfaceNamespace`, `qos`, `senderParty`, `receiverParty`, `receiverService`).
   - *(Note: BTP / CPI live extraction is decoupled and scheduled for a future milestone).*

2. **Automated WSDL-Driven Test Suite Generator (`generate`)**
   - Resolves live Directory WSDLs or offline schemas to analyze XSD contracts (mandatory elements, types, enums, boundaries).
   - Generates persistent test suites (`fixtures/<scenarioId>/`) containing schema-valid happy path, negative validation, and boundary test cases with `suite.yaml` manifests.
   - Decouples test suite generation from test execution.

3. **Technical Smoke Testing (`smoke`)**
   - High-speed validation across hundreds of interfaces following system upgrades, kernel patches, or CPA cache refreshes.
   - Dispatches schema-valid or custom golden payloads with configurable concurrency.
   - Detects HTTP errors, connection drops, and SOAP Faults with root-cause extraction.

4. **Migration Dual-Run Parity Testing (`parity`)**
   - Pre-to-post migration certification comparing SAP PI/PO 7.5 on-premises against SAP BTP Cloud Integration (CPI) iFlows prior to cutover.
   - Dual-dispatches identical production payloads to both runtimes simultaneously.
   - Executes **Canonical XML & JSON Diffing**:
     - Namespace prefix-agnostic structural comparison (e.g. `ns0:Order` vs `p:Order`).
     - Automated stripping of volatile/transient fields (UUIDs, timestamps, session cookies, message IDs).
     - Generates interactive side-by-side HTML diff reports and JUnit XML outputs.

5. **High-Throughput Stress & Benchmark Testing (`stress`)**
   - Benchmarks interface throughput (TPS), adapter queue depth, and socket pooling limits.
   - Precise rate pacing (e.g. 50, 100, 500 TPS) with millisecond-accuracy latency tracking.
   - Computes full statistical distributions: Min, Mean, Median (p50), p90, p95, p99, and Max latency.

6. **Living Interface Documentation & Passports (`doc`)**
   - Solves the legacy interface documentation gap by generating comprehensive **Interface Passports** in Markdown and HTML.
   - Includes auto-generated Mermaid sequence diagrams, channel as-built configurations, ready-to-execute cURL test commands, and Day-2 operational triage runbooks.
   - Generates Master Excel matrices (`.xlsx`) and Word specifications (`.docx`) for corporate SharePoint sign-offs.

7. **Asynchronous Telemetry Poller (`AdapterMessageMonitoring`)**
   - For asynchronous messages (`qos=EO`), an HTTP 200 acknowledgment only confirms queue persistence.
   - The engine automatically extracts the SAP `MessageID` and polls `/AdapterMessageMonitoring/basic` using exponential backoff.
   - Asserts terminal statuses: `DELIVERED` (Success), `WAITING` (In Progress), `SYSTEM_ERROR` / `HOLDING` (Failure with error category and failing step: Mapping, Routing, or Adapter Call).

8. **Enterprise Safety & Masking Invariants**
   - **Non-Production Safety Fence:** Defaults to executing only `read-only` scenarios; blocks mutating scenarios unless `--allow-mutating` is passed; blocks stress tests on mutating scenarios unless `--force-mutating-stress` is passed; blocks production hosts without `--i-understand-this-is-production`.
   - **Zero Credential Leaking:** Redacts all `Authorization` headers, passwords, and tokens from logs, terminal tables, and reports.
   - **Per-Request Timeouts & Cancellation:** Wraps all operations in composable `AbortSignal` timeout controllers.

---

## 📦 Installation & Setup

### Prerequisites
- Node.js >= 20 LTS (Node 22 LTS recommended)
- npm >= 10

```bash
# Clone the repository
git clone https://github.com/serudanth/sap-integration-automated-testing.git
cd sap-integration-automated-testing

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link CLI globally (optional)
npm link
```

---

## 🚀 CLI Usage & Ergonomics

The test harness exposes the ergonomic `aetherflow` command:

```text
Usage: aetherflow [options] [command]

Commands:
  discover [options]  Discover and normalize integration scenarios from an ICO inventory
  generate [options]  Generate synthetic test suites and mock payloads from WSDL/XSD contracts
  smoke [options]     Execute technical smoke tests against discovered SAP PI/PO endpoints
  parity [options]    Run dual-run parity tests comparing SAP PI/PO 7.5 against SAP BTP CPI
  stress [options]    Benchmark throughput (TPS) and latency percentiles under high load
  doc [options]       Generate living Interface Passports (Markdown, HTML, Excel, Word)
```

### 1. Auto-Discover Endpoints

Inspect runtime URLs and routing parameters directly from an ICO inventory:

```bash
# Discover all active interfaces
aetherflow discover --inventory ./inventories/sample-inventory.json

# Filter by interface name and QoS
aetherflow discover \
  --inventory ./inventories/sample-inventory.json \
  --filter Order \
  --qos BE
```

### 2. Generate Synthetic Test Suites (`generate`)

Synthesize schema-valid positive, negative, and boundary test cases directly from WSDLs:

```bash
# Generate test suites for all scenarios in an inventory
aetherflow generate --inventory ./inventories/sample-inventory.json --host sap-qa --output ./fixtures/

# Generate test suite for a specific interface
aetherflow generate --scenario POS_SYSTEM_SalesOrder_OB_S4HANA --host sap-qa

# Offline generation using local schemas
aetherflow generate --inventory ./inventories/sample-inventory.json --schemas-dir ./schemas/
```

### 3. Run Technical Smoke Tests

Run fast parallel sanity tests across discovered endpoints:

```bash
# Run smoke tests with concurrency 5 and 10s timeout
aetherflow smoke \
  --inventory ./inventories/sample-inventory.json \
  --host sap-qa \
  --concurrency 5 \
  --timeout 10000 \
  --junit ./reports/smoke-junit.xml

# Include asynchronous verification loop for EO interfaces
aetherflow smoke \
  --inventory ./inventories/sample-inventory.json \
  --host sap-qa \
  --verify-async
```

### 4. Run Migration Dual-Run Parity Tests

Certify 1:1 functional equivalence between SAP PI/PO and SAP BTP CPI:

```bash
aetherflow parity \
  --pipo-host sap-qa \
  --cpi-host cpi-dev \
  --interface SalesOrder_OB \
  --payload ./payloads/SalesOrder_OB/test-01.xml \
  --html ./reports/parity-report.html \
  --junit ./reports/parity-junit.xml
```

### 5. Run High-Throughput Stress Benchmarks

Benchmark adapter queue saturation and p95/p99 latency distributions:

```bash
aetherflow stress \
  --inventory ./inventories/sample-inventory.json \
  --interface SalesOrder_OB \
  --host sap-dev \
  --tps 50 \
  --duration 60s \
  --payload ./payloads/SalesOrder_OB/test-01.xml \
  --html ./reports/stress-report.html
```

> [!CAUTION]
> If targeted against a production system (`*prod*`, `*prd*`, `SPP*`), AetherFlow triggers the **Non-Production Safety Fence** and terminates execution.
> To explicitly run against production, you must supply `--i-understand-this-is-production`.

### 6. Generate Living Interface Passports (`doc`)

Auto-generate comprehensive architectural specifications and operational runbooks directly from normalized inventories:

```bash
# Generate all formats (Markdown, HTML, Excel matrix, Word specs)
aetherflow doc --inventory ./inventories/sample-inventory.json --output ./docs/passports/ --all-formats

# Generate only Excel matrix for SharePoint
aetherflow doc --inventory ./inventories/sample-inventory.json --output ./docs/passports/ --format xlsx

# Generate passport for a specific legacy interface
aetherflow doc \
  --inventory ./inventories/sample-inventory.json \
  --interface SalesOrder_OB \
  --output ./docs/passports/SalesOrder_OB.md
```

---

## 📁 Test Suite & Payload Architecture

```text
sap-integration-automated-testing/
├── docs/                              # Technical specifications and architecture
│   ├── ARCHITECTURE_AND_CANONICAL_SPEC.md # Single Source of Truth (SSOT)
│   └── passports/                     # Generated living interface passports
├── fixtures/                          # WSDL-generated test suites & mock payloads
│   └── <scenarioId>/
│       ├── 01-happy-path.xml          # Schema-valid request
│       ├── 02-negative-missing-mandatory.xml
│       ├── 03-boundary-limits.xml
│       └── suite.yaml                 # Scenario test manifest & assertions
├── inventories/                       # Imported inventories from sap-po-ico-reader
│   └── sample-inventory.json
├── payloads/                          # Golden production payloads organized by interface
│   └── SalesOrder_OB/
│       ├── test-01.xml                # Template payload with dynamic tokens
│       ├── test-01.expected.xml       # Optional golden expected response
│       └── config.yaml                # Volatile fields ignore list, headers, params
├── schemas/                           # Cached or offline WSDL / XSD contracts
├── reports/                           # Output HTML summaries, diffs, and JUnit XML
├── src/
│   ├── cli/                           # Commander CLI entry points & commands
│   ├── config/                        # Hosts configuration, heuristics, safety fence
│   ├── discovery/                     # Inventory loader & scenario normalizer
│   ├── engine/                        # undici connection pooling, smoke, parity, and stress runners
│   ├── kernel/                        # Ecosystem platform registry & manifest manager
│   ├── protocols/                     # Protocol SPI (soap, xi3, http, rest), template engine
│   ├── reporter/                      # Terminal spinners, JUnit XML, HTML, and Office exports
│   ├── types/                         # CanonicalScenario & ecosystem type definitions
│   └── verifier/                      # Canonical XML/JSON diffing, AdapterMessageMonitoring poller
├── aetherflow.config.yaml             # Ecosystem manifests, heuristics, and scenario overrides
├── hosts.example.json                 # Host definition template
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Dynamic Payload Templating
Payload files support dynamic tokens resolved prior to network dispatch:
- `{{$guid}}`: Fresh RFC 4122 UUID (`crypto.randomUUID()`)
- `{{$isoTimestamp}}`: Current ISO 8601 UTC timestamp (`2026-10-08T12:00:00.000Z`)
- `{{$date}}`: Formatted date string (`YYYYMMDD`)
- `{{$timestamp}}`: Current Unix epoch milliseconds
- `{{$randomInt(min, max)}}`: Random integer within range (e.g. `{{$randomInt(100000, 999999)}}`)

### Volatile Fields Configuration (`config.yaml`)
To prevent false-positive diffing mismatches from dynamic timestamps or message IDs:

```yaml
ignorePaths:
  - TrackingGuid
  - CreatedTimestamp
  - ProcessingTimestamp
  - MessageGuid
  - SessionId

ignoreRegex:
  - "^temp.*"

headers:
  Content-Type: application/xml
  X-Client: AetherFlow

timeoutMs: 15000
```

---

## ⚙️ Configuration (`hosts.json` & `.env`)

Define test environments in `hosts.json` (reusing configuration from `sap-po-ico-reader`):

```json
[
  {
    "id": "sap-qa",
    "label": "SAP PI/PO QA Environment",
    "host": "sap-qa.corp.internal",
    "port": 50001,
    "user": "PI_TEST_USER",
    "password": "SecretPassword",
    "https": true,
    "insecure": true,
    "isProduction": false
  },
  {
    "id": "cpi-dev",
    "label": "SAP BTP Integration Suite Dev",
    "host": "tenant-dev.it-cpi001.cfapps.eu10.hana.ondemand.com",
    "port": 443,
    "user": "sb-client-id",
    "password": "client-secret",
    "https": true,
    "insecure": false,
    "isProduction": false
  }
]
```

Or configure via environment variables in `.env`:
```bash
SAP_PO_HOST=sap-qa.corp.internal
SAP_PO_PORT=50000
SAP_PO_USER=PI_TEST_USER
SAP_PO_PASSWORD=SecretPassword
SAP_PO_HTTPS=false
```

---

## 🧪 Testing & Code Coverage

Run the test suite with Vitest:

```bash
# Run all unit and integration tests
npm test

# Run tests with code coverage analysis (>93% coverage)
npm run test:coverage
```

---

## 📄 License

Apache License 2.0. Copyright (c) 2026.

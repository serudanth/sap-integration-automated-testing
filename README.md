# AetherFlow Test Engine (`sap-po-test-harness`)

[![Build & Test](https://img.shields.io/badge/tests-98%20passed-brightgreen.svg)](#)
[![Coverage](https://img.shields.io/badge/coverage->93%25-brightgreen.svg)](#)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#)
[![Node](https://img.shields.io/badge/node->=20.0.0-informational.svg)](#)

**AetherFlow Test Engine** is an enterprise-grade automated testing, parity certification, and high-throughput stress benchmarking harness for **SAP NetWeaver Process Integration / Process Orchestration (PI/PO 7.5)** and **SAP Integration Suite (BTP Cloud Integration / CPI)**.

Designed to operate seamlessly alongside [`sap-po-ico-reader`](https://github.com/serudanth/sap-po-ico-reader), AetherFlow ingests exported inventory snapshots to auto-discover interface routing keys and test runtime messaging plane endpoints (`/XISOAPAdapter/MessageServlet`).

---

## 🌟 Key Capabilities

1. **Auto-Discovery via Configuration Snapshots**
   - Ingests inventory files exported by `sap-po-ico-reader` (`data/inventories/<inventoryId>.json`).
   - Automatically builds target runtime endpoints with exact routing parameters (`senderService`, `interface`, `interfaceNamespace`, `qos`, `senderParty`, `receiverParty`, `receiverService`).

2. **Mode 1: Technical Smoke Testing (`smoke`)**
   - High-speed validation across hundreds of interfaces following system upgrades, kernel patches, or CPA cache refreshes.
   - Dispatches schema-valid or custom golden payloads with configurable concurrency.
   - Detects HTTP errors, connection drops, and SOAP Faults with root-cause extraction.

3. **Mode 2: Migration Dual-Run Parity Testing (`parity`)**
   - Pre-to-post migration certification comparing SAP PI/PO 7.5 on-premises against SAP BTP Cloud Integration (CPI) iFlows prior to cutover.
   - Dual-dispatches identical production payloads to both runtimes simultaneously.
   - Executes **Canonical XML & JSON Diffing**:
     - Namespace prefix-agnostic structural comparison (e.g. `ns0:Order` vs `p:Order`).
     - Automated stripping of volatile/transient fields (UUIDs, timestamps, session cookies, message IDs).
     - Generates interactive side-by-side HTML diff reports and JUnit XML outputs.

4. **Mode 3: High-Throughput Stress & Benchmark Testing (`stress`)**
   - Benchmarks interface throughput (TPS), adapter queue depth, and socket pooling limits.
   - Precise rate pacing (e.g. 50, 100, 500 TPS) with millisecond-accuracy latency tracking.
   - Computes full statistical distributions: Min, Mean, Median (p50), p90, p95, p99, and Max latency.

5. **Asynchronous Telemetry Poller (`AdapterMessageMonitoring`)**
   - For asynchronous messages (`qos=EO`), an HTTP 200 acknowledgment only confirms queue persistence.
   - The engine automatically extracts the SAP `MessageID` and polls `/AdapterMessageMonitoring/basic` using exponential backoff.
   - Asserts terminal statuses: `DELIVERED` (Success), `WAITING` (In Progress), `SYSTEM_ERROR` / `HOLDING` (Failure with error category and failing step: Mapping, Routing, or Adapter Call).

6. **Enterprise Safety & Masking Invariants**
   - **Non-Production Safety Fence:** Enforces domain inspection to block executing destructive or stress tests against production environments without the explicit `--i-understand-this-is-production` flag.
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
  discover [options]  Discover runtime messaging endpoints from an exported ICO inventory
  smoke [options]     Execute technical smoke tests against discovered SAP PI/PO endpoints
  parity [options]    Run dual-run parity tests comparing SAP PI/PO 7.5 against SAP BTP CPI
  stress [options]    Benchmark throughput (TPS) and latency percentiles under high load
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

### 2. Run Technical Smoke Tests

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

### 3. Run Migration Dual-Run Parity Tests

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

### 4. Run High-Throughput Stress Benchmarks

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

---

## 📁 Test Suite & Payload Architecture

```text
sap-integration-automated-testing/
├── inventories/                       # Imported inventories from sap-po-ico-reader
│   └── sample-inventory.json
├── payloads/                          # Golden test payloads organized by interface
│   └── SalesOrder_OB/
│       ├── test-01.xml                # Template payload with dynamic tokens
│       ├── test-01.expected.xml       # Optional golden expected response
│       └── config.yaml                # Volatile fields ignore list, headers, params
├── reports/                           # Output HTML summaries and JUnit XML
├── src/
│   ├── cli/                           # Commander CLI entry points
│   ├── config/                        # Hosts configuration, credential masking, safety fence
│   ├── discovery/                     # Inventory loader & MessageServlet endpoint generator
│   ├── engine/                        # undici connection pooling, smoke runner, parity & stress runners
│   ├── protocols/                     # SOAP 1.1/1.2, XI 3.0 protocol, template engine, response parser
│   ├── reporter/                      # Terminal spinners & tables, JUnit XML, HTML reports
│   └── verifier/                      # Canonical XML/JSON diffing, AdapterMessageMonitoring poller
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

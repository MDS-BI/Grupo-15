# Implementation Plan: Operations & Manufacturing Module (ERP)

**Branch**: `002-operations-manufacturing` | **Date**: 2026-10-21 | **Updated**: 2026-10-29
**Spec**: `specs/002-operations-manufacturing/spec.md`
**Input**: Feature specification and data contracts derived from `erp_data_model.md` (Module 7: Operations / Manufacturing) and `specs/002-operations-manufacturing/data-model.md`
**Methodology**: Spec-Driven Development (Spec-Kit)

---

## 1. Executive Summary & MVP Scope

### 1.1 Summary

Build a **frontend-only functional MVP** for the Operations & Manufacturing module of an integrated ERP. The module centralizes the *plan → schedule → execute → record* manufacturing cycle over a modular template, powered entirely by **mock data and local state management** so that the eventual replacement of mocks with real APIs requires zero changes to the presentation layer.

The MVP covers five production routines:

1. **Centralized BOM/Routing management** — author multi-level Bills of Materials (`bill_of_materials`, `bom_components`) and manufacturing routings (`routings`, `routing_operations`) over work centers (`work_centers`).
2. **Production Order dispatching** — create and release orders (`production_orders`) from stock replenishment or make-to-order demand, snapshotting routing operations into `production_order_operations`.
3. **Shop-floor operation tracking** — advance operation stages and capture real progress (`production_order_operations`).
4. **Shop-floor recording** — log actual material consumption (`material_consumption`) and finished goods output (`production_output`).
5. **Operator shift tracking (US-06)** — start/finish the active operation with one toggle button, justify delays from a reusable reason catalog, and keep per-shift and cumulative piece counters (`production_shifts`, `operation_delays`, `delay_reasons`).

The data model remains the single source of truth (`data-model.md`); the UI is a typed, traceable projection of that schema. Type fidelity is enforced with JSDoc typedefs in `src/domain/types.js` (the as-built stack is vanilla JavaScript, not TypeScript).

### 1.2 MVP In-Scope / Out-of-Scope

| In Scope (MVP) | Out of Scope (deferred) |
|---|---|
| BOM create/view (multi-level), routing & work center configuration | Automated MRP / netting engine |
| Production order create, dispatch, cancel, and status tracking | Finite/infinite-capacity auto-scheduling |
| Operation execution, consumption and output logging | Real-time MES machine telemetry |
| Operator shift tracking: toggle start/finish, delay justification, per-shift + cumulative counters | Biometric time clocks, payroll integration, per-operator rankings |
| KPI dashboard (active orders, capacity utilization, scrap/completion) | Cost accounting & GL postings |
| Mock-driven, local-persistence demo flows | Backend, auth, and multi-tenant enforcement |
| Read-only integration hooks to Logistics/Quality/Sales | Two-way synchronization with external systems |

### 1.3 User Personas

| Persona | Responsibilities | Primary Entities Owned |
|---|---|---|
| **Production Planner / Plant Manager** | Oversees capacity; creates and versions BOMs and routings; schedules, prioritizes, and dispatches production orders; monitors shop-floor load. | `bill_of_materials`, `bom_components`, `work_centers`, `routings`, `routing_operations`, `production_orders` |
| **Machine Operator** | Starts/finishes the active operation, logs justified delays, counts pieces per shift, and sees cumulative progress. | `production_shifts`, `operation_delays`, `delay_reasons`, `production_order_operations` (progress fields) |
| **Shop Floor Operator / Supervisor** | Updates operation progress; registers consumed materials; logs completed batches, scrap, and output; marks operations complete. | `production_order_operations`, `material_consumption`, `production_output` |

### 1.4 Integration Boundaries

The module references, but does **not** own, the following boundary entities. All are consumed as **read-only mock** datasets in the MVP:

- **Logistics / Inventory** — `products` (finished goods and components), `warehouses` (raw-material, WIP, and finished-goods locations).
- **Sales** — `sales_orders` (optional make-to-order linkage via `production_orders.sales_order_id`).
- **Quality Control** — `quality_inspections` (in-process and final inspection hooks; consumed read-only).
- **Core** — `companies`, `units_of_measure`.

---

## 2. Core User Stories & Acceptance Criteria

> **Convention**: every acceptance criterion is written to be independently testable. `NULL`-able cross-module links must be represented as explicit `null`, never sentinel values.

### US-01 — Create and view multi-level Bill of Materials
**As a** Production Planner, **I want to** author and inspect multi-level Bills of Materials **so that** the standard component structure and theoretical consumption are defined for each finished good.

**Mapped entities**: `bill_of_materials`, `bom_components` (referencing `products`, `units_of_measure`).

**Acceptance Criteria**
1. A BOM header is created against a `products` record whose `product_type = finished_good`, with `base_quantity > 0`, a `version`, and an `effective_from` date.
2. Components are added as `bom_components` rows with `component_product_id` pointing to a `component`/`raw_material` product, `quantity_per_unit > 0`, and a `uom_id`.
3. The BOM explorer renders the structure hierarchically and supports **at least 4 nesting levels**, distinguishing sub-assemblies from leaf materials.
4. `UNIQUE (bom_id, component_product_id)` is enforced; attempting to add a duplicate component shows a blocking validation message.
5. Nesting cycles (a component that resolves back to an ancestor BOM) are detected and rejected with a clear explanation.
6. `scrap_percentage` defaults to `0` and is shown per line; total theoretical consumption per unit is summarized.

### US-02 — Configure work center capacities and routings
**As a** Production Planner, **I want to** define work center capacity and the ordered operations to manufacture a product **so that** capacity and sequence constraints are available for scheduling and execution.

**Mapped entities**: `work_centers`, `routings`, `routing_operations`.

**Acceptance Criteria**
1. A `work_centers` record requires `capacity_per_day_minutes > 0`, an `efficiency_factor` in `(0, 1]`, and a `status`.
2. A `routings` header is created against a finished-good `product_id` with a `version`.
3. `routing_operations` rows reference a `routing_id` and a `work_center_id`, with `sequence` strictly increasing (starting ≥ 10).
4. `planned_time_minutes` for an operation is derived as `setup_time_minutes + run_time_per_unit_minutes × order_quantity`, and is displayed as a read-only computation.
5. The operation sequence builder prevents duplicate or out-of-order sequences and shows a live total standard time.
6. Editing a routing **after** orders reference it does not mutate already-snapshotted `production_order_operations` rows.

### US-03 — Create and dispatch production orders
**As a** Production Planner, **I want to** create and release production orders from replenishment or make-to-order demand **so that** the shop floor receives executable work.

**Mapped entities**: `production_orders` (referencing `bill_of_materials`, `routings`, `warehouses`, `sales_orders`).

**Acceptance Criteria**
1. An order is created with `quantity_planned > 0`, a `product_id`, a `bom_id`, and a destination `warehouse_id`.
2. When originating from a make-to-order scenario, `sales_order_id` points to a `sales_orders` record with `make_to_order = true`; otherwise `sales_order_id` is explicitly `null` (stock replenishment).
3. On release, the selected `bom_id` and `routing_id` are **frozen** onto the order, and one `production_order_operations` row is generated per `routing_operations` step (copying `sequence`, `work_center_id`, and `planned_time_minutes`).
4. Status transitions obey the state machine: `planned → released → in_progress → completed`, with `cancelled` reachable from any non-terminal state. Backward transitions are rejected.
5. The dispatcher list shows orders with filters by `status` and `priority`, and the kanban view groups by `status`.
6. Cancelling an order with prior consumption/output requires explicit confirmation and never silently deletes execution records.

### US-04 — Execute shop-floor tasks and update progress
**As a** Shop Floor Operator, **I want to** start, track, and complete operations **so that** real progress against the plan is recorded.

**Mapped entities**: `production_order_operations`.

**Acceptance Criteria**
1. An operation moves `pending → in_progress → completed`, with `paused` available as a lateral state.
2. Starting the first operation sets `started_at`; the parent `production_orders.status` transitions from `released` to `in_progress` automatically.
3. `actual_time_minutes` is captured per operation (nullable until recorded) and displayed against `planned_time_minutes`.
4. Completing all operations transitions the parent order to `completed` and stamps `actual_end_date`.
5. Operations are shown in `sequence` order; out-of-sequence completion is flagged (advisory) but not hard-blocked, matching real shop-floor reality.
6. `quantity_completed` and `scrap_quantity` persist per operation with `scrap_quantity ≥ 0`.

### US-05 — Record actual material consumption and finished goods output
**As a** Shop Floor Operator, **I want to** register consumed components and produced finished goods **so that** real usage and yield are traceable against the plan.

**Mapped entities**: `material_consumption`, `production_output`.

**Acceptance Criteria**
1. A consumption entry requires `production_order_id`, `component_product_id`, a source `warehouse_id`, and `quantity_consumed > 0`.
2. The consumption modal displays **theoretical vs. actual** side by side by resolving the matching `bom_components` row via `bom_component_id`.
3. Consumption with no matching BOM line (unplanned usage) is permitted but flagged, and `bom_component_id` is `null`.
4. Output requires `production_order_id`, `product_id`, a destination `warehouse_id`, and `quantity_produced > 0`; `scrap_quantity` defaults to `0`.
5. Partial output is supported: multiple `production_output` rows may exist per order.
6. Recording output simulates a stock credit into the finished-goods `warehouse`, and consumption simulates a stock debit from the source `warehouse` — via the mock inventory adapter only.
7. Yield (`Σ quantity_produced / quantity_planned`) and scrap rate (`scrap_quantity / (quantity_produced + scrap_quantity)`) are computed and displayed; neither is persisted.

### US-06 — Track an operator shift with delays and piece counters
**As a** Machine Operator, **I want to** start and finish my active operation with one button, justify delays, and count pieces per shift **so that** real working time, downtime causes, and output are recorded without paperwork.

**Mapped entities**: `production_shifts`, `operation_delays`, `delay_reasons`, plus progress fields on `production_order_operations`.

**Acceptance Criteria**
1. The workstation shows the operator's active order and its current operation with a single button that toggles `Iniciar` / `Finalizar`; finishing always requires an explicit confirmation.
2. The action targets the **active operation**, never the whole order. Starting it sets `production_order_operations.status = in_progress`, stamps `started_at`, and lets `recomputeOrderStatus` move the parent order from `released` to `in_progress`; finishing sets `completed_at`, computes `actual_time_minutes`, and triggers derived order completion.
3. Only one operation per operator may be `in_progress` at a time; a second start is rejected. A repeated finish on an already `completed` operation is rejected (no double close).
4. Elapsed time is computed from ISO-8601 timestamps with a maximum tolerance of 1 second, excluding every delay interval (`Σ operation_delays.duration_minutes`). Delays that remain open at finish are excluded until corrected and never block the close.
5. The delay catalog offers predefined reasons and lets the operator create a custom reason that stays reusable for the rest of the shift. A delay cannot start without a reason, and two delays cannot be open simultaneously on the same operation.
6. Each delay records reason, `started_at`, `ended_at` (nullable) and `duration_minutes`; while open it pauses effective work time. The operator can close it later, even after the operation is completed, and the operation's effective time is recomputed with an audit stamp.
7. Two piece counters are shown and editable: the current-shift counter (`production_shifts.quantity_counted`, resets when a new shift starts) and the cumulative operation counter (`production_order_operations.quantity_completed`, never resets). Increment, decrement and manual set are allowed; negative or non-numeric input is rejected and the last valid value is preserved.
8. The operation summary shows total time, justified delay time, shift pieces, cumulative pieces, and order progress. State, times, delays, and counters survive a page reload or a lost session through the local snapshot.
9. Finishing with an open delay leaves that delay flagged `abierto — pendiente de corrección`; the correction flow updates `ended_at`, recomputes `actual_time_minutes`, and never deletes the delay record.

### Edge Cases (cross-cutting)

| # | Edge Case | Expected Behavior |
|---|---|---|
| E-01 | BOM version changed after order release | Order keeps frozen `bom_id`; historical consumption reconciliation uses the frozen snapshot. |
| E-02 | Consumption exceeds theoretical by a large margin | Allowed but surfaced as an inventory-discrepancy flag for review (see §4.3). |
| E-03 | Operation completed with `actual_time_minutes = 0` | Rejected as invalid; minimum positive duration required. |
| E-04 | `quantity_produced` exceeds `quantity_planned` | Permitted (over-yield); completion rate shown > 100% and flagged. |
| E-05 | Make-to-order `sales_orders` cancelled after release | Order remains valid; a warning banner notes the detached demand. |
| E-06 | All operations completed but no output recorded | Order stays `in_progress`; UI prompts to log output before completion. |
| E-07 | `units_of_measure` mismatch between BOM line and consumption | Flagged as a unit-conversion warning; conversion is out of MVP scope. |
| E-08 | Work center deactivated with pending operations | Existing operations remain; new scheduling onto the center is blocked. |
| E-09 | Operator tries to start a second operation while one is `in_progress` | Rejected with "Ya tienes una operación en curso"; the active operation is highlighted. |
| E-10 | Operator presses the toggle twice quickly (double click / double close) | Idempotent guard rejects the second transition; no duplicate `completed_at` or counter increment. |
| E-11 | Delay started without a reason or while another delay is open | Blocking validation; the operator must choose/create a reason and close the current delay first. |
| E-12 | Operation finished with an open delay | Close is allowed; delay stays open with `abierto — pendiente de corrección` and is excluded from effective time until corrected. |
| E-13 | Piece counter receives a negative or non-numeric value | Value is rejected, an inline error is shown, and the last valid value remains. |
| E-14 | Page reload / lost session during a shift | State is rehydrated from the local snapshot; active timers continue from stored timestamps, not from page load. |
| E-15 | Clock skew or device sleep during the shift | Effective time is derived from timestamps (not a JS interval), so sleep/skew cannot silently add work time; differences > tolerance are flagged for review. |

---

## 3. Implementation Phases (Step-by-Step Roadmap)

### Phase 1 — Specification & Data Contracts

**Goal**: Freeze `spec.md` and the type contracts before any UI is written.

**Activities**
- Author `spec.md` capturing the functional requirements (FR-UX-*, FR-BOM-*, FR-OPS-*) and the edge cases in §2, with explicit acceptance criteria.
- **Schema reconciliation**: verify every table/column against `erp_data_model.md` (Module 7) and `data-model.md`; log any divergence as an architectural decision (see §5.2) before freezing contracts.
- Establish JSDoc typedefs/enums mirroring the schema exactly (as-built: `src/domain/types.js`; no TypeScript toolchain):
  - Enumerations: `ProductType`, `WarehouseType`, `BomStatus`, `RoutingStatus`, `ProductionOrderStatus`, `OperationStatus`, `Priority`, `DelayReasonOrigin`, `ShiftStatus`.
  - Entities: `BillOfMaterials`, `BomComponent`, `WorkCenter`, `Routing`, `RoutingOperation`, `ProductionOrder`, `ProductionOrderOperation`, `MaterialConsumption`, `ProductionOutput`, `ProductionShift`, `OperationDelay`, `DelayReason`.
  - Boundary (read-only): `Product`, `Warehouse`, `UnitOfMeasure`, `Company`, `SalesOrder`, `QualityInspection`.
- Define the **order state machine** as a pure, testable module: allowed transitions and guard conditions.
- Define the **shift-tracking domain module** as pure functions: effective-time computation, open-delay detection, counter validation, one-active-shift guard.
- Define UI/data contracts:
  - `BomTreeNode` shape for the hierarchical explorer.
  - `BomExplosion` result (flattened theoretical quantities) for plan-vs-actual comparison.
  - `OperationPlan` computation (`setup + run × qty`).
  - Port interfaces (`InventoryPort`, `QualityPort`) and store action contracts.
  - Operator shift contract: toggle action, delay lifecycle, counter updates, persistence snapshot (see `contracts/operator-shift.md`).

**Deliverables**: `spec.md`, `research.md`, `quickstart.md`, `contracts/` (state machine, repository, UI, operator-shift contracts), `src/domain/types.js`.

**Exit Criteria**: types mirror `data-model.md`, state machine and shift-time functions unit-tested, schema reconciliation signed off.

---

### Phase 2 — Mock Engine & State Store

**Goal**: Provide realistic, deterministic data and the state layer that drives every screen.

**Activities**
- **Fixtures** — author comprehensive mock datasets:
  - `companies`, `units_of_measure` (core).
  - `products` spanning `finished_good`, `component`, `raw_material`; `warehouses` spanning `raw_materials`, `wip`, `finished_goods`.
  - `sales_orders` including at least two `make_to_order = true`.
  - Multi-level `bill_of_materials` + `bom_components`; `work_centers`; `routings` + `routing_operations`.
  - Seed `production_orders` in a spread of statuses with corresponding `production_order_operations`, plus sample `material_consumption` and `production_output`; `quality_inspections` hooks.
  - Volume fixture (500 orders / 4-level BOMs) for performance validation.
- **Mock engine** — fixtures are deep-cloned into the store on boot (no simulated latency, no RNG); deterministic seed data keeps demos reproducible. Ports simulate inventory/quality side effects.
- **State store** (as-built: one `ManufacturingStore extends EventTarget` in `src/data/ManufacturingStore.js`):
  - Orders + dispatch actions, status-transition guards, operation snapshot generation.
  - BOM/routing CRUD, tree assembly, explosion calculations.
  - Operation progress, consumption and output records.
  - Shift tracking: `startShift`, `finishOperation`, `startDelay`, `closeDelay`, `correctOpenDelay`, `incrementCounter`, `setCounter`.
  - Read-only boundary data (`products`, `warehouses`, `units_of_measure`, `sales_orders`, `quality_inspections`) loaded from fixtures.
  - Persistence: versioned `localStorage` snapshot (`erp.manufacturing.v1`) written through on every mutation and rehydrated on boot; fall back to fixtures when the snapshot is absent or invalid.
- **Ports**: `InventoryPort` (stock debit/credit simulation) and `QualityPort` (read-only inspection lookup), both backed by mocks.

**Deliverables**: `src/data/fixtures/*` (including shifts, delays and delay reasons), `src/data/ManufacturingStore.js` actions + snapshot adapter, `src/data/ports/*`.

**Exit Criteria**: store transitions order status per the state machine; one active shift per operation is enforced; counters and delays survive reload; mock inventory debits/credits reflect consumption/output; fixture load is deterministic.

---

### Phase 3 — UI Component & View Construction

**Goal**: Deliver the navigable, demonstrable screens.

**Activities**

- **Dashboard overview** — KPI tiles:
  - Active orders (by `status`), capacity utilization per `work_center` (`planned_time_minutes` vs. `capacity_per_day_minutes`), scrap rate, completion/yield rate.
- **BOM & Routing Explorer**:
  - Hierarchical `BomTreeViewer` (expand/collapse, 4+ levels, cycle detection).
  - `BomEditor` for header and `bom_components` lines.
  - `RoutingEditor` for the ordered `routing_operations` sequence with live standard-time total.
  - `WorkCenterCapacityList` with load-vs-capacity bars.
- **Production Dispatcher**:
  - `ProductionOrderBoard` — list and kanban (grouped by `status`), filters by `status`/`priority`.
  - `OrderDispatcher` form — create from stock or make-to-order (`sales_order_id`), release (freeze BOM/routing + generate operations), prioritize, cancel.
  - `OrderTraceabilityView` — planned vs. real summary plus derived quality status.
- **Shop-Floor Execution Console**:
  - `OperationExecutionPanel` — start/pause/complete with `actual_time_minutes`.
  - `OperatorWorkstationPanel` (US-06) — active order/operation card, single `Iniciar`/`Finalizar` toggle with confirmation, live effective timer, delay list with reason picker + inline custom reason, shift and cumulative counters with +/-/set controls, and operation/order summary.
  - `DelayCorrectionDialog` — lists open delays (including those left open after finishing) and lets the operator close them with an audit note.
  - `MaterialConsumptionModal` — theoretical vs. actual per `bom_components`, lot capture, unplanned-usage flagging.
  - `ProductionOutputForm` — `quantity_produced` + `scrap_quantity`, partial outputs.
- **Shell integration** — reuse the branded ERP workspace shell (top bar + sidebar) and design tokens from `001-erp-base-module` for visual consistency.

**Deliverables**: components in `src/components/` (`OperatorWorkstationPanel.js`, `DelayCorrectionDialog.js`, plus existing BOM/orders/dashboard views), route entry in `src/manufacturing-main.js`.

**Exit Criteria**: all six user stories are demonstrable end-to-end on mock data, including an operator shift interrupted by a reload.

---

### Phase 4 — Validation, Scalability & Defense Preparation

**Goal**: Prove correctness, integration readiness, and scalability; prepare the academic defense.

**Activities**
- **Contract & interaction testing**: repository contract tests (interface conformance) and interaction tests across mock endpoints (dispatch → execute → consume → output).
- **Shift-tracking verification (US-06)**: unit tests for effective time excluding delays, 1-second tolerance, one-active-shift guard, double-close rejection, open-delay correction, counter validation (negative/non-numeric), per-shift reset vs. cumulative persistence, and snapshot rehydration after reload.
- **Integration alignment checks**:
  - **Logistics**: consumption debits and output credits reconcile in the mock inventory ledger.
  - **Quality**: order quality status is *derived* from `quality_inspections` hooks (read-only), with no coupling of order status.
  - **Sales**: make-to-order linkage (`sales_order_id`) is optional and nullable, verified across MTO and stock scenarios.
- **Scalability validation**: render and interact with 500 orders and 4-level BOMs within the performance budget (`< 100 ms` interactions, virtualized trees/lists).
- **Defense preparation (5 minutes)**:
  - End-to-end demo script: sales order → order → execution → consumption → output → traceability.
  - Stable, deterministic demo dataset; offline fallback.
  - Slide outline: architecture, data model, plan-vs-actual logic, ethics safeguards.

**Deliverables**: `tasks.md` (Phase 3 of Spec-Kit), test suites, integration checklist, performance report, defense script.

**Exit Criteria**: full suite green, integration checklist signed, performance budget met, demo rehearsed.

---

## 4. Technical Constraints, Risk Management & Data Ethics

### 4.1 Technical Context

*As-built context for the implemented module; replaces earlier React/TypeScript/Zustand assumptions that never matched the repository.*

| Aspect | Decision |
|---|---|
| **Language / runtime** | JavaScript ES2022 modules (browser + Node for tests); no TypeScript build step. Types are JSDoc typedefs in `src/domain/types.js`. |
| **Framework / UI** | Vanilla JS DOM rendering with template strings and `EventTarget` change events; shared branded shell from `001-erp-base-module`. |
| **Build / dev server** | Vite 8 (`npm run dev`, `npm run build`, `npm run preview`). |
| **Testing** | Vitest 4 with `jsdom`; unit tests under `tests/unit/`, integration under `tests/integration/` when present. |
| **State / persistence** | Single in-memory `ManufacturingStore` seeded from fixtures; versioned `localStorage` snapshot (`erp.manufacturing.v1`) for reload/session survival. |
| **Boundary integration** | Read-only fixture adapters + in-memory `InventoryPort` / `QualityPort`; no backend, auth, or network calls. |
| **Target platform** | Modern desktop browser (latest Chrome/Edge/Firefox); responsive down to tablet width. |
| **Performance goals** | Interactions `< 100 ms` with up to 500 orders; timers derived from timestamps, never from polling loops. |
| **Scale / scope** | Demo dataset: ~500 orders, 4-level BOMs, ~10 views, one company. |
| **Constraints** | Frontend-only; no operator ranking; no external API; deterministic fixtures; time tolerance ≤ 1 s. |

### 4.2 Technical Constraints

| Constraint | Decision / Rationale |
|---|---|
| **No backend in MVP** | All data via mock engine + local persistence; repository abstraction guarantees swappability. |
| **Schema is truth** | Types mirror `data-model.md` 1:1; any drift is an ADR (see §5.2). |
| **Frontend-only** | Vanilla JavaScript ES2022 + Vite over the modular template; no server-side logic. |
| **Type safety without TypeScript** | JSDoc typedefs and enums in `src/domain/types.js` mirror `data-model.md`; Vitest covers runtime contracts. |
| **Local persistence** | Versioned `localStorage` snapshot written through on every store mutation; fixtures are the fallback. |
| **Boundary read-only** | `products`, `warehouses`, `units_of_measure`, `companies`, `sales_orders`, `quality_inspections` are read-only in MVP. |
| **State machine integrity** | Transitions enforced in a pure domain module, not in components. |
| **Performance budget** | `< 100 ms` interactions up to 500 records; virtualized rendering for trees/lists. |

### 4.3 Inventory Reconciliation Rules (plan vs. actual)

Discrepancies between theoretical BOM consumption (`bom_components.quantity_per_unit`) and actual shop-floor usage (`material_consumption.quantity_consumed`) are first-class, never silently absorbed.

1. **Theoretical quantity** = `quantity_planned × quantity_per_unit × (1 + scrap_percentage)`.
2. **Variance** = `quantity_consumed − theoretical`. Positive = over-consumption; negative = under-consumption.
3. **Tolerance**: a configurable variance threshold (default ±5%). Within tolerance → informational; beyond → **discrepancy flag** requiring a reason on review.
4. **Unplanned usage** (`bom_component_id = null`) is always flagged and requires a reason.
5. **Immutability**: consumption and output records are append-only. Corrections are new records with justification — never destructive edits.
6. **Concurrency/persistence**: consumption debits a `warehouses` record via `InventoryPort`; output credits one. Both are simulated, logged, and reconcilable via the mock ledger.
7. **Audit trail**: every consumption/output row carries the acting user context, enabling traceability without exposing individual performance metrics (§4.4).

### 4.4 Data Sensitivity & Workforce Tracking Ethics

Recording `actual_time_minutes` and `operator_id`/`consumed_by`/`recorded_by` enables individual productivity metrics, creating surveillance and bias risk.

- **Bias risk**: comparing operators by raw cycle time without normalizing for machine type, product complexity, shift, or tenure unfairly penalizes harder assignments.
- **Design control**: MVP analytics aggregate by **work center and operation**, never by individual. Any per-person view requires explicit approval and is labeled *operational context only — not performance evaluation*.
- **Data minimization**: `operator_id` is nullable and captured only when the business process needs it; the MVP exposes **no** operator ranking.
- **Transparency**: operators are informed that times are recorded as process data, not monitoring.
- **Reporting integrity**: misreporting incentives arise if scrap/incidents appear punitive; UX decouples scrap reporting from individual performance, and safety/scrap events are append-only and non-deletable.

### 4.5 Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Schema drift vs. `erp_data_model.md` | Medium | High | Reconciliation in Phase 1; ADR for each divergence |
| R-02 | Mock data unrealistic, weakening demo | Medium | Medium | Curated fixtures with MTO, scrap, partial output scenarios |
| R-03 | State-machine bugs on file:// reload | Medium | High | Domain module unit tests + invariant assertions |
| R-04 | Performance degradation at 500 records | Low | Medium | Virtualization + memoized selectors |
| R-05 | Pushback on operator tracking | Medium | Medium | Aggregation-only analytics; transparency policy |
| R-06 | Integration hooks over-coupled | Low | Medium | Read-only ports; derived quality status |
| R-07 | Corrupt/outdated snapshot breaks reload | Medium | High | Versioned key, schema validation on hydrate, fallback to fixtures + warning |
| R-08 | Clock skew/device sleep distorts effective time | Medium | Medium | Derive from timestamps, recompute on delay correction, flag deviations > tolerance |
| R-09 | Counter drift between shift and cumulative totals | Medium | Medium | Single source of truth: cumulative = previous cumulative + shift delta; recompute after corrections |

---

## 5. Milestone Tracking & GitHub Governance

### 5.1 Milestone Schedule

| Milestone | Phases | Deliverables | Checkpoint |
|---|---|---|---|
| **M0 — Kickoff & Spec draft** | Phase 1 (start) | `spec.md` draft, type skeleton | Internal review |
| **M1 — Interfaces interim review** | Phases 1–2 | `spec.md`, `data-model.md` alignment, navigable mock prototype | **Interim course review** |
| **M2 — Task freeze** | Phase 3 (entry) | `tasks.md` with dependencies & verification criteria | Task-freeze sign-off |
| **M3 — Feature complete** | Phase 3 | All six user stories demonstrable E2E | Internal demo |
| **M4 — Validation & scalability** | Phase 4 | Test suites, integration checklist, performance report | QA sign-off |
| **M5 — Final presentation** | Phase 4 | Defense-ready demo, 5-minute script, slides | **Final course presentation** |

### 5.2 Architectural Trade-off Record (GitHub Issue / PR template)

```markdown
---
title: "[ADR] <decision title>"
labels: ["architecture", "trade-off", "manufacturing"]
---

## Context
What manufacturing or integration problem forces a decision?
(e.g., schema reconciliation with erp_data_model.md, TS vs JS parity with 001-erp-base-module)

## Options Considered
1. <Option A> — pros / cons
2. <Option B> — pros / cons

## Decision
Chosen option and rationale (code quality, performance, UX consistency, effort).

## Consequences
Impact on spec.md, data-model.md, plan.md, tasks.md, and cross-module integrations
(Logistics, Sales, Quality). Note any constitution deviations.

## Verification
Testable acceptance criteria and accountable owner.
```

**Governance rules**
- Every schema divergence, cross-module interface change, or constitution deviation MUST be recorded as an ADR before merge.
- Each PR MUST reference its user story (US-0x) and linked tasks, and MUST confirm relevant tests pass.
- Open decisions to log via this template: schema reconciliation; the boundary of individual-metric exposure (§4.4); the quality-status derivation strategy; and any future split of the single store into domain stores.

**Resolved decisions (2026-10-29)**: vanilla JavaScript + JSDoc parity with `001-erp-base-module` (no TypeScript); single `ManufacturingStore`; versioned `localStorage` snapshot; operator shift state persisted with the rest of the store.

---

## 6. Project Structure

### Documentation (this feature)

```text
specs/002-operations-manufacturing/
├── plan.md              # This file
├── research.md          # Phase 1 output
├── data-model.md        # Data contracts (source of truth projection)
├── quickstart.md        # Phase 1 output
├── contracts/           # State machine, repository & UI contracts (Phase 1)
│   └── operator-shift.md  # US-06 store/UI contract
└── tasks.md             # Phase 3 output
```

### Source Code (frontend)

```text
src/
├── domain/                      # Pure manufacturing logic (no UI)
│   ├── types.js                 # JSDoc mirror of data-model.md entities/enums
│   ├── order-state-machine.js   # production_orders transitions & guards
│   ├── bom-explosion.js         # Theoretical consumption, multi-level explosion
│   ├── operation-planning.js    # planned_time_minutes = setup + run × qty
│   ├── reconciliation.js        # Plan-vs-actual variance & discrepancy flags
│   ├── shift-tracking.js        # Effective time, delay guards, counter rules (US-06)
│   └── validators.js            # Schema & business-rule validation
├── data/
│   ├── ManufacturingStore.js        # Single EventTarget store + actions + snapshot write-through
│   ├── persistence.js               # Versioned localStorage snapshot adapter (new)
│   ├── ports/
│   │   └── index.js                 # InventoryPort + QualityPort (in-memory)
│   └── fixtures/                    # Deterministic datasets (incl. volume set)
├── components/
│   ├── DashboardOverview.js
│   ├── BomExplorer.js
│   ├── ProductionOrders.js
│   ├── OperatorWorkstationPanel.js  # US-06 toggle, delays, counters (new)
│   ├── DelayCorrectionDialog.js     # Open-delay correction (new)
│   └── format.js
├── manufacturing-main.js            # Shell + routing
└── styles/manufacturing.css         # Design tokens reused from 001-erp-base-module

tests/
├── unit/                            # Domain + store tests (Vitest)
└── integration/                     # Flow tests (jsdom)
```

**Structure Decision**: a strict `domain` (pure, testable) / `data` (store + swappable ports) / `components` (presentation) separation. The `domain` layer mirrors `data-model.md` entity-for-entity, guaranteeing traceability between specification artifacts and code, and ensuring the mock store can be replaced by a real backend without touching the UI. A single `ManufacturingStore` is kept deliberately: domain logic stays pure, and the store is the only stateful boundary.

---

## 7. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality & Maintainability**: domain logic (state machine, BOM explosion, reconciliation, shift tracking) is isolated in pure modules with JSDoc contracts traceable to the data model; store mutations live in one auditable class.
- **II. Test-First & Verification**: each user story defines its independent test before implementation; state transitions, plan-vs-actual calculations, effective-time/delay math and counter validation receive exhaustive unit coverage.
- **III. User Experience Consistency**: the branded ERP shell and design tokens from `001-erp-base-module` are reused; one confirmation pattern before destructive actions, one inline-validation pattern for counters/delays, and one open-delay warning style.
- **IV. Performance & Reliability**: dashboards and lists meet `< 100 ms` at 500 records; timers derive from persisted timestamps; snapshot hydration validates the schema and falls back to fixtures; no UI action blocks the main thread or loses shift state on reload.

**Post-Phase-1 re-check (2026-10-29)**: all four principles remain satisfied. The new `production_shifts`, `operation_delays` and `delay_reasons` tables keep operator data scoped to operational context; no per-operator ranking is introduced. Persistence is versioned and recoverable. No violations require an ADR.

## 8. Complexity Tracking

| Deviation | Why Needed | Simpler/Different Alternative Rejected Because |
|---|---|---|
| Single `ManufacturingStore` instead of four domain stores | The as-built template uses one EventTarget store; domain modules remain pure and the demo scale does not justify split stores. | Four stores would duplicate event wiring and complicate snapshot hydration; they can be split if mutation volume grows. |
| Vanilla JavaScript + JSDoc instead of TypeScript | Keeps parity with `001-erp-base-module` and avoids adding a build-time type toolchain that no other module uses. | Migrating to TS now would break template consistency and add tooling for a demo-scale frontend. |
| Separate `domain` layer | Plan-vs-actual logic, the state machine and shift-time math are the evaluable core and must be testable without UI. | Logic embedded in components blocks testing and reuse. |
| Read-only ports for Logistics/Quality | Keeps integration hooks decoupled and swappable without coupling order status. | Direct coupling would entangle the manufacturing lifecycle with inventory/quality lifecycles. |
| Versioned `localStorage` snapshot | US-06 requires state, times, delays and counters to survive reload/lost session. | In-memory only loses the shift on reload; `sessionStorage` loses it on tab close; IndexedDB is overkill for one demo snapshot. |

No other constitution violations.

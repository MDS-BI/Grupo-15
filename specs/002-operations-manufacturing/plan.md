# Implementation Plan: Operations & Manufacturing Module (ERP)

**Branch**: `002-operations-manufacturing` | **Date**: 2026-10-21 | **Updated**: 2026-11-19
**Spec**: `specs/002-operations-manufacturing/spec.md`
**Input**: Feature specification and data contracts derived from `erp_data_model.md` (Module 7: Operations / Manufacturing) and `specs/002-operations-manufacturing/data-model.md`
**Methodology**: Spec-Driven Development (Spec-Kit)

---

## 1. Executive Summary & MVP Scope

### 1.1 Summary

Build a **frontend-only functional MVP** for the Operations & Manufacturing module of an integrated ERP. The module centralizes the *plan → schedule → execute → record* manufacturing cycle over a modular template, powered entirely by **mock data and local state management** so that the eventual replacement of mocks with real APIs requires zero changes to the presentation layer.

The MVP covers the following production routines and supervision capabilities (US-01…US-11):

1. **Centralized BOM/Routing management** — author multi-level Bills of Materials (`bill_of_materials`, `bom_components`) and manufacturing routings (`routings`, `routing_operations`) over work centers (`work_centers`).
2. **Production Order dispatching** — create and release orders (`production_orders`) from stock replenishment or make-to-order demand, snapshotting routing operations into `production_order_operations`.
3. **Shop-floor operation tracking** — advance operation stages and capture real progress (`production_order_operations`).
4. **Shop-floor recording** — log actual material consumption (`material_consumption`) and finished goods output (`production_output`).
5. **Operator shift tracking (US-06)** — start/finish the active operation with one toggle button, justify delays from a reusable reason catalog, and keep per-shift and cumulative piece counters (`production_shifts`, `operation_delays`, `delay_reasons`).
6. **Line supervision (US-07)** — live work-center traffic light, per-shift operator assignments (`shift_assignments`), shift-closure validation and urgent escalation to maintenance (`maintenance_tickets`).
7. **Plant performance (US-08)** — load, derived OEE, accumulated downtimes and fulfillment by period; configurable thresholds, order rescheduling/cancellation, local PDF/Excel export and simulated role permissions (`threshold_settings`, `role_permissions`).
8. **Maintenance management (US-09)** — escalated ticket inbox, technician interventions, real downtime capture, preventive orders and work-center availability restoration (`maintenance_tickets`, `preventive_maintenance_orders`).
9. **Production scheduling (US-10)** — planned start/end dates on `production_orders` with `planned_end_date ≥ planned_start_date`.
10. **Line balancing (US-11)** — standard times, projected load, utilization vs. effective period capacity and bottleneck detection (derived, read-only).

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
| **Production Planner** | Oversees capacity; creates and versions BOMs and routings; schedules, prioritizes, and dispatches production orders; monitors shop-floor load. | `bill_of_materials`, `bom_components`, `work_centers`, `routings`, `routing_operations`, `production_orders` |
| **Plant Manager (Jefa de Planta)** | Monitors plant-wide load, OEE, accumulated downtimes and fulfillment; configures thresholds, reschedules/cancels orders, exports reports and applies simulated role permissions. | `production_orders`, `threshold_settings`, `role_permissions` |
| **Machine Operator** | Starts/finishes the active operation, logs justified delays, counts pieces per shift, and sees cumulative progress. | `production_shifts`, `operation_delays`, `delay_reasons`, `production_order_operations` (progress fields) |
| **Line Supervisor** | Monitors the live traffic light, assigns operators to work centers per shift, validates shift closures and escalates incidents to maintenance. | `shift_assignments`, `production_shifts`, `maintenance_tickets` |
| **Shop Floor Operator** | Updates operation progress; registers consumed materials; logs completed batches, scrap, and output; marks operations complete. | `production_order_operations`, `material_consumption`, `production_output` |
| **Maintenance Manager** | Handles escalated fault tickets, assigns technicians, logs downtime, schedules preventive orders and restores work-center availability. | `maintenance_tickets`, `preventive_maintenance_orders` |
| **Production Engineer** | Analyzes standard times, projected load, utilization and bottlenecks to balance the line. | `work_centers`, `routing_operations`, `production_orders` |

> **Demo role mapping**: the selectable roles are only `Jefa de Planta`, `Supervisor de Operaciones/Línea`, `Planificador` and `Operador`. Maintenance and Production Engineer responsibilities are exercised from `Jefa de Planta`/`Supervisor` and `Planificador` respectively; no extra credentials are created.

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
| E-06 | All operations completed but no output recorded | Order moves to `completed` per FR-04/AC-09; the UI shows a non-blocking reminder to log output before traceability is considered complete. |
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
- Author `spec.md` capturing the functional requirements FR-01…FR-13 (US-01…US-11) and the edge cases in §2, with explicit acceptance criteria.
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
  - Shift tracking: `startShift`, `finishOperation`, `startDelay`, `closeDelay`, `correctOpenDelay`, `adjustShiftCounter`, `setShiftCounter`.
  - Read-only boundary data (`products`, `warehouses`, `units_of_measure`, `sales_orders`, `quality_inspections`) loaded from fixtures.
  - Persistence: versioned `localStorage` snapshot written through on every mutation and rehydrated on boot; `erp.manufacturing.v1` for US-06/US-07 and `erp.manufacturing.v2` from US-08 onward (§10.6) with automatic migration. Fall back to fixtures when the snapshot is absent or invalid.
- **Ports**: `InventoryPort` (stock debit/credit simulation) and `QualityPort` (read-only inspection lookup), both backed by mocks.

**Deliverables**: `src/data/fixtures/*` (including shifts, delays and delay reasons), `src/data/ManufacturingStore.js` actions + snapshot adapter, `src/data/ports/*`.

**Exit Criteria**: store transitions order status per the state machine; one active shift per operation is enforced; counters and delays survive reload; mock inventory debits/credits reflect consumption/output; fixture load is deterministic.

---

### Phase 3 — UI Component & View Construction

**Goal**: Deliver the navigable, demonstrable screens.

**Activities**

- **Dashboard overview** — KPI tiles:
  - Active orders (by `status`), capacity utilization per `work_center` (`planned_time_minutes` vs. effective daily capacity `capacity_per_day_minutes × efficiency_factor`), scrap rate, completion/yield rate.
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

**Exit Criteria**: all eleven user stories (US-01…US-11) are demonstrable end-to-end on mock data, including an operator shift interrupted by a reload.

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

**Exit Criteria**: module suites green (per AC-14), integration checklist signed, performance budget met, demo rehearsed; the 12 pre-existing `001-erp-base-module` suites are isolated from the default Vitest run and tracked as debt under T084.

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
| **State / persistence** | Single in-memory `ManufacturingStore` seeded from fixtures; versioned `localStorage` snapshot (`v1` for US-06/US-07, `v2` from US-08 onward with migration) for reload/session survival. |
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
| **M3 — Feature complete** | Phase 3 | All eleven user stories (US-01…US-11) demonstrable E2E | Internal demo |
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
├── plan.md                        # This file
├── spec.md                        # Functional specification + AC-01…AC-46 (AC-38 retired)
├── research.md                    # Phase 1 + incremental decisions
├── data-model.md                  # Data contracts (source of truth projection)
├── quickstart.md                  # Demo and validation flows
├── checklists/requirements.md     # Spec quality checklist
├── contracts/                     # Store/UI contracts
│   ├── operator-shift.md          # US-06/US-07 store/UI contract
│   ├── plant-performance.md       # US-08 thresholds, roles and export
│   ├── order-scheduling.md        # US-10 planned dates
│   ├── line-balance.md            # US-11 read-only balancing
│   └── maintenance.md             # US-09 ticket and intervention contract
└── tasks.md                       # Phase 3 output + remediation phases
```

### Source Code (frontend)

```text
src/
├── domain/                         # Pure manufacturing logic (no UI)
│   ├── types.js                    # JSDoc mirror of data-model.md entities/enums
│   ├── order-state-machine.js      # production_orders transitions & guards
│   ├── bom-explosion.js            # Theoretical consumption, multi-level explosion
│   ├── operation-planning.js       # planned_time_minutes = setup + run × qty
│   ├── capacity.js                  # business days, efficiency and effective capacity
│   ├── reconciliation.js           # Plan-vs-actual variance & discrepancy flags
│   ├── shift-tracking.js           # Effective time, delay guards, counters (US-06)
│   ├── line-supervision.js         # Traffic light, assignment and validation rules (US-07)
│   ├── plant-performance.js        # OEE, load, downtimes, thresholds, report (US-08)
│   ├── maintenance.js              # Tickets, downtime, wear and availability (US-09)
│   ├── order-scheduling.js         # Planned date validation (US-10)
│   ├── line-balance.js             # Standard times, utilization, bottlenecks (US-11)
│   ├── access-control.js           # Single source of roles and MODULE_ACCESS
│   └── validators.js               # Schema & business-rule validation
├── data/
│   ├── ManufacturingStore.js       # Single EventTarget store + actions + write-through
│   ├── persistence.js              # Versioned localStorage snapshot adapter (v1 → v2)
│   ├── exporters/
│   │   └── plant-report.js         # Local PDF/Excel export (US-08)
│   ├── ports/
│   │   ├── index.js                # InventoryPort + QualityPort (in-memory)
│   │   └── maintenance.js          # Read-only downtime/ticket adapter for US-08
│   └── fixtures/                   # Deterministic datasets (incl. volume set)
│       ├── dashboard-demo.js       # Non-mutating demo data (FR-13)
│       ├── plant-performance.js    # Thresholds and role permissions
│       └── ...                     # BOM, routings, orders, shifts, tickets, etc.
├── components/
│   ├── DashboardOverview.js
│   ├── BomExplorer.js
│   ├── ProductionOrders.js
│   ├── OperatorWorkstationPanel.js # US-06 toggle, delays, counters
│   ├── DelayCorrectionDialog.js    # Open-delay correction
│   ├── SupervisorLinePanel.js      # US-07 traffic light and escalation
│   ├── PlantPerformancePanel.js    # US-08 KPIs, alarms, roles, export
│   ├── MaintenancePanel.js         # US-09 ticket inbox and interventions
│   ├── ProductionSchedulingPanel.js# US-10 planned dates
│   ├── LineBalancePanel.js         # US-11 read-only balancing
│   └── format.js
├── manufacturing-main.js           # Shell, role selector and hash routing
└── styles/manufacturing.css        # Design tokens reused from 001-erp-base-module

tests/
├── unit/                           # Domain + store tests (Vitest)
└── integration/                    # Flow tests (jsdom)
```

**Structure Decision**: a strict `domain` (pure, testable) / `data` (store + swappable ports) / `components` (presentation) separation. The `domain` layer mirrors `data-model.md` entity-for-entity, guaranteeing traceability between specification artifacts and code, and ensuring the mock store can be replaced by a real backend without touching the UI. A single `ManufacturingStore` is kept deliberately: domain logic stays pure, and the store is the only stateful boundary.

---

## 7. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality & Maintainability**: domain logic (state machine, BOM explosion, reconciliation, shift tracking) is isolated in pure modules with JSDoc contracts traceable to the data model; store mutations live in one auditable class. Linting, formatting and static analysis are enforced with ESLint + Prettier via `npm run lint` and `npm run format:check`.
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

---

# 9. Plan Técnico Incremental — US-09 (Mantenimiento)

**Alcance**: exclusivamente FR-10 / US-09 / HU-06 y sus criterios AC-21…AC-27. No reabre ni rediseña las historias US-01…US-08.

## 9.1 Alcance y no objetivos

**Incluye**
- Bandeja de tickets correctivos escalados desde piso (`maintenance_tickets`), ordenados por prioridad y antigüedad.
- Toma de intervención con técnico asignado y transición `open → in_progress`.
- Historial operativo por máquina y un indicador **derivado** de desgaste/frecuencia de fallos.
- Programación de órdenes de mantenimiento preventivo (`preventive_maintenance_orders`).
- Registro del tiempo real de parada técnica al cerrar la intervención.
- Resolución del ticket y **restablecimiento de la disponibilidad** del centro de trabajo.
- Persistencia y rehidratación de todo el estado de mantenimiento.

**No objetivos**
- No se modifica el comportamiento, los contratos ni la UI de BOM, rutas, órdenes, ejecución, consumo, turno del operador, supervisión ni panel de planta.
- No hay mantenimiento predictivo con modelos, gestión de repuestos, costos de mantenimiento ni integración con un CMMS real.
- No hay backend, autenticación real ni firma electrónica del técnico.

**Regla de aislamiento**: los módulos existentes no se editan. El plan solo **añade** archivos nuevos y extensiones aditivas a la infraestructura compartida (typedefs, colecciones del store, snapshot, ruta de la vista y estilos). Las pruebas de regresión de US-01…US-08 deben seguir pasando sin cambios de comportamiento.

## 9.2 Contexto técnico (US-09)

| Aspecto | Decisión |
|---|---|
| **Lenguaje / runtime** | JavaScript ES2022, navegador y Node para pruebas. |
| **Framework / UI** | Vanilla JS con plantillas de string y `EventTarget`; shell reutilizado de `001-erp-base-module`. |
| **Build / pruebas** | Vite 8 + Vitest 4 con `jsdom`. |
| **Estado** | Extensión aditiva de `ManufacturingStore` (nuevas colecciones, consultas y acciones); ninguna acción existente cambia de firma ni de efecto. |
| **Persistencia** | Extiende el snapshot `erp.manufacturing.v2` introducido por US-08 (§10.6) con las colecciones de mantenimiento; la migración desde `v1` la garantiza §10.6 y las nuevas colecciones arrancan vacías si no existen. |
| **Integración de entrada** | US-07 (escalamiento) crea el ticket en `maintenance_tickets`; US-09 lo consume de forma reactiva. Contrato de admisión en [contracts/maintenance.md](contracts/maintenance.md). |
| **Integración de salida** | US-08 consume los tiempos de parada y los tickets resueltos en modo solo lectura para OEE y paradas acumuladas. |
| **Puente RR.HH.** | Técnico asignado por `technician_ext_hr_employee_id` (mismo puente que `shift_assignments`). |
| **Rendimiento** | Interacciones < 100 ms con 500 órdenes y un histórico de tickets acotado por período. |
| **Plataforma** | Navegador de escritorio moderno; diseño usable hasta ancho de tablet. |

Incógnitas pendientes: ninguna. Las decisiones de diseño se documentan en [research.md](research.md) §4 (D-10…D-16).

## 9.3 Flujo de datos

```text
US-07 Supervisor
  └─ escalar incidente → operation_delays.escalated_to_maint = true
                        → maintenance_tickets { ticket_status: open, priority: urgent }

US-09 Encargado de Mantenimiento
  ├─ bandeja de tickets (open/in_progress/resolved)
  ├─ tomar intervención → in_progress + técnico + intervention_started_at
  ├─ cerrar intervención → resolved + downtime_started_at/ended_at/downtime_minutes
  │                        → work_center.operational_status fuera de "fault"
  └─ programar preventiva → preventive_maintenance_orders { status: planned }

US-08 Jefa de Planta (solo lectura)
  └─ OEE y paradas acumuladas ← downtime_minutes + tickets resueltos
```

## 9.4 Modelo de datos y máquinas de estado

Las entidades se definen en [data-model.md](data-model.md) §3.19 y §3.20:

- **`maintenance_tickets`**: ticket correctivo con prioridad, estado, centro, evento de parada, técnico, marcas de intervención y tiempo real de parada.
- **`preventive_maintenance_orders`**: orden preventiva con fecha objetivo, responsable, estado y tiempo real de parada.

**Máquina de estados — ticket correctivo**

```text
open ──tomar──► in_progress ──resolver──► resolved
```

- No existe reapertura: una nueva incidencia genera un ticket nuevo vinculado al evento correspondiente.
- `in_progress` exige técnico y `intervention_started_at`.
- `resolved` exige `resolved_at`, marcas de parada y `downtime_minutes ≥ 0`.
- Como máximo un ticket `in_progress` por `work_center_id`.
- `operation_delay_id` es único cuando existe (escalamiento idempotente).

**Máquina de estados — orden preventiva**

```text
planned ──iniciar──► in_progress ──completar──► completed
   └────────cancelar────────► cancelled ◄──cancelar── in_progress
```

- `completed` exige `completed_at`.
- Una preventiva no reabre ni reemplaza el ticket que la originó.

**Disponibilidad del centro de trabajo al resolver**

```text
fault ──resolver ticket──► in_operation   (si existe operación activa in_progress)
                       └─► paused         (si la operación estuvo pausada)
                       └─► disponible     (sin operación activa)
```

La regla se deriva del estado real de la operación activa; nunca se deja el centro en `fault` sin un ticket abierto.

## 9.5 Contratos de dominio, store y UI

Contrato completo en [contracts/maintenance.md](contracts/maintenance.md).

**Funciones puras** (`src/domain/maintenance.js`, nuevo)
- `canStartIntervention(ticket, activeTicketsForWorkCenter)`.
- `canResolveTicket(ticket)`.
- `computeDowntimeMinutes(startedAt, endedAt)`.
- `deriveWearIndicator(tickets, workCenterId, period)` — derivado, no persistido.
- `resolveAvailabilityStatus(activeOperation, resolvedTicket)`.
- `canTransitionPreventiveOrder(order, nextStatus)`.
- `buildPreventiveOrderFromHistory(tickets, workCenterId, plannedDate)`.

**Consultas del store**
- `maintenanceTicketsFor({ status, priority, workCenterId })`.
- `activeInterventionForWorkCenter(workCenterId)`.
- `maintenanceHistoryForWorkCenter(workCenterId)`.
- `preventiveOrdersFor({ status, workCenterId })`.
- `maintenanceIndicatorsForWorkCenter(workCenterId, period)`.

**Acciones del store** (aditivas, validan antes de mutar y emiten un único `change`)
- `startMaintenanceIntervention(ticketId, { technician_ext_hr_employee_id })`.
- `resolveMaintenanceTicket(ticketId, { resolvedAt, downtimeStartedAt, downtimeEndedAt, causeReasonId, notes })`.
- `createPreventiveMaintenanceOrder({ workCenterId, sourceTicketId, plannedDate, title, technician_ext_hr_employee_id })`.
- `transitionPreventiveMaintenanceOrder(orderId, nextStatus)`.
- `cancelPreventiveMaintenanceOrder(orderId, { reason })`.

**Contrato de UI** (`src/components/MaintenancePanel.js`, nuevo)
- Sección 1: bandeja de tickets con filtros por estado/prioridad y orden por prioridad + antigüedad.
- Sección 2: detalle de intervención (técnico, inicio, causa, notas, cierre).
- Sección 3: historial y desgaste por máquina (agregado, con etiqueta *solo contexto operativo*).
- Sección 4: órdenes preventivas (alta, transición de estado, cancelación).
- Estados vacíos, de error y de carga consistentes con el resto del módulo; foco atrapado en diálogos y cierre con `Esc`.

## 9.6 Persistencia y migración

- **Snapshot**: `erp.manufacturing.v2`, introducido por US-08 (§10.6).
- **Migración**: un `v2` existente se completa con `maintenanceTickets = []` y `preventiveMaintenanceOrders = []` si faltan. Si solo existe `v1`, se copia su contenido, se inicializan también `thresholdSettings` y `rolePermissions` y se reescribe como `v2`. Si `v2` falta, está corrupto o es inválido, se cargan fixtures con advertencia visible.
- **Escritura**: write-through tras cada mutación de mantenimiento, sin bloquear la UI.
- **Rehidratación**: las marcas de tiempo y los cronómetros de intervención se recalculan desde `intervention_started_at`/`downtime_*`, nunca desde intervalos en memoria.
- **Reset de demo**: elimina `v2` (y opcionalmente `v1`) y recarga fixtures.
- No se altera la forma de las colecciones existentes; las nuevas son opcionales y tolerantes a ausencia.

## 9.7 Estrategia de pruebas

**Unidad — dominio** (`tests/unit/maintenance.test.js`)
- Transiciones válidas e inválidas de ticket y orden preventiva.
- Bloqueo de doble intervención por centro.
- Cálculo de `downtime_minutes` y tolerancia de marcas de tiempo.
- Derivación de desgaste y de disponibilidad al resolver.
- Idempotencia del escalamiento por `operation_delay_id`.

**Unidad — store** (`tests/unit/manufacturing-store.test.js`, bloque US-09 aditivo)
- `startMaintenanceIntervention`, `resolveMaintenanceTicket`, órdenes preventivas.
- Persistencia y migración `v1 → v2`; colecciones ausentes se inicializan vacías.
- No mutación ante error.

**Integración jsdom** (`tests/integration/maintenance-panel.test.js`)
- Ticket escalado aparece en la bandeja; tomarlo lo pasa a `in_progress`; resolverlo registra parada y saca la máquina de `fault`; recarga conserva el estado.
- Creación y transición de una orden preventiva.

**Regresión**
- Ejecutar las suites existentes de US-01…US-08 para confirmar que las extensiones aditivas no alteran su comportamiento.

## 9.8 Constitution Check (post-diseño US-09)

- **I. Calidad y mantenibilidad**: lógica pura en `src/domain/maintenance.js`; el store solo orquesta; el contrato está documentado y trazable al modelo de datos.
- **II. Pruebas primero**: cada regla de estado, guarda, cálculo de parada y migración tiene prueba unitaria; el flujo completo tiene prueba de integración jsdom.
- **III. Consistencia de UX**: se reutilizan patrones de diálogo, validación inline, estados vacíos y etiquetas del módulo; el semáforo reutiliza los colores y etiquetas de US-07.
- **IV. Rendimiento y confiabilidad**: operaciones O(n) sobre tickets del período; snapshot versionado con migración y fallback a fixtures; sin temporizadores acumulativos.

No hay violaciones que requieran justificación adicional.

## 9.9 Riesgos y mitigaciones

| ID | Riesgo | Mitigación |
|---|---|---|
| R-10 | Doble ticket por doble clic en el escalamiento | `operation_delay_id` único + guard de idempotencia en el dominio. |
| R-11 | Centro atascado en `fault` tras resolver | `resolveAvailabilityStatus` deriva el estado de la operación activa; prueba de integración. |
| R-12 | Pérdida de datos al migrar `v1 → v2` | Migración copia el snapshot previo, valida forma y conserva `v1` hasta confirmar escritura. |
| R-13 | OEE inconsistente entre US-08 y US-09 | Una sola fuente de tiempos de parada (`downtime_minutes` derivado de marcas de tiempo). |
| R-14 | Vigilancia del técnico | Reporte agregado por máquina; sin ranking individual; etiqueta de contexto operativo. |
| R-15 | Crecimiento del snapshot por histórico | Filtrar por período y limitar el histórico mostrado; la persistencia guarda solo registros reales. |

## 9.10 Fases de implementación (entrada para `/speckit.tasks`)

1. **Fundacional aditivo**: typedefs de `MaintenanceTicket`/`PreventiveMaintenanceOrder`, fixtures, migración `v1 → v2`, colecciones y consultas del store.
2. **Dominio**: `src/domain/maintenance.js` con pruebas unitarias.
3. **Acciones del store**: intervención, resolución, órdenes preventivas y persistencia.
4. **UI**: `MaintenancePanel.js`, ruta en el shell y estilos; accesibilidad y estados vacíos.
5. **Integraciones**: consumo de escalamiento de US-07 y exposición de solo lectura para US-08.
6. **Verificación**: pruebas de integración, regresión de US-01…US-08, rendimiento y guion de demo.

**Criterio de salida**: AC-21…AC-27 verificados; suites de regresión verdes; snapshot migra sin pérdida; `npm run build` exitoso.

## 9.11 Trazabilidad de criterios de aceptación

| AC | Cubierto por |
|---|---|
| AC-21 Bandeja de tickets priorizada | Bandeja + consulta `maintenanceTicketsFor` |
| AC-22 Toma de intervención y bloqueo de doble intervención | `startMaintenanceIntervention` + `canStartIntervention` |
| AC-23 Historial y desgaste por máquina | `maintenanceHistoryForWorkCenter` + `deriveWearIndicator` |
| AC-24 Cierre con tiempo real y disponibilidad restablecida | `resolveMaintenanceTicket` + `resolveAvailabilityStatus` |
| AC-25 Ticket resuelto sin reapertura y ticket vinculado | Máquina de estados + validación de unicidad |
| AC-26 Persistencia de tickets, intervenciones y preventivas | Snapshot `v2` + migración |
| AC-27 Agregación sin rankings de técnicos | Contrato de UI y reglas de ética |

## 9.12 Complexity Tracking (US-09)

| Decisión | Por qué | Alternativa rechazada |
|---|---|---|
| Extensión aditiva del store único | Mantiene una sola fuente de verdad y la arquitectura actual. | Un `MaintenanceStore` separado duplicaría estado y complicaría la integración con US-07/US-08. |
| Snapshot `v2` con migración | El nuevo estado debe persistir sin romper sesiones `v1`. | Reutilizar `v1` con colecciones opcionales oculta el cambio de forma y dificulta la validación. |
| Indicador de desgaste derivado | Evita persistir métricas que pueden recalcularse y sesgar decisiones. | Persistir un score de desgaste añade complejidad de mantenimiento y posible deriva. |
| Técnico vía `ext_hr_employee_id` | Coherente con el puente de RR.HH. de US-07. | Duplicar un catálogo de técnicos rompe la integración. |

---

# 10. Plan Técnico Incremental — US-08 (Panel de Planta), US-10 (Planificación) y US-11 (Balance de Líneas)

**Alcance**: FR-09 / US-08 (AC-04…AC-07 y AC-20), FR-11 / US-10 (AC-28…AC-33), FR-12 / US-11 (AC-37, AC-39, AC-40 y AC-45; AC-38 retirado y absorbido por AC-39) y FR-06 / AC-46 (utilización diaria compartida y detalle de operaciones pendientes; se apoya en FR-02, FR-03, FR-09 y FR-11). No reabre ni rediseña US-01…US-07 ni US-09.

## 10.1 Alcance y no objetivos

**Incluye**
- Panel consolidado de planta: carga por centro contra capacidad efectiva, OEE derivado, paradas acumuladas por motivo y cumplimiento de órdenes por período.
- Umbrales críticos configurables por indicador, alarmas visibles y persistencia de umbrales y permisos por rol simulado.
- Reprogramación de prioridad y cancelación de órdenes desde el panel, conservando los registros de ejecución.
- Exportación local del reporte consolidado a PDF y Excel con datos mock.
- Asignación y edición de fechas planificadas de inicio y término por orden, con validación `planned_end_date ≥ planned_start_date`.
- Panel de balance de líneas: tiempos estándar, carga proyectada, utilización vs. capacidad efectiva del período, estados por umbral y cuellos críticos (`≥ 95%`).
- Sugerencias simuladas de reasignación/secuencia con confirmación explícita: la reasignación solo cruza estaciones del mismo `station_type`; la confirmación marca la fila como `Solicitud simulada` sin registro, persistencia ni mutación.
- AC-46: utilización diaria compartida entre el Panel de Producción y “Carga por centro”, con detalle de operaciones pendientes, días hábiles en el título y componente de barra unificado solo en la pestaña de balance.

**No objetivos**
- No hay backend, autenticación real ni motor de permisos del servidor; los roles y permisos son simulados con un selector.
- No hay MRP, programación automática por capacidad finita ni optimizador de rutas.
- No se persisten OEE, carga, utilización ni cuellos de botella: son valores derivados.
- No se modifican los contratos ni el comportamiento de US-01…US-07 y US-09.

**Regla de aislamiento**: las nuevas funcionalidades se añaden con archivos nuevos y extensiones aditivas a `types.js`, al snapshot y a la ruta del shell. Las suites de regresión deben seguir pasando sin cambios de comportamiento.

## 10.2 Contexto técnico (US-08, US-10, US-11)

| Aspecto | Decisión |
|---|---|
| **Lenguaje / runtime** | JavaScript ES2022, navegador y Node para pruebas. |
| **Framework / UI** | Vanilla JS con plantillas de string y `EventTarget`; shell reutilizado de `001-erp-base-module`. |
| **Build / pruebas** | Vite 8 + Vitest 4 con `jsdom`. |
| **Estado** | Extensión aditiva de `ManufacturingStore`: nuevas consultas y acciones; ninguna firma existente cambia. |
| **Persistencia** | `erp.manufacturing.v2` introducido en esta fase con migración desde `v1`; colecciones nuevas `thresholdSettings` y `rolePermissions`. US-09 extiende `v2` con mantenimiento. |
| **Derivados** | OEE, carga, utilización, paradas acumuladas y cuellos de botella se calculan bajo demanda y no se persisten. |
| **Exportación** | PDF y Excel generados localmente con los datos mock y sin dependencias externas: Excel vía descarga CSV/SpreadsheetML y PDF vía vista imprimible con `window.print()`; sin servicios externos ni backend. |
| **Rendimiento** | Interacciones < 100 ms con 500 órdenes y BOM de 4 niveles. |
| **Plataforma** | Navegador de escritorio moderno; usable hasta ancho de tablet. |
| **Dependencias** | US-06/US-07 (paradas y turnos), US-03 (órdenes), US-02 (centros, rutas y tiempos estándar). |

Incógnitas pendientes: ninguna. Decisiones registradas en [research.md](research.md) §5–§7 (D-17…D-28).

## 10.3 Flujo de datos

```text
US-06/US-07 ──► production_shifts, operation_delays, maintenance_tickets
                        │
US-08 ◄─────────────────┴──► computeOee / computeLoadByWorkCenter
  ├─ umbrales ──► threshold_settings (persistido en v2)
  ├─ permisos ──► role_permissions (persistido en v2)
  ├─ acciones ──► production_orders.priority / status = cancelled
  └─ reporte ──► exportador local PDF/Excel (derivado, no persistido)

US-10 ◄── production_orders.planned_start_date / planned_end_date (persistido en v2)

US-11 ◄── work_centers.station_type / capacity_per_day_minutes / efficiency_factor
       ◄── routing_operations.setup_time_minutes / run_time_per_unit_minutes
       ◄── production_orders.quantity_planned / planned_start_date / planned_end_date
       └──► utilización, cuello de botella y sugerencias simuladas (derivados, no persistidos)
```

## 10.4 Modelo de datos y reglas

Entidades nuevas o ampliadas en [data-model.md](data-model.md):

- **`threshold_settings`** (§3.21): umbral crítico por indicador (`load`, `oee`, `downtime`, `fulfillment`) con comparación (`lt`, `gt`) y marca de actualización. Se persiste en `v2`.
- **`role_permissions`** (§3.22): matriz local rol×acción (`plant_manager`, `supervisor`, `planner`, `operator`) usada por la UI para ocultar o bloquear acciones. Se persiste en `v2`. El supervisor puede `view_plant_panel`, `change_priority` y `export_report`, pero no `set_threshold` ni `cancel_order`.
- **`production_orders.planned_start_date` / `planned_end_date`** (ya definidos en §3.11): se editan en US-10; `planned_end_date ≥ planned_start_date`.
- **`production_orders.priority`** (ya definido): se modifica desde US-08 solo para órdenes `planned`.
- **`production_orders.status`**: la cancelación desde US-08 usa la transición existente a `cancelled` y conserva los registros de ejecución.

**Indicadores derivados (no persistidos)**
- `availability = (planned_time_minutes − downtime_minutes) / planned_time_minutes`.
- `performance = quantity_completed / (run_time_per_unit_minutes × quantity_planned)` acotado a [0, 1].
- `quality = quantity_completed / (quantity_completed + scrap_quantity)`.
- `oee = availability × performance × quality`.
- `capacity_minutes = días_hábiles_del_período × capacity_per_day_minutes × efficiency_factor` y `load = Σ planned_time_minutes / capacity_minutes` en el panel de planta; la tarjeta diaria del Panel de Producción usa solo `capacity_per_day_minutes × efficiency_factor`.
- `utilization = Σ planned_time_minutes / (días_hábiles_del_período × capacity_per_day_minutes × efficiency_factor)` en el balance de líneas.
- `bottleneck = work_center con utilization ≥ 0.95`; desempate por utilización, carga absoluta e id.
- `estado = normal ([0, 0.75)) | ajustada ([0.75, 0.95)) | cuello_crítico ([0.95, ∞))`; no hay huecos entre 94 % y 95 %.

> US-11 aplica el mismo `efficiency_factor` que US-08, multiplicado por los días hábiles del período; `business_days` cuenta lunes a viernes del rango inclusivo y no aplica feriados en la demo (octubre 2026 = 22, noviembre 2026 = 21). El panel propone reasignaciones solo entre estaciones del mismo `station_type` y revisiones de secuencia. La alerta superior se activa únicamente con algún centro ≥ 95 %; si no, muestra “Línea balanceada · Sin cuellos de botella críticos”. Al confirmar, la fila se marca como `Solicitud simulada`: no se registra, persiste ni muta rutas, operaciones ni órdenes.

> `downtime_minutes` tiene una sola definición para US-08/US-09: `Σ operation_delays.duration_minutes + Σ maintenance_tickets.downtime_minutes` del período, sin duplicar una misma parada. `actual_time_minutes` es el tiempo ejecutado observado y no se usa como multiplicador adicional del OEE.

## 10.5 Contratos de dominio, store y UI

Contratos completos en [contracts/plant-performance.md](contracts/plant-performance.md), [contracts/order-scheduling.md](contracts/order-scheduling.md) y [contracts/line-balance.md](contracts/line-balance.md).

**Funciones puras** (`src/domain/plant-performance.js`, nuevo)
- `computeOee(workCenter, operations, delays, period)`.
- `computeLoadByWorkCenter(workCenters, operations, period)`.
- `accumulateDowntimesByReason(delays, maintenanceTickets, period)`.
- `evaluateThresholds(indicators, thresholdSettings)`.
- `canPerformAction(role, action, rolePermissions)`.
- `buildConsolidatedReport(period, data)`.

**Funciones puras** (`src/domain/order-scheduling.js`, nuevo)
- `validatePlannedDates({ planned_start_date, planned_end_date })`.
- `canRescheduleOrder(order)`.

**Funciones puras** (`src/domain/line-balance.js`, nuevo)
- `computeStandardTimes(routingOperations)`.
- `computeProjectedLoad(orders, routingOperations, period)`.
- `computeUtilization(loadByWorkCenter, workCenters, period)`.
- `detectBottlenecks(utilizationByWorkCenter)`.
- `buildLineBalanceSuggestions(balance, operationsByOrder)`.

**Consultas del store**
- `plantPerformanceFor(period)`, `loadByWorkCenterFor(period)`, `downtimesByReasonFor(period)`, `rolePermissionsFor(role)`.
- `ordersForScheduling({ status, dateFrom, dateTo })`.
- `lineBalanceFor(period)` (incluye `suggestions` simuladas), `lineBalanceForOrder(orderId)`, `capacityForPeriod(period)`.

**Acciones del store** (aditivas, validan antes de mutar y emiten un único `change`)
- `setIndicatorThreshold({ indicator, threshold, comparison })`.
- `changeOrderPriority(orderId, priority)`.
- `cancelOrderFromPanel(orderId, { reason })`.
- `updatePlannedDates(orderId, { planned_start_date, planned_end_date })`.

**Contratos de UI**
- `src/components/PlantPerformancePanel.js`: KPIs de carga/OEE/paradas/cumplimiento, alarmas de umbral, acciones de orden con confirmación, selector de rol y exportación.
- `src/components/ProductionSchedulingPanel.js`: listado filtrable de órdenes, edición de fechas planificadas con validación inline y confirmación de guardado.
- `src/components/DashboardOverview.js` (AC-46): tabla “Utilización por Centro de Trabajo” con tasa diaria efectiva; al activar una fila se abre una ventana con las operaciones pendientes (orden, secuencia, estado y minutos), cerrable con botón, Escape, clic fuera o nueva activación.
- `src/components/LineBalancePanel.js`: tabla por centro con utilización vs. capacidad efectiva del período, semáforo verde/ámbar/rojo, alerta superior solo con cuello ≥ 95 %, panel de sugerencias del mismo `station_type` y modal de confirmación simulada. El título muestra “(N días hábiles)”; no hay columna de días. La columna “Utilización del día” va después de “Utilización” y usa el mismo componente de barra, texto real con relleno limitado al 100 % y la misma escala de colores; el ajuste visual no se aplica al Panel de Producción.
- `src/data/exporters/plant-report.js`: generación local de PDF y Excel a partir del reporte consolidado.

## 10.6 Persistencia y migración

- **Snapshot**: `erp.manufacturing.v2`, introducido en esta fase.
- **Migración**: al hidratar, si existe `erp.manufacturing.v1` válido se copia su contenido y se inicializan `thresholdSettings` y `rolePermissions` con los valores por defecto de fixtures; se reescribe como `v2`. Si `v2` falta, está corrupto o es inválido, se cargan fixtures con advertencia visible.
- **Extensiones posteriores**: US-09 añade `maintenanceTickets` y `preventiveMaintenanceOrders` a `v2`; US-10 no añade colecciones (usa campos existentes de `production_orders`); US-11 no añade colecciones ni registros: el balance es derivado y la confirmación de sugerencias es solo visual.
- **Escritura**: write-through tras cada mutación real del panel y de la planificación, sin bloquear la UI. Las confirmaciones simuladas de US-11 no escriben.
- **Reset de demo**: elimina `v2` (y opcionalmente `v1`) y recarga fixtures.
- Las colecciones nuevas son opcionales y tolerantes a ausencia; no se altera la forma de las colecciones existentes.

## 10.7 Estrategia de pruebas

**Unidad — dominio**
- `tests/unit/plant-performance.test.js`: OEE, carga, paradas por motivo, umbrales y permisos.
- `tests/unit/order-scheduling.test.js`: validación de fechas y órdenes no reprogramables.
- `tests/unit/line-balance.test.js`: tiempos estándar, carga proyectada, utilización con eficiencia, umbrales, cuello de botella y sugerencias.

**Unidad — store** (`tests/unit/operations-store.test.js` y `tests/unit/manufacturing-store.test.js`, bloques aditivos)
- Acciones de umbrales, prioridad, cancelación y fechas planificadas.
- Migración `v1 → v2`, colecciones ausentes y no mutación ante error.
- `buildLineBalanceSuggestions`: solo destinos del mismo `station_type`, redacción con nombres de estación y sin API de solicitudes en el store.

**Integración jsdom**
- `tests/integration/operations-panels.test.js`: KPIs, alarmas, acciones y exportación simulada.
- `tests/integration/plant-scheduling-panels.test.js`: edición de fechas, validación inline, paneles de planta/balance, semáforo, alerta crítica, sugerencias del mismo `station_type`, confirmación simulada y AC-46 (popup del panel, días en el título, columna diaria con markup/colores compartidos y texto > 100 % sin deformar la barra).

**Regresión**
- Ejecutar las suites existentes de US-01…US-09 para confirmar que las extensiones aditivas no alteran su comportamiento.

## 10.8 Constitution Check (post-diseño US-08 / US-10 / US-11)

- **I. Calidad y mantenibilidad**: lógica pura en `src/domain/capacity.js`, `src/domain/plant-performance.js`, `src/domain/order-scheduling.js` y `src/domain/line-balance.js`; el store solo orquesta y los contratos están documentados.
- **II. Pruebas primero**: cada cálculo derivado, umbral, permiso y validación de fechas tiene prueba unitaria; cada panel tiene prueba de integración jsdom, incluida AC-46.
- **III. Consistencia de UX**: se reutilizan patrones de tarjetas, tablas, validación inline, diálogos con foco atrapado y estados vacíos del módulo; el popup de operaciones, el título con días hábiles y la barra de utilización compartida siguen el mismo patrón en FR-06 y US-11; los roles deshabilitan acciones de forma visible y accesible.
- **IV. Rendimiento y confiabilidad**: cálculos O(n) sobre operaciones del período; snapshot versionado con migración y fallback a fixtures; sin temporizadores ni recálculos en bucle.

No hay violaciones que requieran justificación adicional.

## 10.9 Riesgos y mitigaciones

| ID | Riesgo | Mitigación |
|---|---|---|
| R-16 | OEE inconsistente por doble fuente de paradas | Una sola fuente: `operation_delays` + `maintenance_tickets.downtime_minutes`, calculada en `plant-performance.js`. |
| R-17 | Umbrales o permisos perdidos al migrar | Migración `v1 → v2` con valores por defecto y validación de forma; prueba de round-trip. |
| R-18 | Exportación PDF/Excel lenta o dependiente de servicios | Generación local con datos mock y límite de período; prueba de rendimiento. |
| R-19 | Fechas planificadas inválidas por edición concurrente | Validación en dominio + store antes de mutar; mensaje inline y conservación del último valor válido. |
| R-20 | Cuello de botella mal señalado por capacidad desactualizada | Recalcular con días hábiles × `capacity_per_day_minutes` × `efficiency_factor` en cada render; exigir `utilization ≥ 0.95`; prueba con escenarios sembrados de 97%, 79% y 29%. |
| R-21 | Permisos simulados tratados como seguridad real | Etiquetar el selector como simulación y no exponer datos sensibles; documentar que no hay autenticación. |

## 10.10 Fases de implementación (entrada para `/speckit.tasks`)

1. **Fundacional US-08**: tipos `ThresholdSetting`, `PlantRole`, `PlantIndicator` y mapa de permisos; fixtures de umbrales/permisos; snapshot `v2` con migración.
2. **Dominio US-08**: `src/domain/plant-performance.js` con pruebas unitarias.
3. **Store US-08**: consultas, acciones de umbral/prioridad/cancelación y exportación del reporte.
4. **UI US-08**: `PlantPerformancePanel.js`, ruta en el shell y estilos.
5. **US-10**: validación de fechas, acción de store, `ProductionSchedulingPanel.js` y ruta.
6. **US-11 / AC-46**: cálculos de balance, umbrales, `LineBalancePanel.js` con días en el título y utilización diaria compartida, sugerencias del mismo `station_type` con modal de confirmación simulada, popup de operaciones en `DashboardOverview.js`, escenario de cuello crítico y ruta.
7. **Verificación**: pruebas de integración de los tres paneles, regresión de US-01…US-09, rendimiento y guion de demo.

**Criterio de salida**: AC-04…AC-07 y AC-20 verificados; AC-28…AC-33 verificados; AC-37, AC-39, AC-40, AC-45 y AC-46 verificados (AC-38 retirado); suites de regresión del módulo verdes; snapshot migra sin pérdida; `npm run build` exitoso.

## 10.11 Trazabilidad de criterios de aceptación

| AC | Cubierto por |
|---|---|
| AC-04 Carga/OEE/paradas por período | `computeOee`, `computeLoadByWorkCenter`, `accumulateDowntimesByReason` + `PlantPerformancePanel` |
| AC-05 Umbrales configurables y alarmas | `threshold_settings` + `evaluateThresholds` + `setIndicatorThreshold` |
| AC-06 Reprogramación/cancelación con confirmación | `changeOrderPriority`, `cancelOrderFromPanel` + UI con confirmación |
| AC-07 Exportación PDF/Excel y permisos por rol | `src/data/exporters/plant-report.js` + `role_permissions` + `canPerformAction` |
| AC-20 Carga sobre capacidad y centros desactivados | `computeLoadByWorkCenter` + validación de `work_centers.status` |
| AC-28..AC-33 Planificación de fechas | `validatePlannedDates`, `updatePlannedDates`, `ProductionSchedulingPanel` |
| FR-12 Balance de líneas | `computeStandardTimes`, `computeProjectedLoad`, `computeUtilization`, `detectBottlenecks`, `buildLineBalanceSuggestions` + `LineBalancePanel` |
| AC-37 Tiempos estándar por operación y ruta | `computeStandardTimes` + `LineBalancePanel` |
| AC-39 Carga/utilización con eficiencia y cuello `≥ 95%` | `computeProjectedLoad`, `computeUtilization`, `detectBottlenecks` + escenario sembrado |
| AC-40 Sugerencias simuladas del mismo tipo | `buildLineBalanceSuggestions` con `station_type` + badge local de `LineBalancePanel` |
| AC-45 Popover de órdenes por centro | `centerPopoverMarkup` en `LineBalancePanel` + estilos `.center-popover` + prueba de integración |
| AC-46 Utilización diaria compartida | `dailyUtilizationByWorkCenter` + popup en `DashboardOverview` + `utilizationCell` en `LineBalancePanel` + días en el título y barra con texto real/relleno limitado |

## 10.12 Complexity Tracking (US-08 / US-10 / US-11)

| Decisión | Por qué | Alternativa rechazada |
|---|---|---|
| Extensión aditiva del store único | Mantiene una sola fuente de verdad y la arquitectura actual. | Stores separados duplicarían estado y complicarían la integración con US-06/US-07/US-09. |
| Snapshot `v2` introducido en US-08 | Agrupa umbrales y permisos con la migración ya prevista para mantenimiento. | Introducir dos migraciones consecutivas complica la rehidratación. |
| Permisos por rol persistidos en `v2` | Permite que la simulación de roles sobreviva recargas. | Solo en memoria perdería la configuración al recargar. |
| Indicadores derivados (OEE, carga, utilización) | Evita datos obsoletos y mantiene una única fuente de cálculo. | Persistir métricas añade mantenimiento y riesgo de deriva. |
| Exportación local | Cumple el alcance frontend-only sin backend ni servicios externos. | Depender de un servicio de reportes rompe el prototipo. |
| Confirmación simulada de balance | Cumple AC-40 sin store, migración ni mutación de datos maestros. | Registrar o persistir solicitudes daría una trazabilidad que la historia no quiere. |

---

# 11. Plan Técnico Incremental — US-12 a US-15 (snapshot `erp.manufacturing.v2`)

**Alcance**: FR-14 a FR-18, historias US-12 a US-15 y criterios AC-47 a AC-76 de `spec.md`. Esta sección es aditiva: no reemplaza el plan Fase 1 a Fase 24 ni las secciones 1 a 10.

## 11.1 Aislamiento y compatibilidad con `main`

- Las Fases 1 a 24 de `tasks.md` permanecen sin cambios. Las tareas de US-12 a US-15 se generarán como Fases 25 a 28 cuando se ejecute `/speckit.tasks`; este documento solo prepara la entrada técnica.
- No se modifica `package.json` (nombre de paquete), no se agregan dependencias externas y no se edita `vitest.config.mjs`.
- No se agregan elementos de `001-erp-base-module` a `index.html`; se conservan los IDs de ruta existentes: `dashboard`, `bom`, `orders`, `operator`, `supervision`, `plant`, `scheduling`, `line-balance`, `maintenance`, `roles`, `admin-roles`.
- Se conservan las mejoras ya presentes en `main`: tipografía `@fontsource-variable/inter`, menú drawer, `icons.js`, `ConfirmDialog.js`, `Toast.js`, `labels.js`, `demo-dates.js`, `capacity.js`, balance de líneas US-11 y botón “Reiniciar datos de demo” de Jefa de Planta.
- Reutilización obligatoria de utilidades existentes:

| Utilidad existente | Uso en US-12 a US-15 |
| --- | --- |
| `src/components/format.js` | `formatLocalDate`, `formatLocalDateTime`, `fmtNumber`, `fmtPercent`, `escapeHtml`, `el` y mapas de estado en calendario, tablas y popups. |
| `src/components/labels.js` | `technicianLabel`, `operationLabel`, `salesOrderLabel` para nombres visibles según rol y trazabilidad. |
| `src/components/icons.js` | `icon(name)` para pestañas, botones de calendario, filtros, mantenimiento y administración de roles. |
| `src/components/Toast.js` | `showToast` para confirmaciones de programación, reasignación, resolución y eliminación histórica. |
| `src/components/ConfirmDialog.js` | `confirmDialog` para borrado de mantenimiento histórico, cancelación de programación y confirmación de resolución; `notifyDialog` para validaciones. |
| `src/data/fixtures/demo-dates.js` | `relativeDay`, `relativeTimestamp`, `daysAgo`, `daysFromNow` para fechas dinámicas y valores por defecto del popup de resolución. |
| `src/domain/capacity.js` | `effectiveDailyCapacity`, `capacityFor`, `loadRatio` siguen siendo la única fuente de capacidad; `deriveBomStations` reutiliza `plannedTimeMinutes` sin duplicar fórmulas. |

## 11.2 Contexto técnico actualizado

| Área | Decisión |
| --- | --- |
| Lenguaje/UI | JavaScript y CSS Vanilla, sin frameworks nuevos; grid del calendario con CSS Grid. |
| Persistencia | `localStorage['erp.manufacturing.v2']` con `SNAPSHOT_VERSION = 2`; se agregan colecciones y campos opcionales, sin migración a `v3`. |
| Roles | Cinco roles canónicos en `USER_ROLES` / `CANONICAL_ROLES`: `plant_manager`, `supervisor`, `planner`, `operator`, `maintenance`. |
| Cuentas demo | Cinco tablas `role_users_*`: `jefa`, `supervisor`, `planificador`, `operador`, `mantenimiento`, más `test` en las cinco y `doble` en `operator`/`maintenance`; contraseña = `username`; se elimina `usuario`. |
| Calendario | Estado de mes, filtros, arrastre y foco en memoria de sesión; solo las fechas/horas y banderas críticas se persisten en `production_orders`, `maintenance_tickets` y `preventive_maintenance_orders`. |
| Estaciones | Una estación equivale a un `work_center` existente; la secuencia se deriva de `routingOperations` y se persiste en `order_stations` como dotación por orden. |
| Mantenimiento | Una sola fuente de datos para los tres bloques y el calendario; `maintenance_tickets` y `preventive_maintenance_orders` comparten `scheduled_start_date` y `scheduled_end_date`. |
| Navegación | `#/${moduleId}` sin cambios; el editor de estaciones desde el calendario se abre con estado transitorio (`focusOrderId`) y no modifica rutas. |
| Pruebas | Vitest existente con proyectos `unit`/`integration`; nuevos tests unitarios puros y tests jsdom de paneles; sin cambios de configuración. |

## 11.3 Flujo de datos

```text
Cuentas demo (5 tablas) ──> rolesForUsername ──> selector de roles ──> MODULE_ACCESS real
                                                        │
                                                        └──> vistas restringidas (nombres/responsables)

Producción (Órdenes) ──> validatePlannedDates ──> calendario mensual ──> drag/selección
        │                       │                       │
        │                       ├──> bandeja "Pendiente de horario" (supervisor/planner/jefa)
        │                       └──> CalendarEventDialog ──> programación por rangos + hora
        │
        └──> deriveBomStations(order, routingOperations, workCenters) ──> order_stations
                                                                        └──> SupervisorLinePanel

Mantenimiento (tickets + preventivas) ──> calendario unificado ──> 3 bloques del panel
                                                                  ├──> programación desde ticket
                                                                  ├──> fechas visibles dinámicas
                                                                  └──> resolución inmutable + borrado histórico
```

## 11.4 Modelo de datos y reglas derivadas

- Ver `data-model.md` secciones 3.11, 3.19, 3.20, 3.22 y nuevas 3.23 a 3.28 para los campos y colecciones exactos.
- `role_permissions` usa el nuevo rol `maintenance` con permisos `view_plant_panel`, `view_technician_names`; `plant_manager` conserva todos los permisos.
- `production_orders`: `priority` se amplía a `low | normal | high | urgent`; se agregan `is_critical_urgent` (por defecto `false`) y `scheduled_start_time` / `scheduled_end_time` (por defecto `08:00` / `16:00`).
- `maintenance_tickets` y `preventive_maintenance_orders`: `scheduled_start_date` y `scheduled_end_date` son opcionales en `v2` y obligatorios para aparecer en el calendario.
- `order_stations`: fila por `(production_order_id, work_center_id, sequence)` con `operator_ext_hr_employee_ids` y `source = bom_derived | manual`.
- `calendarState` recuerda el último mes entre pestañas y vuelve al mes actual al cambiar de usuario/rol, cerrar sesión o recargar; `focusOrderId` y el arrastre son transitorios (AC-53).
- La fecha visible de una mantención activa vencida se calcula como `max(scheduled_end_date, fecha_actual)`; si está resuelta antes del plazo, se muestra la fecha de resolución. Ninguna de estas fechas se persiste.

## 11.5 Contratos a implementar

### 11.5.1 Dominio

- `src/domain/role-access.js` (nuevo): `CANONICAL_ROLES`, `rolesForUsername(roleUsers, username)`, `modulesForRoles(roles)`, `isModuleAllowedForRoles(roles, moduleId)`, `visibleEmployeeNamesFor(role)`, `visibleTechnicianNamesFor(role)`, `roleLabel(role)`.
- `src/domain/access-control.js`: extender `USER_ROLES`, `ROLE_ORDER`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `ROLE_HOME_MODULE`, `MODULE_GROUPS` y `MODULE_ACCESS` con `maintenance`. Según AC-51: supervisor pierde `orders`; operator queda exactamente con `['operator', 'scheduling', 'roles']`; maintenance queda exactamente con `['maintenance', 'scheduling']`; los IDs de ruta no cambian.
- `src/domain/operation-planning.js`: agregar `deriveBomStations(order, { routingOperations = [], workCenters = [] } = {})`, que devuelve `{ work_center_id, name, sequence, planned_time_minutes }` ordenado por secuencia y reutiliza `plannedTimeMinutes`.
- `src/domain/calendar-scheduling.js` (nuevo): `buildCalendarRange(startDay, endDay, startTime, endTime)`, `calendarEventsForMonth(month, sources)`, `filterCalendarEvents(events, filter)`, `sortPendingOrders(orders)`, `canEditOrderSchedule(role)`, `canViewOrderDetails(role)`. El filtro por defecto es `"Ambos"`, con opciones `"Solo Órdenes de Trabajo"` y `"Solo Mantenciones"` (tickets programados + preventivas). `sortPendingOrders` ordena por criticidad/prioridad y expone `% de avance`; solo `plant_manager` cambia prioridad o marca `is_critical_urgent`.
- `src/domain/maintenance.js`: agregar `computeCorrectiveDowntime(startedAt, resolvedAt)`, `canResolveScheduledMaintenance(event)`, `canRescheduleMaintenance(role)`, `canEditMaintenanceFrequency(role)`, `effectiveMaintenanceEnd(event, today)` y `buildScheduledMaintenanceFromTicket(ticket, { scheduled_start_date, scheduled_end_date, technician_ext_hr_employee_id })`.
- `src/domain/order-scheduling.js`: conservar `isValidIsoDate`, `validatePlannedDates`, `canRescheduleOrder` y `sortOrdersForScheduling`; `validatePlannedDates` también valida `scheduled_start_time` / `scheduled_end_time` con formato `HH:mm` y rango válido.

### 11.5.2 Store (`ManufacturingStore`)

- Roles: `roleUsersFor(role)`, `rolesForUsername(username)`, `addRoleUser(role, { username })`, `assignRoleToUser(username, role)`. Todas emiten `change` y persisten en `v2`.
- Calendario: `pendingSchedulingOrders()`, `calendarEventsForMonth(month)`, `scheduleOrderRange(orderId, { startDate, endDate, startTime, endTime })`, `setOrderPriority(orderId, priority)`, `setCriticalUrgent(orderId, flag)`.
- Estaciones: `ensureBomStationsForOrder(orderId)`, `orderStationsFor(orderId)`, `setOrderStationStaffing(orderId, stations)`; `releaseProductionOrder` invoca `ensureBomStationsForOrder` de forma idempotente, sin alterar `production_order_operations`.
- Mantenimiento: `maintenanceFeed()`, `scheduleMaintenanceFromTicket(ticketId, payload)` (pasa ticket a `in_progress` y máquina a `fault`), `schedulePreventiveMaintenance(orderId, payload)`, `setRecommendedMaintenanceFrequency(workCenterId, days)` (solo `maintenance`/`plant_manager`), `resolveScheduledMaintenance(id, { resolvedAt })`, `deleteResolvedMaintenance(id)`. Solo `maintenance` resuelve/reprograma/elimina; la resolución calcula inactividad automáticamente y bloquea cualquier edición posterior.
- `resetDemoData()` restaura las cinco tablas de roles, `order_stations` y los campos de programación de las fixtures; `technicians` y `maintenanceCauses` se mantienen en memoria como hoy.

### 11.5.3 UI

- `src/components/RoleAdminPanel.js` (nuevo): reemplaza `adminRolesView()` en `#/admin-roles` (exclusivo de `plant_manager`), muestra las cinco tablas y persiste altas de usuario/rol con `showToast`; tras logout/login aparecen en el menú superior y en `#/roles`.
- `src/manufacturing-main.js`: `loadRole()` / `persistRole()` usan solo roles asignados; el `<select data-role="role-select">` de la cabecera es el único selector (sin duplicados en otros paneles) y se oculta con un solo rol.
- `src/components/ProductionSchedulingPanel.js`: vista “Calendario” con grid CSS mensual, filtro `"Ambos" | "Solo Órdenes de Trabajo" | "Solo Mantenciones"`, bandeja “Pendiente de horario” solo para planner/jefa, foco `.scheduling-focus-backdrop` + `.scheduling-floating-card` siguiendo el cursor, arrastre `.calendar-day--drag-range` y menú por día para planner/jefa/supervisor. El mes se recuerda entre pestañas y vuelve al actual al cambiar de identidad o recargar. La vista “Listado” se oculta para operator.
- `src/components/calendar/CalendarEventDialog.js` (nuevo): detalle de orden o mantención con botón “Volver a la lista del día”; según rol ofrece reprogramación, “Editar estaciones y trabajadores”, “Resolver” o borrado histórico.
- `src/components/SupervisorLinePanel.js`: botón “Editar estaciones y trabajadores” redirige a `#/supervision`, abre el editor de esa orden con “Secuencia <N>”, título explicativo, cantidad de trabajadores y altas/bajas persistentes; `#/orders` conserva buscador/filtro de prioridad sin controles de dotación.
- `src/components/MaintenancePanel.js`: tres subpestañas exactas —“Máquinas”, “Tickets”, “Mantenimientos”—; “Mantenimientos” usa los bloques “Activos”, “No resueltos por vencimiento” e “Históricos”, los tres con buscador por máquina/código y sincronizados con el calendario.
- Solo `maintenance` resuelve/reprograma/elimina mantenciones; `plant_manager` también edita “Cada cuánto se recomienda mantención” en Máquinas. Toda acción usa `format.js`, `labels.js`, `icons.js`, `Toast.js` y `ConfirmDialog.js` existentes.

## 11.6 Persistencia y migración

- `createFixtureSnapshot()` y `loadSnapshot()` incorporan las colecciones `role_users_plant_manager`, `role_users_supervisor`, `role_users_planner`, `role_users_operator`, `role_users_maintenance` y `order_stations`.
- `loadSnapshot()` rellena colecciones nuevas ausentes con arreglos vacíos y campos nuevos ausentes con los valores por defecto de la sección 11.4; no invalida snapshots `v2` existentes.
- `saveSnapshot()` continúa escribiendo `{ version: 2, savedAt, data }`; el botón de reset usa `resetDemoSnapshot` y vuelve a cargar las cinco tablas demo.
- `technicians` y `maintenanceCauses` siguen sin persistirse; los responsables de mantenimiento se resuelven desde `hr_employees` y el nuevo rol `maintenance`.

## 11.7 Estrategia de pruebas

- Unitarias: `role-access`, `access-control` extendido, `deriveBomStations`, `calendar-scheduling`, `maintenance` (cálculo de inactividad, vencimientos, inmutabilidad) y validación de `HH:mm`.
- Integración jsdom: login con las cinco cuentas, selector restringido, panel de roles, arrastre y menú diario del calendario, editor de estaciones desde orden y flujo completo de las tres pestañas de mantenimiento.
- Regresión: todas las pruebas actuales de Fases 1 a 24 deben seguir pasando sin cambios en `vitest.config.mjs`; se ejecuta `npm test` al final de cada fase nueva.

## 11.8 Constitution Check — reevaluación post-diseño

| Principio | Evaluación |
| --- | --- |
| Code Quality / Single source of truth | Todas las reglas de roles, fechas, capacidad y estaciones viven en `src/domain`; los paneles solo consumen APIs puras y del store. |
| Test-First | Cada fase 25 a 28 comienza con tests unitarios y de integración; la cobertura incluye AC-47 a AC-76. |
| UX Consistency | Se reutilizan `format.js`, `labels.js`, `icons.js`, `Toast.js` y `ConfirmDialog.js`; estados vacíos, error y carga siguen los patrones existentes. |
| Performance / Reliability | El calendario calcula eventos una sola vez por mes y filtro; el drag no escribe en `localStorage` hasta soltar; la persistencia sigue siendo síncrona y acotada a `v2`. |
| Simplicity | No hay frameworks, dependencias ni `v3`; se usa CSS Grid y estado transitorio en memoria. |
| Observability | Cada mutación relevante emite `change` y muestra `showToast`; los errores de validación usan `notifyDialog` o mensajes inline. |

## 11.9 Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Duplicar privilegios al asignar varios roles | La unión solo define roles disponibles en el selector; el módulo activo se resuelve con `MODULE_ACCESS[activeRole]`. |
| Romper snapshots `v2` con campos nuevos | Todos los campos son opcionales al hidratar y se normalizan con valores por defecto. |
| Confundir estación con operario | `deriveBomStations` devuelve `work_center_id`; los operarios viven en `operator_ext_hr_employee_ids` y en `shift_assignments` sin sobreescribirlos. |
| Fechas vencidas que desaparecen del calendario | `effectiveMaintenanceEnd` eleva la fecha visible a “hoy” para activos vencidos; la fecha original no se altera. |
| Resolución tardía sin inactividad correcta | `computeCorrectiveDowntime` usa `intervention_started_at` o `scheduled_start_date` y el `resolvedAt` editable del popup. |
| Regresión visual de Fases 1 a 24 | Cambios aditivos, sin editar `tasks.md` ni estilos base; se revisa diff contra `main`. |

## 11.10 Fases 25 a 28 propuestas (entrada futura para `/speckit.tasks`)

| Fase | Objetivo | Entregable principal |
| --- | --- | --- |
| 25 | US-12: cinco roles, tablas de usuarios, panel de administración y selector restringido | `role-access.js`, `RoleAdminPanel.js`, extensiones de `access-control.js` y `manufacturing-main.js`, tests AC-47 a AC-52. |
| 26 | US-13: calendario, bandeja de pendientes, selección por rangos, foco y menú diario | Extensión de `ProductionSchedulingPanel.js`, `CalendarEventDialog.js`, `calendar-scheduling.js`, tests AC-53 a AC-62. |
| 27 | US-14: derivación BOM, estaciones por orden y edición desde supervisión | `deriveBomStations`, `order_stations`, editor en `SupervisorLinePanel.js`, tests AC-63 a AC-66. |
| 28 | US-15 y FR-18: tres pestañas, programación desde ticket, sincronización, resolución, inmutabilidad y regresión de `main` | Refactor aditivo de `MaintenancePanel.js`, reglas de mantenimiento programado, tests AC-67 a AC-76. |

## 11.11 Trazabilidad de criterios

| Criterios | Historia | Artefacto responsable |
| --- | --- | --- |
| AC-47 a AC-52 | US-12 | `data-model.md` 3.22 a 3.27, `contracts/order-scheduling.md` 9, `plan.md` 11.5.1/11.10 Fase 25. |
| AC-53 a AC-62 | US-13 | `data-model.md` 3.11, `contracts/order-scheduling.md` 10 a 13, `plan.md` 11.5.3/11.10 Fase 26. |
| AC-63 a AC-66 | US-14 | `data-model.md` 3.28, `contracts/order-scheduling.md` 12, `plan.md` 11.5.1/11.10 Fase 27. |
| AC-67 a AC-75 | US-15 | `data-model.md` 3.19/3.20, `contracts/maintenance.md` 8 a 13, `plan.md` 11.5.2/11.10 Fase 28. |
| AC-76 | FR-18 | `plan.md` 11.1 y 11.8; regresión de mejoras de `main`, rutas y configuración. |

## 11.12 Complexity Tracking

| Violación | Justificación | Mitigación |
| --- | --- | --- |
| Cinco tablas de usuarios en lugar de una sola tabla global | Requerimiento explícito de tablas separadas por rol (FR-14/AC-48). | Consulta `rolesForUsername` unifica lecturas; el panel de roles es el único punto de escritura. |
| Estado de calendario en memoria | Evita persistir arrastres y filtros temporales que ensuciarían `erp.manufacturing.v2`. | Se documenta en contratos; recuerda el mes entre pestañas y vuelve al actual al cambiar de identidad o recargar (AC-53). |
| Fechas visibles derivadas | Los vencimientos deben aparecer sin alterar la fecha programada original (AC-73). | `effectiveMaintenanceEnd` es puro y se prueba por separado. |

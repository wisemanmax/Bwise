# Snowsight Clone — Roadmap & Execution Plan

Working document for evolving `pages/Snowsight` (the single-file Snowsight clone with sql.js + a Snowflake→SQLite translator) into a feature-complete, browser-based Snowflake replica with a real analytical dataset.

> **Heads up to Claude Code:** Read `pages/Snowsight` and `README.md` first. The artifact is intentionally a single HTML file. Don't restructure into a build system unless explicitly told to — the "no build step" property is a feature, not a constraint to remove. When in doubt, prefer extending an existing function over introducing a new file.

---

## Project context

**What exists today (`pages/Snowsight`, ~3,726 lines):**

- Vanilla JS, single HTML file, CDN-loaded deps (sql.js, CodeMirror)
- `state` object holds worksheets, history, context (role/warehouse/db/schema)
- `translateSnowflake(sql)` — paren-aware regex translator (Snowflake → SQLite)
- TPCH-shaped synthetic data (~35K rows): region, nation, customer, supplier, part, partsupp, orders, lineitem
- `DEMO_DB.PUBLIC` second namespace: departments, employees, sales
- 12 verified-passing query templates in `TEMPLATES`
- Snowsight-faithful CSS (dark theme, ice-blue accent, Inter + JetBrains Mono)
- `boot()` orchestrates DDL + bulk insert + UI init

**Architectural rules to preserve:**

1. Single deployable HTML file (deployable to GitHub Pages with zero build)
2. localStorage for persistence (worksheets, history, preferences)
3. CDN-only dependencies — no npm install required for end users
4. Snowsight-faithful visual language (don't add Material/shadcn/etc.)
5. Vanilla JS — no React, Vue, Svelte, etc.
6. Snowsight is one of ~77 portfolio sub-pages, not a standalone product. Site-wide health (load time, mobile, SEO) trumps any single feature.

---

## Decision log

Record big decisions here so the codebase stays coherent.

- **2026-05-08:** Started from sql.js v1 single-file build. 12 templates passing.
- **2026-05-08:** Dual-engine commitment. `?engine=sqljs` default, `?engine=duckdb` opt-in. Translator forks where needed; templates run against both.
- **2026-05-08:** Parquet hosted in this repo under `pages/Snowsight-data/`. SF0.01 only (≤5 MB). Slow first load accepted; mitigated by OPFS cache pulled forward in execution plan.
- **2026-05-08:** Snowsight is a portfolio sub-page at `pages/Snowsight`, not a standalone artifact. Budget is sessions-unlimited, but every change is judged against site-wide impact, not just feature parity.
- **2026-05-08:** Phase 0 split into 0a–0e to keep one architectural change in flight at a time. Build pipeline (0d) deferred until pain emerges; 3,726 lines in one file is currently fine.
- **2026-05-08:** AI assistant (was 3.4) and OPFS cache (was 4.1) pulled forward ahead of original Phase 1 — highest wow-per-session, low complexity, work on either engine.
- **2026-05-08:** Phase 1.3 (time travel), 1.4 (MERGE), 1.5 (COPY INTO) deferred until after Phase 2 ships. Deep semantics, low recruiter visibility.
- **2026-05-08:** Phase 0a shipped — engine adapter, `?engine=` URL param, all call sites refactored, harness 12/12 + smoke 9/9. Tagged `phase-0a-complete`.
- **2026-05-08:** Phase 0b shipped — DuckDB-WASM in browser via `@duckdb/duckdb-wasm` jsDelivr ESM, async `exec` + chunked-INSERT `bulkInsert`, Arrow→sql.js result normalization. New `translateForDuckDB` is shorter than `translateForSqljs` (DuckDB native: QUALIFY/ILIKE/::TYPE/IFNULL/DATEDIFF/DATE_TRUNC; still translated: IFF, NVL2, ZEROIFNULL, NULLIFZERO, DIV0, DATEADD, plus CAST-AS-DATE wrapping for VARCHAR date columns). Browser uses `@duckdb/duckdb-wasm` 1.29 over CDN; Node harness uses `@duckdb/node-api` to validate translator output. 12/12 on **both** engines, smoke 14/14. Tagged `phase-0b-complete`.
- **2026-05-08:** Phase 0c shipped — mobile responsive pass. `100dvh` with `100vh` fallback; hamburger button + sidebar drawer + scrim below 768px; nav-tabs hidden on mobile (drawer carries Databases + Worksheets); brand text hidden, pill labels collapsed, role/wh pills hidden below 480px; touch targets bumped to 44×44 on icon buttons; modals re-fit with 12px backdrop padding and 100dvh max-height. CSS + DOM only — translator/engine untouched. Tagged `phase-0c-complete`.
- **2026-05-08:** PF1 shipped — Ask AI assistant. BYOK Anthropic API key stored in localStorage (never leaves the browser except to `api.anthropic.com`). Toolbar button + Cmd+I shortcut open a modal that builds a Snowflake-flavored system prompt with the full schema as context, calls `claude-sonnet-4-6` with `anthropic-dangerous-direct-browser-access`, strips markdown fences from the response, and inserts the SQL into the active worksheet with a `-- Ask AI: <prompt>` comment. Resilient error reporting; recruiters without a key see the case study and the BYOK UI. Tagged `pf1-complete`.
- **2026-05-08:** Phase 2.8 (subset) shipped — editor polish. Real schema autocomplete: `buildHintTables()` derives a CodeMirror sql-hint map from `SCHEMA_META` so every TPCH and DEMO_DB column auto-suggests; live-pop on word chars and `.`, suppressed inside string/comment tokens, dropdown re-themed for the Snowsight dark palette. `formatSql` swapped from a 6-line keyword inserter to lazy-loaded `sql-formatter@15` (Snowflake dialect, upper keywords, 2-space indent) — pairs with PF1 so AI-generated SQL formats cleanly on demand. Inline error markers, find/replace, and tablename-context-aware completion deferred to a follow-up. Tagged `phase-2-8a-complete`.
- **2026-05-08:** Phase 1.6 shipped — translator function parity. New `applySharedRewrites()` runs before engine dispatch and translates the portable Snowflake idioms once: STARTSWITH/ENDSWITH/CONTAINS → LIKE, APPROX_COUNT_DISTINCT → COUNT(DISTINCT), and the OVER-clause-aware `rewriteRatioToReport()` for RATIO_TO_REPORT. DuckDB-only path adds EDITDISTANCE→levenshtein, REGEXP_LIKE→regexp_matches, BITAND_AGG/BITOR_AGG/BITXOR_AGG→bit_and/bit_or/bit_xor. Two new templates (`startswith`, `ratio`) exercise the shared rewrites on both engines. Test gate now 14/14 on each engine plus 14/14 smoke. Tagged `phase-1-6-complete`.
- **2026-05-08:** Phase 2.6 shipped — full Query History page. Replaced the cramped modal with a Snowsight-faithful section that takes over the workspace pane when the Activity nav-tab (or History toolbar button) is clicked. View routing via `switchView('worksheet'|'history')`; nav-tabs gain `data-view` and toggle the `active` class. Filters: free-text search across query bodies (debounced), status (all/succeeded/failed), time range (1h/24h/7d/all). Tabular layout with sticky header, status icon, truncated SQL preview, rows/duration/bytes, warehouse, relative time. Click a row to expand an inline detail panel with full SQL, role/wh/db/schema/qid metadata, error body for failed runs, and "Open in new worksheet" + "Copy SQL" actions. Old `historyModal` removed. Tagged `phase-2-6-complete`.
- **2026-05-08:** Phase 2.2 shipped — table detail page. Double-click a table in the sidebar tree opens a third view (`switchView('table-detail')`) with breadcrumb, type / column count / row count header, and three tabs: **Columns** (name + type always; on DuckDB an async `SUMMARIZE <table>` populates distinct, null %, min, max into the same row), **Data Preview** (lazy `SELECT * LIMIT 100` on first tab open, NULL-aware rendering, long values truncated), **DDL** (regenerated `CREATE TABLE` from `SCHEMA_META`). Back-to-worksheet button + "Preview in new worksheet" preserves the original double-click behavior. Help text in About modal and starter template updated to point at the detail page. Test gate stays 14/14 on each engine plus 14/14 smoke. Tagged `phase-2-2-complete`.
- **2026-05-08:** Phase 2.7 (subset) shipped — result panel filter, search, sort. New `state.resultsView = { search, perCol, filtersOpen, sortCol, sortDir }` resets on every new query. Pure `getVisibleResultRows()` applies search (any cell contains text), per-column filters (one input per column, toggleable), and sort (click header to cycle asc → desc → off; locale-aware with numeric collation) over the loaded values. Toolbar sits above the table with Search, Filter toggle, Clear (when active), and a live "X of Y" count; footer shows the same. Body re-renders without rebuilding the header so search-as-you-type doesn't drop focus. Pivot deferred to a follow-up. Tagged `phase-2-7-complete`.
- **2026-05-08:** Phase 2.1 shipped — worksheet folders. `state.folders` + `state.folderOrder` extend the persistent state schema (with cleanup of dangling `folderId` refs on load). Sidebar "Worksheets" header gains a folder-create button next to the existing new-worksheet button. Renderer now lays out root-level worksheets first, then a "Drop here for top level" zone, then collapsible folders with twisty + count + hover actions (rename ✎ / delete ×). HTML5 drag-and-drop on every worksheet row and every folder header / root-drop target with visual ice-blue drop highlight. Double-click folder to rename. Delete confirms and reparents children to root. Tagged `phase-2-1-complete`.
- **2026-05-08:** Phase 2.5 shipped — Admin pages. Renamed the dead "Data" nav-tab to **Admin** and routed it to a new full-page `<section id="adminView">` with four sub-tabs: **Warehouses** (table of COMPUTE_WH/ANALYTICS_WH/LOAD_WH/REPORTING_WH with size, status pill, auto-suspend/resume, running, queued, credits today), **Users** (BWISE/ADMIN/ANALYST_1/ANALYST_2/LOAD_BOT/GUEST with default role, email, MFA, active/locked status pill, last login), **Roles** (hierarchical tree with grants summary + flat grants table — ACCOUNTADMIN inherits everything; PUBLIC implicit), **Resource Monitors** (empty-state with explanation + Create-monitor stub that toasts "demo only"). All read-only mock data — looks real, doesn't claim to. Status pills reuse existing color tokens; tables share the same `.admin-table` styling for visual consistency across pages. Tagged `phase-2-5-complete`.
- **2026-05-08:** Phase 3.1 shipped — Notebooks. Worksheets gain a `mode: 'sql' | 'notebook'` field; notebook worksheets carry a `cells: [{ id, type, content }]` array (sql + markdown cells). New "+ Notebook" button next to "+ Folder" / "+ Worksheet" in the sidebar header. Tab + sidebar icons branch on mode (sheet vs. ruled-notebook). New `notebookView` section renders cells in a vertical stack, each with type pill, edit textarea, run button (SQL), and inline output. SQL cells run via `state.engine.exec` with the same translator used for the worksheet pane; results render via a shared `buildSimpleResultTable()` capped at 200 rows per cell. Markdown cells render via a tiny inline regex-based renderer (headings, bold/italic, code, fences, links, lists, blockquotes, paragraphs) — no external dep. Per-cell actions: move up / down, duplicate, delete. Cmd+Enter inside a cell runs SQL or re-renders Markdown. `routeActiveWorksheet()` switches between worksheet and notebook view based on the active worksheet's mode; `switchView()` keeps the Worksheets nav-tab active in both. `.ipynb` export deferred to a follow-up. Tagged `phase-3-1-complete`.
- **2026-05-08:** Phase 2.3 (real query plan viz) gets an explicit off-ramp: if the EXPLAIN-parse session goes sideways, fall back to a static text plan and move on.
- *(add entries as you make them)*

---

## Working with Claude Code on this project

**Before each phase:**

```bash
git checkout -b phase-N-shortname
node pages/Snowsight-test.js  # baseline: must be green on whichever engine is in scope
```

**During work:**

- Read the relevant section of `pages/Snowsight` before editing — the file is sectioned with banner comments
- After translator changes: re-run `node pages/Snowsight-test.js`, must stay green on whichever engine is in scope (12/12 minimum on the active engine)
- After UI changes: open the page in a browser, verify visually
- For new features: add at least one entry to the `TEMPLATES` array that exercises it

**Between phases:**

```bash
git add . && git commit -m "phase N: <description>"
git tag phase-N-complete
```

**File map:**

- `pages/Snowsight` — the entire app (single HTML file, no extension)
- `pages/Snowsight-test.js` — Node test harness, runs the 12 templates and prints pass/fail (created in Pre-work below)
- `pages/Snowsight-data/` — committed parquet for the DuckDB engine path (created in Phase 0e)
- `README.md` — public-facing portfolio description (Snowsight is one of ~77 demos)

If you find yourself wanting to split `pages/Snowsight` into modules during a phase, **stop**. Revisit only if a later phase makes single-file editing painful.

---

## Overload-prevention rules

1. **One concern per session.** If a session would touch the engine *and* the data *and* the UI, split it.
2. **Every session ends with a green checkpoint.** All 12 templates pass on whichever engine was in scope. If they don't, revert before stopping.
3. **Hard stop conditions.** If a session goes >2x its estimate or the page is broken at session end → revert, write a decision-log entry, re-scope before retrying.
4. **No two architectural changes in flight.** Don't migrate engines while also splitting files into `src/appN.js`.
5. **Commit per session, tag per phase.**

---

## Pre-work (1 session, before any phase)

Reconcile the workflow with reality so the prescriptions above actually function:

- Confirm path: `pages/Snowsight` (no extension), not `index.html`.
- Drop any references to `app1.js / app2.js / app3.js` — they don't exist on this branch.
- Create `pages/Snowsight-test.js`: extracts the 12 TEMPLATES, runs them via sql.js in Node, prints pass/fail. This is the baseline harness everything else relies on.

---

## Phase 0 — Foundation: Engine + Real Dataset

**Goal:** Replace synthetic data with a real analytical dataset and dual-engine support, without ever leaving the page broken at session end.

### 0a (1 session) — Engine abstraction

Wrap current sql.js calls behind a thin `engine.exec(sql)` interface. No DuckDB yet. 12/12 still pass on sql.js. Adds `?engine=sqljs` URL param (default).

### 0b (1–2 sessions) — DuckDB-WASM behind the abstraction

Loaded only when `?engine=duckdb`. Synthetic TPCH still, no parquet yet. 12/12 pass on **both** engines. Translator forks where needed (most paths same; DuckDB path drops the QUALIFY/IFF/etc. translations DuckDB handles natively):

- `IFF`/`IIF` → `CASE WHEN ... THEN ... ELSE ... END` (run to fixpoint for nesting)
- `DATEADD(unit, n, date)` → `date + INTERVAL n unit`
- `DATEDIFF(unit, a, b)` → `date_diff('unit', a, b)`
- `ZEROIFNULL` → `COALESCE(x, 0)`
- `NULLIFZERO` → `NULLIF(x, 0)`
- `NVL2` → `CASE WHEN x IS NOT NULL THEN y ELSE z END`
- `DIV0` / `DIV0NULL`

Convert result format: SQL.js `{columns, values}` → Arrow `Table` (use `arrowToTable()` helper).

### 0c (1 session) — Mobile responsive pass on the current page

Cheap, fixes a real portfolio-wide problem, independent of engine work. Done before adding more weight to the page:

- Sidebar collapses to hamburger drawer below 768px
- Editor + results stack vertically
- 100dvh instead of 100vh
- Touch targets ≥44px

### 0d (deferred / optional) — Build pipeline

3,726 lines in one file is fine. Only split into `src/appN.js` if a later phase makes single-file editing painful. Skipping this for now is intentional.

### 0e (1–2 sessions) — Parquet ingestion

Commit TPCH SF0.01 parquet (~60K rows, ~2–3 MB total) under `pages/Snowsight-data/`. DuckDB path loads via:

```js
await conn.query(`
  CREATE TABLE lineitem AS
  SELECT * FROM 'pages/Snowsight-data/lineitem.parquet'
`);
```

sql.js path stays synthetic. Add a dataset selector in the topbar near the warehouse pill.

**Verification:** All 12 templates pass on both engines. `node pages/Snowsight-test.js --engine=sqljs` and `--engine=duckdb` both green.

---

## Pull-forward — High-ROI features before original Phase 1

These are cheap and high-payoff. Don't bury them at the end.

### PF1 (1–2 sessions) — AI assistant

"Ask AI" button in the editor toolbar:

1. Takes user's natural-language prompt
2. Sends to Anthropic API with current schema context
3. Inserts generated SQL into editor
4. Stretch: "Explain results in plain English" after execution

Use the in-artifacts API pattern; no backend. Single most resume-worthy feature for 2026 portfolios. Works on either engine.

### PF2 (1 session) — OPFS cache for parquet

DuckDB-WASM persists to OPFS. After loading parquet once, cache locally so subsequent visits skip the GitHub-Pages fetch:

```js
await db.open({ path: 'opfs://snowsight.db', accessMode: duckdb.DuckDBAccessMode.READ_WRITE });
```

First visit: download parquet, write to OPFS (~5s). Subsequent visits: open OPFS file (<1s). Critical because GitHub-hosted parquet means slow first load.

---

## Phase 1 — Core Snowflake SQL parity (re-ordered by safety)

Cheap ones first; defer the risky ones until after a Phase 2 win.

### 1.6 (1 session) — Function parity quick wins

~10 one-liners. Translator + templates. Easy green:

- `REGEXP_LIKE` → `regexp_matches`
- `STARTSWITH` / `ENDSWITH` / `CONTAINS` → `LIKE` patterns
- `EDITDISTANCE` → `levenshtein`
- `BITAND_AGG` / `BITOR_AGG` / `BITXOR_AGG` → DuckDB native
- `APPROX_COUNT_DISTINCT`, `MEDIAN`, `MODE` → DuckDB native or `quantile_cont`
- `RATIO_TO_REPORT(x) OVER (...)` → `x / SUM(x) OVER (...)`

### 1.1 (2 sessions) — VARIANT / OBJECT / ARRAY

DuckDB-only path. sql.js path returns a friendly "VARIANT requires DuckDB engine" error.

- `PARSE_JSON(x)` → `x::JSON`
- `OBJECT_CONSTRUCT(k, v, ...)` → struct or `json_object`
- `ARRAY_CONSTRUCT(...)` → `[...]` or `json_array`
- `OBJECT_KEYS(x)` → `json_keys`
- `obj:key.path[::TYPE]` → `json_extract` with cast

Add a `VARIANT_DATA` table to `DEMO_DB` to demo it.

### 1.2 (1–2 sessions) — FLATTEN / LATERAL

DuckDB-only. `LATERAL FLATTEN(input => arr)` → `unnest(arr) AS f(value)` with the standard alias columns. Pattern-match the common forms.

### Deferred until after Phase 2 ships

- **1.3 time travel** — UI win, low correctness value. Park.
- **1.4 MERGE** — deep semantics, low recruiter visibility. Park.
- **1.5 COPY INTO** — needs stages UI from 2.4 to be useful. Park.

---

## Phase 2 — UX parity (visible wins, isolate the risky one)

### 2.1 (1–2 sessions) — Worksheet folders

Pure UI. Drag-and-drop tree, right-click context menu, "Recent" + "Shared with me" virtual folders.

### 2.2 (1 session) — Table detail page

DuckDB path uses `SUMMARIZE table_name` for column stats. sql.js path shows basic counts only. Tabs: Columns, Data preview, DDL.

### 2.6 (1–2 sessions) — Full Query History page

Replaces the modal. Filter chips, paginated table, click-row → detail panel. Recruiters dwell on this.

### 2.7 (1–2 sessions) — Result panel filter / search / pivot

Client-side, both engines. Filter row, full-text search, drag-to-pivot, per-column statistics popover.

### 2.8 (1 session) — Editor improvements

- Real autocomplete (CodeMirror `show-hint` + custom hinter reading `SCHEMA_META` and current FROM clause)
- Inline error markers from engine error positions
- `Cmd+F` / `Cmd+H` via `searchcursor`
- Replace naive `formatSql()` with `sql-formatter` via CDN

### 2.5 (2 sessions) — Admin pages

UI mocks, both engines. Compute > Warehouses, Admin > Users, Admin > Roles, Admin > Resource Monitors. State in localStorage where it makes sense.

### 2.4 (1 session) — Stages / file upload

Drop CSV/JSON/parquet onto the page → DuckDB `register_file_buffer` → `COPY INTO` works. sql.js path falls back to "load on DuckDB engine" message.

### 2.3 (isolated, with off-ramp) — Real query plan visualization

The single biggest "wow" feature, but also the deepest individual task. Run with off-ramp:

- **Session 1:** parse DuckDB's `EXPLAIN ANALYZE` output into a JSON tree. Stop here.
  - If green → continue.
  - If sideways → fall back to a static text plan rendering and move on.
- **Session 2:** render as top-down DAG, color-coded by time spent.
- **Session 3:** click-node detail panel.

---

## After Phase 2 ships, revisit:

- Deferred 1.3 / 1.4 / 1.5 (decide what's still worth it now that the visible UI is in)
- Original Phase 3: Notebooks (3.1), Dashboards (3.2), Tasks/Streams UI mocks (3.3), Sharing/permalinks (3.5)
- Original Phase 4: Streaming results (4.2), accessibility (4.4), tests (4.5), docs site (4.6)

(Note: Phase 3.4 AI assistant and Phase 4.1 OPFS already shipped as PF1/PF2.)

---

## Anti-goals (things to NOT build)

Common scope-creep traps. Skip unless a recruiter specifically asks.

- **Real authentication / multi-user** — UI mock fine; OAuth burns a week and adds nothing
- **Real warehouse compute simulation** — warehouse pill is a status indicator, not a feature
- **Snowflake Marketplace** — would need to mock dozens of fake datasets
- **Streamlit-in-Snowflake** — would need Pyodide; massive bundle hit
- **Snowpark** — Python execution; out of scope
- **Real cost analytics** — fake numbers are fine
- **Replication / failover UI** — niche, low visual payoff
- **CodeMirror 5 → 6 migration** — huge sink, no visible benefit
- **Visual restyle** — the current ice-blue/dark Snowsight palette is correct; leave it
- **Backend for the AI assistant** — use the in-artifacts API pattern only

---

## Open questions resolved

1. ~~iOS WebView fallback?~~ → **Yes, `?engine=sqljs` always available.**
2. ~~Parquet hosting?~~ → **GitHub repo under `pages/Snowsight-data/`.**
3. ~~Session budget?~~ → **Unlimited; constraint is overload prevention, not cost.**
4. **Still open:** AI assistant API key handling — user-paste-into-localStorage vs. host-provided. Decide at start of PF1.
5. **Still open:** Lighthouse performance budget for Phase 4. Defer until then.

---

*Living document. Edit freely, archive completed phases, add new ones as the product evolves.*

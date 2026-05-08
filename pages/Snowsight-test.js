#!/usr/bin/env node
/**
 * Snowsight test harness — Phase Pre-work baseline.
 *
 * Runs every TEMPLATE from pages/Snowsight against the active engine and
 * prints a pass/fail summary. Single source of truth: the translator,
 * data generators, and TEMPLATES are extracted directly from the HTML
 * via regex + vm.runInContext, so this harness can never drift from
 * what the page actually ships.
 *
 * Usage:
 *   node pages/Snowsight-test.js
 *   node pages/Snowsight-test.js --engine=sqljs
 *   node pages/Snowsight-test.js --engine=duckdb   (Phase 0b — not yet implemented)
 *
 * Exit codes:
 *   0   all templates pass on the requested engine
 *   1   one or more templates failed
 *   2   harness configuration error (engine not implemented, source not found)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = (process.argv.find(a => a.startsWith('--engine=')) || '--engine=sqljs').split('=')[1];

if (ENGINE === 'duckdb') {
  console.error('engine=duckdb is not yet implemented (Phase 0b). Re-run with --engine=sqljs.');
  process.exit(2);
}
if (ENGINE !== 'sqljs') {
  console.error(`Unknown engine: ${ENGINE}. Valid: sqljs, duckdb.`);
  process.exit(2);
}

// ---------- Extract translator + data + TEMPLATES from pages/Snowsight ----------

const srcPath = path.join(__dirname, 'Snowsight');
const html = fs.readFileSync(srcPath, 'utf8');

// The inline <script> block we care about starts with the PART 1 banner and
// runs through PART 2's TEMPLATES array. Everything after that is DOM-bound
// UI code we don't need (and can't run in Node without stubs).
const scriptMatch = html.match(/<script>([\s\S]*?SNOWSIGHT CLONE - PART 1[\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('Could not locate PART 1 <script> block in pages/Snowsight.');
  process.exit(2);
}

let scriptText = scriptMatch[1];

// Cut at "Formatting helpers" — that's where DOM-bound code begins.
const cutMarker = '// ---------- Formatting helpers';
const cutIdx = scriptText.indexOf(cutMarker);
if (cutIdx > 0) scriptText = scriptText.slice(0, cutIdx);

// Promote the const-declared symbols we need onto globalThis so we can grab
// them out of the vm context (const declarations don't auto-leak in vm).
scriptText += `
;globalThis.TEMPLATES = TEMPLATES;
;globalThis.translateSnowflake = translateSnowflake;
;globalThis.generateTPCH = generateTPCH;
;globalThis.generateDemoDB = generateDemoDB;
`;

const sandbox = {
  console,
  // Stubs for browser globals the source touches at parse/run time.
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {} },
  window: {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(scriptText, sandbox, { filename: 'Snowsight (extracted)' });

const { TEMPLATES, translateSnowflake, generateTPCH, generateDemoDB } = sandbox;
if (!TEMPLATES || !translateSnowflake || !generateTPCH || !generateDemoDB) {
  console.error('Failed to extract required symbols from pages/Snowsight.');
  process.exit(2);
}

// ---------- DDL (mirrors loadTpchIntoDB + loadDemoIntoDB in pages/Snowsight) ----------

const TPCH_DDL = [
  `CREATE TABLE region (r_regionkey INTEGER PRIMARY KEY, r_name TEXT, r_comment TEXT);`,
  `CREATE TABLE nation (n_nationkey INTEGER PRIMARY KEY, n_name TEXT, n_regionkey INTEGER, n_comment TEXT);`,
  `CREATE TABLE customer (c_custkey INTEGER PRIMARY KEY, c_name TEXT, c_address TEXT, c_nationkey INTEGER, c_phone TEXT, c_acctbal REAL, c_mktsegment TEXT, c_comment TEXT);`,
  `CREATE TABLE supplier (s_suppkey INTEGER PRIMARY KEY, s_name TEXT, s_address TEXT, s_nationkey INTEGER, s_phone TEXT, s_acctbal REAL, s_comment TEXT);`,
  `CREATE TABLE part (p_partkey INTEGER PRIMARY KEY, p_name TEXT, p_mfgr TEXT, p_brand TEXT, p_type TEXT, p_size INTEGER, p_container TEXT, p_retailprice REAL, p_comment TEXT);`,
  `CREATE TABLE partsupp (ps_partkey INTEGER, ps_suppkey INTEGER, ps_availqty INTEGER, ps_supplycost REAL, ps_comment TEXT, PRIMARY KEY (ps_partkey, ps_suppkey));`,
  `CREATE TABLE orders (o_orderkey INTEGER PRIMARY KEY, o_custkey INTEGER, o_orderstatus TEXT, o_totalprice REAL, o_orderdate TEXT, o_orderpriority TEXT, o_clerk TEXT, o_shippriority INTEGER, o_comment TEXT);`,
  `CREATE TABLE lineitem (l_orderkey INTEGER, l_partkey INTEGER, l_suppkey INTEGER, l_linenumber INTEGER, l_quantity INTEGER, l_extendedprice REAL, l_discount REAL, l_tax REAL, l_returnflag TEXT, l_linestatus TEXT, l_shipdate TEXT, l_commitdate TEXT, l_receiptdate TEXT, l_shipinstruct TEXT, l_shipmode TEXT, l_comment TEXT, PRIMARY KEY (l_orderkey, l_linenumber));`
];
const DEMO_DDL = [
  `CREATE TABLE departments (dept_id INTEGER PRIMARY KEY, dept_name TEXT, location TEXT, budget REAL);`,
  `CREATE TABLE employees (employee_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, dept_id INTEGER, title TEXT, hire_date TEXT, salary REAL, manager_id INTEGER);`,
  `CREATE TABLE sales (sale_id INTEGER PRIMARY KEY, employee_id INTEGER, product TEXT, sale_date TEXT, amount REAL, status TEXT);`
];

const TPCH_COLS = {
  region:   ['r_regionkey','r_name','r_comment'],
  nation:   ['n_nationkey','n_name','n_regionkey','n_comment'],
  customer: ['c_custkey','c_name','c_address','c_nationkey','c_phone','c_acctbal','c_mktsegment','c_comment'],
  supplier: ['s_suppkey','s_name','s_address','s_nationkey','s_phone','s_acctbal','s_comment'],
  part:     ['p_partkey','p_name','p_mfgr','p_brand','p_type','p_size','p_container','p_retailprice','p_comment'],
  partsupp: ['ps_partkey','ps_suppkey','ps_availqty','ps_supplycost','ps_comment'],
  orders:   ['o_orderkey','o_custkey','o_orderstatus','o_totalprice','o_orderdate','o_orderpriority','o_clerk','o_shippriority','o_comment'],
  lineitem: ['l_orderkey','l_partkey','l_suppkey','l_linenumber','l_quantity','l_extendedprice','l_discount','l_tax','l_returnflag','l_linestatus','l_shipdate','l_commitdate','l_receiptdate','l_shipinstruct','l_shipmode','l_comment']
};
const DEMO_COLS = {
  departments: ['dept_id','dept_name','location','budget'],
  employees:   ['employee_id','first_name','last_name','email','dept_id','title','hire_date','salary','manager_id'],
  sales:       ['sale_id','employee_id','product','sale_date','amount','status']
};

// ---------- Run ----------

(async () => {
  const t0 = Date.now();
  let initSqlJs;
  try {
    initSqlJs = require('sql.js');
  } catch (e) {
    console.error('sql.js not installed. Run: npm install');
    process.exit(2);
  }
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  for (const s of TPCH_DDL) db.exec(s);
  for (const s of DEMO_DDL) db.exec(s);

  const tpch = generateTPCH();
  const demo = generateDemoDB();

  const bulk = (table, cols, rows) => {
    if (!rows.length) return;
    const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(_ => '?').join(',')})`);
    db.exec('BEGIN');
    try { for (const r of rows) stmt.run(r); } finally { stmt.free(); db.exec('COMMIT'); }
  };
  for (const t of Object.keys(TPCH_COLS)) bulk(t, TPCH_COLS[t], tpch[t]);
  for (const t of Object.keys(DEMO_COLS)) bulk(t, DEMO_COLS[t], demo[t]);

  const dataMs = Date.now() - t0;
  const rowTotal = Object.values(tpch).reduce((s, a) => s + a.length, 0)
                 + Object.values(demo).reduce((s, a) => s + a.length, 0);
  let sqljsVer = '?';
  try {
    const pkgPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'package.json');
    sqljsVer = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch (_) { /* version display is best-effort */ }
  console.log(`Engine: ${ENGINE} (sql.js ${sqljsVer})`);
  console.log(`Loaded ${rowTotal.toLocaleString()} rows in ${dataMs}ms\n`);

  let pass = 0, fail = 0;
  const failures = [];
  for (const t of TEMPLATES) {
    const id = t.id.padEnd(10);
    const tStart = Date.now();
    try {
      const translated = translateSnowflake(t.sql);
      const result = db.exec(translated);
      const last = result[result.length - 1];
      const rows = last && last.values ? last.values.length : 0;
      const ms = Date.now() - tStart;
      console.log(`  PASS  ${id}  ${String(rows).padStart(6)} rows  ${String(ms).padStart(4)}ms  ${t.title}`);
      pass++;
    } catch (e) {
      const ms = Date.now() - tStart;
      console.log(`  FAIL  ${id}                ${String(ms).padStart(4)}ms  ${t.title}`);
      console.log(`        ${e.message}`);
      failures.push({ id: t.id, title: t.title, error: e.message });
      fail++;
    }
  }

  const total = TEMPLATES.length;
  console.log(`\n${pass}/${total} templates pass on engine=${ENGINE}`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.id}: ${f.error}`);
    process.exit(1);
  }
  process.exit(0);
})().catch(e => {
  console.error('Harness crashed:', e);
  process.exit(1);
});

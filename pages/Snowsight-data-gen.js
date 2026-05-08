#!/usr/bin/env node
/**
 * Snowsight parquet data generator (Phase 0e).
 *
 * Extracts the synthetic TPCH + DEMO_DB row generators from pages/Snowsight,
 * loads them into a fresh DuckDB instance, then writes one parquet file per
 * table under pages/Snowsight-data/.
 *
 * Run:
 *   node pages/Snowsight-data-gen.js
 *
 * The output is committed and served via GitHub Pages so the browser
 * DuckDB-WASM build can fetch each file under
 * pages/Snowsight-data/<table>.parquet.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DuckDBInstance } = require('@duckdb/node-api');

const OUT_DIR = path.join(__dirname, 'Snowsight-data');
const SRC_PATH = path.join(__dirname, 'Snowsight');

const TPCH_DDL = [
  `CREATE TABLE region (r_regionkey INTEGER, r_name VARCHAR, r_comment VARCHAR)`,
  `CREATE TABLE nation (n_nationkey INTEGER, n_name VARCHAR, n_regionkey INTEGER, n_comment VARCHAR)`,
  `CREATE TABLE customer (c_custkey INTEGER, c_name VARCHAR, c_address VARCHAR, c_nationkey INTEGER, c_phone VARCHAR, c_acctbal DOUBLE, c_mktsegment VARCHAR, c_comment VARCHAR)`,
  `CREATE TABLE supplier (s_suppkey INTEGER, s_name VARCHAR, s_address VARCHAR, s_nationkey INTEGER, s_phone VARCHAR, s_acctbal DOUBLE, s_comment VARCHAR)`,
  `CREATE TABLE part (p_partkey INTEGER, p_name VARCHAR, p_mfgr VARCHAR, p_brand VARCHAR, p_type VARCHAR, p_size INTEGER, p_container VARCHAR, p_retailprice DOUBLE, p_comment VARCHAR)`,
  `CREATE TABLE partsupp (ps_partkey INTEGER, ps_suppkey INTEGER, ps_availqty INTEGER, ps_supplycost DOUBLE, ps_comment VARCHAR)`,
  `CREATE TABLE orders (o_orderkey INTEGER, o_custkey INTEGER, o_orderstatus VARCHAR, o_totalprice DOUBLE, o_orderdate DATE, o_orderpriority VARCHAR, o_clerk VARCHAR, o_shippriority INTEGER, o_comment VARCHAR)`,
  `CREATE TABLE lineitem (l_orderkey INTEGER, l_partkey INTEGER, l_suppkey INTEGER, l_linenumber INTEGER, l_quantity INTEGER, l_extendedprice DOUBLE, l_discount DOUBLE, l_tax DOUBLE, l_returnflag VARCHAR, l_linestatus VARCHAR, l_shipdate DATE, l_commitdate DATE, l_receiptdate DATE, l_shipinstruct VARCHAR, l_shipmode VARCHAR, l_comment VARCHAR)`
];
const DEMO_DDL = [
  `CREATE TABLE departments (dept_id INTEGER, dept_name VARCHAR, location VARCHAR, budget DOUBLE)`,
  `CREATE TABLE employees (employee_id INTEGER, first_name VARCHAR, last_name VARCHAR, email VARCHAR, dept_id INTEGER, title VARCHAR, hire_date DATE, salary DOUBLE, manager_id INTEGER)`,
  `CREATE TABLE sales (sale_id INTEGER, employee_id INTEGER, product VARCHAR, sale_date DATE, amount DOUBLE, status VARCHAR)`,
  `CREATE TABLE variant_data (event_id INTEGER, event_type VARCHAR, user_id INTEGER, props VARCHAR)`
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
  departments:  ['dept_id','dept_name','location','budget'],
  employees:    ['employee_id','first_name','last_name','email','dept_id','title','hire_date','salary','manager_id'],
  sales:        ['sale_id','employee_id','product','sale_date','amount','status'],
  variant_data: ['event_id','event_type','user_id','props']
};

function extractGenerators() {
  const html = fs.readFileSync(SRC_PATH, 'utf8');
  const m = html.match(/<script>([\s\S]*?SNOWSIGHT CLONE - PART 1[\s\S]*?)<\/script>/);
  if (!m) throw new Error('Could not locate PART 1 script block.');
  let scriptText = m[1];
  const cut = scriptText.indexOf('// ---------- Formatting helpers');
  if (cut > 0) scriptText = scriptText.slice(0, cut);
  scriptText += `
;globalThis.generateTPCH = generateTPCH;
;globalThis.generateDemoDB = generateDemoDB;
`;
  const sandbox = {
    console,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { addEventListener() {} },
    window: {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptText, sandbox, { filename: 'Snowsight (extracted)' });
  return { generateTPCH: sandbox.generateTPCH, generateDemoDB: sandbox.generateDemoDB };
}

function duckdbLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function bulkInsert(conn, table, cols, rows, chunk = 500) {
  if (!rows.length) return;
  const colList = cols.join(', ');
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const valueRows = slice.map(r => '(' + r.map(v => duckdbLiteral(v)).join(', ') + ')').join(', ');
    await conn.run(`INSERT INTO ${table} (${colList}) VALUES ${valueRows}`);
  }
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const { generateTPCH, generateDemoDB } = extractGenerators();
  const tpch = generateTPCH();
  const demo = generateDemoDB();

  const inst = await DuckDBInstance.create(':memory:');
  const conn = await inst.connect();

  for (const ddl of TPCH_DDL) await conn.run(ddl);
  for (const ddl of DEMO_DDL) await conn.run(ddl);

  console.log('Loading rows…');
  const t0 = Date.now();
  for (const t of Object.keys(TPCH_COLS)) {
    await bulkInsert(conn, t, TPCH_COLS[t], tpch[t]);
    console.log(`  ${t}: ${tpch[t].length.toLocaleString()} rows`);
  }
  for (const t of Object.keys(DEMO_COLS)) {
    await bulkInsert(conn, t, DEMO_COLS[t], demo[t]);
    console.log(`  ${t}: ${demo[t].length.toLocaleString()} rows`);
  }
  console.log(`Loaded in ${Date.now() - t0}ms\n`);

  const tables = [...Object.keys(TPCH_COLS), ...Object.keys(DEMO_COLS)];
  console.log('Writing parquet…');
  let totalBytes = 0;
  const manifest = { generatedAt: new Date().toISOString(), tables: {} };
  for (const t of tables) {
    const out = path.join(OUT_DIR, `${t}.parquet`);
    // SNAPPY by default; gives small files on this dataset and is supported
    // out of the box by DuckDB-WASM.
    await conn.run(`COPY (SELECT * FROM ${t}) TO '${out}' (FORMAT PARQUET, COMPRESSION SNAPPY)`);
    const sz = fs.statSync(out).size;
    const rowsRes = await conn.run(`SELECT COUNT(*) AS n FROM ${t}`);
    const rowObjs = await rowsRes.getRowObjects();
    const rows = Number(rowObjs[0].n);
    totalBytes += sz;
    manifest.tables[t] = { rows, bytes: sz };
    console.log(`  ${t.padEnd(14)}  ${rows.toLocaleString().padStart(7)} rows  ${(sz / 1024).toFixed(1).padStart(7)} KB`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nTotal: ${(totalBytes / 1024 / 1024).toFixed(2)} MB across ${tables.length} parquet files`);
  console.log(`Manifest: ${path.join(OUT_DIR, 'manifest.json')}`);
})().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});

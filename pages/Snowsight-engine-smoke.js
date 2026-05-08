#!/usr/bin/env node
/**
 * Engine adapter smoke test — guardrail for the createEngine block in
 * pages/Snowsight. The main harness (Snowsight-test.js) only exercises
 * the translator + data + TEMPLATES; this file extracts the engine
 * adapter block alone, evaluates it, and exercises every public method.
 *
 * sqljs path runs end-to-end against npm sql.js.
 *
 * duckdb path: the page's adapter calls a browser-only ESM import from
 * jsDelivr, which can't run under Node. We verify the adapter shape
 * (kind, ready, async exec/bulkInsert) and rejection paths only.
 *
 * Run: node pages/Snowsight-engine-smoke.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'Snowsight'), 'utf8');

// Pull the entire engine block — adapter factory + sub-builders + helpers.
// Anchored on banner comment + the closing helper function.
const m = html.match(/(\/\/ ---------- Engine adapter[\s\S]*?function selectedEngineKind\(\)[\s\S]*?\n\})/);
if (!m) {
  console.error('Engine adapter block not found in pages/Snowsight.');
  process.exit(2);
}

const engineCode = m[1] + `
;globalThis.createEngine = createEngine;
;globalThis.createSqljsEngine = createSqljsEngine;
;globalThis.createDuckDBEngine = createDuckDBEngine;
;globalThis.selectedEngineKind = selectedEngineKind;
`;

const initSqlJsNpm = require('sql.js');
const sandbox = {
  console,
  // Strip browser-only locateFile so the sqljs adapter works under Node.
  initSqlJs: () => initSqlJsNpm(),
  window: { location: { search: '' } },
  URLSearchParams,
  // For the duckdb adapter — we don't actually call init(), so dynamic
  // import never executes; nothing to stub.
  Set, Map, Date, JSON, Promise, Error, RegExp, Blob: function () {}, Worker: function () {}, URL
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox, { filename: 'engine adapter (extracted)' });

const { createEngine, selectedEngineKind } = sandbox;

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`  PASS  ${name}${detail ? '  ' + detail : ''}`); pass++; }
  else    { console.log(`  FAIL  ${name}${detail ? '  ' + detail : ''}`); fail++; }
};

(async () => {
  // ---------- Dispatcher ----------
  check('default engine kind is sqljs', selectedEngineKind() === 'sqljs');
  try { createEngine('bogus'); check('createEngine(bogus) rejects', false); }
  catch (e) { check('createEngine(bogus) rejects', /unknown engine/i.test(e.message)); }

  // ---------- sqljs adapter (full end-to-end) ----------
  const sq = createEngine('sqljs');
  check('sqljs ready=false before init', sq.ready === false);
  await sq.init();
  check('sqljs ready=true after init', sq.ready === true);
  check('sqljs kind=sqljs', sq.kind === 'sqljs');

  await sq.exec(`CREATE TABLE t (id INTEGER, name TEXT);`);
  await sq.bulkInsert('t', ['id', 'name'], [[1, 'a'], [2, 'b'], [3, 'c']]);
  const rs = await sq.exec(`SELECT COUNT(*) AS n FROM t;`);
  check('sqljs bulkInsert + exec roundtrip', rs[0].values[0][0] === 3, `got n=${rs[0].values[0][0]}`);

  let emptyOk = true;
  try { await sq.bulkInsert('t', ['id', 'name'], []); } catch (_) { emptyOk = false; }
  check('sqljs bulkInsert([]) is a no-op', emptyOk);

  const shape = await sq.exec(`SELECT id, name FROM t ORDER BY id;`);
  const shapeOk = Array.isArray(shape) && shape.length === 1
    && Array.isArray(shape[0].columns) && Array.isArray(shape[0].values)
    && shape[0].columns.join(',') === 'id,name' && shape[0].values.length === 3;
  check('sqljs result shape sql.js-compatible', shapeOk);

  // ---------- duckdb adapter (shape only — init requires browser) ----------
  const dk = createEngine('duckdb');
  check('duckdb kind=duckdb', dk.kind === 'duckdb');
  check('duckdb ready=false before init', dk.ready === false);
  check('duckdb has async exec', typeof dk.exec === 'function');
  check('duckdb has async bulkInsert', typeof dk.bulkInsert === 'function');
  check('duckdb has init', typeof dk.init === 'function');
  // Methods must return promises (engine.exec contract is async on both kinds).
  const fakeProbe = dk.bulkInsert('t', ['x'], []);
  check('duckdb bulkInsert([]) returns a Promise', fakeProbe && typeof fakeProbe.then === 'function');
  await fakeProbe;

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});

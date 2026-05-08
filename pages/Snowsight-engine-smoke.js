#!/usr/bin/env node
/**
 * Engine adapter smoke test — Phase 0a guardrail.
 *
 * The main harness (Snowsight-test.js) extracts only PART 1 (translator +
 * data + TEMPLATES) from pages/Snowsight, so it cannot catch regressions in
 * the engine adapter that lives further down. This file extracts the
 * engine adapter block alone, evaluates it against npm sql.js, and
 * exercises every public method.
 *
 * Run: node pages/Snowsight-engine-smoke.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'Snowsight'), 'utf8');

// Pull just the engine adapter — anchored on banner comments so it's stable.
const m = html.match(/(\/\/ ---------- Engine adapter[\s\S]*?function selectedEngineKind\(\)[\s\S]*?\n\})/);
if (!m) {
  console.error('Engine adapter block not found in pages/Snowsight.');
  process.exit(2);
}

const engineCode = m[1] + `
;globalThis.createEngine = createEngine;
;globalThis.selectedEngineKind = selectedEngineKind;
`;

const initSqlJsNpm = require('sql.js');
const sandbox = {
  console,
  // Strip browser-only locateFile so the adapter works under Node.
  initSqlJs: () => initSqlJsNpm(),
  window: { location: { search: '' } },
  URLSearchParams,
  Set, Map, Date, JSON, Promise, Error, RegExp
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
  check('default engine kind is sqljs', selectedEngineKind() === 'sqljs');

  try { createEngine('duckdb'); check('createEngine(duckdb) rejects', false); }
  catch (e) { check('createEngine(duckdb) rejects', /not yet implemented/i.test(e.message)); }

  try { createEngine('bogus'); check('createEngine(bogus) rejects', false); }
  catch (e) { check('createEngine(bogus) rejects', /unknown engine/i.test(e.message)); }

  const engine = createEngine('sqljs');
  check('ready=false before init', engine.ready === false);
  await engine.init();
  check('ready=true after init', engine.ready === true);
  check('kind=sqljs', engine.kind === 'sqljs');

  engine.exec(`CREATE TABLE t (id INTEGER, name TEXT);`);
  engine.bulkInsert('t', ['id', 'name'], [[1, 'a'], [2, 'b'], [3, 'c']]);
  const rs = engine.exec(`SELECT COUNT(*) AS n FROM t;`);
  const n = rs[0].values[0][0];
  check('bulkInsert + exec roundtrip', n === 3, `got n=${n}`);

  // Empty bulkInsert is a no-op — must not error.
  let emptyOk = true;
  try { engine.bulkInsert('t', ['id', 'name'], []); }
  catch (_) { emptyOk = false; }
  check('bulkInsert([]) is a no-op', emptyOk);

  // Result shape stays sql.js-compatible: Array<{columns, values}>.
  const shape = engine.exec(`SELECT id, name FROM t ORDER BY id;`);
  const shapeOk = Array.isArray(shape)
    && shape.length === 1
    && Array.isArray(shape[0].columns)
    && Array.isArray(shape[0].values)
    && shape[0].columns.join(',') === 'id,name'
    && shape[0].values.length === 3;
  check('result shape is sql.js-compatible', shapeOk);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});

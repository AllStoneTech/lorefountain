/**
 * Smoke check for release bundles: loads a built bundle in plain Node, with
 * a stand-in for the `vscode` module, and fails if loading it throws.
 *
 * Why: unit tests run the TypeScript sources, never the minified and
 * obfuscated bundle that ships. The 1.1.0 package once crashed on load with
 * "self is not defined" because the obfuscator's control-flow flattening
 * rewrote `globalThis || self` into a call that evaluates both sides. This
 * catches that whole class of bundle-only failure before packaging.
 *
 * Usage: node scripts/smoke-load-bundle.js dist/extension.js [dist/pro.js ...]
 * Exits 1 (and prints the error) if any bundle throws while loading.
 *
 * Constraint: it only loads the module (top-level code and anything that runs
 * at require time); it does not call `activate`, which needs a real VS Code.
 */

'use strict';

const Module = require('node:module');
const path = require('node:path');

/**
 * A `vscode` stand-in: every property is a callable, constructible proxy, so
 * top-level API use doesn't throw. `__esModule` is true so esbuild's
 * namespace interop uses the proxy itself instead of copying its (no) keys.
 */
function makeStub() {
  const handler = {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then') return undefined;
      return stub;
    },
    apply: () => stub,
    construct: () => stub,
  };
  const stub = new Proxy(function vscodeStub() {}, handler);
  return stub;
}

/**
 * The module stand-in: a plain object with every top-level `vscode` API name
 * (read from `@types/vscode`), each a stub. esbuild's interop copies a
 * module's own property names, so the names must really exist.
 */
function makeVscodeModule() {
  const fs = require('node:fs');
  const typesFile = require.resolve('@types/vscode/index.d.ts');
  const source = fs.readFileSync(typesFile, 'utf8');
  const names = new Set();
  for (const match of source.matchAll(/^[ \t]+export (?:declare )?(?:namespace|class|enum|const|function|let|var) ([A-Za-z_$][\w$]*)/gm)) names.add(match[1]);
  const stub = makeStub();
  const vscodeModule = {};
  for (const name of names) vscodeModule[name] = stub;
  return vscodeModule;
}

const vscodeStub = makeVscodeModule();
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'vscode') return vscodeStub;
  return originalLoad.call(this, request, parent, isMain);
};

const bundles = process.argv.slice(2);
if (bundles.length === 0) {
  console.error('[smoke] usage: node scripts/smoke-load-bundle.js <bundle.js> [...]');
  process.exit(2);
}

let failed = false;
for (const bundle of bundles) {
  const file = path.resolve(bundle);
  try {
    require(file);
    console.log(`[smoke] loaded ${bundle}`);
  } catch (error) {
    failed = true;
    console.error(`[smoke] ${bundle} threw while loading:`);
    console.error(error);
  }
}
process.exit(failed ? 1 : 0);

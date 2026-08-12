// esbuild bundler for the LoreFountain VS Code extension, plus its
// companion headless validator script and (when present) the private
// paid-tier module.
//
// Two always-built bundles:
// 1. src/extension.ts -> dist/extension.js — the VS Code extension itself
//    (CommonJS, `vscode` external, sql.js WASM copied alongside).
// 2. src/cli/validate.ts -> resources/agents/validate.js — a fully
//    self-contained, dependency-free script with NO `vscode` import,
//    scaffolded by `Initialize Workspace` into every LoreFountain project
//    so an AI (or CI) can validate a project's files with a plain
//    `node validate.js`, no VS Code involved. It intentionally does not
//    use sql.js (see `src/index/memoryStore.ts`) specifically so this
//    bundle needs no WASM binary to keep colocated wherever it ends up.
//
// Two conditional bundles:
// 3. pro/src/index.ts -> dist/pro.js — the paid-tier ("LoreFountain Pro")
//    feature source, kept in a separate private repo
//    (github.com/AllStoneTech/lorefountain-pro) and consumed here as a git
//    submodule at pro/. Built only if pro/src/index.ts exists on disk — a
//    clone/build with no submodule access to that private repo simply
//    doesn't have the file, and this script skips it silently, producing
//    exactly the same free-tier-only extension it always has. See
//    src/extension.ts's `loadProModule` for the runtime side of this.
// 4. pro/src/webview/entityGraphClient.ts -> dist/entityGraphClient.js — the
//    Entity Graph webview's client script (paid tier). Unlike dist/pro.js,
//    this runs *inside* the webview (a Chromium context, not Node), so it's
//    bundled with platform: 'browser' / format: 'iife' and no `external` —
//    the graph-rendering library it imports must ship fully self-contained,
//    same reasoning as pro.js's own conditional build.
//
// Run with `--watch` for incremental rebuilds during development, or
// `--production` for minified, then javascript-obfuscator-hardened release
// bundles. Obfuscation runs on extension.js, pro.js, and
// entityGraphClient.js only — never on resources/agents/validate.js, which
// is meant to stay plain and readable in users' own projects (see above).
//
// Obfuscation strength is picked with `--obfuscate=<level>` (default
// `max`):
//   max      — string-array encoding + hex identifiers + control-flow
//              flattening + dead code injection. Hardest to reverse, but
//              ~3.5x the .vsix size of unobfuscated and adds real per-call
//              runtime overhead (extension activation, webview load).
//   balanced — string-array encoding + hex identifiers only. ~1.5x the
//              .vsix size, no runtime overhead, still defeats a casual
//              beautify-and-read.
//   off      — skip obfuscation; bundles are still minified under
//              --production.
// See the `npm run build:obfuscate-*` scripts in package.json for the
// one-line ways to switch.

const esbuild = require('esbuild');
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const obfuscateArg = process.argv.find((arg) => arg.startsWith('--obfuscate='));
const obfuscationLevel = obfuscateArg ? obfuscateArg.slice('--obfuscate='.length) : 'max';
if (!['max', 'balanced', 'off'].includes(obfuscationLevel)) {
  console.error(`[obfuscator] unknown --obfuscate level "${obfuscationLevel}" — expected max, balanced, or off`);
  process.exit(1);
}

// `renameProperties` and `renameGlobals` are left off in both profiles:
// this is CommonJS output whose module.exports (activate/deactivate) VS
// Code calls by name, and the pro webview bundle's IIFE may expose globals
// the extension host depends on — renaming either would break the
// extension at runtime. `selfDefending` is left off too: its
// tamper-detection wrapper breaks if VS Code, a bundler, or a future
// obfuscation pass ever reformats the file, and it makes stack traces from
// user bug reports useless.
const OBFUSCATION_PROFILES = {
  balanced: {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    renameProperties: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    splitStrings: false,
    numbersToExpressions: false,
    simplify: true,
    sourceMap: false,
  },
  max: {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    renameProperties: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    splitStrings: true,
    splitStringsChunkLength: 10,
    numbersToExpressions: true,
    simplify: true,
    sourceMap: false,
  },
};

function copySqlWasm() {
  const src = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const dest = path.join(__dirname, 'dist', 'sql-wasm.wasm');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[esbuild] copied sql-wasm.wasm -> dist/');
}

// Runs javascript-obfuscator over an already-bundled/minified output file,
// in place, at the strength selected by `--obfuscate=` (see file header).
// Only called for --production builds, and only on the bundles that ship
// inside the .vsix (extension.js, pro.js, entityGraphClient.js) — NOT
// resources/agents/validate.js, which is deliberately scaffolded into
// users' own projects as a plain, human/AI-readable script (see the file
// header above) and must stay that way.
function obfuscateBundle(outfile, label) {
  if (obfuscationLevel === 'off') {
    console.log(`[obfuscator] skipped ${outfile} (--obfuscate=off)`);
    return;
  }
  const filePath = path.join(__dirname, outfile);
  const source = fs.readFileSync(filePath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, OBFUSCATION_PROFILES[obfuscationLevel]);
  fs.writeFileSync(filePath, result.getObfuscatedCode());
  console.log(`[obfuscator] obfuscated ${outfile} at "${obfuscationLevel}"${label ? ` (${label})` : ''}`);
}

async function main() {
  const extensionCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: 'info',
    plugins: [
      {
        // Prints an explicit begin/end line pair on every build, including
        // every watch-mode rebuild (not just the first) — .vscode/tasks.json
        // matches these literal lines with its own problem matcher so VS
        // Code knows when the "watch" background task has finished a build
        // cycle, without depending on the connor4312.esbuild-problem-matchers
        // extension's "$esbuild-watch" shorthand. Kept exactly as tasks.json
        // expects — do not rename without updating that matcher too.
        name: 'copy-sql-wasm',
        setup(build) {
          build.onStart(() => {
            console.log('[esbuild] build started');
          });
          build.onEnd(() => {
            copySqlWasm();
            if (production) obfuscateBundle('dist/extension.js', 'extension');
            console.log('[esbuild] build finished');
          });
        },
      },
    ],
  });

  const validatorCtx = await esbuild.context({
    entryPoints: ['src/cli/validate.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    outfile: 'resources/agents/validate.js',
    minify: production,
    sourcemap: false,
    sourcesContent: false,
    logLevel: 'info',
    // `banner` text is injected after minification, not parsed as source, so
    // this survives --production builds where an ordinary source comment
    // would be stripped. Keep this number in sync with
    // AGENT_FILE_VERSIONS['agents/validate.js'] in src/config/agentFiles.ts —
    // the one deliberate place this version number is duplicated, since
    // this plain Node build script can't import that TS constant directly.
    banner: { js: '// lorefountain-docs-version: 1' },
    plugins: [
      {
        name: 'log-cli-build',
        setup(build) {
          build.onStart(() => {
            console.log('[esbuild:validator] build started');
          });
          build.onEnd(() => {
            console.log('[esbuild:validator] build finished');
          });
        },
      },
    ],
  });

  const proEntryPoint = path.join('pro', 'src', 'index.ts');
  const hasProModule = fs.existsSync(path.join(__dirname, proEntryPoint));
  const proCtx = hasProModule
    ? await esbuild.context({
        entryPoints: [proEntryPoint],
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'node22',
        outfile: 'dist/pro.js',
        external: ['vscode'],
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        logLevel: 'info',
        plugins: [
          {
            name: 'log-pro-build',
            setup(build) {
              build.onStart(() => {
                console.log('[esbuild:pro] build started');
              });
              build.onEnd(() => {
                if (production) obfuscateBundle('dist/pro.js', 'pro');
                console.log('[esbuild:pro] build finished');
              });
            },
          },
        ],
      })
    : null;
  if (!hasProModule) {
    console.log('[esbuild:pro] pro/src/index.ts not present — building free-tier only');
  }

  const proWebviewEntryPoint = path.join('pro', 'src', 'webview', 'entityGraphClient.ts');
  const hasProWebview = hasProModule && fs.existsSync(path.join(__dirname, proWebviewEntryPoint));
  const proWebviewCtx = hasProWebview
    ? await esbuild.context({
        entryPoints: [proWebviewEntryPoint],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        outfile: 'dist/entityGraphClient.js',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        logLevel: 'info',
        plugins: [
          {
            name: 'log-pro-webview-build',
            setup(build) {
              build.onStart(() => {
                console.log('[esbuild:pro-webview] build started');
              });
              build.onEnd(() => {
                if (production) obfuscateBundle('dist/entityGraphClient.js', 'pro-webview');
                console.log('[esbuild:pro-webview] build finished');
              });
            },
          },
        ],
      })
    : null;
  if (hasProModule && !hasProWebview) {
    console.log('[esbuild:pro-webview] pro/src/webview/entityGraphClient.ts not present — skipping graph webview bundle');
  }

  if (watch) {
    await extensionCtx.watch();
    await validatorCtx.watch();
    if (proCtx) await proCtx.watch();
    if (proWebviewCtx) await proWebviewCtx.watch();
    console.log('[esbuild] watching for changes...');
  } else {
    await extensionCtx.rebuild();
    await validatorCtx.rebuild();
    if (proCtx) await proCtx.rebuild();
    if (proWebviewCtx) await proWebviewCtx.rebuild();
    await extensionCtx.dispose();
    await validatorCtx.dispose();
    if (proCtx) await proCtx.dispose();
    if (proWebviewCtx) await proWebviewCtx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
// `--production` for minified release bundles.

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

function copySqlWasm() {
  const src = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const dest = path.join(__dirname, 'dist', 'sql-wasm.wasm');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[esbuild] copied sql-wasm.wasm -> dist/');
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

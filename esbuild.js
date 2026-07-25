// esbuild bundler for the LoreFountain VS Code extension, plus its
// companion headless validator script.
//
// Two independent bundles:
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

  if (watch) {
    await extensionCtx.watch();
    await validatorCtx.watch();
    console.log('[esbuild] watching for changes...');
  } else {
    await extensionCtx.rebuild();
    await validatorCtx.rebuild();
    await extensionCtx.dispose();
    await validatorCtx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

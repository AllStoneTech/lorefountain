// esbuild bundler for the LoreFountain VS Code extension.
//
// Bundles src/extension.ts -> dist/extension.js as a CommonJS module for the
// VS Code extension host. The `vscode` module is provided by the host at
// runtime and must stay external. Run with `--watch` for incremental rebuilds
// during development, or `--production` for a minified release bundle.
//
// sql.js's WASM binary is copied next to the bundle after every build. sql.js
// locates it via a `__dirname`-relative path baked into its own module code;
// once esbuild inlines that code into dist/extension.js, `__dirname` resolves
// to dist/ at runtime, so the .wasm must live there too or sql.js throws
// ENOENT on load (confirmed by a standalone repro — this is not optional).

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
  const ctx = await esbuild.context({
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
        name: 'copy-sql-wasm',
        setup(build) {
          build.onEnd(copySqlWasm);
        },
      },
    ],
  });

  if (watch) {
    await ctx.watch();
    console.log('[esbuild] watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

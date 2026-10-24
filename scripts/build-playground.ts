import {copyFileSync, mkdirSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'dist/playground');
rmSync(destination, {recursive: true, force: true});
mkdirSync(destination, {recursive: true});

// Browser targeting rejects Node built-ins anywhere in the shared runtime graph.
const result = await Bun.build({
  entrypoints: [resolve(root, 'playground/main.ts')],
  outdir: destination,
  target: 'browser',
  format: 'esm',
  naming: 'app.js',
  loader: {'.bas': 'text'},
  sourcemap: 'external',
});
if (!result.success) throw new AggregateError(result.logs, 'Playground build failed');
for (const file of ['index.html', 'styles.css']) {
  copyFileSync(resolve(root, 'playground', file), resolve(destination, file));
}
console.log('Static playground built in dist/playground');

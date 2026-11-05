import assert from 'node:assert/strict';
import {realpathSync, symlinkSync, unlinkSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {runProcess, runWithOpenInput} from '../subprocess.ts';
import {browserEmbeddingCases} from './fixtures/browser-acceptance.ts';

/** Build solely against the caller's clean installation, never checkout source imports. */
export async function buildBrowserConsumer(consumer: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(consumer, 'scripts/package/fixtures/browser-bundle.ts')],
    target: 'browser',
    format: 'iife',
    metafile: true,
  });
  assert.ok(result.success, result.logs.map((log) => log.message).join('\n'));
  assert.ok(result.metafile, 'Browser bundle must report its module graph');
  const graph = result.metafile;
  // macOS exposes temporary directories through /var -> /private/var.
  // Compare physical paths on both sides, also rejecting symlink escapes.
  const installed = realpathSync(join(consumer, 'node_modules/node-basic-lang')) + sep;
  const fixtureRoot = realpathSync(join(consumer, 'scripts/package/fixtures')) + sep;
  let entry = false;
  for (const [path, input] of Object.entries(graph.inputs)) {
    const absolute = realpathSync(resolve(path));
    assert.ok(
      absolute.startsWith(installed) || absolute.startsWith(fixtureRoot),
      'Bundle escaped installed consumer: ' + path,
    );
    if (absolute === join(installed, 'src/browser/index.ts')) entry = true;
    assert.ok(
      input.imports.every((item) => !item.external),
      'Browser bundle has an external import',
    );
  }
  assert.ok(entry, 'Installed browser entrypoint was bundled');
  for (const output of Object.values(graph.outputs))
    assert.equal(output.imports.length, 0, 'Self-contained browser bundle');
  assert.equal(result.outputs.length, 1);
  return result.outputs[0].text();
}

export async function checkBrowserConsumer(root: string, consumer: string): Promise<void> {
  for (const mode of ['import', 'require']) {
    const load =
      mode === 'import'
        ? 'await import("node-basic-lang/browser")'
        : 'require("node-basic-lang/browser")';
    const probe = `for (const key of ["window","document","localStorage","navigator"]) Object.defineProperty(globalThis,key,{configurable:true,get(){throw new Error("Import touched "+key)}}); const api=${load}; const names=Object.keys(api).sort(); const expected=["BrowserSession","KeyboardInput","SOURCE_DOCUMENT_FORMAT","SOURCE_DOCUMENT_VERSION","createSourceDocument","decodeSourceDocument","encodeSourceDocument","logicalKey"].sort(); if(JSON.stringify(names)!==JSON.stringify(expected)) throw new Error("Unexpected embedding exports");`;
    const imported = await runWithOpenInput({cwd: consumer, args: ['--eval', probe]});
    assert.deepEqual(
      imported,
      {status: 0, signal: null, stdout: '', stderr: ''},
      'Quiet portable ' + mode,
    );
  }
  for (const format of ['esm', 'commonjs']) {
    const result = runProcess({
      cwd: consumer,
      args: [join(consumer, 'scripts/package/fixtures', `browser-${format}.ts`)],
    });
    const prefix = 'BROWSER_EMBEDDING_COMPLETE ';
    assert.ok(result.stdout.startsWith(prefix), format + ' embedding acceptance completed');
    assert.equal(result.stderr, '');
    const evidence = JSON.parse(result.stdout.slice(prefix.length)) as {cases: string[]};
    assert.deepEqual(evidence.cases, [...browserEmbeddingCases]);
  }
  runProcess({
    cwd: consumer,
    timeout: 60000,
    args: [
      join(root, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ESNext',
      '--module',
      'Preserve',
      '--moduleResolution',
      'Bundler',
      '--allowImportingTsExtensions',
      join(consumer, 'scripts/package/fixtures/browser-types.ts'),
    ],
  });
  await buildBrowserConsumer(consumer);
  const alias = join(consumer, '..', 'browser-consumer-alias');
  symlinkSync(consumer, alias, 'dir');
  try {
    await buildBrowserConsumer(alias);
  } finally {
    unlinkSync(alias);
  }
  console.log(
    `Browser embedding: ${browserEmbeddingCases.length} public consumer cases in ESM/CommonJS, strict types, quiet imports and portable browser bundle passed.`,
  );
}

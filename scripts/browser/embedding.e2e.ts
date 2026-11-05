import {test, expect} from '@playwright/test';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {runProcess} from '../subprocess.ts';
import {browserEmbeddingCases} from '../package/fixtures/browser-acceptance.ts';
import type {runBrowserEmbedding} from '../package/fixtures/browser-acceptance.ts';

const root = resolve(import.meta.dirname, '../..');
let directory: string;
let bundle: string;
test.beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'basic-embedding-browser-'));
  const executable = process.env.BASIC_BROWSER_BUN ?? process.execPath;
  const artifact = process.env.BASIC_BROWSER_PACKAGE_ARCHIVE;
  if (process.env.BASIC_BROWSER_STATIC_ROOT && !artifact)
    throw new Error('Extracted-static acceptance requires the exact package artifact');
  const archive = artifact ?? join(directory, 'checkout.tgz');
  if (!artifact)
    runProcess({
      command: executable,
      cwd: root,
      args: ['pm', 'pack', '--filename', archive, '--ignore-scripts'],
      timeout: 60000,
    });
  runProcess({
    command: executable,
    cwd: root,
    args: [join(root, 'scripts/package/build-browser-archive.ts'), archive, directory],
    timeout: 60000,
  });
  bundle = readFileSync(join(directory, 'embedding.js'), 'utf8');
});
test.afterAll(() => {
  if (directory) rmSync(directory, {recursive: true, force: true});
});

test('an installed public browser consumer runs without checkout routes or server APIs', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('about:blank');
  await page.addScriptTag({content: bundle});
  const result = await page.evaluate(async () => {
    return await (globalThis as unknown as {basicEmbedding: ReturnType<typeof runBrowserEmbedding>})
      .basicEmbedding;
  });
  expect(result.cases).toEqual([...browserEmbeddingCases]);
  expect(result.printed).toBe('EMBED\nA1\nHello Ada\n');
  expect(result.command).toEqual({kind: 'pset', x: 2, y: 3, color: 4});
  expect(result.draft).toBe('\t10 PRINT "unfinished🙂\r\n');
  expect(requests).toEqual([]);
});

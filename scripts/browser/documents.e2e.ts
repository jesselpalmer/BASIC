import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runProcess} from '../subprocess.ts';

async function importFile(page: Page, source: string): Promise<void> {
  await page.locator('#file-input').setInputFiles({
    name: 'program.bas',
    mimeType: 'text/plain',
    buffer: Buffer.from(source),
  });
}

async function importPortable(page: Page, document: unknown): Promise<void> {
  await page.locator('#file-input').setInputFiles({
    name: 'program.basic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(typeof document === 'string' ? document : JSON.stringify(document)),
  });
}

test.beforeEach(async ({page}) => {
  await page.goto('/');
});

test('reload restores exact incomplete edits and cancellation protects saved local work', async ({
  page,
}) => {
  const source = '20 PRINT "work in progress"\n10 GOTO 999';
  await page.locator('#source').fill(source);
  await expect(page.locator('#storage-status')).toHaveText('Saved in this browser.');
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(source);
  await expect(page.locator('#storage-status')).toHaveText('Draft restored from this browser.');
  page.once('dialog', (dialog) => {
    void dialog.dismiss();
  });
  await page.locator('#example').selectOption('times-table');
  await expect(page.locator('#file-status')).toContainText('cancelled');
  await expect(page.locator('#source')).toHaveValue(source);
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(source);
});

test('invalid imports, declined replacement, and same-file retries preserve source', async ({
  page,
}) => {
  const original = '10 PRINT "kept"';
  await page.locator('#source').fill(original);
  await importFile(page, '10 GOTO 999');
  await expect(page.locator('#file-status')).toContainText('Invalid BASIC program');
  await expect(page.locator('#source')).toHaveValue(original);
  page.once('dialog', (dialog) => {
    void dialog.dismiss();
  });
  await importFile(page, '10 PRINT "candidate"');
  await expect(page.locator('#file-status')).toContainText('cancelled');
  await expect(page.locator('#source')).toHaveValue(original);
  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await importFile(page, '10 PRINT "candidate"');
  await expect(page.locator('#source')).toHaveValue('10 PRINT "candidate"');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('candidate\n');
});

test('download preserves CRLF source and the exported file runs through the terminal CLI', async ({
  page,
}) => {
  const source = '20 PRINT ABS(-3.14);":";INT(-1.6)\r\n10 REM café\r\n30 END\r\n';
  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await importFile(page, source);
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await expect(page.locator('#source')).toHaveValue(source.replaceAll('\r\n', '\n'));
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('3.14:-2\n');
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('program.bas');
  const path = await file.path();
  expect(await readFile(path, 'utf8')).toBe(source);
  const result = runProcess({
    command: 'bun',
    args: [resolve(import.meta.dirname, '../../bin/basic'), path],
  });
  expect(result.stdout).toBe('3.14:-2\n');
  expect(result.stderr).toBe('');
});

test('blocked storage stays visible without breaking edits, execution or export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
  });
  await page.reload();
  await expect(page.locator('#storage-status')).toContainText('Could not restore');
  await page.locator('#source').fill('10 PRINT "still usable"');
  await expect(page.locator('#storage-status')).toContainText('Could not autosave');
  await expect(page.locator('#source')).toHaveValue('10 PRINT "still usable"');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('still usable\n');
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await downloaded).path();
  expect(await readFile(path, 'utf8')).toBe('10 PRINT "still usable"');
});

test('quota failure retains editor contents and preserves the previously stored draft', async ({
  page,
}) => {
  await page.locator('#source').fill('10 PRINT "stored draft"');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota full', 'QuotaExceededError');
    };
  });
  await page.locator('#source').fill('10 PRINT "newer unsaved draft"');
  await expect(page.locator('#storage-status')).toContainText('Quota full');
  await expect(page.locator('#source')).toHaveValue('10 PRINT "newer unsaved draft"');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('newer unsaved draft\n');
  expect(
    await page.evaluate(() => {
      const saved = localStorage.getItem('basic.playground.document.v1');
      return saved === null ? null : (JSON.parse(saved) as {source?: unknown}).source;
    }),
  ).toBe('10 PRINT "stored draft"');
});

test('failed and stale asynchronous reads cannot overwrite newer edits', async ({page}) => {
  await page.addInitScript(() => {
    type ControlledWindow = Window & {finishBasicImport?: (source: string) => void};
    File.prototype.text = function () {
      return new Promise<string>((resolve) => {
        (window as ControlledWindow).finishBasicImport = resolve;
      });
    };
  });
  await page.reload();
  await page.locator('#source').fill('10 PRINT "before"');
  await importFile(page, '10 PRINT "late"');
  await expect.poll(() => page.evaluate(() => 'finishBasicImport' in window)).toBe(true);
  await page.locator('#source').fill('10 PRINT "newer edits"');
  await page.evaluate(() => {
    const controlled = window as Window & {finishBasicImport?: (source: string) => void};
    controlled.finishBasicImport?.('10 PRINT "late"');
  });
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('newer edits\n');
  await expect(page.locator('#source')).toHaveValue('10 PRINT "newer edits"');
  await page.evaluate(() => {
    File.prototype.text = () => Promise.reject(new Error('File read failed'));
  });
  await importFile(page, '10 PRINT "unreadable"');
  await expect(page.locator('#file-status')).toContainText('Could not read file');
  await expect(page.locator('#source')).toHaveValue('10 PRINT "newer edits"');
});

test('portable document preserves CRLF, context, execution and export through reload', async ({
  page,
}) => {
  const source = '20 END\r\n10 PRINT "portable"\r\n';
  page.once('dialog', (dialog) => void dialog.accept());
  await importPortable(page, {
    format: 'basic-program',
    version: 1,
    dialect: 'native',
    source,
  });
  await expect(page.locator('#file-status')).toHaveText('Portable document imported.');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: native');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('portable\n');
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(source.replaceAll('\r\n', '\n'));
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: native');
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-document').click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('program.basic.json');
  const path = await file.path();
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
    format: 'basic-program',
    version: 1,
    dialect: 'native',
    source,
  });
});

test('unsupported portable metadata preserves work and an active input run', async ({page}) => {
  const source = '10 INPUT NAME$\n20 PRINT NAME$';
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await importPortable(page, {
    format: 'basic-program',
    version: 1,
    dialect: 'basic-plus-1972-10',
    source: '10 PRINT "wrong runtime"',
  });
  await expect(page.locator('#file-status')).toContainText('Invalid BASIC program');
  await expect(page.locator('#source')).toHaveValue(source);
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('Ada');
  await page.locator('#input-form').press('Enter');
  await expect(page.locator('#console-output')).toHaveText('Ada\nAda\n');
});

test('legacy invalid draft migrates once and current envelope remains authoritative', async ({
  page,
}) => {
  const legacy = '10 PRINT "unfinished';
  await page.evaluate((value) => {
    localStorage.removeItem('basic.playground.document.v1');
    localStorage.setItem('basic.playground.source.v1', value);
  }, legacy);
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(legacy);
  expect(
    await page.evaluate(() => {
      const current = localStorage.getItem('basic.playground.document.v1');
      return current === null ? null : (JSON.parse(current) as {source: string}).source;
    }),
  ).toBe(legacy);
  await page.evaluate(() => {
    localStorage.setItem('basic.playground.document.v1', '{');
    localStorage.setItem('basic.playground.source.v1', '10 PRINT "must not restore"');
  });
  await page.reload();
  await expect(page.locator('#source')).not.toHaveValue('10 PRINT "must not restore"');
  await expect(page.locator('#storage-status')).toContainText('Could not restore');
});

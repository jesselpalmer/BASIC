import {expect, test, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source = readFileSync(
  new URL('../package/fixtures/input/probe.bas', import.meta.url),
  'utf8',
).replaceAll('\n', '\r\n');
async function answer(page: Page, text: string): Promise<void> {
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill(text);
  await page.locator('#input-value').press('Enter');
}
async function finishProbe(page: Page): Promise<void> {
  await answer(page, '2,3');
  await expect(page.locator('#input-prompt')).toHaveText('Cell?');
  await answer(page, '4,5,"hi, ""Jesse"""');
  await expect(page.locator('#status')).toHaveText('Finished');
}

test('coordinate/array INPUT retries through the real form and round-trips exact source', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: 'input.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await answer(page, 'oops');
  await expect(page.locator('#console-output')).toContainText(
    'Invalid input; enter 2 comma-separated values.',
  );
  await answer(page, '2,3');
  await expect(page.locator('#input-prompt')).toHaveText('Cell?');
  await answer(page, '4,bad');
  await expect(page.locator('#console-output')).toContainText(
    'Invalid input; enter 3 comma-separated values.',
  );
  await answer(page, '4,5,"hi, ""Jesse"""');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(
    'TURN NO. 1 WHAT IS YOUR GUESSoops\nInvalid input; enter 2 comma-separated values.\n2,3\n4,bad\nInvalid input; enter 3 comma-separated values.\n4,5,"hi, ""Jesse"""\npair=2:3\ncell=4:5:hi, "Jesse"\ndata=7:8\n',
  );
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw Error('Expected download');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.locator('#run').click();
  await finishProbe(page);
  await page.reload();
  await page.locator('#run').click();
  await finishProbe(page);
  await expect(page.locator('#console-output')).toContainText('cell=4:5:hi, "Jesse"\ndata=7:8\n');
});

test('Step commits a whole input list once and later array indices observe the earlier target', async ({
  page,
}) => {
  await page.goto('/');
  const text = '10 DIM A(2):INPUT I,A(I):PRINT A(2):END';
  await page.locator('#source').fill(text);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 13)');
  await page.locator('#step').click();
  await answer(page, '2,bad');
  await expect(page.locator('#input-form')).toBeVisible();
  await expect(page.locator('#variable-rows')).toBeEmpty();
  await answer(page, '2,9');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText(`column ${text.indexOf('PRINT') + 1})`);
  await expect(page.locator('#variable-rows')).toHaveText('I2');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toContainText('9\n');
});

test('Stop after an invalid row preserves edits and a replacement owns its own input request', async ({
  page,
}) => {
  await page.goto('/');
  const original = '10 INPUT A,B:PRINT "old"';
  await page.locator('#source').fill(original);
  await page.locator('#run').click();
  await answer(page, '1,bad');
  await expect(page.locator('#console-output')).toContainText('Invalid input; enter 2');
  await page.locator('#inspection summary').click();
  const changed = '10 INPUT A,B:PRINT "new=";A;B';
  await page.locator('#source').fill(changed);
  await expect(page.locator('#execution-source')).toHaveText(original);
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#source')).toHaveValue(changed);
  await page.locator('#run').click();
  await answer(page, '2,3');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('2,3\nnew=23\n');
});

test('preflight/bounds failures recover and a single indexed string keeps commas and quotes', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 PRINT "never":END:INPUT A(0)');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('Array A requires DIM');
  await expect(page.locator('#input-form')).toBeHidden();
  await expect(page.locator('#console-output')).toBeEmpty();
  const bounds = '10 DIM A(0):INPUT I,A(I)';
  await page.locator('#source').fill(bounds);
  await page.locator('#run').click();
  await answer(page, '2,9');
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText(
    'Index must be an integer from 0 through 0',
  );
  await expect(page.locator('#source')).toHaveValue(bounds);
  await page.locator('#source').fill('10 DIM S$(0):INPUT S$(0):PRINT S$(0)');
  await page.locator('#run').click();
  const raw = '  "x,y"  ';
  await answer(page, raw);
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await page.locator('#console-output').textContent()).toBe(raw + '\n' + raw + '\n');
});

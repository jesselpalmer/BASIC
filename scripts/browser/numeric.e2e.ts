import {expect, test} from '@playwright/test';
import {readFileSync} from 'node:fs';

const source = readFileSync(
  new URL('../package/fixtures/numeric/formulas.bas', import.meta.url),
  'utf8',
).replaceAll('\n', '\r\n');
const output = 'constants=0.001:0.000884361\nheight=16\ndistance=13\npowers=-4:64:0.0625\n';

test('corpus formulas import, step, export and reload with scientific spelling intact', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: 'formulas.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 20 ');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw new Error('Expected download');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(source.replaceAll('\r\n', '\n'));
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
});

test('scientific INPUT retries malformed values and power errors preserve source and recover', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 INPUT N\n20 PRINT N^2');
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('1e+');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#console-output')).toContainText('Invalid number');
  await page.locator('#input-value').fill('-2e1');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(
    '1e+\nInvalid number; please enter a finite decimal.\n-2e1\n400\n',
  );
  const invalid = '10 PRINT "partial";(-2)^.5';
  await page.locator('#source').fill(invalid);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#console-output')).toBeEmpty();
  await expect(page.locator('#diagnostic')).toContainText(
    'negative base requires an integer exponent',
  );
  await expect(page.locator('#source')).toHaveValue(invalid);
  await page.locator('#source').fill('10 PRINT 4^.5;":";1E-3');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('2:0.001\n');
});

test('a huge exponent in a running loop remains cancellable and reruns cleanly', async ({page}) => {
  await page.goto('/');
  const source = '10 LET X=1^1e300\n20 GOTO 10';
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Running');
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#source').fill('10 PRINT -2^2;":";2^3^2');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('-4:64\n');
});

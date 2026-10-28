import {expect, test} from '@playwright/test';
import {readFileSync} from 'node:fs';

const source = readFileSync(
  new URL('../package/fixtures/dispatch/probe.bas', import.meta.url),
  'utf8',
).replaceAll('\n', '\r\n');
const output = '500\n440\n620\n625\n635\n550\n615\n605\n595\n585\none\nafter\ntwo\none\ntail\n';

test('computed dispatch probe preserves source through import, export, reload and rerun', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#file-input').setInputFiles({
    name: 'dispatch.bas',
    mimeType: 'text/plain',
    buffer: Buffer.from(source),
  });
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
  const downloading = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await downloading).path();
  if (!path) throw Error('Expected download');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
});

test('Step counts dispatch once and RETURN resumes the exact same-line tail', async ({page}) => {
  await page.goto('/');
  const text =
    '10 ON 2.9 GOSUB 100,200:PRINT "tail":END\n100 PRINT "wrong":RETURN\n200 PRINT "two":RETURN';
  await page.locator('#source').fill(text);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#console-output')).toBeEmpty();
  await expect(page.locator('#next-line')).toContainText('BASIC line 200');
  await expect(page.locator('#execution-source mark')).toHaveText('200 PRINT "two":RETURN');
  await page.locator('#step').click();
  await expect(page.locator('#console-output')).toHaveText('two\n');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText(
    `BASIC line 10 (source line 1, column ${text.indexOf('PRINT') + 1})`,
  );
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('two\ntail\n');
});

test('computed call INPUT and WAIT keep stepped continuations and Stop protects edited source', async ({
  page,
}) => {
  await page.goto('/');
  const text = '10 ON 1 GOSUB 100:PRINT N:END\n100 INPUT N:WAIT 0:RETURN';
  await page.locator('#source').fill(text);
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('BASIC line 100');
  await page.locator('#step').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('7');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('source line 2, column 13)');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('source line 2, column 20)');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('BASIC line 10');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('7\n7\n');
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#source').fill('10 PRINT "fresh"');
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#source')).toHaveValue('10 PRINT "fresh"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('fresh\n');
});

test('all targets preflight and out-of-range selections fail visibly without losing source', async ({
  page,
}) => {
  await page.goto('/');
  const invalid = '10 PRINT "never":ON 1 GOTO 20,999\n20 END';
  await page.locator('#source').fill(invalid);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('No line label 999');
  await expect(page.locator('#console-output')).toBeEmpty();
  await expect(page.locator('#source')).toHaveValue(invalid);
  const range = '10 ON -0.9 GOSUB 100:PRINT "never"\n100 RETURN';
  await page.locator('#source').fill(range);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText(
    'ON selector must truncate to 1 through 1',
  );
  await expect(page.locator('#console-output')).toBeEmpty();
  await expect(page.locator('#source')).toHaveValue(range);
  await page.locator('#source').fill('10 ON 1 GOTO 20\n20 PRINT "recovered"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('recovered\n');
});

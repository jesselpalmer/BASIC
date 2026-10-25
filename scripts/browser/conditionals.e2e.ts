import {expect, test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source = readFileSync(
  new URL('../package/fixtures/conditionals/probe.bas', import.meta.url),
  'utf8',
).replaceAll('\n', '\r\n');
const output = 'I WIN BY4POINTS\nafter=1\nnonnegative\nedge\ninterior\nsub\ndone\n';

test('conditional corpus probes preserve exact import/export/reload source and rerun results', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: 'conditional.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw Error('Expected download');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
});

test('Step selects a branch, enters a call, and returns past unchosen clauses and their tail', async ({
  page,
}) => {
  await page.goto('/');
  const text =
    '10 IF 1=1 THEN GOSUB 100 ELSE PRINT "no":PRINT "tail"\n20 PRINT "next":END\n100 PRINT "sub":RETURN';
  await page.locator('#source').fill(text);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText(`column ${text.indexOf('GOSUB') + 1})`);
  await expect(page.locator('#execution-source mark')).toHaveText(text.split('\n')[0]);
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('BASIC line 100');
  await page.locator('#step').click();
  await expect(page.locator('#console-output')).toHaveText('sub\n');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('BASIC line 20');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('sub\nnext\n');
  await page.locator('#source').fill(text.replace('1=1', '1=2'));
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('no\ntail\nnext\n');
});

test('nested ELSE binds the nearest IF and only the physically last clause executes the tail', async ({
  page,
}) => {
  await page.goto('/');
  const text =
    '10 INPUT A,B\n20 IF A=1 THEN IF B=1 THEN PRINT "both" ELSE PRINT "inner" ELSE PRINT "outer":PRINT "tail"\n30 END';
  await page.locator('#source').fill(text);
  for (const [response, expected] of [
    ['0,1', 'outer\ntail\n'],
    ['1,0', 'inner\n'],
    ['1,1', 'both\n'],
  ]) {
    await page.locator('#run').click();
    await expect(page.locator('#input-form')).toBeVisible();
    await page.locator('#input-value').fill(response);
    await page.locator('#input-value').press('Enter');
    await expect(page.locator('#status')).toHaveText('Finished');
    await expect(page.locator('#console-output')).toHaveText(response + '\n' + expected);
  }
});

test('INPUT/WAIT branch bodies retain Step continuations and Stop protects edited source', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('#source')
    .fill(
      '10 IF 1=1 THEN INPUT N ELSE PRINT "no":PRINT "tail"\n20 IF N=4 THEN WAIT 0 ELSE END\n30 PRINT N',
    );
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await page.locator('#step').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('4');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('BASIC line 20');
  await page.locator('#step').click();
  await expect(page.locator('#execution-source mark')).toHaveText('20 IF N=4 THEN WAIT 0 ELSE END');
  await expect(page.locator('#next-line')).toContainText('source line 2, column 16)');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('BASIC line 30');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('4\n4\n');
  await page.locator('#source').fill('10 IF 1=1 THEN INPUT N ELSE END\n20 PRINT "old"');
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#source').fill('10 PRINT "fresh"');
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('fresh\n');
});

test('unchosen-branch validation and native loop guards preserve source and permit recovery', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 PRINT "never":IF 1=1 THEN PRINT "ok" ELSE PRINT A(0)');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('Array A requires DIM');
  await expect(page.locator('#console-output')).toBeEmpty();
  const loop = '10 IF 1=1 THEN PRINT "before" ELSE END:FOR I=1 TO 2\n20 NEXT I';
  await page.locator('#source').fill(loop);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('Cannot enter inactive FOR loop');
  await expect(page.locator('#console-output')).toHaveText('before\n');
  await expect(page.locator('#source')).toHaveValue(loop);
  await page.locator('#source').fill('10 IF 1=2 THEN PRINT "wrong" ELSE PRINT "recovered"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('recovered\n');
});

import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('adjacent output imports and reruns without reinterpreting USING variables or arrays', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  const source =
    '10 DIM USING(1,2)\r\n20 USING=4\r\n30 USING(1,2)=7\r\n40 B$=" b"\r\n50 PRINT "score=" USING ":" USING(1,2);\r\n60 PRINT "|"1-2\r\n70 PRINT USING B$;2\r\n';
  await page
    .locator('#file-input')
    .setInputFiles({name: 'print.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('score=4:7|-1\n4 b2\n');
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw new Error('Expected downloaded source');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('score=4:7|-1\n4 b2\n');
});

test('a failing adjacent item writes no partial statement and source survives recovery', async ({
  page,
}) => {
  await page.goto('/');
  const source = '10 PRINT "before"\n20 PRINT "must not appear" 1/0\n30 PRINT "must not run"';
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 20');
  await expect(page.locator('#console-output')).toHaveText('before\n');
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#source').fill('10 PRINT "recovered="3');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('recovered=3\n');
});

test('integer PRINT USING steps once, reports overflow without partial output and reruns cleanly', async ({
  page,
}) => {
  await page.goto('/');
  const source = '10 PRINT USING "## ##",1,2;\n20 PRINT "done"';
  await page.locator('#source').fill(source);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 20 ');
  await expect(page.locator('#console-output')).toHaveText(' 1  2');
  await page.locator('#continue').click();
  await expect(page.locator('#console-output')).toHaveText(' 1  2done\n');
  const invalid = '10 PRINT USING "#",12';
  await page.locator('#source').fill(invalid);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#console-output')).toBeEmpty();
  await expect(page.locator('#diagnostic')).toContainText('does not fit its field');
  await expect(page.locator('#source')).toHaveValue(invalid);
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(' 1  2done\n');
});

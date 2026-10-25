import {expect, test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source = readFileSync(
  new URL('../package/fixtures/subroutines/probe.bas', import.meta.url),
  'utf8',
).replaceAll('\n', '\r\n');
const output = 'take=4:0:3\nnested=4\n';

test('nested calls import/export/reload exactly and Step returns to the same-line successor', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: 'calls.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw new Error('Expected source download');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
  await page.locator('#source').fill('10 GOSUB 100:PRINT "done":END\n100 PRINT "sub":RETURN');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText(
    'BASIC line 100 (source line 2, column 5)',
  );
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('column 17)');
  await expect(page.locator('#console-output')).toHaveText('sub\n');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText(
    'BASIC line 10 (source line 1, column 14)',
  );
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('sub\ndone\n');
});

test('INPUT and WAIT in a subroutine preserve a stepped return address', async ({page}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 GOSUB 100:PRINT N+1:END\n100 INPUT N:WAIT 0:RETURN');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('BASIC line 100');
  await page.locator('#step').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('4');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 13)');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 20)');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText(
    'BASIC line 10 (source line 1, column 14)',
  );
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('4\n5\n');
});

test('Pause/Step/Stop in a repeated call stream preserves edits and clears old frames', async ({
  page,
}) => {
  await page.goto('/');
  const original = '10 GOSUB 100:GOTO 10\n100 RETURN';
  await page.locator('#source').fill(original);
  await page.locator('#run').click();
  await page.locator('#pause').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await page.locator('#source').fill('10 PRINT "new":END');
  await expect(page.locator('#execution-source')).toHaveText(original);
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('new\n');
});

test('overflow and unmatched RETURN recover, and early callee return restores the caller loop', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 GOSUB 10');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('1024 GOSUB calls');
  await expect(page.locator('#source')).toHaveValue('10 GOSUB 10');
  await page.locator('#source').fill('10 RETURN');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('RETURN has no active GOSUB');
  await page
    .locator('#source')
    .fill('10 FOR I=1 TO 2:GOSUB 100:NEXT I:PRINT I:END\n100 FOR J=1 TO 2:RETURN:NEXT J');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('3\n');
});

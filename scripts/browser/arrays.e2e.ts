import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const boardSource = readFileSync(
  new URL('../package/fixtures/arrays/board.bas', import.meta.url),
  'utf8',
);

test('an authored checker board rejects an illegal move, jumps, preserves source and reruns', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: 'board.bas', mimeType: 'text/plain', buffer: Buffer.from(boardSource)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  for (let run = 0; run < 2; run++) {
    await page.locator('#run').click();
    await expect(page.locator('#console-output')).toContainText('pieces:48\n');
    for (const [answer, prompt] of [
      ['1', 'From? '],
      ['2', 'To? '],
      ['1', 'From? '],
      ['19', 'To? '],
      ['0', 'From? '],
    ]) {
      await expect(page.locator('#status')).toHaveText('Waiting for input');
      await expect(page.locator('#input-prompt')).toHaveText(prompt);
      await page.locator('#input-value').fill(answer);
      await page.locator('#input-value').press('Enter');
    }
    await expect(page.locator('#status')).toHaveText('Finished');
    const output = (await page.locator('#console-output').textContent()) ?? '';
    expect([...output.matchAll(/pieces:(\d+)/g)].map((match) => Number(match[1]))).toEqual([
      48, 48, 47,
    ]);
    expect(output).toContain('illegal');
    expect(output).toContain('moves:1');
    await expect(page.locator('#source')).toHaveValue(boardSource);
    if (run === 0) {
      await page.reload();
      await expect(page.locator('#source')).toHaveValue(boardSource);
    }
  }
});

test('2D string arrays step correctly and retain scalar DIM names', async ({page}) => {
  await page.goto('/');
  const source = '10 DIM M$(1,1)\n20 DIM=4\n30 M$(1,0)="Ada"\n40 PRINT DIM;":";M$(0,0);":";M$(1,0)';
  await page.locator('#source').fill(source);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 20 ');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('4::Ada\n');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('4::Ada\n');
  await expect(page.locator('#source')).toHaveValue(source);
});

test('array failures preserve exact source and Stop discards the old run storage', async ({
  page,
}) => {
  await page.goto('/');
  const limited = '10 PRINT "must not run"\n20 DIM A(65536)';
  await page.locator('#source').fill(limited);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#console-output')).toBeEmpty();
  await expect(page.locator('#diagnostic')).toContainText('65536 cells');
  await expect(page.locator('#source')).toHaveValue(limited);
  const invalid = '10 DIM A(0)\n20 A(0)=8\n30 PRINT A(.5)';
  await page.locator('#source').fill(invalid);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 30');
  await expect(page.locator('#source')).toHaveValue(invalid);
  const waiting = '10 DIM A(0)\n20 A(0)=9\n30 INPUT X\n40 PRINT A(0)';
  await page.locator('#source').fill(waiting);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#source')).toHaveValue(waiting);
  await page.locator('#source').fill('10 DIM A(0)\n20 PRINT A(0)');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('0\n');
});

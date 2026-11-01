import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {matchesCorrected, matchesRaw, expectedMatchesOutput} from '../matches-acceptance.ts';

for (const [source, corrected] of [
  [matchesRaw, false],
  [matchesCorrected, true],
] as const) {
  test(`23 Matches ${corrected ? 'reviewed correction' : 'raw source'} retains exact retry/replay output`, async ({
    page,
  }) => {
    await page.goto('/');
    page.on('dialog', (dialog) => dialog.accept());
    await page
      .locator('#file-input')
      .setInputFiles({name: 'matches.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
    await expect(page.locator('#file-status')).toHaveText('File imported.');
    await page.locator('#run').click();
    for (const move of ['0', ...Array<string>(7).fill('1')]) {
      await expect(page.locator('#status')).toHaveText('Waiting for input');
      await page.locator('#input-value').fill(move);
      await page.locator('#input-value').press('Enter');
    }
    await expect(page.locator('#status')).toHaveText('Waiting for input');
    // textContent keeps every output newline and the view's submitted-input echoes.
    expect(await page.locator('#console-output').textContent()).toBe(
      expectedMatchesOutput(corrected, 1, true),
    );
    await page.locator('#stop').click();
    await expect(page.locator('#status')).toHaveText('Stopped');
    await expect(page.locator('#source')).toHaveValue(source);
    const download = page.waitForEvent('download');
    await page.locator('#export-file').click();
    const path = await (await download).path();
    if (!path) throw new Error('Expected exported source');
    expect(readFileSync(path, 'utf8')).toBe(source);
    await page.reload();
    await page.locator('#file-input').setInputFiles(path);
    await expect(page.locator('#file-status')).toHaveText('File imported.');
    await expect(page.locator('#source')).toHaveValue(source);
    await page.locator('#run').click();
    await expect(page.locator('#status')).toHaveText('Waiting for input');
    await page.locator('#input-value').fill('2');
    await page.locator('#input-value').press('Enter');
    await expect(page.locator('#status')).toHaveText('Error');
    await expect(page.locator('#diagnostic')).toContainText('BASIC line 330');
    await expect(page.locator('#diagnostic')).toContainText('RND expects 0 argument(s)');
    await expect(page.locator('#source')).toHaveValue(source);
  });
}

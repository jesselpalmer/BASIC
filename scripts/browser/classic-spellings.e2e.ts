import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const matchesSource = readFileSync(
  new URL('../package/fixtures/classic/23mtch.bas', import.meta.url),
  'utf8',
);

test('classic spellings import, execute and preserve native variable names after reload', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  const source =
    '10 go=4\n20 LET GOTOA=GO+1\n30 GO TO 50\n40 PRINT "skipped"\n50 PRINT GO;":";GOTOA';
  await page.locator('#file-input').setInputFiles({
    name: 'spellings.bas',
    mimeType: 'text/plain',
    buffer: Buffer.from(source),
  });
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('4:5\n');
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('4:5\n');
});

test('unchanged 23 Matches loses and replays; its unsupported native RNG path stays explicit', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#file-input').setInputFiles({
    name: '23mtch.bas',
    mimeType: 'text/plain',
    buffer: Buffer.from(matchesSource),
  });
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  for (const remaining of [21, 17, 13, 9, 5, 1]) {
    await expect(page.locator('#status')).toHaveText('Waiting for input');
    await page.locator('#input-value').fill('1');
    await page.locator('#input-value').press('Enter');
    await expect(page.locator('#console-output')).toContainText(
      `THERE ARE NOW${remaining}MATCHES.`,
    );
  }
  await page.locator('#input-value').fill('1');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#console-output')).toContainText('I WON!! BETTER LUCK NEXT TIME.');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  const output = (await page.locator('#console-output').textContent()) ?? '';
  expect(
    [...output.matchAll(/THERE ARE NOW(\d+)MATCHES\./g)].map((match) => Number(match[1])),
  ).toEqual([23, 21, 17, 13, 9, 5, 1, 23]);
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#source')).toHaveValue(matchesSource);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill('2');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 330');
  await expect(page.locator('#diagnostic')).toContainText('RND expects 0 argument(s)');
  await expect(page.locator('#source')).toHaveValue(matchesSource);
});

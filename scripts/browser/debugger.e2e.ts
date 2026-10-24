import {test, expect, type Page} from '@playwright/test';

async function stepTo(page: Page, label: number): Promise<void> {
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText(`Next: BASIC line ${label} `);
  await expect(page.locator('#execution-source mark')).toContainText(String(label));
}

test.beforeEach(async ({page}) => {
  await page.goto('/');
});

test('Step executes one loop or branch statement and Continue matches a fresh run', async ({
  page,
}) => {
  await page
    .locator('#source')
    .fill('60 END\n10 LET N=0\n20 FOR I=1 TO 2\n30 LET N=N+I\n40 NEXT I\n50 PRINT N');
  await stepTo(page, 20);
  await expect(page.locator('#variable-rows')).toHaveText('N0');
  await stepTo(page, 30);
  await stepTo(page, 40);
  await expect(page.locator('#variable-rows')).toHaveText('N1I1');
  await stepTo(page, 30);
  await stepTo(page, 40);
  await stepTo(page, 50);
  await expect(page.locator('#variable-rows')).toHaveText('N3I3');
  await expect(page.locator('#console-output')).toBeEmpty();
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('3\n');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('3\n');
  await page.locator('#source').fill('10 IF 1=1 THEN 30\n20 PRINT "skipped"\n30 PRINT "target"');
  await stepTo(page, 30);
  await expect(page.locator('#console-output')).toBeEmpty();
  await page.locator('#continue').click();
  await expect(page.locator('#console-output')).toHaveText('target\n');
});

test('INPUT stays visible when paused and Step cannot pass it before a valid value', async ({
  page,
}) => {
  await page.locator('#source').fill('10 INPUT "Number"; N\n20 LET N=N+1\n30 PRINT N');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#step')).toBeDisabled();
  await page.locator('#input-value').fill('not a number');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#input-form')).toBeVisible();
  await expect(page.locator('#variable-rows')).toBeEmpty();
  await page.locator('#input-value').fill('2');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 20 ');
  await expect(page.locator('#variable-rows')).toHaveText('N2');
  await stepTo(page, 30);
  await expect(page.locator('#variable-rows')).toHaveText('N3');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toContainText('3\n');
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#pause').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill('4');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#variable-rows')).toHaveText('N4');
  await page.locator('#continue').click();
  await expect(page.locator('#console-output')).toHaveText('4\n5\n');
});

test('Pause stops loop progress, Step advances once, and new runs reset inspection', async ({
  page,
}) => {
  const source = '10 FOR I=1 TO 1000000000\n20 NEXT I\n30 END';
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await page.locator('#pause').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 20 ');
  const before = Number(await page.locator('#variable-rows td').nth(1).textContent());
  await page.locator('#source').fill('10 PRINT "new source"');
  await stepTo(page, 20);
  await expect(page.locator('#variable-rows')).toHaveText(`I${before + 1}`);
  await expect(page.locator('#execution-source')).toHaveText(source);
  await page.locator('#stop').click();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('new source\n');
  await expect(page.locator('#variable-rows')).toBeEmpty();
  await expect(page.locator('#execution-source')).toHaveText('10 PRINT "new source"');
});

test('inspection bounds visible rows and renders string values as read-only text', async ({
  page,
}) => {
  const source = [
    '1 LET NAME$="<img src=x onerror=alert(1)>"',
    ...Array.from({length: 210}, (_, i) => `${(i + 1) * 10} LET A${i}=${i}`),
  ].join('\n');
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await page.locator('#inspection summary').click();
  await expect(page.locator('#variable-rows tr')).toHaveCount(200);
  await expect(page.locator('#variables-limit')).toHaveText(
    'Showing the first 200 of 211 variables.',
  );
  await expect(page.locator('#variable-rows tr').first()).toHaveText(
    'NAME$"<img src=x onerror=alert(1)>"',
  );
  await expect(
    page.locator('#variables img, #variables input, #variables [contenteditable=true]'),
  ).toHaveCount(0);
});

import {test, expect, type Page} from '@playwright/test';

async function run(page: Page, source: string): Promise<void> {
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
}

async function answer(page: Page, text: string): Promise<void> {
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill(text);
  await page.locator('#input-value').press('Enter');
}

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.41;
  });
  await page.goto('/');
});

test('greeting preserves input and keyboard controls run the edited source', async ({page}) => {
  await expect(page.locator('#source')).toHaveValue(/What is your name/);
  await page.locator('#source').focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('#input-value')).toBeFocused();
  await answer(page, '  Ada LoveLace  ');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(
    '  Ada LoveLace  \nHello,   Ada LoveLace  !\n',
  );
  await expect(page.locator('#run')).toBeFocused();
  await expect(page.locator('#stop')).toBeDisabled();
});

test('times table uses the actual example and renders all ten rows', async ({page}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#example').selectOption('times-table');
  await page.locator('#run').click();
  await answer(page, '3');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(
    '3\n' + Array.from({length: 10}, (_, i) => `${i + 1} x 3 = ${(i + 1) * 3}\n`).join(''),
  );
});

test('guessing game gives low/high feedback and reruns with fresh state', async ({page}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#example').selectOption('guess');
  await page.locator('#run').click();
  await answer(page, '20');
  await expect(page.locator('#console-output')).toContainText('Too low.');
  await answer(page, '80');
  await expect(page.locator('#console-output')).toContainText('Too high.');
  await answer(page, '42');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(
    '20\nToo low.\n80\nToo high.\n42\nCorrect in 3 tries!\n',
  );
  await page.locator('#run').click();
  await answer(page, '42');
  await expect(page.locator('#console-output')).toHaveText('42\nCorrect in 1 tries!\n');
});

test('edits affect the next run and replacing a pending input cannot leak old output', async ({
  page,
}) => {
  await run(page, '10 INPUT "Old"; N$\n20 PRINT "old:";N$');
  await expect(page.locator('#input-prompt')).toHaveText('Old? ');
  await page.locator('#source').fill('10 PRINT "new run"');
  await answer(page, 'answer');
  await expect(page.locator('#console-output')).toHaveText('answer\nold:answer\n');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('new run\n');
  await run(page, '10 INPUT "Stale"; N$\n20 PRINT "must not run"');
  await expect(page.locator('#input-form')).toBeVisible();
  await run(page, '10 PRINT "replacement"');
  await expect(page.locator('#input-form')).toBeHidden();
  await expect(page.locator('#console-output')).toHaveText('replacement\n');
});

test('syntax and runtime errors identify BASIC lines and allow recovery', async ({page}) => {
  await run(page, '10 PRINT "must not run"\n20 PRINT "unfinished');
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 20');
  await expect(page.locator('#console-output')).toBeEmpty();
  await run(page, '10 PRINT 1/0\n20 PRINT "skipped"');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 10');
  await expect(page.locator('#diagnostic')).toContainText('Cannot divide by zero');
  await run(page, '10 PRINT "recovered"');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#diagnostic')).toBeHidden();
  await expect(page.locator('#console-output')).toHaveText('recovered\n');
});

test('Stop cancels INPUT and Escape stops a GOTO-only infinite loop', async ({page}) => {
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#input-form')).toBeHidden();
  await run(page, '10 GOTO 10');
  await expect(page.locator('#status')).toHaveText('Running');
  await page.locator('#source').fill('10 PRINT "usable"');
  await page.keyboard.press('Escape');
  await expect(page.locator('#status')).toHaveText('Stopped');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('usable\n');
});

test('infinite PRINT stays bounded and can stop after visible truncation', async ({page}) => {
  await run(page, '10 PRINT "0123456789012345678901234567890123456789"\n20 GOTO 10');
  await expect(page.locator('#console-truncated')).toBeVisible();
  await page.locator('#source').fill('10 PRINT "after flood"');
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  const retained = await page.locator('#console-output').textContent();
  expect(retained?.length).toBeLessThanOrEqual(50_000);
  await expect(page.locator('#console-output > *')).toHaveCount(0);
  await expect(page.locator('#console-output')).toHaveText(retained ?? '');
  await page.locator('#run').click();
  await expect(page.locator('#console-output')).toHaveText('after flood\n');
  await expect(page.locator('#console-truncated')).toBeHidden();
});

test('output is literal text and the narrow viewport keeps controls usable', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await run(page, '10 PRINT "<img src=x onerror=alert(1)>"');
  await expect(page.locator('#console-output')).toHaveText('<img src=x onerror=alert(1)>\n');
  await expect(page.locator('#console-output img')).toHaveCount(0);
  await expect(page.locator('#source')).toHaveAccessibleName('BASIC source code');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

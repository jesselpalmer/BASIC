import {expect, test} from '@playwright/test';
import {assertCalndrOutput, calndrProgram, calndrRuns, calndrSource} from '../calndr-acceptance.ts';

test('CALNDR prints archived common-year and edited leap-year calendars', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('calndr');
  const source = page.locator('#source');
  await expect(source).toHaveValue(calndrSource);
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  for (const run of calndrRuns) {
    await source.fill(calndrProgram(run));
    await page.locator('#run').click();
    await expect(page.locator('#status')).toHaveText('Finished');
    assertCalndrOutput((await page.locator('#console-output').textContent())!, run);
  }
});

import {expect, test} from '@playwright/test';
import {assertDiamndOutput, diamndRuns, diamndSource} from '../diamnd-acceptance.ts';

test('DIAMND matches the repaired archive patterns and starts fresh', async ({page}) => {
  await page.setViewportSize({width: 390, height: 840});
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('diamnd');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(diamndSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of diamndRuns) {
    await page.locator('#run').click();
    await expect(status).toHaveText('Waiting for input');
    await input.fill(run.answers[0]);
    await input.press('Enter');
    await expect(status).toHaveText('Finished');
    await expect(output).toHaveCSS('white-space', 'pre');
    assertDiamndOutput((await output.textContent())!.replace(`?${run.answers[0]}\n`, '?'), run);
    if (run.answers[0] === '5') {
      const scroll = page.locator('#console-scroll');
      await expect
        .poll(() => scroll.evaluate((element) => element.scrollWidth > element.clientWidth))
        .toBe(true);
    }
  }
});

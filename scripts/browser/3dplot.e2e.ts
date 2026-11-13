import {expect, test} from '@playwright/test';
import {assertPlotOutput, plotSource} from '../3dplot-acceptance.ts';

test('3DPLOT draws all archived rows on a run and a fresh run', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('3dplot');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(plotSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  for (let run = 0; run < 2; run++) {
    await page.locator('#run').click();
    await expect(status).toHaveText('Finished');
    assertPlotOutput((await output.textContent())!);
  }
});

import {expect, test} from '@playwright/test';
import {assertGomokoOutput, gomokoOptions, gomokoRuns, gomokoSource} from '../gomoko-acceptance.ts';

test('GOMOKO matches archived boards, retries and replay in the adapted listing', async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('gomoko');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${gomokoOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(gomokoSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of gomokoRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.split('?').length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!.replace(/\?-?\d+(?:,-?\d+)?\n/g, '?');
    assertGomokoOutput(transcript, run);
  }
});

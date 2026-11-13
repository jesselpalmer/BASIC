import {expect, test} from '@playwright/test';
import {
  assertSlotsOutput,
  slotsEntropy,
  slotsOptions,
  slotsRuns,
  slotsSource,
} from '../slots-acceptance.ts';

test('SLOTS plays all printed spins, handles replay replies and starts fresh', async ({page}) => {
  test.setTimeout(30000);
  await page.addInitScript((entropy) => {
    Math.random = () => entropy;
  }, slotsEntropy);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('slots');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${slotsOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(slotsSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of slotsRuns) {
    await page.locator('#run').click();
    let spin = 0;
    for (const [index, answer] of run.answers.entries()) {
      const previous = run.answers[index - 1];
      if (previous === 'X') {
        await expect(output).toContainText('AGAIN?X\n');
      } else {
        spin++;
        await expect
          .poll(async () => (await output.textContent())?.split('AGAIN?').length)
          .toBe(spin + 1);
      }
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/(AGAIN\?)X\nY/g, '$1\n')
      .replace(/(AGAIN\?)[YN]/g, '$1');
    assertSlotsOutput(transcript, run);
  }
});

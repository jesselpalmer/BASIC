import {expect, test} from '@playwright/test';
import {
  assertRockt1PaperOutput,
  rockt1Options,
  rockt1Runs,
  rockt1Source,
} from '../rockt1-acceptance.ts';

test('ROCKT1 matches the archived plot, crash, perfect landing and fresh RUN', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('rockt1');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${rockt1Options.dialect}`);
  await expect(page.locator('#source')).toHaveValue(rockt1Source);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of rockt1Runs) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.match(/(?<!')\?/g)?.length)
        .toBe(index + 1);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/\?\d+\n/g, '?')
      .replace(/(\(Y OR N\)\? )[NY]/g, '$1');
    expect(transcript).not.toContain('\r');
    expect(transcript).not.toContain('\0');
    assertRockt1PaperOutput(transcript, run);
  }
});

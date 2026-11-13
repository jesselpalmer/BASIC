import {expect, test} from '@playwright/test';
import {
  assertReverseOutput,
  reverseOptions,
  reverseRuns,
  reverseSource,
} from '../reverse-acceptance.ts';

test('REVERSE matches archived prefix moves, win, replay and fresh RUN', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('reverse');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${reverseOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(reverseSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of reverseRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      await expect(input).toBeVisible();
      await expect
        .poll(
          async () =>
            (await output.textContent())?.match(/HOW MANY SHALL I REVERSE\?|\(Y OR N\)\?/g)?.length,
        )
        .toBe(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/(HOW MANY SHALL I REVERSE\?)\d+\n/g, '$1')
      .replace(/(\(Y OR N\)\?)[NY]/g, '$1');
    assertReverseOutput(transcript, run);
  }
});

import {expect, test} from '@playwright/test';
import {assertTrainOutput, trainOptions, trainRuns, trainSource} from '../train-acceptance.ts';

test('TRAIN matches archived grading, replay and a fresh RUN', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('train');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${trainOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(trainSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of trainRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      await expect
        .poll(
          async () =>
            (await output.textContent())?.match(
              /HOW LONG DOES THE TRIP TAKE BY CAR\?|ANOTHER PROBLEM \(Y OR N\)\?/g,
            )?.length,
        )
        .toBe(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/(HOW LONG DOES THE TRIP TAKE BY CAR\?)\d+\.\d+\n/g, '$1')
      .replace(/(ANOTHER PROBLEM \(Y OR N\)\? )[YN]/g, '$1');
    assertTrainOutput(transcript, run);
  }
});

import {expect, test} from '@playwright/test';
import {assertGolfOutput, golfOptions, golfRuns, golfSource} from '../golf-acceptance.ts';

test('GOLF matches the archived rounds, including retry, hazards and fresh RUN', async ({page}) => {
  test.setTimeout(45000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('golf');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${golfOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(golfSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const questionCount = async () => (await output.textContent())!.split('?').length - 1;
  for (const run of golfRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    let questions = 0;
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      await expect(input).toBeVisible();
      if (index === 0) {
        await expect(output).toHaveText('DO YOU WANT DIRECTIONS Y FOR YES N FOR NO');
      } else {
        await expect.poll(questionCount).toBeGreaterThan(questions);
        questions = await questionCount();
      }
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/^(DO YOU WANT DIRECTIONS Y FOR YES N FOR NO\n)[YN]/, '$1')
      .replace(/\?\d+\n/g, '?');
    assertGolfOutput(transcript, run);
  }
});

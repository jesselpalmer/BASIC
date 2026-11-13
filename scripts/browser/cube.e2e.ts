import {expect, test} from '@playwright/test';
import {cubeOptions, cubeRuns, cubeSource} from '../cube-acceptance.ts';

test('CUBE matches the archived win, wager retry and both losses', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('cube');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${cubeOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(cubeSource);
  const output = page.locator('#console-output');
  const status = page.locator('#status');
  const input = page.locator('#input-value');
  for (const run of cubeRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(
          async () =>
            (await output.textContent())?.match(/(?:(?<![A-Z)])|(?<=BET AGAIN))\?/g)?.length,
        )
        .toBe(index + 1);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!;
    expect([...transcript.matchAll(/\?([0-9,]+)\n/g)].map((match) => match[1])).toEqual(
      run.answers,
    );
    expect(transcript.replace(/\?[0-9,]+\n/g, '?')).toBe(run.output);
  }
});

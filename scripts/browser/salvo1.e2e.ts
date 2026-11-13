import {expect, test} from '@playwright/test';
import {assertSalvo1Output, salvo1Options, salvo1Runs, salvo1Source} from '../salvo1-acceptance.ts';

test('SALVO 1 matches archived win and loss on consecutive runs', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('salvo1');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${salvo1Options.dialect}`);
  await expect(page.locator('#source')).toHaveValue(salvo1Source);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of salvo1Runs) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      await expect
        .poll(async () => (await output.textContent())?.match(/\?/g)?.length)
        .toBe(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!;
    expect([...transcript.matchAll(/\?([0-9,]+)\n/g)].map((match) => match[1])).toEqual(
      run.answers,
    );
    assertSalvo1Output(transcript.replace(/\?[0-9,]+\n/g, '?'), run);
  }
});

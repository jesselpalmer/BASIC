import {expect, test} from '@playwright/test';
import {war2Options, war2Runs, war2Source} from '../war2-acceptance.ts';

test('WAR-2 matches all three printed outcomes on fresh runs', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('war2');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${war2Options.dialect}`);
  await expect(page.locator('#source')).toHaveValue(war2Source);
  const output = page.locator('#console-output');
  const status = page.locator('#status');
  const input = page.locator('#input-value');
  for (const run of war2Runs) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.match(/(?<!MOVE)\?/g)?.length)
        .toBe(index + 1);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!;
    expect([...transcript.matchAll(/\?(\d+(?:\.\d+)?)\n/g)].map((match) => match[1])).toEqual(
      run.answers,
    );
    expect(transcript.replace(/\?\d+(?:\.\d+)?\n/g, '?')).toBe(run.output);
  }
});

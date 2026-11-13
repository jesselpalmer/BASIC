import {expect, test} from '@playwright/test';
import {
  diceOptions,
  diceReplayPrompt,
  diceRollsPrompt,
  diceRuns,
  diceSource,
} from '../dice-acceptance.ts';

test('DICE matches archived frequency tables, replay and a fresh RUN', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('dice');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${diceOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(diceSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of diceRuns) {
    let offset = 0;
    let paper = '';
    await page.locator('#run').click();
    for (const answer of run.answers) {
      const numeric = /^\d+$/.test(answer);
      const prompt = numeric ? diceRollsPrompt : diceReplayPrompt;
      const end = run.output.indexOf(prompt, offset) + prompt.length;
      paper += run.output.slice(offset, end);
      offset = end;
      await expect(status).toHaveText('Waiting for input');
      await expect.poll(() => output.textContent()).toBe(paper);
      await input.fill(answer);
      await input.press('Enter');
      paper += answer + (numeric ? '\n' : '');
    }
    await expect(status).toHaveText('Finished');
    await expect.poll(() => output.textContent()).toBe(paper + run.output.slice(offset));
  }
});

import {expect, test} from '@playwright/test';
import {assertBatnumOutput, batnumPrompt, batnumRuns, batnumSource} from '../batnum-acceptance.ts';

test('BATNUM matches the printed games, rejects invalid moves, and starts fresh', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('batnum');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(batnumSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const waitForPrompt = async (count: number) => {
    await expect.poll(async () => (await output.textContent())?.split('?').length).toBe(count + 1);
    await expect(status).toHaveText('Waiting for input');
  };
  for (const run of batnumRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await waitForPrompt(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await waitForPrompt(run.answers.length + 1);
    const transcript = (await output.textContent())!.replace(/\?\d+(?:,\d+)?\n/g, '?');
    expect(transcript.endsWith(batnumPrompt)).toBe(true);
    assertBatnumOutput(transcript, run);
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
  }
});

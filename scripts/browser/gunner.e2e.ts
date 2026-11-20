import {expect, test} from '@playwright/test';
import {
  gunnerOptions,
  gunnerAnswers,
  gunnerTerminalTranscript,
  gunnerSource,
} from '../gunner-acceptance.ts';

test('GUNNER matches archived five targets, loss, automatic replay and fresh runs', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('gunner');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${gunnerOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(gunnerSource);
  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of [0, 1].map(() => ({
    answers: gunnerAnswers,
    output: gunnerTerminalTranscript,
    clockWord: 0,
  }))) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    let offset = 0;
    let paper = '';
    for (const answer of run.answers) {
      const promptEnd = run.output.indexOf('? ', offset) + 2;
      expect(promptEnd).toBeGreaterThan(offset);
      paper += run.output.slice(offset, promptEnd - 2);
      offset = promptEnd;
      await expect(status).toHaveText('Waiting for input');
      await expect.poll(() => output.textContent()).toBe(paper);
      await input.fill(answer);
      await input.press('Enter');
      paper += answer + '\n';
    }
    await expect(status).toHaveText('Waiting for input');
    await expect
      .poll(() => output.textContent())
      .toBe(paper + run.output.slice(offset).replace(/\? /g, ''));
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
    await expect(page.locator('#source')).toHaveValue(gunnerSource);
  }
});

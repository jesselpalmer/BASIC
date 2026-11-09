import {expect, test} from '@playwright/test';
import {
  assertLife2Transcript,
  life2Answers,
  life2FirstPrompt,
  life2Retries,
  life2Source,
} from '../life2-acceptance.ts';

test('LIFE2 replays the archived win, draw and restarts in the editor', async ({page}) => {
  test.setTimeout(45_000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('life2');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: altair-8k-4.0');
  const source = page.locator('#source');
  const status = page.locator('#status');
  const consoleOutput = page.locator('#console-output');
  await expect(source).toHaveValue(life2Source);
  await page.locator('#step').click();
  await expect(status).toHaveText('Paused');
  await page.locator('#step').click();
  await expect(status).toHaveText('Paused');
  await page.locator('#continue').click();
  const submit = async (answer: string) => {
    await expect(status).toHaveText('Waiting for input');
    await page.locator('#input-value').fill(answer);
    await page.locator('#input-value').press('Enter');
  };
  for (const answer of life2Answers) await submit(answer);
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => consoleOutput.textContent()).toMatch(/A DRAW[\s\S]+@@@@\r\n\? $/);
  assertLife2Transcript((await consoleOutput.textContent())!, true);

  await source.fill(life2Source + '\n1000 RUN 500');
  await page.locator('#run').click();
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 1000');
  await expect(status).toHaveText('Waiting for input');
  assertLife2Transcript((await consoleOutput.textContent())!, true);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await source.fill(life2Source);
  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => consoleOutput.textContent()).toBe(life2FirstPrompt);
  for (const answer of life2Retries.answers) await submit(answer);
  const retryTranscript = life2Retries.output
    .map((chunk, index) => {
      const echo = life2Retries.answers[index];
      return chunk + (echo === undefined ? '' : echo + '\n');
    })
    .join('');
  await expect.poll(() => consoleOutput.textContent()).toBe(retryTranscript);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});

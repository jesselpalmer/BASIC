import {expect, test} from '@playwright/test';
import {
  assertLetterOutput,
  letterAnswers,
  letterEntropy,
  letterSource,
} from '../letter-acceptance.ts';

test('LETTER plays both archived rounds and starts fresh after Stop', async ({page}) => {
  await page.addInitScript((entropy) => {
    Math.random = () => entropy;
  }, letterEntropy);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('letter');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(letterSource);

  const status = page.locator('#status');
  const consoleOutput = page.locator('#console-output');
  const submit = async (answer: string) => {
    await expect(status).toHaveText('Waiting for input');
    await page.locator('#input-value').fill(answer);
    await page.locator('#input-value').press('Enter');
  };
  await page.locator('#run').click();
  for (const answer of letterAnswers) await submit(answer);
  await expect(status).toHaveText('Waiting for input');
  await expect(consoleOutput).toContainText('YOU GOT IT IN 6 GUESSES!!');
  assertLetterOutput(
    (await consoleOutput.textContent())!.replace(/(WHAT IS YOUR GUESS\?)[A-Z]/g, '$1'),
  );

  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await page.locator('#run').click();
  await submit('D');
  await expect(status).toHaveText('Waiting for input');
  await expect(consoleOutput).toContainText('YOU GOT IT IN 1 GUESSES!!');
  await expect(consoleOutput).not.toContainText('YOU GOT IT IN 6 GUESSES!!');
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});

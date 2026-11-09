import {expect, test} from '@playwright/test';
import {assertTrapOutput, trapAnswers, trapNextRound, trapSource} from '../trap-acceptance.ts';

test('TRAP matches the archived playthrough and stops during the second input value', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('trap');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(trapSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const waitForPrompt = async (count: number) => {
    await expect.poll(async () => (await output.textContent())?.match(/\?/g)?.length).toBe(count);
    await expect(status).toHaveText('Waiting for input');
  };
  const submit = async (answer: string) => {
    await input.fill(answer);
    await input.press('Enter');
  };

  await page.locator('#run').click();
  for (const [index, answer] of trapAnswers.entries()) {
    await waitForPrompt(index + 1);
    await submit(answer);
  }
  await waitForPrompt(trapAnswers.length + 1);
  assertTrapOutput((await output.textContent())!.replace(/\?(?:[0-9,]+|BAD)\n/g, '?'));

  await submit('23');
  await waitForPrompt(trapAnswers.length + 2);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await page.locator('#run').click();
  await waitForPrompt(1);
  await submit('0');
  await waitForPrompt(2);
  await submit('23,23');
  await waitForPrompt(3);
  expect(await output.textContent()).toBe(
    `WANT INSTRUCTIONS (1 FOR YES)?0\n\nGUESS # 1 ?23,23\nYOU GOT IT!!!\n\n${trapNextRound}`,
  );
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});

import {expect, test} from '@playwright/test';
import {assertReviewedTranscript, matchesReviewed, reviewedAnswers} from '../matches-acceptance.ts';

test('23MTCH follows the archived loss, retry, replay, win and RNG sequence', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('matches');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(matchesReviewed);

  const status = page.locator('#status');
  const consoleOutput = page.locator('#console-output');
  const submit = async (answer: string) => {
    await expect(status).toHaveText('Waiting for input');
    await page.locator('#input-value').fill(answer);
    await page.locator('#input-value').press('Enter');
  };
  await page.locator('#run').click();
  for (const answer of reviewedAnswers) await submit(answer);
  await expect(status).toHaveText('Waiting for input');
  await expect(consoleOutput).toHaveText(
    /I TOOK 2 \.\.\.THERE ARE NOW 19 MATCHES\.\n\nHOW MANY DO YOU TAKE\?$/,
  );
  assertReviewedTranscript((await consoleOutput.textContent())!);

  const source = page.locator('#source');
  await source.fill(matchesReviewed + '\n1000 LET A=RND()\n1010 END');
  await page.locator('#run').click();
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 1000');
  await expect(status).toHaveText('Waiting for input');
  assertReviewedTranscript((await consoleOutput.textContent())!);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');

  await source.fill(matchesReviewed);
  await page.locator('#step').click();
  await expect(status).toHaveText('Paused');
  await page.locator('#step').click();
  await expect(status).toHaveText('Paused');
  await page.locator('#continue').click();
  await submit('2');
  await expect(status).toHaveText('Waiting for input');
  await expect(consoleOutput).toContainText('I TOOK 1 ...THERE ARE NOW 20 MATCHES.');
  await expect(consoleOutput).not.toContainText('I WON!!!');
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});

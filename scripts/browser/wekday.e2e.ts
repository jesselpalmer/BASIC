import {expect, test} from '@playwright/test';
import {wekdayOptions, wekdaySessions, wekdaySource} from '../wekday-acceptance.ts';

test('WEKDAY matches archived date facts and returns to the OMSI menu', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('wekday');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${wekdayOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(wekdaySource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const session = wekdaySessions[0];
  expect(session.entry).toBe('WEKDAY');
  let offset = 0;
  let paper = '';
  await page.locator('#run').click();
  for (const answer of session.answers) {
    const end = session.output.indexOf('?', offset) + 1;
    paper += session.output.slice(offset, end);
    offset = end;
    await expect(status).toHaveText('Waiting for input');
    await expect.poll(() => output.textContent()).toBe(paper);
    await input.fill(answer);
    await input.press('Enter');
    paper += answer + '\n';
  }
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(paper + session.output.slice(offset));
  await expect(page.locator('#source')).toHaveValue(wekdaySource);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect
    .poll(() => output.textContent())
    .toBe(session.output.slice(0, session.output.indexOf('?') + 1));
  await page.locator('#stop').click();
});

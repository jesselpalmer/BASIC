import {expect, test} from '@playwright/test';
import {zoopOptions, zoopSessions, zoopSource} from '../zoop-acceptance.ts';

test('ZOOP echoes the archived command dialogue, reloads itself and returns to DEMON', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('zoop');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${zoopOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(zoopSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const session = zoopSessions[0];
  expect(session.entry).toBe('ZOOP');
  let paper = session.start;
  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(paper);
  for (const step of session.steps) {
    for (const key of step.keys) {
      await expect(status).toHaveText('Waiting for input');
      const answer = key === '\n' ? '' : key;
      await input.fill(answer);
      await input.press('Enter');
      paper += answer;
    }
    paper += step.output;
    await expect(status).toHaveText('Waiting for input');
    await expect.poll(() => output.textContent()).toBe(paper);
  }

  await expect(page.locator('#source')).toHaveValue(zoopSource);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(session.start);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});

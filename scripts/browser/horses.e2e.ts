import {expect, test} from '@playwright/test';
import {
  horsesMenuSource,
  horsesOptions,
  horsesSessions,
  horsesSource,
} from '../horses-acceptance.ts';

for (const session of horsesSessions) {
  test(`HORSES matches the archived race entered from ${session.entry} and returns to DEMON`, async ({
    page,
  }) => {
    await page.goto('/');
    const fromMenu = session.entry === 'DEMON';
    const source = fromMenu ? horsesMenuSource : horsesSource;
    page.once('dialog', (dialog) => void dialog.accept());
    await page.locator('#example').selectOption(fromMenu ? 'baseball' : 'horses');
    await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${horsesOptions.dialect}`);
    await expect(page.locator('#source')).toHaveValue(source);

    const status = page.locator('#status');
    const output = page.locator('#console-output');
    const input = page.locator('#input-value');
    let offset = 0;
    let paper = '';
    await page.locator('#run').click();
    for (const {answer, prompt, numeric} of session.inputs) {
      const start = session.output.indexOf(prompt, offset);
      expect(start).toBeGreaterThanOrEqual(offset);
      const end = start + prompt.length;
      paper += session.output.slice(offset, end);
      offset = end;
      await expect(status).toHaveText('Waiting for input');
      await expect.poll(() => output.textContent()).toBe(paper);
      await input.fill(answer);
      await input.press('Enter');
      paper += answer + (numeric ? '\n' : '');
    }
    await expect(status).toHaveText('Waiting for input');
    await expect.poll(() => output.textContent()).toBe(paper + session.output.slice(offset));
    await expect(page.locator('#source')).toHaveValue(source);
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
    await page.locator('#run').click();
    const first = session.inputs[0].prompt;
    await expect(status).toHaveText('Waiting for input');
    await expect
      .poll(() => output.textContent())
      .toBe(session.output.slice(0, session.output.indexOf(first) + first.length));
    await page.locator('#stop').click();
  });
}

import {expect, test} from '@playwright/test';
import {
  assertBaseballOutput,
  baseballAnswers,
  baseballCatalogPrompt,
  baseballMenuPrompt,
  baseballOptions,
  baseballPlayPrompt,
  baseballSource,
  baseballTeamPrompt,
} from '../baseball-acceptance.ts';

test('OMSI baseball matches the archived game and returns to DEMON', async ({page}) => {
  test.setTimeout(60_000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('baseball');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${baseballOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(baseballSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const waitForPrompt = async (prompt: string, count = 1) => {
    await expect
      .poll(async () => (await output.textContent())?.split(prompt).length)
      .toBe(count + 1);
    await expect(status).toHaveText('Waiting for input');
  };
  const submit = async (answer: string) => {
    await input.fill(answer);
    await input.press('Enter');
  };
  const [selection, team, ...plays] = baseballAnswers;
  const list = plays.pop()!;

  await page.locator('#run').click();
  await waitForPrompt(baseballMenuPrompt);
  await submit(selection);
  await waitForPrompt(baseballTeamPrompt);
  await submit(team);
  for (const [index, play] of plays.entries()) {
    await waitForPrompt(baseballPlayPrompt, index + 1);
    await submit(play);
  }
  await waitForPrompt(baseballMenuPrompt, 2);
  await submit(list);
  await waitForPrompt(baseballCatalogPrompt);

  const paper = (await output.textContent())!;
  expect(paper).toContain(baseballMenuPrompt + selection);
  expect(paper).toContain(baseballMenuPrompt + list);
  expect(paper).toContain(baseballTeamPrompt + team);
  const playEcho = /YOUR PLAY\? ([A-Z-]+)(?=\n)/g;
  expect([...paper.matchAll(playEcho)].map((match) => match[1])).toEqual(plays);
  const echoFree = paper
    .replace(baseballMenuPrompt + selection, baseballMenuPrompt)
    .replace(baseballMenuPrompt + list, baseballMenuPrompt)
    .replace(baseballTeamPrompt + team, baseballTeamPrompt)
    .replaceAll(playEcho, baseballPlayPrompt);
  assertBaseballOutput(echoFree);

  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await page.locator('#run').click();
  await waitForPrompt(baseballMenuPrompt);
  expect(await output.textContent()).toBe(
    `\nWHAT DEMONSTRATION WOULD YOU LIKE TO SEE\n${baseballMenuPrompt}`,
  );
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});

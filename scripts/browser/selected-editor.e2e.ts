import {expect, test} from '@playwright/test';

test('selected editor follows seven legal jumps, rejects printed continuation and replays', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('checker');
  await page.locator('#run').click();
  for (const answer of [
    '1',
    '19',
    '2',
    '20',
    '3',
    '21',
    '8',
    '22',
    '16',
    '30',
    '24',
    '38',
    '64',
    '46',
    '12',
    '26',
  ]) {
    await expect(page.locator('#status')).toHaveText('Waiting for input');
    await page.locator('#input-value').fill(answer);
    await page.locator('#input-value').press('Enter');
  }
  await expect(page.locator('#console-output')).toContainText('ILLEGAL MOVE.  TRY AGAIN...');
  for (const answer of ['0', 'MAYBE', 'YES', '1', '19', '0', 'NO']) {
    await expect(page.locator('#status')).toHaveText('Waiting for input');
    await page.locator('#input-value').fill(answer);
    await page.locator('#input-value').press('Enter');
  }
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toContainText('YOU MADE 7 JUMPS AND HAD 41 PIECES');
  await expect(page.locator('#console-output')).toContainText("PLEASE ANSWER 'YES' OR 'NO'.");
  await expect(page.locator('#console-output')).toContainText('YOU MADE 1 JUMPS AND HAD 47 PIECES');
  await expect(page.locator('#console-output')).toContainText('O. K.  HOPE YOU HAD FUN!');
});

test('editable 1CHECK runs in the public selected profile and retains its portable context', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('checker');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: basic-plus-v4a12-ma2');
  await expect(page.locator('#source')).toHaveValue(/SOLITAIRE CHECKER PUZZLE/);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#console-output')).toContainText('OPENING POSITION OF THE CHECKERS');
  await page.locator('#input-value').fill('1');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill('19');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill('0');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#console-output')).toContainText('YOU MADE 1 JUMPS AND HAD 47 PIECES');
  await page.locator('#input-value').fill('NO');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toContainText('YOU MADE 1 JUMPS AND HAD 47 PIECES');

  const original = await page.locator('#source').inputValue();
  await page
    .locator('#source')
    .fill(original.replace('SOLITAIRE CHECKER PUZZLE', 'CHECKER TEST COPY'));
  await expect(page.locator('#example')).toHaveValue('');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#console-output')).toContainText('CHECKER TEST COPY');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: basic-plus-v4a12-ma2');
});

test('selected admission shows a located error and preserves a waiting game', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('checker');
  const source = page.locator('#source');
  const checker = await source.inputValue();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');

  await source.fill('10 PRINT "NEVER"\n20 END\n30 PRINT RND()');
  await page.locator('#run').click();
  await expect(page.locator('#diagnostic')).toContainText('Source line 3, column');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 30');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#console-output')).not.toContainText('NEVER');

  await page.locator('#input-value').fill('0');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill('NO');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Finished');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 30');
  await expect(page.locator('#console-output')).toContainText('YOU MADE 0 JUMPS AND HAD 48 PIECES');

  await source.fill(checker);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#diagnostic')).toBeHidden();
});

test('EDUSYSTEM-30 indexed character input consumes one submitted line', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('tower');
  await page
    .locator('#source')
    .fill(
      [
        '10 DIM A(2)',
        '20 INPUT$A(0)',
        '30 INPUT $A(1)',
        '40 INPUT $A(2)',
        '50 PRINT A(0);A(1);A(2)',
        '60 END',
      ].join('\n'),
    );
  await page.locator('#run').click();
  const input = page.getByRole('textbox', {name: 'Program input'});
  await expect(input).toBeVisible();
  await input.fill('Ab');
  await input.press('Enter');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toContainText(' 193  226  141 ');
});

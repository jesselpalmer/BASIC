import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

interface KeyboardProbe {
  pending: Map<number, () => void>;
  tick(): void;
}

declare global {
  interface Window {
    keyboardProbe: KeyboardProbe;
  }
}

// Hold only the program's WAIT tasks. Input, focus, rendering and browser controls
// still run normally; each tick completes one BASIC frame without a fixed sleep.
async function open(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const browser = window as unknown as {
      setTimeout(
        handler: (...values: unknown[]) => void,
        delay?: number,
        ...values: unknown[]
      ): number;
      clearTimeout(id?: number): void;
    };
    const nativeTimeout = browser.setTimeout.bind(browser);
    const nativeClear = browser.clearTimeout.bind(browser);
    let id = -1;
    const pending = new Map<number, () => void>();
    window.keyboardProbe = {
      pending,
      tick() {
        const next = pending.entries().next().value;
        if (!next) throw new Error('No BASIC frame is waiting');
        pending.delete(next[0]);
        next[1]();
      },
    };
    browser.setTimeout = (handler, delay, ...values) => {
      if (delay !== 1234 && delay !== 16) return nativeTimeout(handler, delay, ...values);
      const timer = id--;
      pending.set(timer, () => handler(...values));
      return timer;
    };
    browser.clearTimeout = (timer) => {
      if (timer === undefined || !pending.delete(timer)) nativeClear(timer);
    };
  });
  await page.goto('/');
}

async function waiting(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.keyboardProbe.pending.size)).toBe(1);
}

async function run(page: Page, source: string): Promise<void> {
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await waiting(page);
}

async function tick(page: Page): Promise<void> {
  await page.evaluate(() => window.keyboardProbe.tick());
}

const poll = '10 WAIT 1234\n20 PRINT KEYDOWN("up");":";INKEY$();":";INKEY$()\n30 GOTO 10';

test('logical names queue once in order while KEYDOWN retains the held key until release', async ({
  page,
}) => {
  await open(page);
  const source =
    '10 WAIT 1234\n20 PRINT KEYDOWN("up");":";INKEY$();",";INKEY$();",";INKEY$();",";INKEY$();",";INKEY$();",";INKEY$();",";INKEY$()\n30 GOTO 10';
  await run(page, source);
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowUp');
  for (const key of ['a', '7', 'ArrowLeft', 'Enter', 'Space']) await page.keyboard.press(key);
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('1:UP,A,7,LEFT,ENTER,SPACE,\n');
  await waiting(page);
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText(
    '1:UP,A,7,LEFT,ENTER,SPACE,\n1:,,,,,,\n',
  );
  await waiting(page);
  await page.keyboard.up('ArrowUp');
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText(
    '1:UP,A,7,LEFT,ENTER,SPACE,\n1:,,,,,,\n0:,,,,,,\n',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('#status')).toHaveText('Stopped');
});

test('the queue drops the oldest overflow and ignores modified and composing keys', async ({
  page,
}) => {
  await open(page);
  await run(page, poll);
  await page.locator('#graphics').focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Alt+b');
  await page
    .locator('#graphics')
    .dispatchEvent('keydown', {key: 'c', code: 'KeyC', isComposing: true});
  await page.locator('#graphics').dispatchEvent('keyup', {key: 'c', code: 'KeyC'});
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0::\n');
  await run(
    page,
    '10 WAIT 1234\n20 FOR I=1 TO 64\n30 PRINT INKEY$();\n40 NEXT I\n50 PRINT "[";INKEY$();"]"\n60 END',
  );
  await page.locator('#graphics').focus();
  await page.evaluate(() => {
    const canvas = document.querySelector('#graphics')!;
    for (let index = 0; index < 80; index++) {
      const key = String(index % 10);
      for (const type of ['keydown', 'keyup'])
        canvas.dispatchEvent(
          new KeyboardEvent(type, {key, code: `Digit${key}`, bubbles: true, cancelable: true}),
        );
    }
  });
  await tick(page);
  await expect(page.locator('#status')).toHaveText('Finished');
  const retained = Array.from({length: 64}, (_, index) => String((index + 16) % 10)).join('');
  await expect(page.locator('#console-output')).toHaveText(`${retained}[]\n`);
});

test('editor typing, lost focus, window blur and hidden pages clear game input', async ({page}) => {
  await open(page);
  await run(page, poll);
  await expect(page.locator('#graphics')).not.toBeFocused();
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowUp');
  await page.locator('#source').focus();
  await page.keyboard.press('End');
  await page.keyboard.type('a');
  await page.keyboard.up('ArrowUp');
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0::\n');
  await waiting(page);
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowUp');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0::\n0::\n');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.keyboard.up('ArrowUp');
  await waiting(page);
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowUp');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, value: true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.keyboard.press('a');
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0::\n0::\n0::\n');
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.keyboard.up('ArrowUp');
  await page.locator('#graphics').focus();
  await page.keyboard.press('b');
  await waiting(page);
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0::\n0::\n0::\n0:B:\n');
});

test('Pause and text INPUT release keys and do not capture typing in either interface', async ({
  page,
}) => {
  await open(page);
  await run(page, poll);
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowUp');
  await page.locator('#pause').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await page.locator('#graphics').focus();
  await page.keyboard.press('a');
  await page.keyboard.up('ArrowUp');
  await page.locator('#continue').click();
  await page.locator('#graphics').focus();
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0::\n');
  await run(
    page,
    '10 WAIT 1234\n20 INPUT "Name"; N$\n30 WAIT 1234\n40 PRINT N$;":";KEYDOWN("UP");":";INKEY$()',
  );
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowUp');
  await tick(page);
  await expect(page.locator('#input-value')).toBeFocused();
  await page.locator('#graphics').focus();
  await page.keyboard.press('b');
  await page.keyboard.up('ArrowUp');
  await page.locator('#input-value').fill('Ada');
  await page.locator('#input-value').press('Enter');
  await waiting(page);
  await tick(page);
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('Ada\nAda:0:\n');
});

test('Stop, errors and repeated replacements release old key state without duplicated input', async ({
  page,
}) => {
  await open(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    await run(page, poll);
    await page.locator('#graphics').focus();
    await page.keyboard.down('ArrowUp');
    await page.locator('#stop').click();
    await expect(page.locator('#status')).toHaveText('Stopped');
    expect(await page.evaluate(() => window.keyboardProbe.pending.size)).toBe(0);
    await page.keyboard.up('ArrowUp');
  }
  await run(page, '10 WAIT 1234\n20 PRINT 1/0');
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowUp');
  await tick(page);
  await expect(page.locator('#status')).toHaveText('Error');
  await page.keyboard.up('ArrowUp');
  await run(page, poll);
  await page.locator('#graphics').focus();
  await page.keyboard.press('a');
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0:A:\n');
  await waiting(page);
  await page.keyboard.down('ArrowUp');
  await page.locator('#run').click();
  await waiting(page);
  await page.keyboard.up('ArrowUp');
  await page.locator('#graphics').focus();
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0::\n');
});

test('keyboard navigation reaches the game surface and Stop without trapping Tab', async ({
  page,
}) => {
  await open(page);
  await run(page, poll);
  await page.locator('#graphics').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#graphics')).not.toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#graphics')).toBeFocused();
  for (let count = 0; count < 20; count++) {
    await page.keyboard.press('Shift+Tab');
    if (await page.locator('#stop').evaluate((button) => button === document.activeElement)) break;
  }
  await expect(page.locator('#stop')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#status')).toHaveText('Stopped');
  await page.locator('#source').focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('#status')).toHaveText('Running');
  await page.keyboard.press('Escape');
  await expect(page.locator('#status')).toHaveText('Stopped');
});

async function frames(page: Page, count: number): Promise<void> {
  await page.evaluate(async (total) => {
    for (let frame = 0; frame < total; frame++) {
      window.keyboardProbe.tick();
      for (let turn = 0; turn < 1000 && window.keyboardProbe.pending.size === 0; turn++)
        await Promise.resolve();
      if (window.keyboardProbe.pending.size !== 1)
        throw new Error('Marker failed to schedule its next frame');
    }
  }, count);
}

async function markerBounds(page: Page) {
  return page.evaluate(() => {
    const data = (document.querySelector('#graphics') as HTMLCanvasElement)
      .getContext('2d')!
      .getImageData(0, 0, 320, 200).data;
    let left = 320,
      right = -1,
      top = 200,
      bottom = -1;
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 320; x++) {
        const offset = (y * 320 + x) * 4;
        if (data[offset] || data[offset + 1] || data[offset + 2]) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    return {left, right, top, bottom};
  });
}

test('the actual marker moves only on held arrows, clamps both edges and survives an exact file round trip', async ({
  page,
}) => {
  await open(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#example').selectOption('move');
  const source = await readFile(new URL('../../examples/move.bas', import.meta.url), 'utf8');
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#run').click();
  await waiting(page);
  const initial = {left: 156, right: 164, top: 96, bottom: 104};
  expect(await markerBounds(page)).toEqual(initial);
  await frames(page, 2);
  expect(await markerBounds(page)).toEqual(initial);
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await frames(page, 80);
  expect(await markerBounds(page)).toEqual({left: 311, right: 319, top: 191, bottom: 199});
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowDown');
  await frames(page, 2);
  expect(await markerBounds(page)).toEqual({left: 311, right: 319, top: 191, bottom: 199});
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('ArrowUp');
  await frames(page, 110);
  expect(await markerBounds(page)).toEqual({left: 0, right: 8, top: 0, bottom: 8});
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  await page.locator('#stop').click();
  await page.locator('#run').click();
  await waiting(page);
  expect(await markerBounds(page)).toEqual(initial);
  await page.locator('#stop').click();
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  expect(await readFile(path, 'utf8')).toBe(source);
  await page.locator('#source').fill('10 PRINT "temporary"');
  await page.locator('#file-input').setInputFiles(path);
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#run').click();
  await waiting(page);
  expect(await markerBounds(page)).toEqual(initial);
  await page.locator('#graphics').focus();
  await page.keyboard.down('ArrowRight');
  await frames(page, 1);
  expect(await markerBounds(page)).toEqual({left: 159, right: 167, top: 96, bottom: 104});
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(page.locator('#status')).toHaveText('Stopped');
  expect(await page.evaluate(() => window.keyboardProbe.pending.size)).toBe(0);
});

test('held keys release by physical identity when modifiers change and Enter keys overlap', async ({
  page,
}) => {
  await open(page);
  await run(page, '10 WAIT 1234\n20 PRINT KEYDOWN("1");":";KEYDOWN("ENTER")\n30 GOTO 10');
  await page.locator('#graphics').focus();
  await page.keyboard.down('1');
  await page.keyboard.down('Shift');
  // Playwright keeps the original character on keyboard.up('1'). Dispatch the
  // changed character explicitly to exercise a real modifier/layout transition.
  await page.locator('#graphics').dispatchEvent('keyup', {
    key: '!',
    code: 'Digit1',
    shiftKey: true,
  });
  await page.keyboard.up('Shift');
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0:0\n');
  await page.keyboard.up('1');
  await waiting(page);
  await page.keyboard.down('Enter');
  await page.keyboard.down('NumpadEnter');
  await page.keyboard.up('Enter');
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0:0\n0:1\n');
  await waiting(page);
  await page.keyboard.up('NumpadEnter');
  await tick(page);
  await expect(page.locator('#console-output')).toHaveText('0:0\n0:1\n0:0\n');
});

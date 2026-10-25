import {expect, test, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

interface PongProbe {
  timers: Map<number, () => void>;
  maximumTimers: number;
  listeners(): number;
}

declare global {
  interface Window {
    pongProbe: PongProbe;
  }
}

// Keep the real interpreter, canvas, input and key handlers. Only WAIT's clock is
// controlled; every completed frame must schedule exactly one successor task.
async function open(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.41;
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
    const timers = new Map<number, () => void>();
    let nextId = -1;
    const registrations: {
      target: EventTarget;
      type: string;
      callback: EventListenerOrEventListenerObject | null;
    }[] = [];
    const events = new Set(['keydown', 'keyup', 'focus', 'blur', 'visibilitychange']);
    // Saved methods are deliberately invoked with their original event target.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const add = EventTarget.prototype.addEventListener;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, callback, options) {
      if (
        events.has(type) &&
        !registrations.some(
          (entry) => entry.target === this && entry.type === type && entry.callback === callback,
        )
      )
        registrations.push({target: this, type, callback});
      Reflect.apply(add, this, [type, callback, options]);
    };
    EventTarget.prototype.removeEventListener = function (type, callback, options) {
      const index = registrations.findIndex(
        (entry) => entry.target === this && entry.type === type && entry.callback === callback,
      );
      if (index !== -1) registrations.splice(index, 1);
      Reflect.apply(remove, this, [type, callback, options]);
    };
    window.pongProbe = {
      timers,
      maximumTimers: 0,
      listeners: () =>
        registrations.filter(
          (entry) =>
            entry.target === window ||
            entry.target === document ||
            entry.target === document.querySelector('#graphics'),
        ).length,
    };
    browser.setTimeout = (handler, delay, ...values) => {
      if (delay !== 16) return nativeTimeout(handler, delay, ...values);
      const id = nextId--;
      timers.set(id, () => handler(...values));
      window.pongProbe.maximumTimers = Math.max(window.pongProbe.maximumTimers, timers.size);
      return id;
    };
    browser.clearTimeout = (id) => {
      if (id === undefined || !timers.delete(id)) nativeClear(id);
    };
  });
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#inspection summary').click();
  await page.locator('#example').selectOption('pong');
  await expect(page.locator('#source')).toHaveValue(
    await readFile(new URL('../../examples/pong.bas', import.meta.url), 'utf8'),
  );
  await page.locator('#run').click();
  await expect(page.locator('#input-prompt')).toContainText('Press Enter to start');
}

async function start(page: Page): Promise<void> {
  await page.locator('#input-value').press('Enter');
  await expect.poll(() => page.evaluate(() => window.pongProbe.timers.size)).toBe(1);
  await page.locator('#graphics').focus();
}

async function variables(page: Page): Promise<Record<string, number>> {
  return page.locator('#variable-rows tr').evaluateAll((rows) =>
    Object.fromEntries(
      rows.map((row) => {
        const cells = row.querySelectorAll('td');
        return [cells[0].textContent, Number(cells[1].textContent)];
      }),
    ),
  );
}

// The player uses only values exposed by the read-only inspector and sends the
// same key events as a person. Ball motion, collisions and scoring remain BASIC.
async function play(page: Page, strategy: 'win' | 'lose' | 'idle', frames = 3000): Promise<void> {
  await page.evaluate(
    async ({strategy, frames}) => {
      const canvas = document.querySelector('#graphics')!;
      const pressed = new Set<string>();
      const key = (name: string, held: boolean) => {
        if (pressed.has(name) === held) return;
        if (held) pressed.add(name);
        else pressed.delete(name);
        canvas.dispatchEvent(
          new KeyboardEvent(held ? 'keydown' : 'keyup', {
            key: name === 'Space' ? ' ' : name,
            code: name,
            bubbles: true,
            cancelable: true,
          }),
        );
      };
      for (let frame = 0; frame < frames; frame++) {
        if (document.querySelector('#status')!.textContent === 'Waiting for input') break;
        const values = Object.fromEntries(
          Array.from(document.querySelectorAll('#variable-rows tr'), (row) => {
            const cells = row.querySelectorAll('td');
            return [cells[0].textContent, Number(cells[1].textContent)];
          }),
        );
        key('Space', true);
        const target =
          strategy === 'win' ? values.Y - 17 : strategy === 'lose' ? 172 : values.PADDLE;
        key('ArrowUp', target < values.PADDLE - 2);
        key('ArrowDown', target > values.PADDLE + 2);
        const next = window.pongProbe.timers.entries().next().value;
        if (!next) throw new Error('Pong has no frame timer');
        window.pongProbe.timers.delete(next[0]);
        next[1]();
        let settled = false;
        for (let turn = 0; turn < 1000; turn++) {
          await Promise.resolve();
          if (
            window.pongProbe.timers.size === 1 ||
            document.querySelector('#status')!.textContent === 'Waiting for input'
          ) {
            settled = true;
            break;
          }
        }
        if (!settled) throw new Error('Pong did not produce its next frame');
      }
      for (const name of pressed) key(name, false);
    },
    {strategy, frames},
  );
}

test('the actual BASIC game has reachable win/loss and clean in-game restarts', async ({page}) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  const baselineListeners = await page.evaluate(() => window.pongProbe.listeners());
  await start(page);
  await expect(page.locator('#console-output')).toContainText('You: 0  Computer: 0');
  await play(page, 'win');
  await expect(page.locator('#input-prompt')).toContainText('Press Enter to restart');
  await expect(page.locator('#console-output')).toContainText('YOU WIN!');
  expect(await variables(page)).toMatchObject({SCORE: 3});
  expect(await page.evaluate(() => window.pongProbe.timers.size)).toBe(0);
  expect(await page.evaluate(() => window.pongProbe.listeners())).toBe(baselineListeners);
  await start(page);
  expect(await variables(page)).toMatchObject({
    SCORE: 0,
    COMPUTERSCORE: 0,
    PADDLE: 100,
    OPPONENT: 100,
    X: 160,
    Y: 100,
  });
  await play(page, 'lose');
  await expect(page.locator('#input-prompt')).toContainText('Press Enter to restart');
  await expect(page.locator('#console-output')).toContainText('COMPUTER WINS');
  expect(await variables(page)).toMatchObject({COMPUTERSCORE: 3});
  expect(await page.evaluate(() => window.pongProbe.listeners())).toBe(baselineListeners);
  await start(page);
  expect(await variables(page)).toMatchObject({
    SCORE: 0,
    COMPUTERSCORE: 0,
    PADDLE: 100,
    OPPONENT: 100,
    X: 160,
    Y: 100,
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#status')).toHaveText('Stopped');
  expect(
    await page.evaluate(() => ({
      pending: window.pongProbe.timers.size,
      maximum: window.pongProbe.maximumTimers,
      listeners: window.pongProbe.listeners(),
    })),
  ).toEqual({pending: 0, maximum: 1, listeners: baselineListeners});
  expect(errors).toEqual([]);
});

test('focus loss, pause, Stop and rerun preserve source and release game controls', async ({
  page,
}) => {
  await open(page);
  const original = await page.locator('#source').inputValue();
  const baselineListeners = await page.evaluate(() => window.pongProbe.listeners());
  await start(page);
  await page.keyboard.down('ArrowDown');
  await play(page, 'idle', 1);
  expect((await variables(page)).PADDLE).toBeGreaterThan(100);
  await page.locator('#source').focus();
  await page.locator('#source').fill(`${original}65500 REM edits belong to the next run\n`);
  const heldBefore = (await variables(page)).PADDLE;
  await play(page, 'idle', 3);
  expect((await variables(page)).PADDLE).toBe(heldBefore);
  await expect(page.locator('#execution-source')).toHaveText(original);
  await page.locator('#pause').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  expect(await page.evaluate(() => window.pongProbe.listeners())).toBe(baselineListeners);
  await page.locator('#continue').click();
  await page.locator('#graphics').focus();
  await page.keyboard.up('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.locator('#status')).toHaveText('Stopped');
  expect(await page.evaluate(() => window.pongProbe.timers.size)).toBe(0);
  for (let run = 0; run < 3; run++) {
    await page.locator('#run').click();
    await expect(page.locator('#input-prompt')).toContainText('Press Enter to start');
    expect(await page.evaluate(() => window.pongProbe.listeners())).toBe(baselineListeners);
    await start(page);
    expect(await variables(page)).toMatchObject({SCORE: 0, COMPUTERSCORE: 0, PADDLE: 100});
    await page.locator('#stop').click();
  }
  await expect(page.locator('#source')).toHaveValue(
    `${original}65500 REM edits belong to the next run\n`,
  );
  expect(await page.evaluate(() => window.pongProbe.listeners())).toBe(baselineListeners);
});

test('the downloadable game reimports exactly and plays through the same public controls', async ({
  page,
}) => {
  await open(page);
  const expected = await readFile(new URL('../../examples/pong.bas', import.meta.url), 'utf8');
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  expect(await readFile(await (await download).path(), 'utf8')).toBe(expected);
  await page.locator('#source').fill('10 PRINT "replace me"');
  await page
    .locator('#file-input')
    .setInputFiles({name: 'pong.bas', mimeType: 'text/plain', buffer: Buffer.from(expected)});
  await expect(page.locator('#source')).toHaveValue(expected);
  await page.locator('#run').click();
  await expect(page.locator('#input-prompt')).toContainText('Press Enter to start');
  await start(page);
  await page.keyboard.down('ArrowUp');
  await play(page, 'idle', 2);
  expect((await variables(page)).PADDLE).toBeLessThan(100);
  await page.keyboard.up('ArrowUp');
  await page.locator('#stop').click();
  await expect(page.locator('#source')).toHaveValue(expected);
});

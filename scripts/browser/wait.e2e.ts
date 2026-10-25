import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

interface Frame {
  first: number[];
  second: number[];
  bounds: {left: number; right: number; top: number; bottom: number} | null;
}

interface HeldTimer {
  id: number;
  delay: number;
  frameCount: number;
  cancelled: boolean;
  fired: boolean;
}

interface WaitProbe {
  frames: Frame[];
  timers: HeldTimer[];
  pending: number[];
  releaseNext(): void;
}

declare global {
  interface Window {
    waitProbe: WaitProbe;
  }
}

// Hold actual host timer tasks rather than advancing wall time. Other browser
// tasks and rendering remain live, so controls still have to work during WAIT.
async function observeWaits(page: Page, delays: number[] = [1234]): Promise<void> {
  await page.addInitScript((heldDelays) => {
    // This code runs in Chromium; narrow the ambient Bun/Node timer overloads.
    const browser = window as unknown as {
      setTimeout(
        handler: (...arguments_: unknown[]) => void,
        delay?: number,
        ...arguments_: unknown[]
      ): number;
      clearTimeout(id?: number): void;
    };
    const nativeTimeout = browser.setTimeout.bind(browser);
    const nativeClear = browser.clearTimeout.bind(browser);
    const callbacks = new Map<number, () => void>();
    let nextId = -1;
    const probe: WaitProbe = {
      frames: [],
      timers: [],
      pending: [],
      releaseNext() {
        const id = probe.pending.shift();
        if (id === undefined) throw new Error('No WAIT timer is pending');
        const callback = callbacks.get(id)!;
        callbacks.delete(id);
        probe.timers.find((timer) => timer.id === id)!.fired = true;
        callback();
      },
    };
    window.waitProbe = probe;
    browser.setTimeout = (handler, delay, ...arguments_) => {
      if (!heldDelays.includes(delay ?? 0)) return nativeTimeout(handler, delay, ...arguments_);
      const id = nextId--;
      callbacks.set(id, () => handler(...arguments_));
      probe.pending.push(id);
      probe.timers.push({
        id,
        delay: delay ?? 0,
        frameCount: probe.frames.length,
        cancelled: false,
        fired: false,
      });
      return id;
    };
    browser.clearTimeout = (id) => {
      if (id !== undefined && callbacks.delete(id)) {
        probe.pending.splice(probe.pending.indexOf(id), 1);
        probe.timers.find((timer) => timer.id === id)!.cancelled = true;
      } else nativeClear(id);
    };
    // The saved native method is always invoked with the original canvas receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const put = CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData = function (image, x, y) {
      let left = image.width;
      let right = -1;
      let top = image.height;
      let bottom = -1;
      for (let row = 0; row < image.height; row++) {
        for (let column = 0; column < image.width; column++) {
          const offset = (row * image.width + column) * 4;
          if (image.data[offset] || image.data[offset + 1] || image.data[offset + 2]) {
            left = Math.min(left, column);
            right = Math.max(right, column);
            top = Math.min(top, row);
            bottom = Math.max(bottom, row);
          }
        }
      }
      const pixel = (column: number, row: number) => {
        const offset = (row * image.width + column) * 4;
        return Array.from(image.data.slice(offset, offset + 4));
      };
      probe.frames.push({
        first: pixel(1, 1),
        second: pixel(2, 2),
        bounds: right < 0 ? null : {left, right, top, bottom},
      });
      Reflect.apply(put, this, [image, x, y]);
    };
  }, delays);
  await page.goto('/');
}

async function waitForTimer(page: Page, count: number): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.waitProbe.timers.length)).toBe(count);
}

const black = [0, 0, 0, 255];
const red = [255, 85, 85, 255];
const green = [85, 255, 85, 255];

test('WAIT presents the complete frame before its timer and CLS does not flash an empty frame', async ({
  page,
}) => {
  await observeWaits(page);
  await page
    .locator('#source')
    .fill(
      '10 COLOR 12\n20 PSET 1,1\n30 PRINT "first"\n40 WAIT 1234\n50 CLS\n60 COLOR 10\n70 PSET 2,2\n80 PRINT "second"\n90 WAIT 1234\n100 END',
    );
  await page.locator('#run').click();
  await waitForTimer(page, 1);
  await expect(page.locator('#console-output')).toHaveText('first\n');
  const first = await page.evaluate(() => {
    const {frames, timers} = window.waitProbe;
    return {frame: frames[timers[0].frameCount - 1], count: timers[0].frameCount};
  });
  expect(first.frame.first).toEqual(red);
  expect(first.frame.second).toEqual(black);
  await page.evaluate(() => window.waitProbe.releaseNext());
  await waitForTimer(page, 2);
  await expect(page.locator('#console-output')).toHaveText('second\n');
  const laterFrames = await page.evaluate(
    (start) => window.waitProbe.frames.slice(start),
    first.count,
  );
  expect(laterFrames.length).toBeGreaterThan(0);
  for (const frame of laterFrames) {
    expect(frame.first).toEqual(black);
    expect(frame.second).toEqual(green);
  }
  await page.evaluate(() => window.waitProbe.releaseNext());
  await expect(page.locator('#status')).toHaveText('Finished');
});

test('WAIT 0 yields a host task and Stop cancels it before another statement runs', async ({
  page,
}) => {
  await observeWaits(page, [0]);
  await page.locator('#source').fill('10 WAIT 0\n20 PRINT "must not run"');
  await page.locator('#run').click();
  await waitForTimer(page, 1);
  await expect(page.locator('#status')).toHaveText('Running');
  await expect(page.locator('#console-output')).toBeEmpty();
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  expect(await page.evaluate(() => window.waitProbe.pending)).toEqual([]);
  expect(await page.evaluate(() => window.waitProbe.timers[0])).toMatchObject({
    cancelled: true,
    fired: false,
  });
  await page.locator('#source').fill('10 PRINT "fresh"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('fresh\n');
});

test('Step waits for one asynchronous WAIT, then preserves normal PRINT and INPUT stepping', async ({
  page,
}) => {
  await observeWaits(page);
  await page.locator('#source').fill('10 WAIT 1234\n20 PRINT "after"\n30 INPUT N\n40 PRINT N');
  await page.locator('#step').click();
  await waitForTimer(page, 1);
  await expect(page.locator('#status')).toHaveText('Running');
  await expect(page.locator('#step')).toBeDisabled();
  await expect(page.locator('#continue')).toBeEnabled();
  await expect(page.locator('#input-form')).toBeHidden();
  await expect(page.locator('#console-output')).toBeEmpty();
  await page.evaluate(() => window.waitProbe.releaseNext());
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 20 ');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 30 ');
  await expect(page.locator('#console-output')).toHaveText('after\n');
  await page.locator('#step').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('7');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 40 ');
  await expect(page.locator('#variable-rows')).toHaveText('N7');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('after\n7\n7\n');
});

test('Pause and Step finish the current WAIT; Continue during a stepped wait releases future statements', async ({
  page,
}) => {
  await observeWaits(page);
  await page.locator('#source').fill('10 WAIT 1234\n20 PRINT "after"');
  await page.locator('#run').click();
  await waitForTimer(page, 1);
  await page.locator('#pause').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await page.locator('#step').click();
  expect(await page.evaluate(() => window.waitProbe.pending.length)).toBe(1);
  await page.evaluate(() => window.waitProbe.releaseNext());
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('Next: BASIC line 20 ');
  await expect(page.locator('#console-output')).toBeEmpty();
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('after\n');
  await page.locator('#step').click();
  await waitForTimer(page, 2);
  await page.locator('#continue').click();
  await page.evaluate(() => window.waitProbe.releaseNext());
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('after\n');
});

test('Stop and replacement remove old timer work while the next run keeps its own wait', async ({
  page,
}) => {
  await observeWaits(page);
  await page.locator('#source').fill('10 WAIT 1234\n20 PRINT "stale"');
  await page.locator('#run').click();
  await waitForTimer(page, 1);
  await page.locator('#stop').click();
  expect(await page.evaluate(() => window.waitProbe.pending)).toEqual([]);
  await page.locator('#run').click();
  await waitForTimer(page, 2);
  await page.locator('#source').fill('10 WAIT 1234\n20 PRINT "fresh"');
  await page.locator('#run').click();
  await waitForTimer(page, 3);
  expect(await page.evaluate(() => window.waitProbe.pending.length)).toBe(1);
  expect(
    await page.evaluate(() => window.waitProbe.timers.map((timer) => timer.cancelled)),
  ).toEqual([true, true, false]);
  await page.evaluate(() => window.waitProbe.releaseNext());
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('fresh\n');
  expect(await page.evaluate(() => window.waitProbe.pending)).toEqual([]);
});

test('fractional waits round up and oversized waits fail at their source without timer overflow', async ({
  page,
}) => {
  await observeWaits(page, [1, 2147483647]);
  await page.locator('#source').fill('10 WAIT .1\n20 WAIT 2147483647\n30 PRINT "too early"');
  await page.locator('#run').click();
  await waitForTimer(page, 1);
  expect(await page.evaluate(() => window.waitProbe.timers[0].delay)).toBe(1);
  await page.evaluate(() => window.waitProbe.releaseNext());
  await waitForTimer(page, 2);
  expect(await page.evaluate(() => window.waitProbe.timers[1].delay)).toBe(2147483647);
  await expect(page.locator('#console-output')).toBeEmpty();
  await page.locator('#stop').click();
  await page.locator('#source').fill('10 REM oversized\n20 WAIT 2147483648');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 20');
  expect(await page.evaluate(() => window.waitProbe.timers.length)).toBe(2);
  expect(await page.evaluate(() => window.waitProbe.pending)).toEqual([]);
});

test('the actual bouncing ball moves, reverses at both bounds, exports intact, and reruns cleanly', async ({
  page,
}) => {
  await observeWaits(page, [16]);
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#example').selectOption('bounce');
  await page.locator('#run').click();
  await waitForTimer(page, 1);
  const initial = await page.evaluate(() => window.waitProbe.frames.at(-1)!.bounds);
  expect(initial).not.toBeNull();
  const animation = await page.evaluate(async () => {
    const {waitProbe: probe} = window;
    const firstFrame = probe.timers[0].frameCount - 1;
    const observed: NonNullable<Frame['bounds']>[] = [];
    for (let frame = 0; frame < 200; frame++) {
      probe.releaseNext();
      for (let turn = 0; turn < 1000 && probe.pending.length === 0; turn++) {
        await Promise.resolve();
        // The ordinary instruction-batch scheduler also needs a host task;
        // its zero-delay timer is deliberately not held in this test.
        if (turn % 50 === 49) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (probe.pending.length !== 1) throw new Error('Animation did not schedule its next frame');
      const bounds = probe.frames.at(-1)!.bounds;
      if (!bounds) throw new Error('Animation presented an empty frame');
      observed.push(bounds);
    }
    return {bounds: observed, frames: probe.frames.slice(firstFrame)};
  });
  const {bounds} = animation;
  expect(animation.frames.every((frame) => frame.bounds !== null)).toBe(true);
  const horizontal = bounds.map((frame) => (frame.left + frame.right) / 2);
  const vertical = bounds.map((frame) => (frame.top + frame.bottom) / 2);
  for (const frame of bounds) {
    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.right).toBeLessThan(320);
    expect(frame.top).toBeGreaterThanOrEqual(0);
    expect(frame.bottom).toBeLessThan(200);
    expect(frame.right - frame.left).toBe(12);
    expect(frame.bottom - frame.top).toBe(12);
  }
  for (const centers of [horizontal, vertical]) {
    const differences = centers.slice(1).map((center, index) => center - centers[index]);
    expect(differences.some((difference) => difference > 0)).toBe(true);
    expect(differences.some((difference) => difference < 0)).toBe(true);
  }
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  expect(await page.evaluate(() => window.waitProbe.pending)).toEqual([]);
  await page.locator('#run').click();
  await waitForTimer(page, 202);
  expect(await page.evaluate(() => window.waitProbe.frames.at(-1)!.bounds)).toEqual(initial);
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const file = await downloaded;
  expect(await readFile(await file.path(), 'utf8')).toBe(
    await readFile(new URL('../../examples/bounce.bas', import.meta.url), 'utf8'),
  );
  await page.locator('#stop').click();
  expect(await page.evaluate(() => window.waitProbe.pending)).toEqual([]);
});

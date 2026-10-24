import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function pixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.locator('#graphics').evaluate(
    (element, point) => {
      const canvas = element as HTMLCanvasElement;
      return Array.from(canvas.getContext('2d')!.getImageData(point.x, point.y, 1, 1).data);
    },
    {x, y},
  );
}
async function run(page: Page, source: string): Promise<void> {
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
}
const black = [0, 0, 0, 255];
const red = [255, 85, 85, 255];
test.beforeEach(async ({page}) => {
  await page.goto('/');
});

test('the actual picture example renders each primitive and downloads intact', async ({page}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#example').selectOption('picture');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await pixel(page, 258, 20)).toEqual([255, 255, 85, 255]);
  expect(await pixel(page, 258, 42)).toEqual(black);
  expect(await pixel(page, 0, 170)).toEqual([85, 255, 85, 255]);
  expect(await pixel(page, 80, 95)).toEqual(red);
  expect(await pixel(page, 95, 95)).toEqual([170, 170, 170, 255]);
  expect(await pixel(page, 160, 105)).toEqual([85, 85, 255, 255]);
  expect(await pixel(page, 160, 116)).toEqual([255, 255, 255, 255]);
  const pending = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const file = await pending;
  expect(await readFile(await file.path(), 'utf8')).toBe(
    await readFile(new URL('../../examples/picture.bas', import.meta.url), 'utf8'),
  );
});

test('rounding, clipping, and enormous offscreen geometry use logical pixels', async ({page}) => {
  await run(
    page,
    '10 COLOR 12\n20 PSET -.5,.49\n30 PSET 319.49,199.49\n40 LINE -4,10,4,10\n50 CIRCLE 0,0,2\n60 CIRCLE 9007199254740991,100,9007199254740991',
  );
  expect(await pixel(page, 0, 0)).toEqual(red);
  expect(await pixel(page, 319, 199)).toEqual(red);
  expect(await pixel(page, 4, 10)).toEqual(red);
  expect(await pixel(page, 5, 10)).toEqual(black);
  expect(await pixel(page, 2, 0)).toEqual(red);
  expect(await pixel(page, 0, 100)).toEqual(red);
  expect(await pixel(page, 1, 100)).toEqual(black);
  await page.setViewportSize({width: 390, height: 844});
  const dimensions = await page.locator('#graphics').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const bounds = canvas.getBoundingClientRect();
    return {width: canvas.width, height: canvas.height, ratio: bounds.width / bounds.height};
  });
  expect(dimensions).toMatchObject({width: 320, height: 200});
  expect(dimensions.ratio).toBeCloseTo(1.6, 2);
  expect(await pixel(page, 319, 199)).toEqual(red);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('CLS clears both surfaces, retains the pen, and reruns reset pen and pixels', async ({
  page,
}) => {
  await run(page, '10 COLOR 12\n20 PSET 1,1\n30 PRINT "old"\n40 CLS\n50 PSET 2,2\n60 PRINT "new"');
  expect(await pixel(page, 1, 1)).toEqual(black);
  expect(await pixel(page, 2, 2)).toEqual(red);
  await expect(page.locator('#console-output')).toHaveText('new\n');
  await run(page, '10 PSET 3,3');
  expect(await pixel(page, 2, 2)).toEqual(black);
  expect(await pixel(page, 3, 3)).toEqual([170, 170, 170, 255]);
  await page.locator('#source').fill('10 COLOR 16\n20 PSET 1,1');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('BASIC line 10');
  await expect(page.locator('#diagnostic')).toContainText('COLOR requires an integer');
  expect(await pixel(page, 3, 3)).toEqual(black);
});

test('Step presents complete drawing and clearing operations while retaining color', async ({
  page,
}) => {
  await page.locator('#source').fill('10 COLOR 12\n20 PSET 2,2\n30 CLS\n40 PSET 3,3\n50 END');
  for (const next of [20, 30, 40]) {
    await page.locator('#step').click();
    await expect(page.locator('#status')).toHaveText('Paused');
    await expect(page.locator('#next-line')).toContainText(`Next: BASIC line ${next} `);
    expect(await pixel(page, 2, 2)).toEqual(next === 30 ? red : black);
  }
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await pixel(page, 3, 3)).toEqual(red);
});

test('a loop drawing huge clipped circles remains stoppable and can restart', async ({page}) => {
  await page
    .locator('#source')
    .fill('10 COLOR 12\n20 CIRCLE 9007199254740991,100,9007199254740991\n30 GOTO 20');
  await page.locator('#run').click();
  await expect.poll(() => pixel(page, 0, 100)).toEqual(red);
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await run(page, '10 COLOR 10\n20 PSET 20,20');
  expect(await pixel(page, 0, 100)).toEqual(black);
  expect(await pixel(page, 20, 20)).toEqual([85, 255, 85, 255]);
});

test('a missing Canvas context leaves text usable and reports unsupported drawing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.reload();
  await expect(page.locator('#graphics-unavailable')).toBeVisible();
  await run(page, '10 PRINT "text still works"');
  await expect(page.locator('#console-output')).toHaveText('text still works\n');
  await page.locator('#source').fill('10 PSET 1,1');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText(
    'Graphics are not supported by this host',
  );
});

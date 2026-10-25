import {expect, test} from '@playwright/test';

test('the static distribution runs without checkout files, backend routes or remote assets', async ({
  page,
  request,
  baseURL,
}) => {
  const requests: string[] = [];
  page.on('request', (event) => requests.push(event.url()));
  await page.goto('/');
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('Static artifact');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#console-output')).toHaveText(
    'Static artifact\nHello, Static artifact!\n',
  );
  await expect(page.locator('#status')).toHaveText('Finished');
  const origin = new URL(baseURL!).origin;
  for (const url of requests) {
    expect(new URL(url).origin).toBe(origin);
    expect(['/', '/app.js', '/styles.css']).toContain(new URL(url).pathname);
  }
  for (const path of ['/index.html', '/app.js', '/app.js.map', '/styles.css']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  }
  for (const path of ['/src/index.ts', '/examples/pong.bas', '/package.json', '/api/run'])
    expect((await request.get(path)).status()).toBe(404);
});

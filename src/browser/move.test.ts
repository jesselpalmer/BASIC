import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {BrowserSession} from './session.ts';
import type {GraphicsCommand} from '../core/types.ts';

async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Expected marker frame did not occur');
}

test('the actual marker program moves in all four directions and clamps the whole outline inside the surface', async () => {
  const source = await readFile(new URL('../../examples/move.bas', import.meta.url), 'utf8');
  const circles: Extract<GraphicsCommand, {kind: 'circle'}>[] = [];
  const releases: (() => void)[] = [];
  let forward = true;
  const session = new BrowserSession(
    {
      write: () => {},
      clear: () => {},
      requestInput: () => {},
      stateChanged: () => {},
      draw(command) {
        if (command.kind === 'circle') circles.push(command);
      },
      keyDown: (key) =>
        forward ? key === 'RIGHT' || key === 'DOWN' : key === 'LEFT' || key === 'UP',
    },
    {
      scheduler: () => Promise.resolve(),
      wait: (milliseconds) => {
        expect(milliseconds).toBe(16);
        return new Promise<void>((resolve) => releases.push(resolve));
      },
    },
  );
  const run = session.run(source);
  await until(() => releases.length === 1);
  expect(circles[0]).toEqual({kind: 'circle', x: 160, y: 100, radius: 4, color: 14});
  for (let frame = 0; frame < 240; frame++) {
    if (frame === 120) forward = false;
    releases[frame]();
    await until(() => releases.length === frame + 2);
    const circle = circles.at(-1)!;
    expect(circle.x).toBeGreaterThanOrEqual(4);
    expect(circle.x).toBeLessThanOrEqual(315);
    expect(circle.y).toBeGreaterThanOrEqual(4);
    expect(circle.y).toBeLessThanOrEqual(195);
    if (frame === 119) expect(circle).toMatchObject({x: 315, y: 195});
  }
  expect(circles.at(-1)).toMatchObject({x: 4, y: 4});
  session.stop();
  expect((await run).status).toBe('stopped');
});

import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {BrowserSession, type BrowserView} from './session.ts';
import type {GraphicsCommand} from '../core/types.ts';

async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Expected WAIT boundary did not occur');
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected browser run to reject');
}

function fixture(present = true) {
  const events: string[] = [];
  const output: string[] = [];
  const requests: ((text: string) => boolean)[] = [];
  const waits: {
    milliseconds: number;
    signal: AbortSignal;
    resolve: () => void;
    reject: (error: unknown) => void;
  }[] = [];
  const view: BrowserView = {
    write: (text) => output.push(text),
    clear: () => {
      output.length = 0;
    },
    draw: () => events.push('draw'),
    requestInput: (_prompt, submit) => requests.push(submit),
    stateChanged: () => {},
    ...(present
      ? {
          present() {
            expect(this).toBe(view);
            events.push('present');
          },
        }
      : {}),
  };
  const session = new BrowserSession(view, {
    scheduler: () => Promise.resolve(),
    wait: (milliseconds, {signal} = {}) => {
      events.push('wait');
      return new Promise<void>((resolve, reject) => {
        waits.push({milliseconds, signal: signal!, resolve, reject});
      });
    },
  });
  return {session, view, events, output, waits, requests};
}

test('WAIT presents the complete view before starting timing without requesting input', async () => {
  for (const present of [true, false]) {
    const ui = fixture(present);
    const run = ui.session.run('10 PSET 1,2\n20 PRINT "frame"\n30 WAIT .5\n40 PRINT "done"');
    await until(() => ui.waits.length === 1);
    expect(ui.events).toEqual(present ? ['draw', 'present', 'wait'] : ['draw', 'wait']);
    expect(ui.output).toEqual(['frame\n']);
    expect(ui.requests).toEqual([]);
    expect(ui.session.state).toMatchObject({
      status: 'running',
      currentLocation: {label: 30},
      nextLocation: null,
    });
    expect(ui.waits[0].milliseconds).toBe(1);
    ui.waits[0].resolve();
    expect((await run).status).toBe('finished');
    expect(ui.output).toEqual(['frame\n', 'done\n']);
  }
});

test('a WAIT step completes once, then INPUT retains its own step and retry', async () => {
  const ui = fixture();
  const run = ui.session.run('10 WAIT 20\n20 INPUT N\n30 PRINT N', {paused: true});
  ui.session.step();
  await until(() => ui.waits.length === 1);
  expect(ui.session.state).toMatchObject({status: 'running', isPaused: true});
  ui.session.step();
  expect(ui.waits).toHaveLength(1);
  ui.waits[0].resolve();
  await until(() => ui.session.state.status === 'paused');
  expect(ui.session.state.nextLocation?.label).toBe(20);
  expect(ui.requests).toHaveLength(0);
  ui.session.step();
  await until(() => ui.requests.length === 1);
  ui.requests[0]('bad');
  await until(() => ui.requests.length === 2);
  expect(ui.session.state.status).toBe('waiting');
  ui.requests[1]('9');
  await until(() => ui.session.state.status === 'paused');
  expect(ui.session.state.nextLocation?.label).toBe(30);
  ui.session.resume();
  expect((await run).status).toBe('finished');
  expect(ui.output.at(-1)).toBe('9\n');
});

test('pause, step completion and Continue preserve an in-flight WAIT without restarting its timer', async () => {
  for (const command of ['pause', 'step', 'resume'] as const) {
    const ui = fixture();
    const run = ui.session.run('10 WAIT 20\n20 PRINT "after"');
    await until(() => ui.waits.length === 1);
    expect(ui.session.pause().status).toBe('paused');
    if (command !== 'pause') ui.session[command]();
    expect(ui.waits[0].signal.aborted).toBe(false);
    ui.waits[0].resolve();
    if (command !== 'resume') {
      await until(
        () => ui.session.state.status === 'paused' && ui.session.state.nextLocation?.label === 20,
      );
      expect(ui.output).toEqual([]);
      ui.session.resume();
    }
    expect((await run).status).toBe('finished');
    expect(ui.waits).toHaveLength(1);
    expect(ui.output).toEqual(['after\n']);
  }
});

test('Stop and replacement settle WAIT even if timing ignores abort, including late failures', async () => {
  for (const stop of [true, false]) {
    for (const reject of [true, false]) {
      const ui = fixture();
      const old = ui.session.run('10 WAIT 2147483647\n20 PRINT "stale"');
      await until(() => ui.waits.length === 1);
      if (stop) ui.session.stop();
      const next = ui.session.run('10 INPUT NAME$\n20 PRINT NAME$');
      expect(ui.waits[0].signal.aborted).toBe(true);
      expect((await old).status).toBe('stopped');
      if (reject) ui.waits[0].reject(new Error('late timer failure'));
      else ui.waits[0].resolve();
      await Promise.resolve();
      expect(ui.session.state.status).toBe('waiting');
      ui.requests[0]('replacement');
      expect((await next).status).toBe('finished');
      expect(ui.output).toEqual(['replacement\n']);
    }
  }
});

test('presentation errors preserve the original application failure and do not start timing', async () => {
  const ui = fixture();
  const error = new Error('Cannot present frame');
  ui.view.present = () => {
    throw error;
  };
  expect(await rejection(ui.session.run('10 WAIT 0'))).toBe(error);
  expect(ui.waits).toEqual([]);
  expect(ui.session.state.status).toBe('error');
  ui.view.present = () => {};
  expect((await ui.session.run('10 PRINT "recovered"')).status).toBe('finished');
  expect(ui.output).toEqual(['recovered\n']);
});

test('presentation callbacks have the same lifecycle reentrancy guard as drawing', async () => {
  const ui = fixture();
  ui.view.present = () => {
    for (const control of ['stop', 'pause', 'step', 'resume'] as const)
      expect(() => ui.session[control]()).toThrow('browser view callback');
  };
  const run = ui.session.run('10 WAIT 0');
  await until(() => ui.waits.length === 1);
  ui.waits[0].resolve();
  expect((await run).status).toBe('finished');
});

test('timer failures are source-located and invalid timing options reject', async () => {
  const ui = fixture();
  const run = ui.session.run('\n10 WAIT 20');
  await until(() => ui.waits.length === 1);
  ui.waits[0].reject(new Error('Timer unavailable'));
  expect(await run).toMatchObject({status: 'error', diagnostic: {label: 10, line: 2}});
  const invalid = new BrowserSession(ui.view, {wait: null} as unknown as ConstructorParameters<
    typeof BrowserSession
  >[1]);
  expect(await rejection(invalid.run('10 END'))).toMatchObject({
    message: 'wait must be a function',
  });
  expect(invalid.state.status).toBe('error');
});

test('the actual bouncing ball stays inside the canvas, reverses both axes and reruns fresh', async () => {
  const source = await readFile(new URL('../../examples/bounce.bas', import.meta.url), 'utf8');
  const ui = fixture();
  const circles: Extract<GraphicsCommand, {kind: 'circle'}>[] = [];
  ui.view.draw = (command) => {
    if (command.kind === 'circle') circles.push(command);
  };
  const run = ui.session.run(source);
  for (let frame = 0; frame < 240; frame++) {
    await until(() => ui.waits.length === frame + 1);
    const circle = circles[frame];
    expect(circle).toMatchObject({kind: 'circle', radius: 6, color: 14});
    expect(circle.x).toBeGreaterThanOrEqual(6);
    expect(circle.x).toBeLessThanOrEqual(313);
    expect(circle.y).toBeGreaterThanOrEqual(6);
    expect(circle.y).toBeLessThanOrEqual(193);
    expect(ui.waits[frame].milliseconds).toBe(16);
    if (frame < 239) ui.waits[frame].resolve();
  }
  expect(circles.slice(1).some((c, i) => c.x < circles[i].x)).toBe(true);
  expect(circles.slice(1).some((c, i) => c.y < circles[i].y)).toBe(true);
  expect(
    circles.slice(1).some((c, i) => c.x > circles[i].x && circles[i].x < circles[i - 1]?.x),
  ).toBe(true);
  expect(
    circles.slice(1).some((c, i) => c.y > circles[i].y && circles[i].y < circles[i - 1]?.y),
  ).toBe(true);
  ui.session.stop();
  expect((await run).status).toBe('stopped');
  expect(ui.waits.at(-1)!.signal.aborted).toBe(true);
  const next = ui.session.run(source);
  await until(() => circles.length === 241);
  expect(circles.at(-1)).toEqual({kind: 'circle', x: 160, y: 100, radius: 6, color: 14});
  ui.session.stop();
  expect((await next).status).toBe('stopped');
});

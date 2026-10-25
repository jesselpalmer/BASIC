import {afterEach, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {Basic, type BasicValue, type GraphicsCommand, type LogicalKey} from '../index.ts';

const source = readFileSync(new URL('../../examples/pong.bas', import.meta.url), 'utf8');
const fields = [
  'X',
  'Y',
  'DX',
  'DY',
  'PADDLE',
  'OPPONENT',
  'SCORE',
  'COMPUTERSCORE',
  'SERVING',
] as const;
type Frame = Record<(typeof fields)[number], number>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return {promise, resolve};
}

async function until(ready: () => boolean): Promise<void> {
  for (let turn = 0; turn < 1000; turn++) {
    if (ready()) return;
    await Promise.resolve();
  }
  throw new Error('Pong did not reach its next frame or INPUT boundary');
}

const runs: {basic: Basic; completion: Promise<unknown>}[] = [];
afterEach(async () => {
  for (const {basic, completion} of runs.splice(0)) {
    basic.cancel();
    await completion;
  }
});

function game(program = source, random = 0.41) {
  const frames: Frame[] = [];
  const waits: ReturnType<typeof deferred<void>>[] = [];
  const prompts: {prompt: string; answer: (value: string) => void}[] = [];
  const held = new Set<LogicalKey>();
  const commands: GraphicsCommand[] = [];
  const output: string[] = [];
  const durations: number[] = [];
  const basic = new Basic({
    random: () => random,
    write: (text) => output.push(text),
    clear: () => {
      output.length = 0;
      commands.length = 0;
    },
    draw: (command) => commands.push(command),
    keyDown: (key) => held.has(key),
    readLine(prompt = '') {
      // The embedding host releases game keys when INPUT takes ownership.
      held.clear();
      const input = deferred<string>();
      prompts.push({prompt, answer: input.resolve});
      return input.promise;
    },
    wait(milliseconds) {
      const values = new Map(basic.variables.map(({name, value}) => [name, value]));
      const frame = Object.fromEntries(
        fields.map((name) => {
          const value = values.get(name);
          if (typeof value !== 'number') throw new Error(`Missing numeric Pong variable ${name}`);
          return [name, value];
        }),
      ) as Frame;
      frames.push(frame);
      durations.push(milliseconds);
      const waiting = deferred<void>();
      waits.push(waiting);
      return waiting.promise;
    },
  });
  const completion = basic
    .runAsync(program, {
      instructionLimit: 500_000,
      scheduler: () => Promise.resolve(),
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
    });
  // Attach immediately so a failed assertion cannot leave an unhandled rejection.
  void completion.catch(() => {});
  runs.push({basic, completion});
  return {
    basic,
    frames,
    prompts,
    held,
    commands,
    output,
    durations,
    async start() {
      await until(() => prompts.length === 1);
      prompts[0].answer('');
      await until(() => frames.length === 1);
    },
    async tick(...keys: LogicalKey[]) {
      held.clear();
      for (const key of keys) held.add(key);
      const before = frames.length;
      const inputs = prompts.length;
      waits.at(-1)!.resolve();
      await until(() => frames.length > before || prompts.length > inputs);
    },
  };
}

function scenario(values: Partial<Frame>) {
  const state: Frame = {
    X: 160,
    Y: 100,
    DX: -4,
    DY: 2,
    PADDLE: 100,
    OPPONENT: 100,
    SCORE: 0,
    COMPUTERSCORE: 0,
    SERVING: 0,
    ...values,
  };
  // Seed scenarios with ordinary BASIC assignments, then enter the unchanged
  // collision block. Full match tests below execute the source without edits.
  const setup = Object.entries(state).map(
    ([name, value], index) => `${index + 1} LET ${name} = ${value}`,
  );
  const body = source.split('\n').filter((line) => !line.startsWith('10 REM'));
  return game([...setup, '10 GOTO 700', ...body].join('\n'));
}

test('Pong waits for Enter and Space, draws its real initial field, and clamps both paddle directions before serving', async () => {
  const play = game();
  await until(() => play.prompts.length === 1);
  expect(play.prompts[0].prompt).toBe('Press Enter to start? ');
  expect(play.frames).toEqual([]);
  await play.start();
  const initial = {
    X: 160,
    Y: 100,
    DX: -4,
    DY: -2,
    PADDLE: 100,
    OPPONENT: 100,
    SCORE: 0,
    COMPUTERSCORE: 0,
    SERVING: 1,
  };
  expect(play.frames[0]).toEqual(initial);
  expect(play.commands).toEqual([
    {kind: 'line', x1: 0, y1: 10, x2: 319, y2: 10, color: 7},
    {kind: 'line', x1: 0, y1: 190, x2: 319, y2: 190, color: 7},
    {kind: 'line', x1: 16, y1: 82, x2: 16, y2: 118, color: 10},
    {kind: 'line', x1: 303, y1: 82, x2: 303, y2: 118, color: 12},
    {kind: 'circle', x: 160, y: 100, radius: 3, color: 14},
  ]);
  for (let frame = 0; frame < 50; frame++) await play.tick('DOWN');
  expect(play.frames.at(-1)).toEqual({...initial, PADDLE: 172});
  for (let frame = 0; frame < 50; frame++) await play.tick('UP');
  expect(play.frames.at(-1)).toEqual({...initial, PADDLE: 28});
  await play.tick('UP', 'DOWN');
  expect(play.frames.at(-1)).toEqual({...initial, PADDLE: 28});
  await play.tick('SPACE');
  expect(play.frames.at(-1)).toMatchObject({X: 156, Y: 98, SERVING: 0});
  expect(play.durations.every((duration) => duration === 16)).toBe(true);
});

test.each([
  [
    {X: 21, Y: 14, DX: -4, DY: -3, PADDLE: 35},
    {X: 17, Y: 15, DX: -4, DY: 3},
  ],
  [
    {X: 21, Y: 14, DX: -4, DY: -3, PADDLE: 34.5},
    {X: 21, Y: 15, DX: 4, DY: -3},
  ],
  [
    {X: 21, Y: 186, DX: -4, DY: 3, PADDLE: 165},
    {X: 17, Y: 185, DX: -4, DY: -3},
  ],
  [
    {X: 21, Y: 186, DX: -4, DY: 3, PADDLE: 165.5},
    {X: 21, Y: 185, DX: 4, DY: 3},
  ],
  [
    {X: 298, Y: 14, DX: 4, DY: -3, OPPONENT: 35},
    {X: 302, Y: 15, DX: 4, DY: 3},
  ],
  [
    {X: 298, Y: 14, DX: 4, DY: -3, OPPONENT: 34.5},
    {X: 298, Y: 15, DX: -4, DY: 3},
  ],
  [
    {X: 298, Y: 186, DX: 4, DY: 3, OPPONENT: 165},
    {X: 302, Y: 185, DX: 4, DY: -3},
  ],
  [
    {X: 298, Y: 186, DX: 4, DY: 3, OPPONENT: 165.5},
    {X: 298, Y: 185, DX: -4, DY: -3},
  ],
] as const)(
  'wall-and-paddle crossings distinguish exact grazing contact from a corner miss: %j',
  async (state, expected) => {
    const play = scenario(state);
    await until(() => play.frames.length === 1);
    expect(play.frames[0]).toMatchObject({...expected, SCORE: 0, COMPUTERSCORE: 0});
  },
);

test.each([
  [{X: 21, Y: 100, DX: -4, DY: 0, PADDLE: 121}, 4],
  [{X: 21, Y: 100, DX: -4, DY: 0, PADDLE: 121.001}, -4],
  [{X: 298, Y: 100, DX: 4, DY: 0, OPPONENT: 121}, -4],
  [{X: 298, Y: 100, DX: 4, DY: 0, OPPONENT: 121.001}, 4],
] as const)(
  'paddle contact uses the full ball radius and catches a crossed plane without tunneling: %j',
  async (state, direction) => {
    const play = scenario(state);
    await until(() => play.frames.length === 1);
    expect(play.frames[0].DX).toBe(direction);
    expect(play.frames[0]).toMatchObject({SCORE: 0, COMPUTERSCORE: 0});
  },
);

test.each([
  [{X: 1, DX: -4}, 'COMPUTERSCORE'],
  [{X: 318, DX: 4}, 'SCORE'],
] as const)(
  'a fully departed ball awards exactly one point and creates a stopped new serve: %j',
  async (state, scored) => {
    const play = scenario(state);
    await until(() => play.frames.length === 1);
    expect(play.frames[0][scored]).toBe(0);
    await play.tick();
    expect(play.frames.at(-1)).toMatchObject({X: 160, Y: 100, SERVING: 1, [scored]: 1});
    for (let frame = 0; frame < 5; frame++) await play.tick();
    expect(play.frames.at(-1)).toMatchObject({X: 160, Y: 100, SERVING: 1, [scored]: 1});
  },
);

async function finishMatch(win: boolean, random: number, verticalServe: number) {
  const play = game(source, random);
  await play.start();
  for (let frame = 0; frame < 2500 && play.prompts.length === 1; frame++) {
    const state = play.frames.at(-1)!;
    const target = win ? Math.max(28, Math.min(172, state.Y - 17)) : 172;
    const keys: LogicalKey[] = ['SPACE'];
    if (state.PADDLE < target - 2) keys.push('DOWN');
    else if (state.PADDLE > target + 2) keys.push('UP');
    await play.tick(...keys);
  }
  for (const [index, state] of play.frames.entries()) {
    expect(state.PADDLE).toBeGreaterThanOrEqual(28);
    expect(state.PADDLE).toBeLessThanOrEqual(172);
    expect(state.OPPONENT).toBeGreaterThanOrEqual(28);
    expect(state.OPPONENT).toBeLessThanOrEqual(172);
    expect(state.Y).toBeGreaterThanOrEqual(13);
    expect(state.Y).toBeLessThanOrEqual(187);
    if (index === 0) continue;
    const previous = play.frames[index - 1];
    expect(Math.abs(state.OPPONENT - previous.OPPONENT)).toBeLessThanOrEqual(1);
    expect(state.SCORE - previous.SCORE).toBeGreaterThanOrEqual(0);
    expect(state.COMPUTERSCORE - previous.COMPUTERSCORE).toBeGreaterThanOrEqual(0);
    expect(
      state.SCORE + state.COMPUTERSCORE - previous.SCORE - previous.COMPUTERSCORE,
    ).toBeLessThanOrEqual(1);
  }
  expect(play.prompts).toHaveLength(2);
  expect(play.prompts[1].prompt).toBe('Press Enter to restart? ');
  expect(play.held.size).toBe(0);
  const values = new Map<string, BasicValue>(
    play.basic.variables.map(({name, value}) => [name, value]),
  );
  expect(values.get(win ? 'SCORE' : 'COMPUTERSCORE')).toBe(3);
  expect(Number(values.get(win ? 'COMPUTERSCORE' : 'SCORE'))).toBeLessThan(3);
  expect(play.output[0]).toBe(win ? 'YOU WIN!\n' : 'COMPUTER WINS\n');
  const count = play.frames.length;
  play.prompts[1].answer('');
  await until(() => play.frames.length === count + 1);
  expect(play.frames.at(-1)).toMatchObject({
    X: 160,
    Y: 100,
    DX: -4,
    DY: verticalServe,
    PADDLE: 100,
    OPPONENT: 100,
    SCORE: 0,
    COMPUTERSCORE: 0,
    SERVING: 1,
  });
  await play.tick();
  expect(play.frames.at(-1)).toMatchObject({
    X: 160,
    Y: 100,
    SERVING: 1,
    SCORE: 0,
    COMPUTERSCORE: 0,
  });
  expect(play.durations.every((duration) => duration === 16)).toBe(true);
}

test.each([
  [0, -2],
  [0.41, -2],
  [0.99, 3],
] as const)(
  'the unchanged BASIC game can be won and restarted with controlled randomness %s',
  async (random, verticalServe) => {
    await finishMatch(true, random, verticalServe);
  },
);
test('the unchanged BASIC game can be lost and restarted fresh', async () => {
  await finishMatch(false, 0.41, -2);
});

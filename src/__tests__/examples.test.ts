import {describe, expect, it, jest} from 'bun:test';
import {readFileSync} from 'node:fs';
import {Basic} from '../index.ts';

function example(filename: string) {
  return readFileSync(new URL(`../../examples/${filename}`, import.meta.url), 'utf8');
}

function scriptedHost(answers: string[]) {
  const remaining = [...answers];
  const transcript: string[] = [];
  const random = jest.fn(() => 0.41);
  const basic = new Basic({
    write(text) {
      transcript.push(text);
    },
    readLine(prompt) {
      transcript.push(prompt ?? '');
      return Promise.resolve(remaining.shift() ?? null);
    },
    random,
  });
  return {basic, transcript, remaining, random};
}

describe('runnable example files', () => {
  it('greets the supplied name without changing its spaces or case', async () => {
    const {basic, transcript, remaining} = scriptedHost(['  Ada LoveLace  ']);

    expect((await basic.runAsync(example('greeting.bas'))).status).toBe('halted');
    expect(transcript).toEqual(['What is your name? ', 'Hello,   Ada LoveLace  !\n']);
    expect(remaining).toEqual([]);
  });

  it('plays the guessing game and resets the attempt count when rerun', async () => {
    const {basic, transcript, remaining, random} = scriptedHost(['20', '80', '42', '42']);
    const prompt = 'Guess a number from 1 to 100? ';

    expect((await basic.runAsync(example('guess.bas'))).status).toBe('halted');
    expect(transcript).toEqual([
      prompt,
      'Too low.\n',
      prompt,
      'Too high.\n',
      prompt,
      'Correct in 3 tries!\n',
    ]);
    expect(random).toHaveBeenCalledTimes(1);

    transcript.length = 0;
    expect((await basic.runAsync()).status).toBe('halted');
    expect(transcript).toEqual([prompt, 'Correct in 1 tries!\n']);
    expect(random).toHaveBeenCalledTimes(2);
    expect(remaining).toEqual([]);
  });
});

import {describe, expect, it, jest} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runCli, type CliHost} from '../cli/run_cli.ts';
import constants from '../shared/constants.ts';

function scriptedHost(answers: string[]) {
  const remaining = [...answers];
  const output: string[] = [];
  const errors: string[] = [];
  const prompts: string[] = [];
  const random = jest.fn(() => 0.41);
  const close = jest.fn();
  const host: CliHost = {
    write: (text) => output.push(text),
    writeError: (text) => errors.push(text),
    readLine(prompt) {
      prompts.push(prompt ?? '');
      return Promise.resolve(remaining.shift() ?? null);
    },
    random,
    close,
    clear() {},
    discardEntry() {},
    setInterruptHandler() {},
  };
  return {host, output, errors, prompts, remaining, random, close};
}

const table = (number: number) =>
  Array.from({length: 10}, (_, i) => `${i + 1} x ${number} = ${(i + 1) * number}\n`);

const examples = [
  {
    filename: 'greeting.bas',
    answers: [['  Ada LoveLace  '], ['Grace']],
    output: [['Hello,   Ada LoveLace  !\n'], ['Hello, Grace!\n']],
    prompts: ['What is your name? ', 'What is your name? '],
    randomCalls: 0,
  },
  {
    filename: 'times-table.bas',
    answers: [['3'], ['5']],
    output: [table(3), table(5)],
    prompts: ['Which times table? ', 'Which times table? '],
    randomCalls: 0,
  },
  {
    filename: 'guess.bas',
    answers: [['20', '80', '42'], ['42']],
    output: [['Too low.\n', 'Too high.\n', 'Correct in 3 tries!\n'], ['Correct in 1 tries!\n']],
    prompts: Array<string>(4).fill('Guess a number from 1 to 100? '),
    randomCalls: 2,
  },
];

describe('MVP examples through file execution and interactive RUN', () => {
  for (const example of examples) {
    it(`${example.filename} produces the same results in both modes and on a fresh rerun`, async () => {
      const path = resolve(import.meta.dirname, '../../examples', example.filename);
      const source = readFileSync(path, 'utf8').trimEnd();
      const file = scriptedHost(example.answers.flat());
      for (const expected of example.output) {
        const start = file.output.length;
        expect(await runCli([path], {host: file.host})).toBe(0);
        expect(file.output.slice(start)).toEqual(expected);
      }
      expect(file.prompts).toEqual(example.prompts);
      expect(file.errors).toEqual([]);
      expect(file.remaining).toEqual([]);
      expect(file.random).toHaveBeenCalledTimes(example.randomCalls);
      expect(file.close).toHaveBeenCalledTimes(2);

      const interactive = scriptedHost([
        // Reverse entry order to exercise the editor's numeric ordering as well.
        ...source.split('\n').reverse(),
        'LIST',
        'RUN',
        ...example.answers[0],
        'RUN',
        ...example.answers[1],
        'EXIT',
        'yes',
      ]);
      expect(await runCli([], {host: interactive.host})).toBe(0);
      expect(interactive.output).toEqual([
        `${constants.Strings.Repl.WELCOME_MESSAGE}\n`,
        source + '\n',
        ...example.output.flat(),
        `${constants.Strings.Repl.EXIT_MESSAGE}\n`,
      ]);
      expect(
        interactive.prompts.filter(
          (prompt) =>
            prompt !== constants.Strings.Repl.PROMPT &&
            prompt !== 'Discard unsaved changes and exit? [y/N] ',
        ),
      ).toEqual(example.prompts);
      expect(interactive.errors).toEqual([]);
      expect(interactive.remaining).toEqual([]);
      expect(interactive.random).toHaveBeenCalledTimes(example.randomCalls);
      expect(interactive.close).toHaveBeenCalledTimes(1);
    }, 5000);
  }
});

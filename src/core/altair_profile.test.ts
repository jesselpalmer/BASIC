import assert from 'node:assert/strict';
import {expect, test} from 'bun:test';
import reference from '../../docs/life2-altair-reference.json' with {type: 'json'};
import {prepareProgram} from './prepared_program.ts';
import {Basic, parseProgram, validateProgram} from '../index.ts';
import {altairOptions} from '../../scripts/life2-acceptance.ts';

const {rules} = reference;
const supportedProbes = [
  rules.compactSource,
  rules.indexedInput,
  rules.inputIndexOrder,
  rules.inputPrintColumn,
  rules.printControls,
  rules.restartState,
  rules.restartPrintColumn,
];

for (const probe of supportedProbes) {
  for (const [name, scenario] of Object.entries(probe.cases)) {
    test(`replays Altair ${probe.source[0]} · ${name}`, async () => {
      const answers = [...scenario.answers];
      let output = '';
      const basic = new Basic(
        {
          write: (text) => {
            output += text;
          },
          readLine: (prompt) => {
            output += prompt;
            return Promise.resolve(answers.shift() ?? null);
          },
        },
        altairOptions,
      );
      expect((await basic.runAsync(probe.source.join('\n'), {instructionLimit: 100})).status).toBe(
        'halted',
      );
      expect(answers).toEqual([]);
      expect(output).toBe(scenario.output.join(''));
    });
  }
}

test('reports located Altair subscript errors after printing preceding items', () => {
  let output = '';
  const basic = new Basic(
    {
      write: (text) => {
        output += text;
      },
    },
    altairOptions,
  );
  expect(() => basic.run(rules.fractionalSubscripts.source.join('\n'))).toThrow();
  expect(output).toBe(' 1  2 ');
  expect(basic.state.diagnostic).toMatchObject({code: 'ALTAIR_FC', label: 20});
  expect(() => basic.run(rules.outOfBoundsSubscript.source.join('\n'))).toThrow();
  expect(basic.state.diagnostic).toMatchObject({code: 'ALTAIR_BS', label: 20});
});

test('rejects out-of-scope Altair forms before execution, including dead source', () => {
  for (const source of [
    rules.lateDimension.source.join('\n'),
    '10 DIM A(1)\n20 GOTO10',
    '10 END\n20 RUN 10',
    '10 END\n20 X$="A"',
    '10 END\n20 A=2^3',
    '10 END\n20 PRINT"X"A',
    '10 END\n20 PRINT"é"',
    '10 END\n20 PRINT USING "##",A',
    '10 END\n20 INPUT"A";A',
    '10 END\n20 PRINTCHR$(1,2)',
    '10 END\n20 A=RND(1)',
    '10 END\n20 ON A GOTO 10',
    '10 END\n20 IF A=0 THEN 10 ELSE 10',
  ])
    expect(() => parseProgram(source, altairOptions)).toThrow();
  expect(() => parseProgram('10 RUN')).toThrow(/Unsupported statement RUN/);
  const altair = parseProgram('10 RUN', altairOptions);
  const relabelled = {...altair.lines[0], dialect: 'native' as const};
  expect(() => validateProgram([relabelled])).toThrow(/Numbered RUN requires the Altair profile/);
  expect(() => prepareProgram('10 END', 'basic-plus-v4a12-ma2')).toThrow(/shared-driver/);
});

test('counts numbered RUN within the same debugger and instruction budget', async () => {
  const basic = new Basic({}, altairOptions);
  let steps = 0;
  await assert.rejects(
    basic.runAsync('10 RUN', {
      instructionLimit: 3,
      beforeStatement: () => {
        expect(basic.state.nextLocation?.label).toBe(10);
        steps++;
      },
    }),
  );
  expect(steps).toBe(3);
  expect(basic.state.diagnostic).toMatchObject({code: 'INSTRUCTION_LIMIT', label: 10});
});

test('cancellation prevents a late continuation from touching a fresh run', async () => {
  let answer!: (text: string) => void;
  let continuationReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    continuationReady = resolve;
  });
  const basic = new Basic(
    {
      readLine: (prompt) => {
        if (prompt === '? ') return Promise.resolve('4');
        expect(prompt).toBe('?? ');
        return new Promise<string>((resolve) => {
          answer = resolve;
          continuationReady();
        });
      },
    },
    altairOptions,
  );
  const old = basic.runAsync('10 INPUT A,B\n20 END');
  await ready;
  expect(basic.variables).toEqual([{name: 'A', value: 4}]);
  basic.cancel();
  basic.run('10 A=9\n20 END');
  answer('5');
  await assert.rejects(old, {name: 'AbortError'});
  expect(basic.variables).toEqual([{name: 'A', value: 9}]);
});

test('renders print controls within the bounded terminal width and character set', () => {
  let output = '';
  const basic = new Basic(
    {
      write: (text) => {
        output += text;
      },
    },
    altairOptions,
  );
  basic.run('10 PRINTTAB(80);CHR$(65);(2+3)\n20 END');
  expect(output).toBe(' '.repeat(80) + '\nA 5 \n');
  expect(() => basic.run('10 PRINTTAB(81)')).toThrow();
  expect(basic.state.diagnostic).toMatchObject({code: 'ALTAIR_FC', label: 10});
  expect(() => basic.run('10 PRINTCHR$(1)')).toThrow();
  expect(basic.state.diagnostic).toMatchObject({code: 'UNSUPPORTED_ALTAIR_CONTROL', label: 10});
});

test('bounds a host response before assigning Altair input', async () => {
  const basic = new Basic({readLine: () => Promise.resolve('1'.repeat(65_537))}, altairOptions);
  await assert.rejects(basic.runAsync('10 INPUT A'), /65536 response characters/);
  expect(basic.state.diagnostic).toMatchObject({code: 'INPUT_LIMIT', label: 10});
  expect(basic.variables).toEqual([]);
});

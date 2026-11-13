import {expect, test} from 'bun:test';
import reference from '../../docs/rsts-v4a-ma2-rng-reference.json' with {type: 'json'};
import Basic from './runtime.ts';
import {parseProgram} from '../parser/parser.ts';

const options = {dialect: 'basic-plus-v4a12-ma2'} as const;
const firstDraws = reference.scaledDefaultValues;

test('selected RND matches archived V4A on repeated fresh RUN and evaluates an optional argument', () => {
  const values: number[] = [];
  const basic = new Basic(
    {
      write: (text) => values.push(...text.trim().split(/\s+/).map(Number)),
      random: () => {
        throw new Error('Default stream must not read host entropy');
      },
    },
    options,
  );
  for (const draw of ['RND', 'RND(I-2)']) {
    const program = parseProgram(
      `10 FOR I=1 TO 12\n20 PRINT ${draw}*32768\n30 NEXT I\n40 END`,
      options,
    );
    expect(basic.run(program).status).toBe('halted');
    expect(basic.run().status).toBe('halted');
    expect(values.splice(0)).toEqual([...firstDraws, ...firstDraws]);
  }
  expect(() => basic.run('10 PRINT RND(1/0)\n20 END')).toThrow('MA2 numeric-event: 61');
  expect(values).toEqual([]);
});

test('selected RANDOMIZE adds one host word to the current state and forces it odd', () => {
  const values: number[] = [];
  const words = [1, 65535];
  const basic = new Basic(
    {
      write: (text) => values.push(...text.trim().split(/\s+/).map(Number)),
      random: () => words.shift()! / 65536,
    },
    options,
  );
  basic.run('10 RANDOMIZE\n20 PRINT RND*32768\n30 RANDOMIZE\n40 PRINT RND*32768\n50 END');
  expect(values).toEqual([23223, 13349]);
  expect(words).toEqual([]);
  for (const source of ['10 PRINT RND()', '10 PRINT RND(1,2)', '10 PRINT RND("BAD")']) {
    expect(() => basic.run(source)).toThrow();
  }
  expect(() => parseProgram('10 RANDOMIZE\n20 END')).toThrow();
});

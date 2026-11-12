import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';

import arithmeticReference from '../../docs/edusystem30-arithmetic-reference.json';
import sourceReference from '../../docs/edusystem30-literal-reference.json';
import inputReference from '../../docs/edusystem30-input-reference.json';
import {Basic, BasicRuntimeError, createHost, parseLine} from '../index.ts';
import {createEduSystem30Evaluator} from './evaluator.ts';
import {
  compareEduSystem30,
  eduSystem30Absolute,
  eduSystem30FromNumber,
  eduSystem30Integer,
  evaluateEduSystem30Arithmetic,
  observeEduSystem30,
  parseEduSystem30Input,
  parseEduSystem30SourceLiteral,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';

function words({significand, exponent}: EduSystem30FloatingValue): string[] {
  return [BigInt(exponent), significand >> 12n, significand].map((value) =>
    (value & 0o7777n).toString(8).padStart(4, '0'),
  );
}

test('EDUSYSTEM-30 decimal INPUT matches the archived stored words', () => {
  const observations = inputReference.inputProbe.observations;
  expect(observations).toHaveLength(66);
  for (const observation of observations)
    expect(words(parseEduSystem30Input(observation.input))).toEqual(observation.wordsOctal);
});

test('EDUSYSTEM-30 source literals match the archived compiled words', () => {
  expect(sourceReference.accepted).toHaveLength(30);
  for (const {source, wordsOctal} of sourceReference.accepted)
    expect(words(parseEduSystem30SourceLiteral(source))).toEqual(wordsOctal);
});

test('EDUSYSTEM-30 converts inputs and computes exact archived scalar operations', () => {
  const {observations, alignmentObservations} = arithmeticReference.arithmeticProbe;
  expect(observations).toHaveLength(57);
  expect(alignmentObservations).toHaveLength(5);
  for (const {inputs, scalarWordsOctal: stored} of [...observations, ...alignmentObservations]) {
    const [a, p] = inputs.map(parseEduSystem30Input);
    expect(words(a)).toEqual(stored.A);
    expect(words(p)).toEqual(stored.P);
    for (const [operator, output] of [
      ['+', stored.F],
      ['-', stored.C],
      ['*', stored.N],
      ['/', stored.G],
    ] as const)
      expect(words(evaluateEduSystem30Arithmetic(operator, p, a))).toEqual(output);
  }
});

test('EDUSYSTEM-30 conformance rejects incomplete fields and unsupported exponent range', () => {
  for (const text of ['.', '+', '1x', '1e-', '1\n'])
    expect(() => parseEduSystem30Input(text)).toThrow(SyntaxError);
  for (const text of ['1e2048', '1e-2049', '1e617', '1e-617'])
    expect(() => parseEduSystem30Input(text)).toThrow(RangeError);
  expect(() =>
    evaluateEduSystem30Arithmetic('/', parseEduSystem30Input('1'), parseEduSystem30Input('0')),
  ).toThrow('Cannot divide by zero');
});

test('EDUSYSTEM-30 numeric boundary preserves exactly representable host values', () => {
  for (const input of [0, 0.5, -1.5, 4095 / 4096, 2 ** 1000, Number.MIN_VALUE]) {
    expect(observeEduSystem30(eduSystem30FromNumber(input))).toBe(input);
  }
  expect(observeEduSystem30(eduSystem30FromNumber(1 + 2 ** -23))).toBe(1);
  expect(observeEduSystem30(eduSystem30FromNumber(-1 - 2 ** -23))).toBe(-1);
  expect(eduSystem30FromNumber(-0)).toEqual(eduSystem30FromNumber(0));
  expect(() => eduSystem30FromNumber(Infinity)).toThrow(RangeError);
});

test('EDUSYSTEM-30 scalar comparison and integer operations use stored values', () => {
  const tiny = parseEduSystem30Input('1e-400');
  const zero = parseEduSystem30Input('0');
  const negative = parseEduSystem30Input('-1.5');
  const wide = parseEduSystem30Input('1e20');
  expect(observeEduSystem30(tiny)).toBe(0);
  expect(compareEduSystem30(tiny, zero)).toBe(1);
  expect(compareEduSystem30(negative, tiny)).toBe(-1);
  expect(compareEduSystem30(eduSystem30Absolute(negative), eduSystem30FromNumber(1.5))).toBe(0);
  expect(eduSystem30Absolute(tiny)).toBe(tiny);
  expect(eduSystem30Integer(tiny)).toEqual(zero);
  expect(eduSystem30Integer(negative)).toEqual(eduSystem30FromNumber(-2));
  expect(eduSystem30Integer(wide)).toBe(wide);
});

test('EDUSYSTEM-30 runtime reports overflowing arithmetic before writing a PRINT field', async () => {
  const writes: string[] = [];
  const basic = new Basic(
    {readLine: () => Promise.resolve('1e300'), write: (text) => writes.push(text)},
    {dialect: 'edusystem-30'},
  );
  try {
    await basic.runAsync('10 INPUT A\n20 PRINT "VALUE";A*A*A\n30 END');
    throw new Error('Expected arithmetic overflow');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe('NON_FINITE_NUMBER');
    expect(error.diagnostic.label).toBe(20);
    expect(writes).toEqual([]);
  }
});

test('EDUSYSTEM-30 evaluator guards syntax reserved for native expressions', () => {
  const {evaluator} = createEduSystem30Evaluator(createHost({}));
  const assignment = parseLine('10 LET X=2+3')?.statement;
  if (assignment?.type !== 'LetStatement' || assignment.expression.type !== 'BinaryExpression')
    throw new Error('Expected a binary assignment');
  const expression = {...assignment.expression, operator: '%'};
  expect(() => evaluator.evaluateNumber(expression)).toThrow(
    'EDUSYSTEM-30 binary operator escaped admission',
  );
});

test('EDUSYSTEM-30 locates overflow in numeric PRINT before writing', async () => {
  const answers = ['1024', '127.9999'];
  const writes: string[] = [];
  const basic = new Basic(
    {readLine: () => Promise.resolve(answers.shift() ?? null), write: (text) => writes.push(text)},
    {dialect: 'edusystem-30'},
  );
  await assert.rejects(
    basic.runAsync(`10 INPUT A\n20 INPUT B\n30 PRINT ${'A*'.repeat(204)}B\n40 END`),
    (error) =>
      error instanceof BasicRuntimeError &&
      error.diagnostic.code === 'NON_FINITE_NUMBER' &&
      error.diagnostic.label === 30,
  );
  expect(writes).toEqual([]);
});

test('EDUSYSTEM-30 advances its loop count separately from the visible scalar', async () => {
  let output = '';
  const basic = new Basic(
    {readLine: () => Promise.resolve('8388608'), write: (text) => (output += text)},
    {dialect: 'edusystem-30'},
  );
  await basic.runAsync(
    `10 INPUT A
20 B=A+2
30 FOR I=A TO B
40 D=I-A
41 PRINT D
45 J=J+1
50 IF J=4 THEN 70
60 NEXT I
70 PRINT J
80 END`,
    {instructionLimit: 50},
  );
  expect(output).toBe(' 0 \n 0 \n 0 \n 3 \n');

  output = '';
  basic.run('10 FOR I=1 TO 3\n20 PRINT I\n30 I=I+1\n40 NEXT I\n50 PRINT I\n60 END');
  expect(output).toBe(' 1 \n 3 \n 5 \n 6 \n');
});

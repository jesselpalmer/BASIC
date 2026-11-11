import assert from 'node:assert/strict';
import {expect, test} from 'bun:test';
import reference from '../../docs/edusystem30-roots-reference.json';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseProgram} from '../index.ts';
import {eduSystem30FromNumber, type EduSystem30FloatingValue} from './edusystem30_floating.ts';

const options = {dialect: 'edusystem-30'} as const;

function words({exponent, significand}: EduSystem30FloatingValue): string[] {
  return [BigInt(exponent), significand >> 12n, significand].map((word) =>
    (word & 0o7777n).toString(8).padStart(4, '0'),
  );
}

async function run(source: string, input: string, resultName: string) {
  let output = '';
  const basic = new Basic(
    {readLine: () => Promise.resolve(input), write: (text) => (output += text)},
    options,
  );
  await basic.runAsync(source);
  const result = basic.variables.find(({name}) => name === resultName)?.value;
  assert(typeof result === 'number');
  return {output, result: words(eduSystem30FromNumber(result))};
}

test('EDUSYSTEM-30 SQR matches the archive at stored word precision', async () => {
  for (const sample of reference.squareRoot.observations) {
    if (sample.input.startsWith('-')) continue;
    expect(await run('10 INPUT A\n20 P=SQR(A)\n30 PRINT P\n40 END', sample.input, 'P')).toEqual({
      output: sample.output,
      result: sample.words.P,
    });
  }
});

test('EDUSYSTEM-30 bounded ^ matches the archive at stored word precision', async () => {
  for (const sample of reference.power.observations) {
    const [input, exponent] = sample.input.split(',');
    expect(await run(`10 INPUT A\n20 C=A^${exponent}\n30 PRINT C\n40 END`, input, 'C')).toEqual({
      output: sample.output,
      result: sample.words.C,
    });
  }
});

test('EDUSYSTEM-30 SQR reports a source-located domain error before printing', () => {
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, options);
  assert.throws(
    () => basic.run('10 PRINT "VALUE";SQR(-4)\n20 END'),
    (error) =>
      error instanceof BasicRuntimeError &&
      error.diagnostic.code === 'NUMERIC_DOMAIN' &&
      error.diagnostic.label === 10,
  );
  expect(writes).toEqual([]);
});

test('EDUSYSTEM-30 rejects unadmitted powers and SQR arities at preparation', () => {
  for (const expression of ['2^A', '2^.5', '2^6', 'SQR()', 'SQR(1,2)']) {
    expect(() => parseProgram(`10 END\n20 PRINT ${expression}\n30 END`, options)).toThrow(
      BasicSyntaxError,
    );
  }
});

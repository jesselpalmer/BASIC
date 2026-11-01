import {describe, expect, it} from 'bun:test';
import {Basic, BasicRuntimeError, parseProgram} from '../index.ts';
import {formatPrintUsing} from './print_using.ts';
import type {BasicValue, Location} from './types.ts';

const location: Location = {
  label: 10,
  start: {line: 1, column: 16, offset: 15},
  end: {line: 1, column: 22, offset: 21},
};
const format = (image: string, values: readonly BasicValue[]) =>
  formatPrintUsing(image, values, location);

function failure(image: string, values: readonly BasicValue[], code: string) {
  try {
    format(image, values);
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic).toMatchObject({code, label: 10, line: 1, column: 16, offset: 15});
    return;
  }
  throw new Error('Expected formatting failure');
}

describe('native PRINT USING trailing minus', () => {
  it.each([
    ['###-', -12, ' 12-'],
    ['###-', 12, ' 12 '],
    ['#-', -9, '9-'],
    ['#-', 9, '9 '],
    ['#-', 0, '0 '],
    ['#-', -0, '0 '],
    ['**#-', -12, '*12-'],
    ['**#-', 12, '*12 '],
    ['**#-', -123, '123-'],
    ['**#-', 123, '123 '],
    ['**#-', -0, '**0 '],
    ['**###-', -27, '***27-'],
    ['################-', Number.MAX_SAFE_INTEGER, '9007199254740991 '],
    ['################-', -Number.MAX_SAFE_INTEGER, '9007199254740991-'],
  ] as const)('places the sign in its own final column', (image, value, expected) => {
    expect(format(image, [value])).toBe(expected);
    expect(expected.length).toBe(image.length);
  });

  it('mixes signed, asterisk, ordinary integer and string fields in order', () => {
    expect(format('A=###-;B=**#-;C=###;S=!', [-12, -12, -12, 'Zed'])).toBe(
      'A= 12-;B=*12-;C=-12;S=Z',
    );
    expect(format('#-#-!', [-1, 2, 'A'])).toBe('1-2 A');
    expect(format('**#-**#', [-12, 1])).toBe('*12-**1');
    expect(format('##-', Object.freeze([1]))).toBe(' 1 ');
  });

  it.each(['-', '-##', '##--', '## -', '##-+', '##-\n', '**#--', '!-', '**-#'])(
    'rejects unsupported or misplaced sign form %j',
    (image) => failure(image, [1], 'UNSUPPORTED_FORMAT'),
  );

  it('reserves the suffix for the sign rather than extra digits', () => {
    failure('#-', [12], 'FORMAT_OVERFLOW');
    failure('#-', [-12], 'FORMAT_OVERFLOW');
    failure('**#-', [1234], 'FORMAT_OVERFLOW');
    failure('**#-', [-1234], 'FORMAT_OVERFLOW');
    failure('**#', [-12], 'UNSUPPORTED_FORMAT_VALUE');
    failure('###-', ['12'], 'TYPE_MISMATCH');
    failure('###-', [1.5], 'UNSUPPORTED_FORMAT_VALUE');
    failure('###-', [Infinity], 'UNSUPPORTED_FORMAT_VALUE');
    failure('###-', [Number.MAX_SAFE_INTEGER + 1], 'UNSUPPORTED_FORMAT_VALUE');
    failure('###-', [], 'FORMAT_VALUE_COUNT');
    failure('###-', [1, 2], 'FORMAT_VALUE_COUNT');
  });

  it('keeps the exact image/output bounds with suffixes', () => {
    expect(format('#'.repeat(4095) + '-', [-1])).toBe(' '.repeat(4094) + '1-');
    expect(format('#-'.repeat(2048), Array<number>(2048).fill(0))).toBe('0 '.repeat(2048));
    failure('#'.repeat(4096) + '-', [-1], 'FORMAT_LIMIT');
  });

  it('preserves left-to-right effects and one atomic write with recovery', () => {
    const trace: string[] = [];
    const basic = new Basic({
      write: (t) => trace.push(t),
      random: () => {
        trace.push('random');
        return 0.5;
      },
    });
    basic.run('10 PRINT USING "**#-|#-",-INT(RND()*10),2;\n20 PRINT "end"');
    expect(trace).toEqual(['random', '**5-|2 ', 'end\n']);
    trace.length = 0;
    expect(() => basic.run('10 PRINT USING "**#-|#-",-INT(RND()*10),12')).toThrow(
      BasicRuntimeError,
    );
    expect(trace).toEqual(['random']);
    expect(basic.status).toBe('error');
    basic.run('10 PRINT USING "##-",-12');
    expect(trace.at(-1)).toBe('12-\n');
  });

  it('uses one real statement per Step and preserves a valid fresh rerun', async () => {
    const writes: string[] = [];
    const basic = new Basic({write: (t) => writes.push(t)});
    const program = parseProgram('10 PRINT USING "##-",12\n20 PRINT USING "**#-",-12');
    basic.reset(program);
    const step = basic.step();
    expect(writes).toEqual(['12 \n']);
    expect(step.currentLocation?.label).toBe(10);
    expect(step.nextLocation?.label).toBe(20);
    basic.step();
    expect(writes).toEqual(['12 \n', '*12-\n']);
    await basic.runAsync();
    expect(writes).toEqual(['12 \n', '*12-\n', '12 \n', '*12-\n']);
    expect(program.lines[0].source).toBe('10 PRINT USING "##-",12');
  });
});

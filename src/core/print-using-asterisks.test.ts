import {describe, expect, it} from 'bun:test';
import assert from 'node:assert/strict';
import {Basic, BasicRuntimeError, parseProgram} from '../index.ts';
import {formatPrintUsing} from './print_using.ts';
import type {Location} from './types.ts';

const location: Location = {
  label: 10,
  start: {line: 1, column: 16, offset: 15},
  end: {line: 1, column: 23, offset: 22},
};
const format = (image: string, values: readonly (number | string)[]) =>
  formatPrintUsing(image, values, location);

function failure(image: string, values: readonly (number | string)[], code: string) {
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

describe('native PRINT USING asterisk-filled integers', () => {
  it.each([
    ['**#', 0, '**0'],
    ['**#', -0, '**0'],
    ['**#', 9, '**9'],
    ['**#', 12, '*12'],
    ['**#', 123, '123'],
    ['**###', 27, '***27'],
    ['**###', 107, '**107'],
    ['**###', 1007, '*1007'],
    ['**##############', Number.MAX_SAFE_INTEGER, '9007199254740991'],
  ] as const)('formats %s and %s with independently expected padding', (image, value, expected) => {
    expect(format(image, [value])).toBe(expected);
  });

  it('keeps string and ordinary signed integer fields in image order', () => {
    expect(format('A=**##;B=###;C=! END', [7, -12, 'Zed'])).toBe('A=***7;B=-12;C=Z END');
    expect(format('**#/**##', [1, 23])).toBe('**1/**23');
    expect(format('!**#!', ['A', 1, 'B'])).toBe('A**1B');
  });

  it.each(['*#', '**', '***#', '****#', '#**#', '**#*', '**#**#', '**.##', '** ##'])(
    'rejects malformed or unsupported asterisk image %j',
    (image) => failure(image, [1], 'UNSUPPORTED_FORMAT'),
  );

  it('retains count, type, sign, integer and overflow errors without partial output', () => {
    failure('**#', [], 'FORMAT_VALUE_COUNT');
    failure('**#', [1, 2], 'FORMAT_VALUE_COUNT');
    failure('**#', ['1'], 'TYPE_MISMATCH');
    failure('**#', [-1], 'UNSUPPORTED_FORMAT_VALUE');
    failure('**#', [1.5], 'UNSUPPORTED_FORMAT_VALUE');
    failure('**#', [Number.MAX_SAFE_INTEGER + 1], 'UNSUPPORTED_FORMAT_VALUE');
    failure('**#', [Infinity], 'UNSUPPORTED_FORMAT_VALUE');
    failure('**#', [1000], 'FORMAT_OVERFLOW');
    failure('## **#', [1, -1], 'UNSUPPORTED_FORMAT_VALUE');
    expect(format('### **#', [-12, 12])).toBe('-12 *12');
  });

  it('keeps output and traversal bounded by the existing image limit', () => {
    expect(format('**' + '#'.repeat(4094), [0])).toBe('*'.repeat(4095) + '0');
    expect(format('**# '.repeat(1024), Array<number>(1024).fill(7))).toBe('**7 '.repeat(1024));
    failure('**' + '#'.repeat(4095), [0], 'FORMAT_LIMIT');
  });

  it('evaluates left to right, writes atomically, locates failure and recovers', () => {
    const trace: string[] = [];
    const basic = new Basic({
      write: (text) => trace.push(text),
      random: () => {
        trace.push('random');
        return 0.5;
      },
    });
    basic.run('10 PRINT USING "**# ##",INT(RND()*10),-2;\n20 PRINT "end"');
    expect(trace).toEqual(['random', '**5 -2', 'end\n']);
    trace.length = 0;
    expect(() => basic.run('10 PRINT USING "**# **#",INT(RND()*10),-1')).toThrow(BasicRuntimeError);
    expect(trace).toEqual(['random']);
    expect(basic.status).toBe('error');
    basic.run('10 PRINT USING "**#",12');
    expect(trace).toEqual(['random', '*12\n']);
  });

  it('steps once, preserves source and cancels before formatting', async () => {
    const writes: string[] = [];
    const basic = new Basic({write: (text) => writes.push(text)});
    basic.reset(parseProgram('10 PRINT USING "**#",7\n20 END'));
    basic.step();
    expect(writes).toEqual(['**7\n']);
    basic.step();
    expect(basic.status).toBe('halted');
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(basic.runAsync('10 PRINT USING "**#",7', {signal: controller.signal}), {
      name: 'AbortError',
    });
    expect(writes).toEqual(['**7\n']);
    await basic.runAsync();
    expect(writes).toEqual(['**7\n', '**7\n']);
  });
});

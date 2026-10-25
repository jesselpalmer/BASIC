import {describe, expect, it} from 'bun:test';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  createHost,
  Evaluator,
  parseLine,
  parseProgram,
  validateProgram,
} from '../index.ts';
import type {Expression, Host, LogicalKey} from './types.ts';
import {normalizeKeyName} from './keyboard.ts';
import {expressionType} from './comparison.ts';

function expression(source: string): Expression {
  const statement = parseLine(`10 PRINT ${source}`)!.statement;
  if (statement.type !== 'PrintStatement') throw new Error('Expected PRINT');
  return statement.items[0];
}

function failure(action: () => unknown): BasicRuntimeError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    return error as BasicRuntimeError;
  }
  throw new Error('Expected keyboard failure');
}

const keys: LogicalKey[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
  'ENTER',
  'SPACE',
];

describe('keyboard syntax and static types', () => {
  it('parses case-insensitive function names including the string suffix and preserves locations', () => {
    const statement = parseProgram('30 END\r\n10 PRINT inkey$();keydown("up")').lines[0].statement;
    if (statement.type !== 'PrintStatement') throw new Error('Expected PRINT');
    expect(statement.items.map((item) => item.type)).toEqual(['CallExpression', 'CallExpression']);
    expect(statement.items[0]).toMatchObject({
      name: 'INKEY$',
      arguments: [],
      nameLocation: {label: 10, start: {line: 2, column: 10, offset: 17}},
    });
    expect(Object.isFrozen(statement.items[0])).toBe(true);
    expect(() => parseLine('10 LET INKEY$="x"')).toThrow(BasicSyntaxError);
    expect(() => parseLine('10 LET KEYDOWN=1')).toThrow(BasicSyntaxError);
    expect(parseLine('10 LET INKEY2$="still a variable"')!.statement.type).toBe('LetStatement');
    for (const source of ['INKEY$', 'KEYDOWN', 'INKEY$(,)', 'KEYDOWN("UP",)'])
      expect(() => parseLine(`10 PRINT ${source}`)).toThrow(BasicSyntaxError);
  });

  it('infers INKEY$ as string for comparison, concatenation, WAIT and graphics checks', () => {
    expect(expressionType(expression('INKEY$()'))).toBe('string');
    expect(expressionType(expression('INKEY$()+"x"'))).toBe('string');
    expect(expressionType(expression('KEYDOWN(INKEY$())'))).toBe('number');
    expect(() => parseProgram('10 IF INKEY$()="A" THEN 20\n20 END')).not.toThrow();
    for (const source of [
      'IF INKEY$()>"A" THEN 20',
      'IF INKEY$()=1 THEN 20',
      'WAIT INKEY$()',
      'PSET INKEY$(),1',
    ]) {
      expect(() => parseProgram(`10 END\n20 ${source}`)).toThrow(BasicSyntaxError);
    }
  });

  it.each([
    'PRINT KEYDOWN(1)',
    'LET N=KEYDOWN(1)',
    'PRINT ABS(KEYDOWN(1))',
    'IF KEYDOWN(1)=1 THEN 10',
    'FOR I=KEYDOWN(1) TO 2\n30 NEXT I',
    'FOR I=0 TO KEYDOWN(1)\n30 NEXT I',
    'FOR I=0 TO 2 STEP KEYDOWN(1)\n30 NEXT I',
    'WAIT KEYDOWN(1)',
    'COLOR KEYDOWN(1)',
    'LINE 0,0,KEYDOWN(1),0',
    'PSET 0,KEYDOWN(1)',
    'CIRCLE 0,0,KEYDOWN(1)',
  ])('preflights numeric key names without host effects in %s', (source) => {
    const writes: string[] = [];
    const basic = new Basic({write: (text) => writes.push(text)});
    expect(() => basic.run(`1 PRINT "must not run"\n10 END\n20 ${source}`)).toThrow(
      BasicSyntaxError,
    );
    expect(basic.state.diagnostic).toMatchObject({code: 'TYPE_MISMATCH', label: 20});
    expect(writes).toEqual([]);
  });

  it('validates caller-created program snapshots as well as source', () => {
    const line = parseLine('10 PRINT KEYDOWN(1)')!;
    expect(() => validateProgram([line])).toThrow(BasicSyntaxError);
    const program = parseProgram('10 PRINT INKEY$()');
    const candidate = structuredClone(program.lines);
    const snapshot = validateProgram(candidate);
    expect(Object.isFrozen(snapshot.lines[0].statement)).toBe(true);
    expect(Object.isFrozen(candidate[0].statement)).toBe(false);
  });
});

describe('keyboard host evaluation', () => {
  it('consumes logical keys once in expression order, retains held state and supports empty queues', () => {
    const queued: (LogicalKey | '')[] = ['A', 'B', 'LEFT'];
    const events: string[] = [];
    const output: string[] = [];
    const basic = new Basic({
      readKey() {
        const key = queued.shift() ?? '';
        events.push(`read:${key}`);
        return key;
      },
      keyDown(key) {
        events.push(`held:${key}`);
        return key === 'LEFT';
      },
      write: (text) => output.push(text),
    });
    basic.run(
      '10 LET KEY$=INKEY$()+INKEY$()\n20 PRINT KEY$;KEYDOWN(INKEY$());KEYDOWN("right");INKEY$()',
    );
    expect(output).toEqual(['AB10\n']);
    expect(events).toEqual(['read:A', 'read:B', 'read:LEFT', 'held:LEFT', 'held:RIGHT', 'read:']);
    expect(basic.variables).toEqual([{name: 'KEY$', value: 'AB'}]);
  });

  it('recognizes every canonical key, folds ASCII query names and rejects aliases/Escape', () => {
    const evaluator = new Evaluator({keyDown: () => true});
    for (const key of keys) {
      expect(normalizeKeyName(key)).toBe(key);
      expect(normalizeKeyName(key.toLowerCase())).toBe(key);
      expect(evaluator.evaluate(expression(`KEYDOWN("${key.toLowerCase()}")`))).toBe(1);
      expect(new Evaluator({readKey: () => key}).evaluate(expression('INKEY$()'))).toBe(key);
    }
    for (const invalid of [
      '',
      'Escape',
      'ESC',
      'ArrowUp',
      ' ',
      ' UP',
      'UP ',
      'é',
      'ſ',
      'ß',
      'F1',
      'SHIFT',
      'AA',
      'UP\n',
      'A\r\n',
    ]) {
      expect(normalizeKeyName(invalid)).toBeNull();
      const query = structuredClone(expression('KEYDOWN("UP")'));
      if (query.type !== 'CallExpression') throw new Error('Expected function call');
      Object.assign(query.arguments[0], {value: invalid});
      expect(failure(() => evaluator.evaluate(query)).diagnostic.code).toBe('INVALID_KEY_NAME');
    }
  });

  it('returns 0/1 for held state and type-checks runtime-only argument paths', () => {
    const evaluator = new Evaluator({keyDown: (key) => key === 'A'});
    expect(evaluator.evaluate(expression('KEYDOWN("A")'))).toBe(1);
    expect(evaluator.evaluate(expression('KEYDOWN("B")'))).toBe(0);
    expect(failure(() => evaluator.evaluate(expression('KEYDOWN(1)'))).diagnostic).toMatchObject({
      code: 'TYPE_MISMATCH',
      label: 10,
      column: 10,
    });
  });

  it.each(['INKEY$(RND())', 'KEYDOWN()', 'KEYDOWN(RND(), RND())'])(
    'rejects wrong arity before evaluating arguments in %s',
    (source) => {
      let effects = 0;
      const evaluator = new Evaluator({
        random: () => {
          effects++;
          return 0;
        },
        readKey: () => {
          effects++;
          return '';
        },
        keyDown: () => {
          effects++;
          return false;
        },
      });
      expect(failure(() => evaluator.evaluate(expression(source))).diagnostic.code).toBe(
        'INVALID_ARGUMENT_COUNT',
      );
      expect(effects).toBe(0);
    },
  );

  it('reports each missing capability clearly, only when that capability executes', () => {
    const basic = new Basic();
    expect(basic.run('10 END\n20 PRINT INKEY$();KEYDOWN("UP")').status).toBe('halted');
    for (const source of ['INKEY$()', 'KEYDOWN("UP")']) {
      expect(failure(() => basic.run(`30 END\r\n10 PRINT ${source}`)).diagnostic).toMatchObject({
        code: 'KEYBOARD_UNAVAILABLE',
        label: 10,
        line: 2,
        column: 10,
        offset: 17,
      });
      expect(basic.run('10 PRINT "recovered"').status).toBe('halted');
    }
    expect(new Evaluator({readKey: () => ''}).evaluate(expression('INKEY$()'))).toBe('');
    expect(
      failure(() => new Evaluator({readKey: () => ''}).evaluate(expression('KEYDOWN("A")')))
        .diagnostic.code,
    ).toBe('KEYBOARD_UNAVAILABLE');
    expect(new Evaluator({keyDown: () => false}).evaluate(expression('KEYDOWN("A")'))).toBe(0);
    expect(
      failure(() => new Evaluator({keyDown: () => false}).evaluate(expression('INKEY$()')))
        .diagnostic.code,
    ).toBe('KEYBOARD_UNAVAILABLE');
  });

  it.each(['readKey', 'keyDown'] as const)(
    'binds, snapshots and validates %s callbacks, preserving original thrown causes',
    (name) => {
      const calls: unknown[] = [];
      const host = {
        readKey() {
          expect(this).toBe(host);
          calls.push('read');
          return 'A' as const;
        },
        keyDown(key: LogicalKey) {
          expect(this).toBe(host);
          calls.push(key);
          return true;
        },
      };
      const basic = new Basic(host);
      host[name] = () => {
        throw new Error('replaced');
      };
      basic.run('10 PRINT INKEY$();KEYDOWN("up")');
      expect(calls).toEqual(['read', 'UP']);
      expect(Object.isFrozen(basic.host)).toBe(true);
      expect(() => Reflect.apply(createHost, undefined, [{[name]: 1}])).toThrow(
        `Host ${name} must be a function`,
      );
      const cause = new Error('keyboard disconnected');
      const broken = new Evaluator({
        [name]: () => {
          throw cause;
        },
      });
      const error = failure(() =>
        broken.evaluate(expression(name === 'readKey' ? 'INKEY$()' : 'KEYDOWN("A")')),
      );
      expect(error.diagnostic).toMatchObject({code: 'KEYBOARD_FAILED', label: 10, column: 10});
      expect(error.cause).toBe(cause);
    },
  );

  it.each([null, undefined, 1, true, {}, Promise.resolve('A'), 'a', 'ESCAPE', 'ARROWUP'])(
    'rejects invalid readKey result %j',
    (value) => {
      const host = {readKey: () => value} as unknown as Partial<Host>;
      expect(failure(() => new Basic(host).run('10 PRINT INKEY$()')).diagnostic.code).toBe(
        'INVALID_KEY_VALUE',
      );
    },
  );
  it.each([null, undefined, 0, 1, 'true', Promise.resolve(true)])(
    'rejects invalid keyDown result %j',
    (value) => {
      const host = {keyDown: () => value} as unknown as Partial<Host>;
      expect(failure(() => new Basic(host).run('10 PRINT KEYDOWN("UP")')).diagnostic.code).toBe(
        'INVALID_KEY_VALUE',
      );
    },
  );

  it('guards both keyboard callbacks against lifecycle reentrancy and preserves earlier output on failure', () => {
    for (const name of ['readKey', 'keyDown'] as const) {
      const basic = new Basic({
        [name]: () => {
          basic.reset();
          return name === 'readKey' ? 'A' : true;
        },
      });
      const error = failure(() =>
        basic.run(name === 'readKey' ? '10 PRINT INKEY$()' : '10 PRINT KEYDOWN("UP")'),
      );
      expect(error.diagnostic.code).toBe('KEYBOARD_FAILED');
      expect((error.cause as Error).message).toBe('Cannot change execution during a statement');
    }
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text), readKey: () => 'A'});
    failure(() => basic.run('10 PRINT "before"\n20 PRINT INKEY$();1/0\n30 PRINT "after"'));
    expect(output).toEqual(['before\n']);
  });

  it('shares synchronous, asynchronous, stepping and immediate expression semantics without shared instance state', async () => {
    const output: string[] = [];
    const first = new Basic({
      readKey: () => 'A',
      keyDown: () => true,
      write: (text) => output.push(text),
    });
    const second = new Basic({
      readKey: () => 'B',
      keyDown: () => false,
      write: (text) => output.push(text),
    });
    await first.runAsync('10 PRINT INKEY$();KEYDOWN("UP")');
    second.reset('10 PRINT INKEY$();KEYDOWN("UP")');
    await second.stepAsync();
    first.reset();
    second.reset();
    first.readLine('20 PRINT INKEY$()');
    await second.readLineAsync('20 PRINT INKEY$()');
    expect(output).toEqual(['A1\n', 'B0\n', 'A\n', 'B\n']);
  });
});

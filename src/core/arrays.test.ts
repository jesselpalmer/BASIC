import {describe, expect, it} from 'bun:test';
import {readFileSync} from 'node:fs';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  Evaluator,
  parseLine,
  parseProgram,
} from '../index.ts';
import type {ArrayDeclaration, BasicValue, Expression, Host, NodeOf} from './types.ts';

function setup(host: Partial<Host> = {}) {
  const output: string[] = [];
  return {output, basic: new Basic({write: (text) => output.push(text), ...host})};
}
function expression(source: string): Expression {
  const statement = parseLine(`10 PRINT ${source}`)?.statement;
  if (statement?.type !== 'PrintStatement') throw new Error('Expected PRINT');
  return statement.items[0];
}
function assignment(source: string): NodeOf<'LetStatement'> {
  const statement = parseLine(`10 ${source}`)?.statement;
  if (statement?.type !== 'LetStatement') throw new Error('Expected assignment');
  return statement;
}
function declarations(source = '10 DIM A(2),S$(1),M(1,2)'): readonly ArrayDeclaration[] {
  const statement = parseLine(source)?.statement;
  if (statement?.type !== 'DimStatement') throw new Error('Expected DIM');
  return statement.declarations;
}
function failure(action: () => unknown, code: string): BasicRuntimeError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error;
  }
  throw new Error('Expected runtime failure');
}

describe('array execution', () => {
  it('initializes numeric/string arrays, separates scalar namespaces and preserves DIM as a name', () => {
    const {basic, output} = setup();
    basic.run(
      '10 DIM A(2),A$(1),M(1,2),DIM(0)\n20 A=9\n30 A$="scalar"\n40 DIM=4\n50 A(0)=3\n60 LET A(2)=7\n70 A$(1)="hi"\n80 M(1,2)=A(0)+A(2)\n90 DIM(0)=5\n100 PRINT A;":";A$;":";DIM;":";DIM(0);":";M(1,2);":";A(1);":";A$(0);":";A$(1)',
    );
    expect(output).toEqual(['9:scalar:4:5:10:0::hi\n']);
    expect(basic.variables).toEqual([
      {name: 'A', value: 9},
      {name: 'A$', value: 'scalar'},
      {name: 'DIM', value: 4},
    ]);
    expect(basic.arrays[2]).toEqual({
      name: 'M',
      bounds: [1, 2],
      elementCount: 6,
      values: [0, 0, 0, 0, 0, 10],
      truncated: false,
    });
  });

  it('prepares declarations after references/END and treats DIM as inert on every visit', () => {
    const {basic, output} = setup();
    basic.run('10 A(0)=A(0)+1\n20 DIM A(0)\n30 PRINT A(0)\n40 IF A(0)<2 THEN 10\n50 END');
    expect(output).toEqual(['1\n', '2\n']);
    basic.run('10 PRINT Z$(0);":";Z(0)\n20 END\n30 DIM Z$(0),Z(0)');
    expect(output.at(-1)).toBe(':0\n');
    basic.reset('10 DIM A(0)\n20 A(0)=3');
    expect(basic.arrays[0].values).toEqual([0]);
    expect(basic.step().nextLocation?.label).toBe(20);
    expect(basic.arrays[0].values).toEqual([0]);
    expect(basic.step().status).toBe('halted');
    expect(basic.arrays[0].values).toEqual([3]);
    failure(() => new Basic().readLine('10 DIM A(0)'), 'PROGRAM_REQUIRED');
  });

  it('isolates runs/instances and freezes bounded detached observations', () => {
    const {basic} = setup();
    basic.run('10 DIM A(1)\n20 A(1)=7');
    const old = basic.arrays;
    expect(Object.isFrozen(old)).toBe(true);
    expect(Object.isFrozen(old[0])).toBe(true);
    expect(Object.isFrozen(old[0].bounds)).toBe(true);
    expect(Object.isFrozen(old[0].values)).toBe(true);
    expect(Reflect.set(old[0].values, '1', 9)).toBe(false);
    basic.reset();
    expect(basic.arrays[0].values).toEqual([0, 0]);
    expect(old[0].values).toEqual([0, 7]);
    basic.run();
    expect(basic.arrays[0].values).toEqual([0, 7]);
    expect(new Basic().arrays).toEqual([]);
    basic.run('10 DIM A(65535),B(100),C(100),D(100),E(100)');
    const bounded = basic.arrays;
    expect(bounded.map(({values}) => values.length)).toEqual([64, 64, 64, 64, 0]);
    expect(bounded.every(({truncated}) => truncated)).toBe(true);
    expect(bounded[0].elementCount).toBe(65536);
    basic.run('10 END');
    expect(basic.arrays).toEqual([]);
  });

  it.each(['10 DIM A(65536)', '10 END\n20 PRINT MISSING(0)', '10 DIM A(1),A(1)'])(
    'rejects invalid replacements before effects and retains the previous program: %s',
    (source) => {
      const effects: string[] = [];
      const {basic, output} = setup({
        random: () => {
          effects.push('random');
          return 0.5;
        },
      });
      basic.reset('10 DIM A(1)\n20 A(1)=6\n30 PRINT A(1)');
      expect(() => basic.run('1 PRINT RND()\n' + source)).toThrow(BasicSyntaxError);
      expect(output).toEqual([]);
      expect(effects).toEqual([]);
      basic.run();
      expect(output).toEqual(['6\n']);
    },
  );

  it('evaluates nested indices iteratively and in left-to-right order, with eager assignment values', () => {
    const draws = [0.5, 0.1, 0.9, 0.1, 0.9];
    const {basic, output} = setup({random: () => draws.shift()!});
    basic.run(
      '10 DIM M(1,1),A(0)\n20 M(INT(RND()*2),INT(RND()*2))=RND()*10\n30 PRINT M(0,1)\n40 PRINT M(INT(RND()*2),INT(RND()*2))\n50 PRINT ' +
        'A('.repeat(250) +
        '0' +
        ')'.repeat(250),
    );
    expect(output).toEqual(['5\n', '5\n', '0\n']);
    expect(draws).toEqual([]);
  });

  it('checks declaration/rank/type before consuming target indices, retaining eager RHS effects', () => {
    let draws = 0;
    const evaluator = new Evaluator({
      random: () => {
        draws++;
        return 0.5;
      },
    });
    evaluator.reset(declarations('10 DIM A(0)'));
    for (const [source, code] of [
      ['MISSING(RND())=1', 'UNDECLARED_ARRAY'],
      ['A(RND(),RND())=1', 'ARRAY_RANK_MISMATCH'],
      ['A(RND())="bad"', 'TYPE_MISMATCH'],
    ]) {
      const statement = assignment(source);
      failure(
        () => evaluator.assign(statement.target, evaluator.evaluate(statement.expression)),
        code,
      );
    }
    failure(() => evaluator.evaluate(expression('MISSING(RND())')), 'UNDECLARED_ARRAY');
    expect(draws).toBe(0);
    const statement = assignment('MISSING(RND())=RND()');
    failure(
      () => evaluator.assign(statement.target, evaluator.evaluate(statement.expression)),
      'UNDECLARED_ARRAY',
    );
    expect(draws).toBe(1);
    expect(evaluator.snapshotArrays()[0].values).toEqual([0]);
  });

  it('standalone evaluators copy declarations, preserve cells on failed writes and reset atomically', () => {
    const evaluator = new Evaluator();
    const parsed = declarations();
    const mutable = parsed.map((item) => ({
      ...item,
      bounds: item.bounds.map((bound) => ({...bound})),
    }));
    evaluator.reset(mutable);
    mutable[0].bounds[0].value = 0;
    const write = assignment('A(2)=7');
    evaluator.assign(write.target, evaluator.evaluate(write.expression));
    for (const [source, code] of [
      ['A(-1)=4', 'ARRAY_BOUNDS'],
      ['A(.5)=4', 'ARRAY_BOUNDS'],
      ['A(3)=4', 'ARRAY_BOUNDS'],
      ['A("1")=4', 'TYPE_MISMATCH'],
      ['A(1,0)=4', 'ARRAY_RANK_MISMATCH'],
      ['UNDECLARED(RND())=4', 'UNDECLARED_ARRAY'],
      ['A(2)="bad"', 'TYPE_MISMATCH'],
      ['S$(0)=4', 'TYPE_MISMATCH'],
    ]) {
      const statement = assignment(source);
      failure(
        () => evaluator.assign(statement.target, evaluator.evaluate(statement.expression)),
        code,
      );
    }
    for (const [source, code] of [
      ['A(-1)', 'ARRAY_BOUNDS'],
      ['A(3)', 'ARRAY_BOUNDS'],
      ['A(1,0)', 'ARRAY_RANK_MISMATCH'],
      ['UNDECLARED(RND())', 'UNDECLARED_ARRAY'],
      ['A("1")', 'TYPE_MISMATCH'],
    ]) {
      failure(() => evaluator.evaluate(expression(source)), code);
    }
    expect(evaluator.evaluate(expression('A(2)'))).toBe(7);
    const target = assignment('A(2)=0').target;
    for (const value of [Infinity, NaN])
      failure(() => evaluator.assign(target, value), 'NON_FINITE_NUMBER');
    expect(() => evaluator.reset(declarations('10 DIM A(65536)'))).toThrow(BasicSyntaxError);
    expect(evaluator.evaluate(expression('A(2)'))).toBe(7);
    evaluator.reset();
    expect(evaluator.snapshotArrays()).toEqual([]);
  });

  it('reports the failing physical index location and leaves earlier cell values intact', () => {
    const {basic} = setup();
    const error = failure(
      () => basic.run('10 DIM M(1,1)\n20 M(0,0)=9\n30 PRINT M(1,2)'),
      'ARRAY_BOUNDS',
    );
    expect(error.diagnostic).toMatchObject({label: 30, line: 3, column: 14});
    expect(basic.state.diagnostic).toEqual(error.diagnostic);
    expect(basic.arrays[0].values).toEqual([9, 0, 0, 0]);
    failure(() => basic.run('10 DIM A(0)\n20 PRINT A(1/0)'), 'DIVISION_BY_ZERO');
  });

  it('releases a cancelled array program and isolates late input from a fresh run', async () => {
    const requested = Promise.withResolvers<void>();
    let reply: (text: string | null) => void = () => {
      throw new Error('Missing request');
    };
    const {basic, output} = setup({
      readLine: () => {
        requested.resolve();
        return new Promise((resolve) => {
          reply = resolve;
        });
      },
    });
    const stopped = basic
      .runAsync('10 DIM A(0)\n20 A(0)=5\n30 INPUT X\n40 A(0)=X')
      .catch((error: unknown) => error);
    await requested.promise;
    expect(basic.status).toBe('waiting');
    expect(basic.arrays[0].values).toEqual([5]);
    basic.cancel();
    basic.run('10 DIM A(0)\n20 PRINT A(0)');
    reply('9');
    expect(await stopped).toMatchObject({name: 'AbortError'});
    expect(basic.arrays[0].values).toEqual([0]);
    expect(output).toEqual(['0\n']);
  });

  it('executes the authored checker-board oracle and reruns with fresh cells', async () => {
    const source = readFileSync(
      new URL('../../scripts/package/fixtures/arrays/board.bas', import.meta.url),
      'utf8',
    );
    const answers: (string | null)[] = [];
    const observed: BasicValue[][] = [];
    const {basic, output} = setup({
      readLine: () => {
        observed.push([...basic.arrays[0].values]);
        return Promise.resolve(answers.shift() ?? null);
      },
    });
    for (let run = 0; run < 2; run++) {
      answers.push('1', '2', '1', '19', '0');
      await basic.runAsync(parseProgram(source), {instructionLimit: 2000});
      expect(basic.status).toBe('halted');
    }
    expect(output).toEqual([
      'pieces:48\n',
      'illegal\n',
      'pieces:48\n',
      'pieces:47\n',
      'moves:1\n',
      'pieces:48\n',
      'illegal\n',
      'pieces:48\n',
      'pieces:47\n',
      'moves:1\n',
    ]);
    const first = observed[0];
    const rejected = observed[2];
    expect(first).toEqual(rejected);
    for (let square = 1; square <= 63; square++) {
      const row = Math.floor((square - 1) / 8),
        column = (square - 1) % 8;
      expect(first[square]).toBe(row >= 2 && row <= 5 && column >= 2 && column <= 5 ? 0 : 1);
    }
    expect(basic.arrays[0].values[1]).toBe(0);
    expect(basic.arrays[0].values[10]).toBe(0);
    expect(basic.arrays[0].values[19]).toBe(1);
  });
});

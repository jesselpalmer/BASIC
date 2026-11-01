import {describe, expect, test} from 'bun:test';
import {Basic, Evaluator, parseLine, parseProgram} from '../index.ts';
import type {NodeOf, Program} from './types.ts';
import {ArrayStore} from './arrays.ts';

function change(text: string): NodeOf<'ChangeStatement'> {
  const statement = parseLine('10 ' + text)!.statement;
  if (statement.type !== 'ChangeStatement') throw new Error('Expected CHANGE');
  return statement;
}
function variable(name: string): NodeOf<'Variable'> {
  return {...change('CHANGE A TO S$').source, name};
}
function evaluator(dim = 'A(300)') {
  const e = new Evaluator();
  const statement = parseLine('10 DIM ' + dim)!.statement;
  if (statement.type !== 'DimStatement') throw new Error('Expected DIM');
  e.reset(statement.declarations);
  return e;
}

describe('native CHANGE execution', () => {
  test('executes the CAT and reverse ABCDE manual examples without changing native numeric output', () => {
    const output: string[] = [],
      basic = new Basic({write: (t) => output.push(t)});
    basic.run(
      '10 DIM X(3),A(5)\n15 A$="CAT"\n20 CHANGE A$ TO X\n25 PRINT X(0);X(1);X(2);X(3)\n30 FOR I=0 TO 5\n35 READ A(I)\n40 NEXT I\n45 CHANGE A TO A$\n50 PRINT A$\n60 DATA 5,65,66,67,68,69',
    );
    expect(output).toEqual(['3676584\n', 'ABCDE\n']);
    expect(basic.arrays[0].values).toEqual([3, 67, 65, 84]);
  });
  test('round-trips every byte and preserves numeric scalar, unused cells and string-array namespaces', () => {
    const e = evaluator('A(300),S$(1)');
    const text = Array.from({length: 256}, (_, i) => String.fromCharCode(i)).join('');
    e.assign(variable('S$'), text);
    e.assign(variable('A'), 99);
    const last = parseLine('10 A(300)=42')!.statement;
    if (last.type !== 'LetStatement') throw new Error('Expected LET');
    e.assign(last.target, 42);
    e.change(change('CHANGE S$ TO A'));
    expect(e.snapshotArrays()[0].values).toEqual([256, ...Array.from({length: 63}, (_, i) => i)]);
    e.change(change('CHANGE A TO R$'));
    expect(e.evaluate(variable('R$'))).toBe(text);
    expect(e.evaluate(variable('A'))).toBe(99);
    e.assign(variable('S$'), '');
    e.change(change('CHANGE S$ TO A'));
    e.change(change('CHANGE A TO R$'));
    expect(e.evaluate(variable('R$'))).toBe('');
    expect(e.snapshotArrays()[0].values.slice(0, 4)).toEqual([0, 0, 1, 2]);
    expect(e.snapshotArrays()[1].values).toEqual(['', '']);
    const ref = parseLine('10 PRINT A(300)')!.statement;
    if (ref.type !== 'PrintStatement') throw new Error('Expected PRINT');
    expect(e.evaluate(ref.items[0])).toBe(42);
  });
  test.each(['ab\u0100', 'ab😀', 'ab\ud800'])(
    'rejects a late non-byte character atomically: %j',
    (text) => {
      const e = evaluator('A(8)');
      e.assign(variable('S$'), 'kept');
      e.change(change('CHANGE S$ TO A'));
      const before = e.snapshotArrays();
      e.assign(variable('S$'), text);
      expect(() => e.change(change('CHANGE S$ TO A'))).toThrow('byte characters');
      expect(e.snapshotArrays()).toEqual(before);
    },
  );
  test('checks full capacity before writes and supports the exact native length limit', () => {
    const e = evaluator('A(32768),B(2)');
    e.assign(variable('S$'), 'x'.repeat(32767));
    e.change(change('CHANGE S$ TO A'));
    e.change(change('CHANGE A TO R$'));
    expect(e.evaluate(variable('R$'))).toBe('x'.repeat(32767));
    const before = e.snapshotArrays();
    e.assign(variable('S$'), 'y'.repeat(32768));
    expect(() => e.change(change('CHANGE S$ TO A'))).toThrow('at most 32767');
    expect(e.snapshotArrays()).toEqual(before);
    e.assign(variable('S$'), 'abc');
    expect(() => e.change(change('CHANGE S$ TO B'))).toThrow('exceeds the array capacity');
    expect(e.snapshotArrays()).toEqual(before);
  });
  test.each([-1, 1.5, 4])(
    'rejects an invalid stored length %j without replacing the string',
    (length) => {
      const b = new Basic();
      expect(() => b.run(`10 DIM A(3):A(0)=${length}:S$="kept":CHANGE A TO S$`)).toThrow(
        'length must be an integer',
      );
      expect(b.variables.find((v) => v.name === 'S$')?.value).toBe('kept');
    },
  );
  test.each([-1, 256, 65.5])(
    'rejects a late invalid character %j without replacing the string',
    (code) => {
      const b = new Basic();
      expect(() =>
        b.run(`10 DIM A(2):A(0)=2:A(1)=65:A(2)=${code}:S$="kept":CHANGE A TO S$`),
      ).toThrow('character codes');
      expect(b.variables.find((v) => v.name === 'S$')?.value).toBe('kept');
    },
  );
  test('ignores unused cells, accepts length zero and rejects oversized reverse strings', () => {
    const b = new Basic();
    b.run('10 DIM A(2):A(0)=1:A(1)=65:A(2)=-1:CHANGE A TO S$');
    expect(b.variables.find((v) => v.name === 'S$')?.value).toBe('A');
    b.run('10 DIM A(0):CHANGE A TO S$');
    expect(b.variables[0].value).toBe('');
    expect(() => b.run('10 DIM A(32768):A(0)=32768:CHANGE A TO S$')).toThrow('at most 32767');
  });
  test('uses shared sequence/branch/call stepping and fresh storage on every run', async () => {
    const output: string[] = [],
      b = new Basic({write: (t) => output.push(t)});
    const program =
      '10 DIM A(3):S$="CAT":GOSUB 100:PRINT R$:END\n100 IF 1=1 THEN CHANGE S$ TO A ELSE CHANGE A TO R$\n110 CHANGE A TO R$:RETURN';
    const visited: number[] = [];
    await b.runAsync(program, {
      beforeStatement() {
        visited.push(b.state.nextLocation!.label!);
      },
    });
    expect(output).toEqual(['CAT\n']);
    expect(visited.filter((n) => n === 100)).toHaveLength(2);
    b.run(program);
    expect(output).toEqual(['CAT\n', 'CAT\n']);
    b.run('10 DIM A(0):CHANGE A TO S$:PRINT S$');
    expect(output.at(-1)).toBe('\n');
    const gates = new Basic();
    gates.reset('10 DIM A(3):S$="CAT":CHANGE S$ TO A:CHANGE A TO R$:END');
    gates.step();
    gates.step();
    expect(gates.arrays[0].values).toEqual([0, 0, 0, 0]);
    gates.step();
    expect(gates.arrays[0].values).toEqual([3, 67, 65, 84]);
    gates.step();
    expect(gates.variables.find((v) => v.name === 'R$')?.value).toBe('CAT');
    expect(
      await gates.runAsync(undefined, {instructionLimit: 2}).catch((error: unknown) => error),
    ).toBeInstanceOf(Error);
    expect(gates.arrays[0].values).toEqual([0, 0, 0, 0]);
  });
  test('rejects immediate entry before reading undefined operands', () => {
    const b = new Basic();
    expect(() => b.readLine('10 CHANGE S$ TO A')).toThrow('require a complete program');
    expect(b.state.diagnostic?.code).toBe('PROGRAM_REQUIRED');
  });
  test('cancellation before conversion prevents a late gate from writing into a replacement run', async () => {
    const reached = Promise.withResolvers<void>(),
      release = Promise.withResolvers<void>();
    const b = new Basic();
    const old = b
      .runAsync('10 DIM A(3)\n20 S$="CAT"\n30 CHANGE S$ TO A', {
        beforeStatement() {
          if (b.state.nextLocation?.label === 30) {
            reached.resolve();
            return release.promise;
          }
          return undefined;
        },
      })
      .catch((error: unknown) => error);
    await reached.promise;
    expect(b.arrays[0].values).toEqual([0, 0, 0, 0]);
    b.cancel();
    b.run('10 DIM A(0):CHANGE A TO S$');
    release.resolve();
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(b.arrays[0].values).toEqual([0]);
    expect(b.variables.find((v) => v.name === 'S$')?.value).toBe('');
  });
  test('direct evaluator validates missing/rank source and target arrays', () => {
    for (const text of ['CHANGE S$ TO A', 'CHANGE A TO S$']) {
      const e = new Evaluator();
      e.assign(variable('S$'), 'a');
      expect(() => e.change(change(text))).toThrow('requires DIM');
      const m = evaluator('A(1,1)');
      m.assign(variable('S$'), 'a');
      expect(() => m.change(change(text))).toThrow('one-dimensional');
    }
  });
  test('storage rejects malformed typed cells rather than coercing them', () => {
    const stmt = parseLine('10 DIM A(2)')!.statement;
    if (stmt.type !== 'DimStatement') throw new Error('Expected DIM');
    const store = new ArrayStore(stmt.declarations),
      array = variable('A');
    expect(() => store.changeToNumbers(array, 3)).toThrow('string source');
    const print = parseLine('10 PRINT A(0)')!.statement;
    if (print.type !== 'PrintStatement' || print.items[0].type !== 'ArrayReference')
      throw new Error('Expected array');
    store.write(print.items[0], [0], 'bad');
    expect(() => store.changeToString(array)).toThrow('length must');
    store.write(print.items[0], [0], 1);
    store.write(print.items[0], [1], 'bad');
    expect(() => store.changeToString(array)).toThrow('character codes');
  });
});

describe('CHANGE syntax and complete-program validation', () => {
  test.each([
    'CHANGE A TO B',
    'CHANGE S$ TO T$',
    'CHANGE S$',
    'CHANGE "CAT" TO A',
    'CHANGE S$+T$ TO A',
    'CHANGE A(0) TO S$',
    'CHANGE S$ TO A(0)',
    'CHANGE A TO S$(0)',
    'CHANGE S$ A',
    'CHANGE S$ TO A TO B',
    'CHANGE S$ TO A, B',
  ])('rejects malformed or unsupported operands: %s', (text) => {
    expect(() => parseLine('10 ' + text)).toThrow();
  });
  test.each([
    '10 END\n20 CHANGE S$ TO A',
    '10 END\n20 CHANGE A TO S$',
    '10 DIM A(1,1):END\n20 IF 1=2 THEN CHANGE S$ TO A',
  ])('preflights dead dependencies before effects: %s', (text) => {
    const out: string[] = [];
    expect(() => new Basic({write: (t) => out.push(t)}).run('1 PRINT "never"\n' + text)).toThrow();
    expect(out).toEqual([]);
  });
  test('preserves CHANGE scalar/array names and physical source locations', () => {
    const b = new Basic();
    b.run(
      '10 DIM CHANGE(1),A(3):CHANGE=7:CHANGE(1)=8:S$="CAT":CHANGE S$ TO A:CHANGE A TO R$:PRINT CHANGE;CHANGE(1);R$',
    );
    expect(b.variables.find((v) => v.name === 'CHANGE')?.value).toBe(7);
    const stmt = parseLine('\t010 change S$ to A', {line: 4, offset: 50})!.statement;
    expect(stmt.type).toBe('ChangeStatement');
    if (stmt.type !== 'ChangeStatement') throw new Error('Expected CHANGE');
    expect(stmt.location.start).toEqual({line: 4, column: 6, offset: 55});
    expect(stmt.source.location.start.column).toBe(13);
    expect(stmt.target.location.start.column).toBe(19);
  });
  test('copies supplied nodes and rejects malformed candidates without replacing a prepared program', () => {
    const b = new Basic();
    b.reset('10 PRINT "kept"');
    const candidate = structuredClone(parseProgram('10 DIM A(3):S$="CAT"\n20 CHANGE S$ TO A'));
    b.reset(candidate);
    const statement = candidate.lines[1].statement;
    if (statement.type !== 'ChangeStatement') throw new Error('Expected CHANGE');
    (statement.source as {name: string}).name = 'OTHER$';
    b.run();
    expect(b.arrays[0].values).toEqual([3, 67, 65, 84]);
    const invalids = [
      null,
      {type: 'NumberLiteral'},
      {...statement.source, name: 'bad name'},
      {...statement.source, name: 3},
    ];
    for (const source of invalids) {
      const bad = {
        ...candidate,
        lines: [candidate.lines[0], {...candidate.lines[1], statement: {...statement, source}}],
      } as unknown as Program;
      expect(() => b.reset(bad)).toThrow('two bare names');
      expect(() => b.run()).not.toThrow();
    }
  });
});

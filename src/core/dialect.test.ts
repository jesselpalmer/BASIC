import {describe, expect, it} from 'bun:test';
import {
  Basic,
  BasicRuntimeError,
  Evaluator,
  parseLine,
  parseProgram,
  validateProgram,
} from '../index.ts';
import type {LanguageOptions, ParsedLine, Program} from '../index.ts';

// Deliberately cross the TypeScript boundary as a JS consumer or decoded file can.
function untrustedOptions(dialect: unknown): LanguageOptions {
  return {dialect} as LanguageOptions;
}

describe('explicit language context', () => {
  it('tags immutable snapshots without changing exact source or fragment coordinates', () => {
    const options: LanguageOptions = {dialect: 'native'};
    const source = '20 END\r\n10 go=4';
    const program = parseProgram(source, options);
    const line = parseLine('10 go=4', {...options, line: 7, offset: 90});
    expect(program.dialect).toBe('native');
    expect(program.lines.map((item) => item.dialect)).toEqual(['native', 'native']);
    expect(program.lines.map((item) => item.source)).toEqual(['10 go=4', '20 END']);
    expect(program.lines[0].location.start).toEqual({line: 2, column: 1, offset: 8});
    expect(line?.location.start).toEqual({line: 7, column: 1, offset: 90});
    expect(line?.dialect).toBe('native');
    expect(Object.isFrozen(program)).toBe(true);
    expect(Object.isFrozen(line)).toBe(true);
    expect(Object.isFrozen(options)).toBe(false);
    expect(parseProgram('').dialect).toBe('native');
    expect(parseLine('')).toBeNull();
  });

  it.each(['basic-plus-1972', '', 'NATIVE', null, 0, {}, ['native']].map((dialect) => ({dialect})))(
    'rejects unsupported context %p even on empty source and unreachable lines',
    ({dialect}) => {
      const options = untrustedOptions(dialect);
      for (const parse of [
        () => parseLine('', options),
        () => parseProgram('', options),
        () => validateProgram([], options),
        () => new Basic({}, options),
        () => new Evaluator({}, options),
      ]) {
        expect(parse).toThrow(TypeError);
        expect(parse).toThrow(/dialect/);
      }
      const native = parseProgram('10 END\n20 PRINT RND()');
      const mixed = [native.lines[0], {...native.lines[1], dialect} as ParsedLine];
      expect(() => validateProgram(mixed)).toThrow(TypeError);
    },
  );

  it('copies legacy native trees, leaving caller ownership and the selected snapshot intact', () => {
    const parsed = parseProgram('10 VALUE=4\n20 PRINT VALUE');
    const legacyLines = parsed.lines.map(({dialect, ...line}) => {
      expect(dialect).toBe('native');
      return line;
    });
    const legacy: Program = {type: 'Program', lines: legacyLines};
    const snapshot = validateProgram(legacyLines);
    expect(snapshot.dialect).toBe('native');
    expect(snapshot.lines.every((line) => line.dialect === 'native')).toBe(true);
    expect(snapshot.lines[0].statement).not.toBe(legacyLines[0].statement);
    expect(Object.isFrozen(legacyLines[0])).toBe(false);
    expect('dialect' in legacyLines[0]).toBe(false);
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)}, {dialect: 'native'});
    basic.reset(legacy);
    legacyLines.splice(0, legacyLines.length);
    basic.run();
    basic.run();
    expect(output).toEqual(['4\n', '4\n']);
    expect(basic.dialect).toBe('native');
  });

  it.each(['program', 'line'] as const)(
    'rejects unsupported %s metadata before effects and can rerun the previous snapshot',
    async (where) => {
      const effects: string[] = [];
      const basic = new Basic({
        write: (text) => effects.push(text),
        clear: () => effects.push('clear'),
        random: () => {
          effects.push('random');
          return 0.5;
        },
        readLine: () => {
          effects.push('input');
          return Promise.resolve(null);
        },
        wait: () => {
          effects.push('wait');
          return Promise.resolve();
        },
      });
      basic.reset('10 PRINT "retained"');
      const native = parseProgram('10 PRINT RND()\n20 CLS\n30 WAIT 1\n40 INPUT A');
      const candidate =
        where === 'program'
          ? ({...native, dialect: 'basic-plus-1972'} as unknown as Program)
          : ({
              ...native,
              lines: [...native.lines, {...parseLine('50 END')!, dialect: 'basic-plus-1972'}],
            } as unknown as Program);
      expect(() => basic.run(candidate)).toThrow(TypeError);
      expect(basic.status).toBe('error');
      expect(basic.state.diagnostic).toBeNull();
      expect(effects).toEqual([]);
      const failure = await basic.runAsync(candidate).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(TypeError);
      expect(effects).toEqual([]);
      basic.run();
      expect(effects).toEqual(['retained\n']);
    },
  );

  it('copies instance options and prevents immediate source options changing language', async () => {
    const options: LanguageOptions = {dialect: 'native'};
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)}, options);
    const evaluator = new Evaluator({}, options);
    Object.assign(options, {dialect: 'basic-plus-1972'});
    expect(basic.dialect).toBe('native');
    expect(evaluator.dialect).toBe('native');
    expect(Reflect.set(basic, 'dialect', 'basic-plus-1972')).toBe(false);
    expect(Reflect.set(evaluator, 'dialect', 'basic-plus-1972')).toBe(false);
    basic.readLine('10 VALUE=4');
    expect(() => basic.readLine('20 PRINT VALUE', options)).toThrow(TypeError);
    expect(output).toEqual([]);
    basic.reset();
    const failure = await basic
      .readLineAsync('10 PRINT RND()', options)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TypeError);
    expect(output).toEqual([]);
    basic.reset();
    basic.readLine('10 VALUE=5', {dialect: 'native'});
    await basic.readLineAsync('20 PRINT VALUE', {line: 9, dialect: 'native'});
    expect(output).toEqual(['5\n']);
    basic.reset('10 PRINT VALUE');
    expect(() => basic.run()).toThrow(BasicRuntimeError);
    expect(basic.state.diagnostic?.code).toBe('UNDEFINED_VARIABLE');
    basic.run('10 PRINT 6');
    expect(output).toEqual(['5\n', '6\n']);
  });
});

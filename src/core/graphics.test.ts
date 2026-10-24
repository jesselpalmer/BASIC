import {describe, expect, it} from 'bun:test';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  createHost,
  parseLine,
  parseProgram,
  validateProgram,
} from '../index.ts';
import type {GraphicsCommand} from '../index.ts';
import {tokenize} from '../parser/tokenizer.ts';

function diagnostic(action: () => unknown, code: string, label = 10, column?: number) {
  try {
    action();
    throw new Error('Expected a BASIC failure');
  } catch (error) {
    if (!(error instanceof BasicRuntimeError || error instanceof BasicSyntaxError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    expect(error.diagnostic.label).toBe(label);
    if (column !== undefined) expect(error.diagnostic.column).toBe(column);
    return error;
  }
}

function setup() {
  const commands: GraphicsCommand[] = [];
  const events: string[] = [];
  const basic = new Basic({
    draw: (command) => commands.push(command),
    clear: () => events.push('clear'),
    write: (text) => events.push(text),
  });
  return {basic, commands, events};
}

describe('graphics language', () => {
  it('tokenizes complete case insensitive keywords without claiming longer names', () => {
    expect(
      tokenize('10 color circle pset line LINEAR')
        .filter((token) => token.type === 'KEYWORD' || token.type === 'IDENTIFIER')
        .map((token) => [token.type, token.value]),
    ).toEqual([
      ['KEYWORD', 'COLOR'],
      ['KEYWORD', 'CIRCLE'],
      ['KEYWORD', 'PSET'],
      ['KEYWORD', 'LINE'],
      ['IDENTIFIER', 'LINEAR'],
    ]);
    const program = parseProgram(
      '10 color 1+2\n20 pset (1+2),INT(4.9)\n30 line 1,2,3,4\n40 circle 1,2,ABS(-3)',
    );
    expect(program.lines.map((line) => line.statement.type)).toEqual([
      'ColorStatement',
      'PsetStatement',
      'LineStatement',
      'CircleStatement',
    ]);
    expect(program.lines[1].statement.location).toEqual({
      label: 20,
      start: {line: 2, column: 4, offset: 16},
      end: {line: 2, column: 23, offset: 35},
    });
  });

  it('rejects missing, extra, and malformed arguments and reserved variable names', () => {
    for (const source of [
      'COLOR',
      'PSET 1',
      'PSET ,2',
      'PSET 1,',
      'LINE 1,2,3',
      'CIRCLE 1,2',
      'PSET 1;2',
      'COLOR 1,2',
      'PSET 1,2,3',
      'LINE 1,2,3,4,5',
      'CIRCLE 1,2,3,4',
      'PSET (1,2)',
      'LET COLOR=1',
      'LET LINE=1',
      'LET PSET=1',
      'LET CIRCLE=1',
    ]) {
      expect(() => parseLine(`10 ${source}`)).toThrow(BasicSyntaxError);
    }
  });

  it('preflights numeric argument types on unreachable lines before any effects', () => {
    const {basic, commands, events} = setup();
    for (const source of ['COLOR "red"', 'PSET 1,"y"', 'LINE 1,2,3,S$', 'CIRCLE 1,2,("radius")']) {
      diagnostic(() => basic.run(`1 PRINT "bad"\n2 END\n10 ${source}`), 'TYPE_MISMATCH');
    }
    expect(commands).toEqual([]);
    expect(events).toEqual([]);
  });

  it('copies and freezes all graphics ASTs without retaining or freezing the candidate', () => {
    const candidate = structuredClone(
      parseProgram('10 COLOR 2\n20 PSET 1,2\n30 LINE 1,2,3,4\n40 CIRCLE 1,2,3').lines,
    );
    const snapshot = validateProgram(candidate);
    for (let index = 0; index < candidate.length; index++) {
      expect(snapshot.lines[index].statement).not.toBe(candidate[index].statement);
      expect(Object.isFrozen(snapshot.lines[index].statement)).toBe(true);
      expect(Object.isFrozen(candidate[index].statement)).toBe(false);
    }
    const color = candidate[0].statement;
    if (color.type !== 'ColorStatement') throw new Error('Expected COLOR');
    Object.assign(color.color, {value: 15});
    const {basic, commands} = setup();
    basic.run(snapshot);
    expect(commands.map((command) => command.color)).toEqual([2, 2, 2]);
  });
});

describe('graphics execution', () => {
  it('draws self-contained frozen primitives, rounds ties toward positive infinity, and preserves pen across CLS', () => {
    const {basic, commands, events} = setup();
    basic.run(
      '10 PSET -1.5,2.5\n20 COLOR 0\n30 LINE 1.4,2.5,-.5,-1.5\n40 CLS\n50 CIRCLE 160,100,.5\n60 PRINT "ok"',
    );
    expect(commands).toEqual([
      {kind: 'pset', x: -1, y: 3, color: 7},
      {kind: 'line', x1: 1, y1: 3, x2: 0, y2: -1, color: 0},
      {kind: 'circle', x: 160, y: 100, radius: 1, color: 0},
    ]);
    expect(commands.every(Object.isFrozen)).toBe(true);
    expect(events).toEqual(['clear', 'ok\n']);
  });

  it('evaluates arguments left to right exactly once before drawing', () => {
    const events: (number | GraphicsCommand)[] = [];
    let next = 0;
    const basic = new Basic({
      random: () => {
        events.push(++next);
        return next / 10;
      },
      draw: (command) => events.push(command),
    });
    basic.run('10 LINE RND()*10,RND()*10,RND()*10,RND()*10');
    expect(events).toEqual([1, 2, 3, 4, {kind: 'line', x1: 1, y1: 2, x2: 3, y2: 4, color: 7}]);
    const bad = new Basic({
      random: () => {
        events.push(5);
        return 0.5;
      },
      draw: (command) => events.push(command),
    });
    diagnostic(() => bad.readLine('10 PSET "bad",RND()'), 'TYPE_MISMATCH', 10, 9);
    expect(events.at(-1)).toBe(5);
  });

  it('reports located numeric, color and radius failures without sending a command', () => {
    const {basic, commands} = setup();
    for (const source of ['COLOR -1', 'COLOR 16', 'COLOR .5'])
      diagnostic(() => basic.run(`10 ${source}`), 'INVALID_COLOR', 10, 10);
    diagnostic(() => basic.run('10 CIRCLE 1,2,-.1'), 'INVALID_RADIUS', 10, 15);
    diagnostic(() => basic.run('10 PSET 9007199254740992,0'), 'GRAPHICS_RANGE', 10, 9);
    diagnostic(() => basic.run('10 CIRCLE 1,2,9007199254740992'), 'GRAPHICS_RANGE', 10, 15);
    diagnostic(() => basic.run('10 PSET MISSING,0'), 'UNDEFINED_VARIABLE', 10, 9);
    diagnostic(() => basic.run('10 LINE 1,2,1/0,4'), 'DIVISION_BY_ZERO', 10, 14);
    const huge = '9'.repeat(308);
    diagnostic(() => basic.run(`10 PSET ${huge}*2,0`), 'NON_FINITE_NUMBER');
    expect(commands).toEqual([]);
  });

  it('permits safe offcanvas coordinates and zero-radius circles for bounded host clipping', () => {
    const {basic, commands} = setup();
    basic.run(
      '10 PSET -9007199254740991,9007199254740991\n20 CIRCLE 0,0,0\n30 LINE -9007199254740991,0,9007199254740991,0',
    );
    expect(commands).toHaveLength(3);
    expect(commands[1]).toEqual({kind: 'circle', x: 0, y: 0, radius: 0, color: 7});
  });

  it('resets pen on rerun/reset, keeps instance state separate, and adds no reset effects', async () => {
    const first = setup();
    const second = setup();
    first.basic.readLine('10 COLOR 15');
    first.basic.readLine('20 PSET 1,2');
    second.basic.run('10 PSET 1,2');
    first.basic.reset('10 PSET 3,4');
    expect(first.events).toEqual([]);
    first.basic.step();
    await first.basic.runAsync();
    expect(first.commands.map((command) => command.color)).toEqual([15, 7, 7]);
    expect(second.commands[0].color).toBe(7);
  });

  it('fails unsupported hosts at the attempted BASIC statement, including COLOR', () => {
    for (const source of ['COLOR 2', 'PSET 1,2', 'LINE 1,2,3,4', 'CIRCLE 1,2,3']) {
      const basic = new Basic();
      diagnostic(() => basic.run(`1 REM\n10 ${source}`), 'GRAPHICS_UNAVAILABLE', 10, 4);
      expect(basic.state.currentLocation?.label).toBe(10);
      expect(basic.state.status).toBe('error');
    }
    expect(new Basic().run('10 END\n20 PSET 1,2').status).toBe('halted');
  });

  it('binds and snapshots optional host callbacks and normalizes failures', () => {
    const commands: GraphicsCommand[] = [];
    const provider = {
      commands,
      draw(command: GraphicsCommand) {
        this.commands.push(command);
      },
    };
    const basic = new Basic(provider);
    provider.draw = () => {
      throw new Error('replacement');
    };
    basic.run('10 PSET 1,2');
    expect(commands).toHaveLength(1);
    expect(Object.isFrozen(basic.host)).toBe(true);
    expect(Object.hasOwn(createHost(), 'draw')).toBe(false);
    expect(() => {
      Reflect.apply(createHost, undefined, [{draw: 1}]);
    }).toThrow('Host draw must be a function');
    const cause = new Error('canvas failed');
    const error = diagnostic(
      () =>
        new Basic({
          draw: () => {
            throw cause;
          },
        }).run('10 PSET 1,2'),
      'HOST_ERROR',
      10,
      4,
    );
    expect(error.cause).toBe(cause);
  });

  it('guards mutation reentrancy inside drawing and random callbacks', () => {
    let basic: Basic;
    basic = new Basic({draw: () => basic.reset()});
    const error = diagnostic(() => basic.run('10 PSET 1,2'), 'HOST_ERROR');
    expect(error.cause).toEqual(new Error('Cannot change execution during a statement'));
    const events: string[] = [];
    basic = new Basic({
      random: () => {
        expect(() => basic.cancel()).toThrow('Cannot change execution during a statement');
        return 0.5;
      },
      draw: () => {
        events.push('draw');
        expect(() => basic.step()).toThrow('Cannot change execution during a statement');
      },
    });
    basic.run('10 PSET RND(),0');
    expect(events).toEqual(['draw']);
  });
});

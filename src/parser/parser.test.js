import {parseLine, parseProgram, validateProgram} from '../index.js';
import {BasicSyntaxError} from '../core/diagnostic.js';

// Display tree shape without source spans; this does not evaluate expressions.
function shape(node) {
  switch (node.type) {
    case 'NumberLiteral': return node.value;
    case 'StringLiteral': return ['string', node.value];
    case 'Variable': return ['variable', node.name];
    case 'GroupExpression': return ['group', shape(node.expression)];
    case 'UnaryExpression': return [node.operator, shape(node.argument)];
    case 'BinaryExpression':
      return [node.operator, shape(node.left), shape(node.right)];
    case 'CallExpression': return [node.name, ...node.arguments.map(shape)];
    default: throw new Error(`Unexpected expression ${node.type}`);
  }
}

function diagnostic(parse) {
  try {
    parse();
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    return error.diagnostic;
  }
  throw new Error('Expected parsing to fail');
}

describe('expression parsing', () => {
  it.each([
    ['1+2*3', ['+', 1, ['*', 2, 3]]],
    ['8/4*2-3+1', ['+', ['-', ['*', ['/', 8, 4], 2], 3], 1]],
    ['10-3-2', ['-', ['-', 10, 3], 2]],
    ['24/6/2', ['/', ['/', 24, 6], 2]],
    ['-2*+3', ['*', ['-', 2], ['+', 3]]],
    ['--+2', ['-', ['-', ['+', 2]]]],
    ['-(2+3)*4', ['*', ['-', ['group', ['+', 2, 3]]], 4]],
    ['int(rnd()*100)+abs(-.5)',
      ['+', ['INT', ['*', ['RND'], 100]], ['ABS', ['-', 0.5]]]],
    ['"a"+name$+"b"',
      ['+', ['+', ['string', 'a'], ['variable', 'NAME$']], ['string', 'b']]],
  ])('represents precedence and associativity for %s', (source, expected) => {
    const line = parseLine(`10 LET a = ${source}`);
    expect(line.statement.target).toMatchObject({type: 'Variable', name: 'A'});
    expect(shape(line.statement.expression)).toEqual(expected);
  });

  it('retains literal spelling and decoded string values', () => {
    const statement = parseLine('10 PRINT 01.50;"MiX ""Hi""\\n"').statement;
    expect(statement.items).toMatchObject([
      {type: 'NumberLiteral', value: 1.5, raw: '01.50'},
      {type: 'StringLiteral', value: 'MiX "Hi"\\n', raw: '"MiX ""Hi""\\n"'},
    ]);
  });

  it('records operators, groups, arguments, and names at their source spans',
      () => {
        const source = '10 PRINT -(2+INT(3))';
        const unary = parseLine(source).statement.items[0];
        const group = unary.argument;
        const addition = group.expression;
        const call = addition.right;
        expect(unary.operatorLocation).toMatchObject({
          label: 10, start: {column: 10, offset: 9}, end: {column: 11},
        });
        expect(group.location).toMatchObject({
          start: {column: 11}, end: {column: 21},
        });
        expect(addition.operatorLocation.start.column).toBe(13);
        expect(call.nameLocation.start.column).toBe(14);
        expect(call.arguments[0].location.start.column).toBe(18);
        expect(source.slice(call.location.start.offset,
            call.location.end.offset)).toBe('INT(3)');
      });

  it('leaves arity, types, and arithmetic to evaluation', () => {
    const program = parseProgram([
      '10 LET A = "text"', '20 PRINT ABS(); RND(1); INT(1,2)',
      '30 PRINT unknown/0',
    ].join('\n'));
    expect(program.lines[1].statement.items.map((node) =>
      node.arguments.length)).toEqual([0, 1, 2]);
    expect(shape(program.lines[2].statement.items[0]))
        .toEqual(['/', ['variable', 'UNKNOWN'], 0]);
  });
});

describe('statement parsing', () => {
  it('preserves PRINT separators and its trailing-semicolon intent', () => {
    const line = parseLine('10 print "Hi"; n;');
    expect(line.statement).toMatchObject({
      type: 'PrintStatement', trailingSemicolon: true,
      items: [
        {type: 'StringLiteral', value: 'Hi'}, {type: 'Variable', name: 'N'},
      ],
      separators: [
        {start: {column: 14, offset: 13}, end: {column: 15}},
        {start: {column: 17, offset: 16}, end: {column: 18}},
      ],
      location: {start: {column: 4}, end: {column: 18}},
    });
    const normal = parseLine('20 PRINT "Hi"; n').statement;
    expect(normal.trailingSemicolon).toBe(false);
  });

  it('accepts blank PRINT and empty string output', () => {
    expect(parseLine('10 PRINT').statement).toMatchObject({
      type: 'PrintStatement', items: [], separators: [],
      trailingSemicolon: false,
    });
    expect(parseLine('20 PRINT "";').statement).toMatchObject({
      items: [{type: 'StringLiteral', value: ''}], trailingSemicolon: true,
    });
  });

  it('parses REM, CLS, and END without interpreting comment text', () => {
    const program = parseProgram('10 rem "bad <> : @\n20 cls\n30 end\n40 REM');
    expect(program.lines.map((line) => line.statement.type)).toEqual([
      'RemStatement', 'ClsStatement', 'EndStatement', 'RemStatement',
    ]);
    expect(program.lines[0].statement.text).toBe(' "bad <> : @');
    expect(program.lines[3].statement.text).toBe('');
  });

  it('parses independent edits without whole-program checks', () => {
    const one = parseLine('10 LET A = MISSING + 1');
    const replacement = parseLine('10 PRINT A');
    expect(one.label).toBe(replacement.label);
    expect(one.statement.type).toBe('LetStatement');
    expect(replacement.statement.type).toBe('PrintStatement');
    expect(() => validateProgram([one, replacement]))
        .toThrow('Duplicate line label 10');
  });

  it.each(['', ' \t', '\r\n\t \n'])(
      'returns null for a blank edit %s', (source) => {
        expect(parseLine(source)).toBeNull();
      },
  );

  it.each([
    ['10', 'EXPECTED_STATEMENT', 3],
    ['10 LET', 'EXPECTED_TOKEN', 7],
    ['10 LET PRINT = 1', 'EXPECTED_TOKEN', 8],
    ['10 LET ABS = 1', 'EXPECTED_TOKEN', 8],
    ['10 LET A 1', 'EXPECTED_TOKEN', 10],
    ['10 LET A =', 'EXPECTED_EXPRESSION', 11],
    ['10 LET A = 1 2', 'UNEXPECTED_TOKEN', 14],
    ['10 PRINT ;', 'EXPECTED_EXPRESSION', 10],
    ['10 PRINT 1;;2', 'EXPECTED_EXPRESSION', 12],
    ['10 PRINT 1,2', 'UNEXPECTED_TOKEN', 11],
    ['10 PRINT (1+2', 'EXPECTED_TOKEN', 14],
    ['10 PRINT ()', 'EXPECTED_EXPRESSION', 11],
    ['10 PRINT 1+', 'EXPECTED_EXPRESSION', 12],
    ['10 PRINT 1=2', 'UNEXPECTED_TOKEN', 11],
    ['10 PRINT 1<2', 'UNEXPECTED_TOKEN', 11],
    ['10 PRINT ABS', 'EXPECTED_TOKEN', 13],
    ['10 PRINT ABS(,1)', 'EXPECTED_EXPRESSION', 14],
    ['10 PRINT ABS(1,)', 'EXPECTED_EXPRESSION', 16],
    ['10 PRINT ABS(1 2)', 'EXPECTED_TOKEN', 16],
    ['10 PRINT FOO(1)', 'UNKNOWN_FUNCTION', 10],
    ['10 CLS 1', 'UNEXPECTED_TOKEN', 8],
    ['10 END "extra"', 'UNEXPECTED_TOKEN', 8],
    ['10 "PRINT" "x"', 'UNSUPPORTED_STATEMENT', 4],
    ['10 A = 1', 'UNSUPPORTED_STATEMENT', 4],
    ['10 ABS "1"', 'UNSUPPORTED_STATEMENT', 4],
    ['10 INPUT N', 'UNSUPPORTED_STATEMENT', 4],
    ['10 GOTO 50', 'UNSUPPORTED_STATEMENT', 4],
    ['10 FOR I = 1 TO 5', 'UNSUPPORTED_STATEMENT', 4],
  ])('rejects invalid or not-yet-supported syntax: %s',
      (source, code, column) => {
        expect(diagnostic(() => parseLine(source))).toMatchObject({
          code, label: 10, line: 1, column, offset: column - 1,
        });
      });

  it('rejects a second statement passed as one edit', () => {
    expect(diagnostic(() => parseLine('10 REM\n20 END'))).toMatchObject({
      code: 'INVALID_STATEMENT', label: 20, line: 2, column: 1, offset: 7,
    });
  });
});

describe('program snapshots', () => {
  it('sorts numerically while retaining source spelling and file positions',
      () => {
        const source = '\r\n\t020 PRINT "MiX"  \r\n\n 3 END\n100 REM hi';
        const program = parseProgram(source);
        expect(program.lines.map((line) => line.label)).toEqual([3, 20, 100]);
        expect(program.lines[1].source).toBe('\t020 PRINT "MiX"  ');
        expect(program.lines[1].location).toMatchObject({
          label: 20, start: {line: 2, column: 2, offset: 3},
          end: {line: 2, column: 17, offset: 18},
        });
        expect(program.lines[0].location.start.line).toBe(4);
        expect(program.lines[2].location.start.line).toBe(5);
      });

  it('preserves a supplied file origin when parsing one line', () => {
    const source = '\t10 LET n = 2';
    const line = parseLine(source, {line: 7, offset: 90});
    expect(line.source).toBe(source);
    expect(line.location.start).toEqual({line: 7, column: 2, offset: 91});
    expect(line.statement.expression.location.start)
        .toEqual({line: 7, column: 13, offset: 102});
  });

  it('rejects duplicate labels at the second occurrence in original order',
      () => {
        expect(diagnostic(() => parseProgram('10 END\r\n\t010 PRINT "x"')))
            .toMatchObject({
              code: 'DUPLICATE_LABEL', label: 10,
              line: 2, column: 2, offset: 9,
            });
      });

  it('validates syntax on every line, including after END', () => {
    expect(diagnostic(() => parseProgram('10 END\n20 LET A =')))
        .toMatchObject({
          code: 'EXPECTED_EXPRESSION', label: 20,
          line: 2, column: 11, offset: 17,
        });
    expect(diagnostic(() => parseProgram('10 END\n20 PRINT "bad')))
        .toMatchObject({code: 'UNTERMINATED_STRING', label: 20, line: 2});
  });

  it('does not replace a stored program when a candidate fails', () => {
    let stored = parseProgram('10 PRINT "saved"\n20 END');
    const original = stored;
    expect(() => {
      stored = parseProgram('30 PRINT 1+');
    }).toThrow(BasicSyntaxError);
    expect(stored).toBe(original);
    expect(stored.lines[0].statement.items[0].value).toBe('saved');
    expect(parseProgram('10 PRINT "next"').lines[0].label).toBe(10);
  });

  it('deeply freezes snapshots without changing candidates', () => {
    const candidate = [parseLine('20 END'), parseLine('10 PRINT 1+2;')];
    const program = validateProgram(candidate);
    expect(candidate.map((line) => line.label)).toEqual([20, 10]);
    expect(Object.isFrozen(candidate)).toBe(false);
    expect(program.lines[0]).not.toBe(candidate[1]);
    candidate[1] = parseLine('10 PRINT 99');
    expect(shape(program.lines[0].statement.items[0])).toEqual(['+', 1, 2]);
    expect(() => program.lines.push(candidate[1])).toThrow(TypeError);
    expect(() => {
      program.lines[0].statement.items[0].left.value = 99;
    }).toThrow(TypeError);
    expect(() => {
      program.lines[0].statement.separators[0].start.column = 99;
    }).toThrow(TypeError);
    expect(() => {
      parseLine('10 PRINT 1').statement.items[0].value = 99;
    }).toThrow(TypeError);
  });

  it('does not modify candidate lines when full validation fails', () => {
    const candidate = [parseLine('20 END'), parseLine('020 CLS')];
    expect(() => validateProgram(candidate)).toThrow('Duplicate line label 20');
    expect(candidate.map((line) => line.source)).toEqual(['20 END', '020 CLS']);
    expect(Object.isFrozen(candidate)).toBe(false);
  });

  it('accepts an empty program', () => {
    expect(parseProgram('\n \t\r\n')).toEqual({type: 'Program', lines: []});
    expect(validateProgram([])).toEqual({type: 'Program', lines: []});
  });

  it('handles long flat expressions without recursive copying/freezing', () => {
    const program = parseProgram(`10 PRINT ${Array(3000).fill('1').join('+')}`);
    let node = program.lines[0].statement.items[0];
    let operators = 0;
    while (node.type === 'BinaryExpression') {
      expect(node.operator).toBe('+');
      expect(Object.isFrozen(node)).toBe(true);
      operators++;
      node = node.left;
    }
    expect(operators).toBe(2999);
    expect(node.value).toBe(1);
  });

  it.each([
    `${'('.repeat(300)}1${')'.repeat(300)}`,
    `${'-'.repeat(300)}1`,
    `${'ABS('.repeat(300)}1${')'.repeat(300)}`,
  ])('reports excessive nesting with a BASIC diagnostic', (expression) => {
    expect(diagnostic(() => parseProgram(`10 PRINT ${expression}`)))
        .toMatchObject({code: 'EXPRESSION_TOO_DEEP', label: 10, line: 1});
  });
});

import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {validateBasicPlusMa2Candidate} from '../parser/ma2_candidate_validation.ts';
import {parseBasicPlusMa2Candidate} from '../parser/parser.ts';
import Basic from './runtime.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import {injectMa2Value} from './ma2_value.ts';
import {Ma2StatementOutput} from './ma2_statement_output.ts';
import type {Expression, NodeOf} from './types.ts';
import type {Ma2Value} from './ma2_value.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
const instructions = validateBasicPlusMa2Candidate(fixture).instructions;
function statement(label: number): NodeOf<'PrintStatement'> | NodeOf<'PrintUsingStatement'> {
  const found = instructions.find((instruction) => instruction.label === label)?.statement;
  if (found?.type !== 'PrintStatement' && found?.type !== 'PrintUsingStatement')
    throw Error(`Missing PRINT ${label}`);
  return found;
}
function number(value: number) {
  const bound = injectMa2Value(value);
  if (bound.kind !== 'value') throw Error('Expected exact MA2 value');
  return bound.value;
}

describe('selected MA2 statement output', () => {
  test('runs source PRINT commas through the manual five 14-column zones', () => {
    // BASIC-PLUS Oct 1972 §3.3.2 shows five zones and a sixth item on a new line.
    const source = '10 PRINT 3,2,5,6,1,-1\n20 END';
    const result = createSelectedMa2Session(source).advance();
    expect(result.status).toBe('halted');
    expect(result.output).toBe(
      ' 3             2             5             6             1 \n-1 \n',
    );
    const line = parseBasicPlusMa2Candidate(source)[0].statement;
    expect(line.type).toBe('PrintStatement');
    if (line.type !== 'PrintStatement') throw Error('Expected PRINT');
    expect(line.candidateSeparators).toEqual(['comma', 'comma', 'comma', 'comma', 'comma', null]);
    expect(Object.isFrozen(line.candidateSeparators)).toBe(true);
    expect(() => new Basic().run(source)).toThrow();
  });

  test('preserves mixed selected separators and source-bound supplied punctuation', () => {
    const source = '10 PRINT 1;2,3;4\n20 PRINT 5,\n30 PRINT 6\n40 END';
    expect(createSelectedMa2Session(source).advance().output).toBe(
      ' 1  2          3  4 \n 5             6 \n',
    );
    const supplied = structuredClone(parseBasicPlusMa2Candidate(source));
    const first = supplied[0].statement;
    if (first.type !== 'PrintStatement') throw Error('Expected PRINT');
    Reflect.set(first.candidateSeparators!, 0, 'comma');
    expect(() => createSelectedMa2Session(source, 100, supplied)).toThrow(
      'disagrees with its source',
    );
  });

  test('keeps PRINT USING terminal semicolon separate from ordinary comma metadata', () => {
    const parsed = parseBasicPlusMa2Candidate('10 PRINT USING B$,1;')[0].statement;
    if (parsed.type !== 'PrintUsingStatement') throw Error('Expected PRINT USING');
    const output = new Ma2StatementOutput(() => {});
    expect(
      output.execute(parsed, (expression) => (expression.type === 'Variable' ? '##' : number(1))),
    ).toEqual({kind: 'value', text: ' 1', column: 2});
  });

  test('renders the reviewed numbered board and initial 48-piece position through parsed statements', () => {
    const writes: string[] = [];
    const output = new Ma2StatementOutput((text) => writes.push(text));
    const image = '## ##  ##  ##  ##  ##  ##  ##';
    const resolveNumbers = (offset: number) => (expression: Expression) => {
      if (expression.type === 'Variable') return expression.name === 'B$' ? image : number(offset);
      if (expression.type === 'BinaryExpression' && expression.right.type === 'Ma2NumberLiteral')
        return number(offset + Number(expression.right.raw));
      throw Error('Unexpected fixture expression');
    };
    for (const row of [1, 9, 17, 25, 33, 41, 49, 57])
      expect(output.execute(statement(74), resolveNumbers(row)).kind).toBe('value');
    const expectedNumbers = [
      ' 1  2   3   4   5   6   7   8',
      ' 9 10  11  12  13  14  15  16',
      '17 18  19  20  21  22  23  24',
      '25 26  27  28  29  30  31  32',
      '33 34  35  36  37  38  39  40',
      '41 42  43  44  45  46  47  48',
      '49 50  51  52  53  54  55  56',
      '57 58  59  60  61  62  63  64',
    ];
    expect(writes.join('')).toBe(expectedNumbers.join('\n') + '\n');

    writes.length = 0;
    const squares = Array.from({length: 64}, (_, index) =>
      [19, 20, 21, 22, 27, 28, 29, 30, 35, 36, 37, 38, 43, 44, 45, 46].includes(index + 1) ? 0 : 1,
    );
    expect(squares.reduce<number>((sum, cell) => sum + cell, 0)).toBe(48);
    for (let row = 0; row < 8; row++) {
      for (let cell = 0; cell < 8; cell++) {
        const index = row * 8 + cell;
        expect(output.execute(statement(360), () => number(squares[index])).kind).toBe('value');
      }
      output.execute(statement(380), () => {
        throw Error('Bare PRINT must not evaluate');
      });
    }
    const expectedRows = Array.from(
      {length: 8},
      (_, row) =>
        Array.from({length: 8}, (_, cell) => ` ${squares[row * 8 + cell]} `).join('') + '\n',
    );
    expect(writes.join('')).toBe(expectedRows.join(''));
    expect(output.column).toBe(0);
    squares[0] = 0;
    squares[9] = 0;
    squares[18] = 1;
    expect(squares.reduce<number>((sum, cell) => sum + cell, 0)).toBe(47);
    writes.length = 0;
    for (let row = 0; row < 8; row++) {
      for (let cell = 0; cell < 8; cell++)
        output.execute(statement(360), () => number(squares[row * 8 + cell]));
      output.execute(statement(380), () => {
        throw Error('Unexpected read');
      });
    }
    expect(writes.join('')).toBe(
      Array.from(
        {length: 8},
        (_, row) =>
          Array.from({length: 8}, (_, cell) => ` ${squares[row * 8 + cell]} `).join('') + '\n',
      ).join(''),
    );
    expect(
      output.execute(statement(540), (expression) =>
        expression.type === 'StringLiteral'
          ? expression.value
          : expression.type === 'Variable'
            ? number(expression.name === 'M' ? 1 : 47)
            : (() => {
                throw Error('Unexpected summary expression');
              })(),
      ),
    ).toEqual({kind: 'value', text: 'YOU MADE 1 JUMPS AND HAD 47 PIECES\n', column: 0});
  });

  test('carries semicolon output into a following statement and resets for a fresh run', () => {
    const writes: string[] = [];
    const output = new Ma2StatementOutput((text) => writes.push(text));
    expect(output.execute(statement(360), () => number(1))).toEqual({
      kind: 'value',
      text: ' 1 ',
      column: 3,
    });
    expect(
      output.execute(statement(380), () => {
        throw Error('Unexpected read');
      }),
    ).toEqual({kind: 'value', text: '\n', column: 0});
    output.execute(statement(360), () => number(0));
    output.reset();
    expect(output.column).toBe(0);
    expect(writes).toEqual([' 1 ', '\n', ' 0 ']);
  });

  test('does not write or advance cursor on unsupported value, image, or failed host write', () => {
    const writes: string[] = [];
    const output = new Ma2StatementOutput((text) => writes.push(text));
    expect(output.execute(statement(360), () => number(0.5))).toEqual({
      kind: 'unsupported',
      reason: 'integer-domain',
    });
    expect(output.execute(statement(74), () => 'bad')).toEqual({
      kind: 'unsupported',
      reason: 'image',
    });
    const image = '## ##  ##  ##  ##  ##  ##  ##';
    expect(
      output.execute(statement(74), (expression) =>
        expression.type === 'Variable' && expression.name === 'B$' ? image : 'text',
      ),
    ).toEqual({kind: 'unsupported', reason: 'integer-domain'});
    const fourWords = {kind: 'ma2', words: [0, 0, 0, 0]} as unknown as Ma2Value;
    expect(
      output.execute(statement(74), (expression) =>
        expression.type === 'Variable' && expression.name === 'B$' ? image : fourWords,
      ),
    ).toEqual({kind: 'unsupported', reason: 'numeric-observation'});
    expect(output.execute(statement(360), () => fourWords)).toEqual({
      kind: 'unsupported',
      reason: 'numeric-observation',
    });
    expect(writes).toEqual([]);
    expect(output.column).toBe(0);
    const failed = new Ma2StatementOutput(() => {
      throw Error('host');
    });
    expect(() => failed.execute(statement(360), () => number(1))).toThrow('host');
    expect(failed.column).toBe(0);
  });
});

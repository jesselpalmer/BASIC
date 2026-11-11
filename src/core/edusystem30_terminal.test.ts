import {expect, test} from 'bun:test';
import {Basic, parseProgram} from '../index.ts';

const options = {dialect: 'edusystem-30'} as const;

test('EDUSYSTEM-30 TAB wraps and rounds targets before comparing the current column', () => {
  const cases = [
    ['0', '\r\0'],
    ['2', '\r\0  '],
    ['2+1/(1000*10)', ''],
    ['3', ''],
    ['3+.5', ' '],
    ['4+.5', '  '],
    ['69+9/10', ' '.repeat(67)],
    ['70', '\r\0'],
    ['70+1/10', '\r\0 '],
    ['142', '\r\0  '],
    ['0-.5', ' '.repeat(67)],
    ['0-1', ' '.repeat(66)],
    ['0-70', '\r\0'],
  ];
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  const lines = cases.map(
    ([target], index) => `${(index + 1) * 10} PRINT "ABC";TAB(${target});"X"`,
  );
  basic.run([...lines, '200 END'].join('\n'));
  expect(output).toBe(cases.map(([, movement]) => `ABC${movement}X\n`).join(''));
});

test('EDUSYSTEM-30 preserves column across semicolons and clears it for fresh runs', () => {
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  basic.run(
    '10 PRINT TAB(4);"B";\n20 PRINT TAB(2);"C";\n30 PRINT TAB(6);"D"\n40 PRINT TAB(4);"E";\n50 END',
  );
  expect(output).toBe('    B\r\0  C   D\n    E');
  output = '';
  basic.run('10 PRINT TAB(2);"X"\n20 END');
  expect(output).toBe('  X\n');
});

test('EDUSYSTEM-30 TAB follows numeric line input, buffered fields, and character echo', async () => {
  const answers = ['1,2', '3', 'Q', ''];
  const prompts: (string | undefined)[] = [];
  let output = '';
  const basic = new Basic(
    {
      readLine: (prompt) => {
        prompts.push(prompt);
        return Promise.resolve(answers.shift() ?? null);
      },
      write: (text) => (output += text),
    },
    options,
  );
  await basic.runAsync(
    '10 INPUT A\n20 PRINT "ABCD";\n30 INPUT B\n40 PRINT TAB(3);"X"\n' +
      '50 PRINT "Z";\n60 INPUT N\n70 PRINT TAB(N);"X"\n' +
      '80 PRINT "ABC";\n90 INPUT $C\n100 PRINT TAB(3);"X"\n' +
      '110 PRINT "ABC";\n120 INPUT $D\n130 PRINT TAB(3);"X"\n' +
      '140 PRINT "ABC";CHR$(7);TAB(3);"X"\n150 END',
  );
  expect(prompts).toEqual(['?', '?', '', '']);
  expect(output).toBe('ABCD\r\0   X\nZ   X\nABC\r\0   X\nABC\r\0   X\nABC\x07\r\0   X\n');
});

test('EDUSYSTEM-30 limits TAB to one numeric PRINT argument and retains atomic output', () => {
  for (const statement of ['LET A=TAB(2)', 'PRINT TAB(1,2)', 'PRINT TAB("X")', 'PRINT TAB(1)+1']) {
    expect(() => parseProgram(`10 ${statement}\n20 END`, options)).toThrow();
  }
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, options);
  expect(() => basic.run('10 PRINT "prefix";TAB(1/0)\n20 END')).toThrow();
  expect(writes).toEqual([]);

  new Basic({write: (text) => writes.push(text)}).run(
    '10 DIM TAB(2)\n20 TAB(2)=9\n30 PRINT TAB(2)\n40 END',
  );
  expect(writes).toEqual(['9\n']);
});

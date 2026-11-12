import {expect, test} from 'bun:test';
import blackjack from '../../docs/blkjak-edusystem30-reference.json';
import golf from '../../docs/golf-edusystem30-reference.json';
import {Basic, parseProgram} from '../index.ts';
import {decodeSourceDocument, encodeSourceDocument} from './source_document.ts';

const space = {dialect: 'edusystem-30'} as const;
const mark = {dialect: 'edusystem-30-mark'} as const;

test('EDUSYSTEM-30 character literals always compile to archived marked ASCII', () => {
  const {source, output} = golf.probes[0];
  for (const options of [space, mark]) {
    let printed = '';
    new Basic({write: (text) => (printed += text)}, options).run(source);
    expect(printed).toBe(output);
  }
  expect(() => parseProgram(source)).toThrow('Unexpected character');
  expect(() => parseProgram('10 PRINT #a\n20 END', mark)).toThrow('character literal');
});

test('EDUSYSTEM-30 character input selects parity through the portable document', async () => {
  const {source, answer, runs} = golf.characterInputParity;
  for (const options of [space, mark]) {
    let printed = '';
    const document = decodeSourceDocument(encodeSourceDocument(source, options));
    expect(document.dialect).toBe(options.dialect);
    const program = parseProgram(document.source, document);
    const basic = new Basic(
      {readLine: () => Promise.resolve(answer), write: (text) => (printed += text)},
      document,
    );
    await basic.runAsync(program);
    const expected = runs.find(({parity}) => parity === (options === mark ? 'mark' : 'space'));
    expect(printed).toBe('LETTER\n' + expected?.output);
  }
  expect(() => new Basic({}, space).reset(parseProgram(source, mark))).toThrow('conflicting');
});

test('EDUSYSTEM-30 numeric CHR$ reproduces archived conversion and PRINT adjacency', () => {
  let printed = '';
  const basic = new Basic({write: (text) => (printed += text)}, mark);
  basic.run(blackjack.characterProbe.source.join('\n'));
  expect(printed).toBe(blackjack.characterProbe.output);
  printed = '';
  basic.run('10 PRINT 1 CHR$(#A) 2\n20 END');
  expect(printed).toBe(' 1 A 2 \n');
});

test('EDUSYSTEM-30 CHR$ bounds terminal controls before emitting PRINT output', () => {
  let printed = '';
  const basic = new Basic({write: (text) => (printed += text)}, mark);
  expect(() => basic.run('10 PRINT CHR$(8)\n20 END')).toThrow('printable CHR$');
  expect(() => basic.run('10 A=1E50\n20 PRINT "PREFIX";CHR$(A)\n30 END')).toThrow(
    'printable terminal character',
  );
  expect(printed).toBe('');
});

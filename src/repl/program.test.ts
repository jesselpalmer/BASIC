import {expect, it} from 'bun:test';
import StoredProgram from './program.ts';
import {parseProgram} from '../parser/parser.ts';
import type {Program} from '../core/types.ts';

it('stores, replaces, deletes, sorts, and clears source independently of snapshots', () => {
  const source = new StoredProgram();
  expect(source.source).toBe('');
  expect(source.dirty).toBe(false);
  source.edit('20 PRINT "later"');
  source.edit('\t010\tPRINT "MiXeD"');
  const before = source.source;
  expect(before).toBe('\t010\tPRINT "MiXeD"\n20 PRINT "later"');
  source.edit('10 GOTO 30');
  source.edit('30 FOR I=1 TO 2');
  expect(before).toBe('\t010\tPRINT "MiXeD"\n20 PRINT "later"');
  expect(source.source).toBe('10 GOTO 30\n20 PRINT "later"\n30 FOR I=1 TO 2');
  source.edit('20');
  source.edit(' \t999\t ');
  source.edit('');
  expect(source.source).toBe('10 GOTO 30\n30 FOR I=1 TO 2');
  expect(source.dirty).toBe(true);
  source.clear();
  expect(source.source).toBe('');
  expect(source.dirty).toBe(false);
});

it('rejects invalid replacement syntax and labels without changing prior source or dirty state', () => {
  const source = new StoredProgram();
  for (const text of ['0', '65536', '0 PRINT 1', '10 PRINT "unfinished']) {
    expect(() => source.edit(text)).toThrow();
    expect(source.source).toBe('');
    expect(source.dirty).toBe(false);
  }
  source.edit('65535 END');
  for (const text of ['65535 PRINT 1+', '65535 END\n10 END']) {
    expect(() => source.edit(text)).toThrow();
    expect(source.source).toBe('65535 END');
    expect(source.dirty).toBe(true);
  }
  source.edit('65535');
  expect(source.dirty).toBe(false);
});

it('retains common classic spellings through stored edits and validation', () => {
  const source = new StoredProgram();
  source.edit('30 PRINT GO');
  source.edit('10 go = 2');
  source.edit('20 GO TO 30');
  const expected = '10 go = 2\n20 GO TO 30\n30 PRINT GO';
  expect(source.source).toBe(expected);
  const snapshot = parseProgram(source.source);
  source.replace(snapshot, 'classic.bas');
  expect(source.source).toBe(expected);
  expect(source.dirty).toBe(false);
  expect(() => source.edit('20 GO TO nope')).toThrow();
  expect(source.source).toBe(expected);
  expect(source.dirty).toBe(false);
});

it('tracks the current filename and saved baseline through edits, loads, and NEW', () => {
  const source = new StoredProgram();
  expect(source.filename).toBeNull();
  source.edit('10 END');
  source.saved('First File.bas');
  expect(source.filename).toBe('First File.bas');
  expect(source.dirty).toBe(false);
  source.edit('10 END');
  source.edit('20');
  expect(source.dirty).toBe(false);
  source.edit('20 PRINT "changed"');
  expect(source.dirty).toBe(true);
  source.edit('20');
  expect(source.dirty).toBe(false);
  source.edit('10');
  expect(source.dirty).toBe(true);
  source.replace(parseProgram('20 END\r\n10 PRINT "loaded"\r\n'), 'Loaded File.bas');
  expect(source.source).toBe('10 PRINT "loaded"\n20 END');
  expect(source.filename).toBe('Loaded File.bas');
  expect(source.dirty).toBe(false);
  source.clear();
  expect(source.source).toBe('');
  expect(source.filename).toBeNull();
  expect(source.dirty).toBe(false);
});

it('preserves a verbatim document through no-op edits and changes representation only after edits', () => {
  const source = new StoredProgram();
  const text = '\r\n20 END\r\n010 PRINT "MiXeD"\r\n';
  source.replace(parseProgram(text), 'source.basic.json', text);
  const snapshot = source.document;
  for (const edit of ['010 PRINT "MiXeD"', '999', '']) source.edit(edit);
  expect(source.source).toBe(text);
  expect(source.dirty).toBe(false);
  source.edit('30 PRINT 3');
  expect(source.source).toBe('010 PRINT "MiXeD"\n20 END\n30 PRINT 3');
  expect(source.dirty).toBe(true);
  expect(snapshot.source).toBe(text);
  source.clear();
  expect(source.document).toEqual({
    format: 'basic-program',
    version: 1,
    dialect: 'native',
    source: '',
  });
  expect(source.dirty).toBe(false);
  expect(source.filename).toBeNull();
});

it('rejects unsupported replacement context before changing any editor state', () => {
  const source = new StoredProgram();
  source.edit('10 END');
  source.saved('prior.bas');
  const before = source.document;
  const invalid = {...parseProgram('20 END'), dialect: 'basic-plus'} as unknown as Program;
  expect(() => source.replace(invalid, 'bad.basic.json', '20 END')).toThrow();
  expect(source.document).toEqual(before);
  expect(source.filename).toBe('prior.bas');
  expect(source.dirty).toBe(false);
});

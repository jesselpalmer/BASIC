import {expect, it} from 'bun:test';
import StoredProgram from './program.ts';

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

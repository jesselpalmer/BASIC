import {expect, it} from 'bun:test';
import {runWithOpenInput} from '../../scripts/subprocess.ts';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const executable = resolve(import.meta.dirname, '../../bin/basic');

it.each([
  ['self jump', '20 GOTO 20'],
  ['long FOR loop', '20 FOR I=1 TO 1000000000\n30 NEXT I'],
])(
  'interrupts a CPU-bound file program: %s',
  async (_name, loop) => {
    const directory = mkdtempSync(join(tmpdir(), 'basic-compute-interrupt-'));
    try {
      const file = join(directory, 'busy.bas');
      writeFileSync(file, `10 PRINT "started"\n${loop}\n40 PRINT "must not finish"`);
      const result = await runWithOpenInput({args: [executable, file], interruptAt: 'started\n'});
      expect(result).toEqual({status: 130, signal: null, stdout: 'started\n', stderr: ''});
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  },
  10000,
);

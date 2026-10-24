import {expect, it} from 'bun:test';
import {spawn} from 'node:child_process';
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
      const result = await new Promise<{
        status: number | null;
        signal: string | null;
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        const child = spawn(process.execPath, [executable, file]);
        let stdout = '';
        let stderr = '';
        let interrupted = false;
        // A deadlock guard, not a performance threshold. Readiness is observed
        // through program output; no sleep guesses when the signal is safe to send.
        const timeout = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('CPU-bound program did not stop after SIGINT'));
        }, 5000);
        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
          if (!interrupted && stdout.includes('started\n')) {
            interrupted = true;
            child.kill('SIGINT');
          }
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on('error', (error) => {
          clearTimeout(timeout);
          child.stdin.destroy();
          reject(error);
        });
        child.on('close', (status, signal) => {
          clearTimeout(timeout);
          child.stdin.destroy();
          resolve({status, signal, stdout, stderr});
        });
      });
      expect(result).toEqual({status: 130, signal: null, stdout: 'started\n', stderr: ''});
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  },
  10000,
);

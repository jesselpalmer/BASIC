import {expect, it} from 'bun:test';
import assert from 'node:assert/strict';
import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import {runWithOpenInput} from './subprocess.ts';

const busyChild = ['-e', 'console.log("ready"); setInterval(() => {}, 1000);'];

it('decodes UTF-8 characters split across stdout and stderr chunks', async () => {
  const result = await runWithOpenInput({
    args: [
      '-e',
      // The delayed second byte exercises decoding across separate writes.
      'process.stdout.write(Buffer.from([0xc3])); process.stderr.write(Buffer.from([0xc3]));' +
        'setTimeout(() => { process.stdout.write(Buffer.from([0xa9])); process.stderr.write(Buffer.from([0xa9])); }, 25);',
    ],
  });
  expect(result).toEqual({status: 0, signal: null, stdout: 'é', stderr: 'é'});
});

it('closes the child before rejecting a failed output callback', async () => {
  let closed = false;
  let input: ChildProcessWithoutNullStreams['stdin'] | undefined;
  const failure = new Error('output callback failed');
  const running = runWithOpenInput({
    args: busyChild,
    onOutput(_output, child) {
      input = child.stdin;
      child.once('close', () => {
        closed = true;
      });
      throw failure;
    },
  });
  await assert.rejects(running, {cause: failure});
  expect(closed).toBe(true);
  expect(input?.destroyed).toBe(true);
});

it('rejects an asynchronous input stream error and closes the child', async () => {
  let closed = false;
  let input: ChildProcessWithoutNullStreams['stdin'] | undefined;
  const running = runWithOpenInput({
    args: busyChild,
    onOutput(_output, child) {
      input = child.stdin;
      child.once('close', () => {
        closed = true;
      });
      child.stdin.end();
      child.stdin.write('write after end');
    },
  });
  await assert.rejects(running, (error: unknown) => {
    assert.ok(error instanceof Error && error.cause instanceof Error);
    assert.ok('code' in error.cause);
    assert.equal(error.cause.code, 'ERR_STREAM_WRITE_AFTER_END');
    return true;
  });
  expect(closed).toBe(true);
  expect(input?.destroyed).toBe(true);
});

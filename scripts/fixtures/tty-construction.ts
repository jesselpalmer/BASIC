import assert from 'node:assert/strict';
import {readSync} from 'node:fs';
import {PassThrough} from 'node:stream';
import {ReadStream} from 'node:tty';
import TerminalHost from '../../src/cli/terminal_host.ts';

const input = new ReadStream(0);
assert.equal(input.isTTY, true);
const output = Object.assign(new PassThrough(), {isTTY: true});
const externalResize = () => {};
output.on('resize', externalResize);
const externalError = () => {};
input.on('error', externalError);
const events = ['keypress', 'error', 'end', 'data', 'close'];
const before = events.map((event) => input.listeners(event));
process.stdout.write('READY\n');
// The parent disconnects the actual terminal before releasing this control pipe.
assert.equal(readSync(Number(process.argv[2]), Buffer.alloc(1), 0, 1, null), 1);
const host = new TerminalHost({input, output});
try {
  const result = await host.readLine().catch((error: unknown) => error);
  if (process.platform === 'darwin') {
    // macOS reports this hangup as EOF; Linux fails native raw-mode setup.
    assert.equal(result, null, 'Disconnected macOS TTY must settle at EOF');
  } else {
    assert.ok(result instanceof Error, 'Disconnected TTY setup must reject');
  }
  const destroyedBeforeClose = input.destroyed;
  host.close();
  for (const [index, event] of events.entries()) {
    assert.deepEqual(input.listeners(event), before[index], `Leaked ${event} listener`);
  }
  assert.deepEqual(output.listeners('resize'), [externalResize]);
  // EOF can close a native stream itself; host disposal must not destroy it.
  assert.equal(input.destroyed, destroyedBeforeClose);
  if (process.platform !== 'darwin') assert.equal(input.destroyed, false);
  assert.equal(output.destroyed, false, 'Host must not destroy the caller output');
  process.stdout.write('CLEAN\n');
} finally {
  host.close();
  input.destroy();
  output.destroy();
}

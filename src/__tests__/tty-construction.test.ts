import {expect, it} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {runProcess} from '../../scripts/subprocess.ts';

const pythonAvailable =
  process.platform !== 'win32' && spawnSync('python3', ['--version']).status === 0;

it.skipIf(!pythonAvailable)(
  'releases caller listeners when a real terminal disconnects before raw-mode setup',
  () => {
    const fixture = resolve(import.meta.dirname, '../../scripts/fixtures');
    const result = runProcess({
      command: 'python3',
      args: [
        resolve(fixture, 'tty-hangup.py'),
        process.execPath,
        resolve(fixture, 'tty-construction.ts'),
      ],
      timeout: 8000,
    });
    expect(result.stdout).toBe('CLEAN\n');
    expect(result.stderr).toBe('');
  },
  10000,
);

it.skipIf(process.platform === 'win32' || !process.env.CI)(
  'has Python available for the POSIX CI terminal-disconnect regression',
  () => expect(pythonAvailable).toBe(true),
);

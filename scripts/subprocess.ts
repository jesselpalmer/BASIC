import assert from 'node:assert/strict';
import {spawn, spawnSync, type ChildProcessWithoutNullStreams} from 'node:child_process';

interface ProcessOptions {
  args: string[];
  command?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
}

interface ProcessResult {
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}

export function runProcess({
  command = process.execPath,
  args,
  cwd,
  env = process.env,
  timeout = 5000,
  input = '',
  expectedStatus = 0,
}: ProcessOptions & {input?: string; expectedStatus?: number}): ProcessResult {
  const result = spawnSync(command, args, {cwd, env, timeout, input, encoding: 'utf8'});
  const context = `${command} ${args.join(' ')}\n${result.stderr || result.stdout}`;
  assert.ifError(result.error);
  assert.equal(result.signal, null, context);
  assert.equal(result.status, expectedStatus, context);
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// Keep stdin open until the child exits: a leaked input handle must fail the check.
// Output markers determine readiness; the timeout only bounds deadlocks.
export function runWithOpenInput({
  command = process.execPath,
  args,
  cwd,
  env = process.env,
  timeout = 5000,
  interruptAt,
  onOutput,
}: ProcessOptions & {
  interruptAt?: string;
  onOutput?: (stdout: string, child: ChildProcessWithoutNullStreams) => void;
}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, env});
    let stdout = '';
    let stderr = '';
    let interrupted = false;
    let failure: Error | undefined;
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => {
      stop(new Error(`Child did not exit with stdin open: ${command} ${args.join(' ')}`));
    }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data: string) => {
      stdout += data;
      if (failure) return;
      try {
        if (interruptAt && !interrupted && stdout.includes(interruptAt)) {
          interrupted = true;
          child.kill('SIGINT');
        }
        onOutput?.(stdout, child);
      } catch (cause) {
        stop(cause instanceof Error ? cause : new Error('Child output handler failed', {cause}));
      }
    });
    child.stderr.on('data', (data: string) => {
      stderr += data;
    });
    child.on('error', stop);
    child.stdin.on('error', stop);
    child.stdout.on('error', stop);
    child.stderr.on('error', stop);
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      child.stdin.destroy();
      if (failure) reject(new Error(`${failure.message}\n${stdout}${stderr}`, {cause: failure}));
      else resolve({status, signal, stdout, stderr});
    });
  });
}

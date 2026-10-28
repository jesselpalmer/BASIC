import {expect, test} from 'bun:test';
import {runProcess} from '../subprocess.ts';

const module = new URL('./completion.ts', import.meta.url).href;
function command(body: string, expectedStatus: number) {
  return runProcess({
    args: ['-e', `import {completeRelease} from ${JSON.stringify(module)};\n${body}`],
    expectedStatus,
  });
}

test('an unreferenced unfinished validation exits nonzero without a completion certificate', () => {
  const result = command(
    'void completeRelease(async () => { console.log("STARTED"); await new Promise(() => {});' +
      'console.log("RELEASE_VALIDATED"); });',
    1,
  );
  expect(result.stdout).toBe('STARTED\n');
  expect(result.stderr).toBe('');
});

test('asynchronous validation and cleanup finish before the command may succeed', () => {
  const result = command(
    'await completeRelease(async () => {' +
      'console.log("STARTED"); try { await Bun.sleep(5); console.log("CHECKED"); }' +
      'finally { await Bun.sleep(5); console.log("CLEANED"); }' +
      '}); console.log("RELEASE_VALIDATED");',
    0,
  );
  expect(result.stdout).toBe('STARTED\nCHECKED\nCLEANED\nRELEASE_VALIDATED\n');
  expect(result.stderr).toBe('');
});

test('a caught validation failure retains a nonzero command status', () => {
  const result = command(
    'try { await completeRelease(async () => { throw new Error("bad archive"); }); }' +
      'catch (error) { console.log(error.message); }',
    1,
  );
  expect(result.stdout).toBe('bad archive\n');
  expect(result.stderr).toBe('');
});

test('an unfinished validation preserves a previous failure status', () => {
  const result = command(
    'process.exitCode=23; void completeRelease(async () => { await new Promise(() => {});' +
      'console.log("RELEASE_VALIDATED"); });',
    23,
  );
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
});

test('a completed check does not erase an earlier command failure', () => {
  const result = command(
    'process.exitCode=17; await completeRelease(async () => { await Bun.sleep(5); });' +
      'console.log("CHECK_COMPLETE");',
    17,
  );
  expect(result.stdout).toBe('CHECK_COMPLETE\n');
  expect(result.stderr).toBe('');
});

test('a validation failure preserves a more specific status set by the failed action', () => {
  const result = command(
    'try { await completeRelease(async () => { process.exitCode=29; throw new Error("browser failed"); }); }' +
      'catch (error) { console.log(error.message); }',
    29,
  );
  expect(result.stdout).toBe('browser failed\n');
  expect(result.stderr).toBe('');
});

test('a fulfilled check preserves a new nonzero failure status', () => {
  const result = command(
    'await completeRelease(async () => { await Bun.sleep(5); process.exitCode=2; });' +
      'console.log("CHECK_COMPLETE");',
    2,
  );
  expect(result.stdout).toBe('CHECK_COMPLETE\n');
  expect(result.stderr).toBe('');
});

test('clearing status inside a fulfilled check cannot erase an earlier failure', () => {
  const result = command(
    'process.exitCode=2; await completeRelease(async () => { process.exitCode=0; });',
    2,
  );
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
});

test('a caught rejection cannot become successful by clearing the pending status', () => {
  const result = command(
    'try { await completeRelease(async () => { process.exitCode=0; throw new Error("failed"); }); }' +
      'catch { console.log("REJECTED"); }',
    1,
  );
  expect(result.stdout).toBe('REJECTED\n');
  expect(result.stderr).toBe('');
});

test('a fulfilled check preserves an explicit new failure status of one', () => {
  const result = command(
    'await completeRelease(async () => { process.exitCode=1; }); console.log("CHECK_COMPLETE");',
    1,
  );
  expect(result.stdout).toBe('CHECK_COMPLETE\n');
  expect(result.stderr).toBe('');
});

test('an explicit zero exit cannot certify an unfinished check', () => {
  const result = command(
    'void completeRelease(async () => { console.log("STARTED"); process.exit(0); });' +
      'console.log("RELEASE_VALIDATED");',
    1,
  );
  expect(result.stdout).toBe('STARTED\n');
  expect(result.stderr).toBe('');
});

test('an unfinished check cannot clear the shutdown guard by setting a zero status', () => {
  const result = command(
    'void completeRelease(async () => { process.exitCode=0; await new Promise(()=>{});' +
      'console.log("RELEASE_VALIDATED"); });',
    1,
  );
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
});

test('cleanup failure prevents the final completion certificate', () => {
  const result = command(
    'try { await completeRelease(async () => {' +
      'try { await Bun.sleep(5); console.log("CHECKED"); }' +
      'finally { throw new Error("cleanup failed"); }' +
      '}); console.log("RELEASE_VALIDATED"); } catch (error) { console.log(error.message); }',
    1,
  );
  expect(result.stdout).toBe('CHECKED\ncleanup failed\n');
  expect(result.stderr).toBe('');
});

test('fulfilled and rejected checks detach their shutdown listeners', () => {
  const result = command(
    'const baseline=process.listenerCount("exit"); await completeRelease(async () => {});' +
      'if(process.listenerCount("exit")!==baseline) throw new Error("success leaked listener");' +
      'try { await completeRelease(async () => { throw new Error("failed"); }); } catch {}' +
      'if(process.listenerCount("exit")!==baseline) throw new Error("failure leaked listener");' +
      'console.log("DETACHED");',
    1,
  );
  expect(result.stdout).toBe('DETACHED\n');
  expect(result.stderr).toBe('');
});

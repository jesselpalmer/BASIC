import {expect, test} from 'bun:test';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {FullResult, Suite, TestCase, TestResult} from '@playwright/test/reporter';
import ReleaseBrowserReporter, {validateBrowserCompletion} from './browser-report.ts';
import {runProcess} from '../subprocess.ts';

const item = (id: string, expectedStatus: TestCase['expectedStatus'] = 'passed') =>
  ({id, expectedStatus}) as TestCase;
const result = (status: TestResult['status']) => ({status}) as TestResult;
const ended = (status: FullResult['status'] = 'passed'): FullResult => ({
  status,
  startTime: new Date(),
  duration: 1,
});

function fixture(action: (file: string, reporter: ReleaseBrowserReporter) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'basic-browser-report-'));
  const file = join(directory, 'completion.json');
  try {
    action(file, new ReleaseBrowserReporter({outputFile: file}));
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}
function begin(reporter: ReleaseBrowserReporter, tests: TestCase[]) {
  reporter.onBegin({}, {allTests: () => tests} as Suite);
}

test('the reporter certifies the actual plan only after onEnd with one passed result per test', () => {
  fixture((file, reporter) => {
    const tests = [item('first'), item('second'), item('third')];
    begin(reporter, tests);
    expect(existsSync(file)).toBe(false);
    for (const test of tests) reporter.onTestEnd(test, result('passed'));
    expect(existsSync(file)).toBe(false);
    reporter.onEnd(ended());
    expect(reporter.printsToStdio()).toBe(false);
    expect(validateBrowserCompletion(0, file)).toBe(3);
  });
});

test('a zero child exit cannot certify a planned test that never completed', () => {
  fixture((file, reporter) => {
    begin(reporter, [item('first'), item('never-ran')]);
    reporter.onTestEnd(item('first'), result('passed'));
    reporter.onEnd(ended());
    expect(() => validateBrowserCompletion(0, file)).toThrow('did not pass exactly once');
  });
});

test.each<TestResult['status']>(['failed', 'timedOut', 'interrupted', 'skipped'])(
  'a %s test result is not successful completion',
  (status) => {
    fixture((file, reporter) => {
      begin(reporter, [item('test')]);
      reporter.onTestEnd(item('test'), result(status));
      reporter.onEnd(ended());
      expect(() => validateBrowserCompletion(0, file)).toThrow('did not pass exactly once');
    });
  },
);

test.each<FullResult['status']>(['failed', 'timedout', 'interrupted'])(
  'the overall %s status rejects even when every test passed',
  (status) => {
    fixture((file, reporter) => {
      begin(reporter, [item('test')]);
      reporter.onTestEnd(item('test'), result('passed'));
      reporter.onEnd(ended(status));
      expect(() => validateBrowserCompletion(0, file)).toThrow('did not finish successfully');
    });
  },
);

test('retries and expected failures do not satisfy clean release acceptance', () => {
  fixture((file, reporter) => {
    begin(reporter, [item('retry')]);
    reporter.onTestEnd(item('retry'), result('failed'));
    reporter.onTestEnd(item('retry'), result('passed'));
    reporter.onEnd(ended());
    expect(() => validateBrowserCompletion(0, file)).toThrow('did not pass exactly once');
  });
  fixture((file, reporter) => {
    begin(reporter, [item('expected-failure', 'failed')]);
    reporter.onTestEnd(item('expected-failure', 'failed'), result('passed'));
    reporter.onEnd(ended());
    expect(() => validateBrowserCompletion(0, file)).toThrow('must expect success');
  });
});

test('global errors and unplanned test callbacks reject a completion certificate', () => {
  for (const unplanned of [false, true])
    fixture((file, reporter) => {
      begin(reporter, [item('test')]);
      reporter.onTestEnd(item('test'), result('passed'));
      if (unplanned) reporter.onTestEnd(item('unknown'), result('passed'));
      else reporter.onError();
      reporter.onEnd(ended());
      expect(() => validateBrowserCompletion(0, file)).toThrow('global errors');
    });
});

test('duplicate planned ids are rejected before any certificate is written', () => {
  fixture((file, reporter) => {
    expect(() => begin(reporter, [item('same'), item('same')])).toThrow('Duplicate planned');
    expect(existsSync(file)).toBe(false);
  });
});

test('missing, truncated, empty and malformed certificates cannot pass', () => {
  fixture((file, reporter) => {
    expect(() => validateBrowserCompletion(0, file)).toThrow();
    writeFileSync(file, '{"schema":1,');
    expect(() => validateBrowserCompletion(0, file)).toThrow();
    begin(reporter, []);
    reporter.onEnd(ended());
    expect(() => validateBrowserCompletion(0, file)).toThrow('No planned');
    for (const malformed of [
      null,
      [],
      {schema: 2},
      {schema: 1, status: 'passed', errors: 0, tests: [null]},
    ]) {
      writeFileSync(file, JSON.stringify(malformed));
      expect(() => validateBrowserCompletion(0, file)).toThrow();
    }
  });
});

test('the validator rejects duplicate ids and nonzero exits despite a successful report', () => {
  fixture((file, reporter) => {
    begin(reporter, [item('test')]);
    reporter.onTestEnd(item('test'), result('passed'));
    reporter.onEnd(ended());
    expect(() => validateBrowserCompletion(7, file)).toThrow('browser acceptance');
    const report = JSON.parse(readFileSync(file, 'utf8')) as {tests: unknown[]};
    report.tests.push(report.tests[0]);
    writeFileSync(file, JSON.stringify(report));
    expect(() => validateBrowserCompletion(0, file)).toThrow('duplicate planned');
  });
});

test.each(['missing', 'truncated', 'complete'])(
  'a real zero-exit child needs a %s completion certificate before release success',
  (mode) => {
    fixture((file) => {
      const module = new URL('./browser-report.ts', import.meta.url).href;
      const completion = new URL('./completion.ts', import.meta.url).href;
      let child = 'console.log("CHILD_PROGRESS");';
      if (mode === 'truncated') child += `await Bun.write(${JSON.stringify(file)}, '{');`;
      if (mode === 'complete')
        child +=
          `const {default:Reporter}=await import(${JSON.stringify(module)});` +
          `const reporter=new Reporter({outputFile:${JSON.stringify(file)}});` +
          'const test={id:"browser-case",expectedStatus:"passed"};' +
          'reporter.onBegin({}, {allTests:()=>[test]}); reporter.onTestEnd(test,{status:"passed"});' +
          'reporter.onEnd({status:"passed"});';
      const code =
        `import {completeRelease} from ${JSON.stringify(completion)};` +
        `import {validateBrowserCompletion} from ${JSON.stringify(module)};` +
        'try { await completeRelease(async()=>{' +
        `const child=Bun.spawn([process.execPath,'-e',${JSON.stringify(child)}],{stdout:'inherit',stderr:'inherit'});` +
        `validateBrowserCompletion(await child.exited,${JSON.stringify(file)});` +
        'console.log("RELEASE_VALIDATED"); }); } catch { console.log("REJECTED"); }';
      const checked = runProcess({args: ['-e', code], expectedStatus: mode === 'complete' ? 0 : 1});
      expect(checked.stdout).toBe(
        mode === 'complete' ? 'CHILD_PROGRESS\nRELEASE_VALIDATED\n' : 'CHILD_PROGRESS\nREJECTED\n',
      );
      expect(checked.stderr).toBe('');
    });
  },
);

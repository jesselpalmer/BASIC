import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import type {FullResult, Reporter, Suite, TestCase, TestResult} from '@playwright/test/reporter';

interface PlannedTest {
  id: string;
  expectedStatus: TestCase['expectedStatus'];
  results: TestResult['status'][];
}

/** Written only by Playwright's onEnd, after it supplies the complete run status. */
export default class ReleaseBrowserReporter implements Reporter {
  private readonly outputFile: string;
  private readonly tests = new Map<string, PlannedTest>();
  private errors = 0;

  constructor({outputFile = process.env.BASIC_BROWSER_REPORT}: {outputFile?: string} = {}) {
    assert.ok(outputFile, 'A release browser report output file is required');
    this.outputFile = outputFile;
  }

  onBegin(_config: unknown, suite: Suite): void {
    for (const test of suite.allTests()) {
      assert.ok(!this.tests.has(test.id), 'Duplicate planned browser test');
      this.tests.set(test.id, {id: test.id, expectedStatus: test.expectedStatus, results: []});
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const planned = this.tests.get(test.id);
    if (planned) planned.results.push(result.status);
    else this.errors++;
  }

  onError(): void {
    this.errors++;
  }

  onEnd(result: FullResult): void {
    writeFileSync(
      this.outputFile,
      JSON.stringify({
        schema: 1,
        status: result.status,
        errors: this.errors,
        tests: [...this.tests.values()],
      }),
    );
  }

  printsToStdio(): boolean {
    return false;
  }
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Invalid browser completion report',
  );
  return value as Record<string, unknown>;
}

/** A zero child exit is insufficient when the runner has not certified every planned test. */
export function validateBrowserCompletion(exitCode: number, outputFile: string): number {
  assert.equal(exitCode, 0, 'Extracted static artifact browser acceptance');
  const report = record(JSON.parse(readFileSync(outputFile, 'utf8')));
  assert.equal(report.schema, 1, 'Unknown browser completion report schema');
  assert.equal(report.status, 'passed', 'Browser run did not finish successfully');
  assert.equal(report.errors, 0, 'Browser run reported global errors');
  assert.ok(Array.isArray(report.tests) && report.tests.length > 0, 'No planned browser tests');
  const ids = new Set<string>();
  for (const value of report.tests) {
    const test = record(value);
    const id = test.id;
    assert.ok(
      typeof id === 'string' && id.length > 0 && !ids.has(id),
      'Invalid or duplicate planned browser test',
    );
    ids.add(id);
    assert.equal(test.expectedStatus, 'passed', `Browser test ${id} must expect success`);
    assert.deepEqual(test.results, ['passed'], `Browser test ${id} did not pass exactly once`);
  }
  return ids.size;
}

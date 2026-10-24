import {describe, expect, it} from 'bun:test';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {coverageInventory} from './coverage-inventory.ts';

function inspectCoverage(root: string, lcov: string) {
  return coverageInventory(root, lcov, {
    subprocessOnly: ['src/cli/main.ts'],
    floors: {'src/core/runtime.ts': {lines: 0.96, functions: 1}},
  });
}

function lcovReport(...paths: string[]): string {
  return paths.map((path) => `SF:${path}\nFNF:1\nFNH:1\nLF:1\nLH:1\nend_of_record\n`).join('');
}

function fixture(check: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'basic-coverage-'));
  mkdirSync(join(root, 'src/cli'), {recursive: true});
  mkdirSync(join(root, 'src/core'), {recursive: true});
  mkdirSync(join(root, 'src/__tests__'), {recursive: true});
  writeFileSync(join(root, 'src/cli/main.ts'), 'console.log("CLI");');
  writeFileSync(
    join(root, 'src/core/types.ts'),
    'export interface Value { n: number }; export type Count = number;',
  );
  writeFileSync(
    join(root, 'src/core/types2.ts'),
    'import type {Value} from "./types"; export type {Value};',
  );
  writeFileSync(join(root, 'src/core/runtime.ts'), 'export function run() { return 1; }');
  writeFileSync(join(root, 'src/core/runtime.spec.ts'), 'throw new Error("test fixture");');
  writeFileSync(join(root, 'src/core/runtime.test.ts'), 'throw new Error("test fixture");');
  writeFileSync(join(root, 'src/__tests__/helper.ts'), 'throw new Error("test helper");');
  try {
    check(root);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

describe('coverage inventory enforcement', () => {
  it('rejects absent metrics and regressions below per-module floors', () => {
    fixture((root) => {
      expect(() => inspectCoverage(root, 'SF:src/core/runtime.ts\n')).toThrow(
        'Incomplete coverage metrics',
      );
      expect(() =>
        inspectCoverage(root, lcovReport('src/core/runtime.ts').replace('LH:1', 'LH:0')),
      ).toThrow('Line coverage below');
      expect(() =>
        inspectCoverage(root, lcovReport('src/core/runtime.ts').replace('FNH:1', 'FNH:0')),
      ).toThrow('Function coverage below');
      writeFileSync(join(root, 'src/core/new.ts'), 'export const n = 1;');
      expect(() =>
        inspectCoverage(
          root,
          lcovReport('src/core/runtime.ts', 'src/core/new.ts').replace(
            'SF:src/core/new.ts\nFNF:1\nFNH:1\nLF:1\nLH:1',
            'SF:src/core/new.ts\nFNF:1\nFNH:1\nLF:2\nLH:1',
          ),
        ),
      ).toThrow('Line coverage below 100%');
    });
  });
  it('requires runtime files while recognizing type-only modules and subprocess entrypoints', () => {
    fixture((root) => {
      const report = inspectCoverage(root, lcovReport('src/core/runtime.ts'));
      expect(report.runtimeFiles).toEqual(['src/cli/main.ts', 'src/core/runtime.ts']);
      expect(report.typeOnlyFiles).toEqual(['src/core/types.ts', 'src/core/types2.ts']);
      expect(report.subprocessOnlyFiles).toEqual(['src/cli/main.ts']);
    });
  });

  it('fails when a newly added runtime file is silently omitted', () => {
    fixture((root) => {
      writeFileSync(join(root, 'src/core/untested.ts'), 'export const missing = 1;');
      expect(() => inspectCoverage(root, lcovReport('src/core/runtime.ts'))).toThrow('untested.ts');
    });
  });

  it('stops treating a type-only file as exempt when executable code is added', () => {
    fixture((root) => {
      writeFileSync(
        join(root, 'src/core/types.ts'),
        'export type Count = number; export const n = 1;',
      );
      expect(() => inspectCoverage(root, lcovReport('src/core/runtime.ts'))).toThrow('types.ts');
    });
  });

  it('also inventories browser UI modules outside src and ignores declarations', () => {
    fixture((root) => {
      mkdirSync(join(root, 'playground'));
      writeFileSync(join(root, 'playground/assets.d.ts'), 'declare module "*.bas";');
      writeFileSync(join(root, 'playground/view.ts'), 'export const output = 1;');
      expect(() => inspectCoverage(root, lcovReport('src/core/runtime.ts'))).toThrow(
        'playground/view.ts',
      );
      const report = inspectCoverage(root, lcovReport('src/core/runtime.ts', 'playground/view.ts'));
      expect(report.measuredRuntimeFiles).toContain('playground/view.ts');
    });
  });

  it('rejects empty/stale reports and stale entrypoint exceptions', () => {
    fixture((root) => {
      expect(() => inspectCoverage(root, '')).toThrow('no source records');
      expect(() =>
        inspectCoverage(root, lcovReport('src/core/runtime.ts', 'src/deleted.ts')),
      ).toThrow('deleted.ts');
      writeFileSync(join(root, 'src/cli/main.ts'), 'export type NoRuntime = number;');
      expect(() => inspectCoverage(root, lcovReport('src/core/runtime.ts'))).toThrow(
        'Stale subprocess',
      );
    });
  });

  it('rejects a coverage floor whose module no longer contains runtime code', () => {
    fixture((root) => {
      writeFileSync(join(root, 'src/core/runtime.ts'), 'export type NoRuntime = number;');
      expect(() => inspectCoverage(root, lcovReport('src/core/runtime.ts'))).toThrow(
        'Stale coverage floor: src/core/runtime.ts',
      );
    });
  });

  it('accepts absolute LCOV paths and measured entrypoints without duplicating records', () => {
    fixture((root) => {
      const report = inspectCoverage(
        root,
        lcovReport(join(root, 'src/core/runtime.ts'), 'src/core/runtime.ts', 'src/cli/main.ts'),
      );
      expect(report.measuredRuntimeFiles).toEqual(['src/cli/main.ts', 'src/core/runtime.ts']);
      expect(report.subprocessOnlyFiles).toEqual([]);
    });
  });
});

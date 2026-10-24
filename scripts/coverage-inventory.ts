import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import ts from 'typescript';

interface MinimumCoverage {
  lines: number;
  functions: number;
}

interface CoveragePolicy {
  subprocessOnly: readonly string[];
  floors: Readonly<Record<string, MinimumCoverage>>;
}

// This is the single policy for product coverage. Entrypoints are exercised in
// child processes, whose coverage is not merged into the unit-test report.
const policy: CoveragePolicy = {
  subprocessOnly: ['src/cli/main.ts'],
  floors: {
    // Validated targets and destination checks make two defensive guards unreachable.
    // Their 12 lines moved from runtime.ts; the smaller module changes the percentage.
    'src/core/control_flow.ts': {lines: 0.87, functions: 1},
    // Terminal callbacks still have no-op initializers, addressed by the next PR.
    'src/cli/terminal_host.ts': {lines: 1, functions: 0.75},
  },
};

function relativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(entry.name) ? [path] : [];
  });
}

function typeOnly(path: string): boolean {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
  return file.statements.every(
    (statement) =>
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement) ||
      (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly === true) ||
      (ts.isExportDeclaration(statement) && statement.isTypeOnly),
  );
}

function inventorySource(root: string) {
  const runtimeFiles: string[] = [];
  const typeOnlyFiles: string[] = [];
  for (const path of sourceFiles(join(root, 'src')).sort()) {
    (typeOnly(path) ? typeOnlyFiles : runtimeFiles).push(relativePath(root, path));
  }
  return {runtimeFiles, typeOnlyFiles};
}

type Counters = Map<string, number>;

function parseLcov(root: string, lcov: string): Map<string, Counters> {
  const records = new Map<string, Counters>();
  let current: Counters | undefined;
  for (const line of lcov.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      current = new Map();
      records.set(relativePath(root, resolve(root, line.slice(3))), current);
    } else if (line === 'end_of_record') {
      current = undefined;
    } else {
      const match = /^(LF|LH|FNF|FNH):(\d+)$/.exec(line);
      if (match && current) current.set(match[1], Number(match[2]));
    }
  }
  assert.ok(records.size, 'Coverage report contains no source records');
  return records;
}

function validateInventory(
  {runtimeFiles, typeOnlyFiles}: ReturnType<typeof inventorySource>,
  measuredFiles: string[],
  {subprocessOnly, floors}: CoveragePolicy,
): void {
  for (const path of subprocessOnly) {
    assert.ok(runtimeFiles.includes(path), `Stale subprocess coverage exception: ${path}`);
  }
  for (const path of Object.keys(floors)) {
    assert.ok(runtimeFiles.includes(path), `Stale coverage floor: ${path}`);
  }
  const missing = runtimeFiles.filter(
    (path) => !measuredFiles.includes(path) && !subprocessOnly.includes(path),
  );
  assert.deepEqual(missing, [], `Runtime files absent from coverage: ${missing.join(', ')}`);
  const source = new Set([...runtimeFiles, ...typeOnlyFiles]);
  const stale = measuredFiles.filter((path) => path.startsWith('src/') && !source.has(path));
  assert.deepEqual(stale, [], `Coverage references missing source files: ${stale.join(', ')}`);
}

function measureCoverage(path: string, counts: Counters, minimum: MinimumCoverage) {
  function counter(key: string): number {
    const value = counts.get(key);
    assert.ok(value !== undefined, `Incomplete coverage metrics for ${path}: ${key}`);
    return value;
  }
  const foundLines = counter('LF');
  const hitLines = counter('LH');
  const foundFunctions = counter('FNF');
  const hitFunctions = counter('FNH');
  const lines = foundLines === 0 ? 1 : hitLines / foundLines;
  const functions = foundFunctions === 0 ? 1 : hitFunctions / foundFunctions;
  assert.ok(lines >= minimum.lines, `Line coverage below ${minimum.lines * 100}% for ${path}`);
  assert.ok(
    functions >= minimum.functions,
    `Function coverage below ${minimum.functions * 100}% for ${path}`,
  );
  return {path, lines, functions, minimum};
}

export function coverageInventory(root: string, lcov: string, coveragePolicy = policy) {
  const source = inventorySource(root);
  const records = parseLcov(root, lcov);
  const measuredFiles = [...records.keys()].sort();
  validateInventory(source, measuredFiles, coveragePolicy);
  const coverage = source.runtimeFiles.flatMap((path) => {
    const counts = records.get(path);
    if (!counts) return [];
    const minimum = coveragePolicy.floors[path] ?? {lines: 1, functions: 1};
    return [measureCoverage(path, counts, minimum)];
  });
  return {
    ...source,
    measuredRuntimeFiles: measuredFiles.filter((path) => source.runtimeFiles.includes(path)),
    subprocessOnlyFiles: coveragePolicy.subprocessOnly.filter((path) => !records.has(path)),
    coverage,
  };
}

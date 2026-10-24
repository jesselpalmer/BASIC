import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import ts from 'typescript';

// These launch the real CLI and are checked in subprocesses instead of being
// imported into a unit-test process (which would open a session as a side effect).
const subprocessEntries = ['src/cli/main.ts'];
// Public validation makes two runtime guards unreachable. TTY callback fields
// also have no-op initializers replaced before use; don't invoke them for a number.
const floors: Record<string, {lines: number; functions: number}> = {
  'src/core/runtime.ts': {lines: 0.96, functions: 1},
  'src/cli/terminal_host.ts': {lines: 1, functions: 0.75},
};

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

export function coverageInventory(root: string, lcov: string) {
  const name = (path: string) => relative(root, path).split(sep).join('/');
  const files = sourceFiles(join(root, 'src')).sort();
  const typeOnlyFiles = files.filter(typeOnly).map(name);
  const runtimeFiles = files.map(name).filter((path) => !typeOnlyFiles.includes(path));
  const measuredFiles = [
    ...new Set(
      lcov
        .split(/\r?\n/)
        .filter((line) => line.startsWith('SF:'))
        .map((line) => name(resolve(root, line.slice(3)))),
    ),
  ].sort();
  assert.ok(measuredFiles.length, 'Coverage report contains no source records');
  for (const path of subprocessEntries) {
    assert.ok(runtimeFiles.includes(path), `Stale subprocess coverage exception: ${path}`);
  }
  const missing = runtimeFiles.filter(
    (path) => !measuredFiles.includes(path) && !subprocessEntries.includes(path),
  );
  assert.deepEqual(missing, [], `Runtime files absent from coverage: ${missing.join(', ')}`);
  const stale = measuredFiles.filter(
    (path) => path.startsWith('src/') && !files.map(name).includes(path),
  );
  assert.deepEqual(stale, [], `Coverage references missing source files: ${stale.join(', ')}`);
  const metrics = new Map<string, Map<string, number>>();
  let current: Map<string, number> | undefined;
  for (const line of lcov.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      current = new Map();
      metrics.set(name(resolve(root, line.slice(3))), current);
    } else {
      const match = /^(LF|LH|FNF|FNH):(\d+)$/.exec(line);
      if (match && current) current.set(match[1], Number(match[2]));
    }
  }
  const coverage = runtimeFiles
    .filter((path) => measuredFiles.includes(path))
    .map((path) => {
      const counts = metrics.get(path)!;
      for (const key of ['LF', 'LH', 'FNF', 'FNH'])
        assert.ok(counts.has(key), `Incomplete coverage metrics for ${path}: ${key}`);
      const foundLines = counts.get('LF')!;
      const foundFunctions = counts.get('FNF')!;
      const lines = foundLines === 0 ? 1 : counts.get('LH')! / foundLines;
      const functions = foundFunctions === 0 ? 1 : counts.get('FNH')! / foundFunctions;
      const minimum = floors[path] ?? {lines: 1, functions: 1};
      assert.ok(lines >= minimum.lines, `Line coverage below ${minimum.lines * 100}% for ${path}`);
      assert.ok(
        functions >= minimum.functions,
        `Function coverage below ${minimum.functions * 100}% for ${path}`,
      );
      return {path, lines, functions, minimum};
    });
  return {
    runtimeFiles,
    measuredRuntimeFiles: measuredFiles.filter((path) => runtimeFiles.includes(path)),
    subprocessOnlyFiles: subprocessEntries.filter((path) => !measuredFiles.includes(path)),
    typeOnlyFiles,
    coverage,
  };
}

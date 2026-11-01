import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {matchesCorrected, matchesRaw, expectedMatchesOutput} from '../matches-acceptance.ts';
import {runProcess} from '../subprocess.ts';

/** Run both byte-pinned sources through the real executable, outside the checkout. */
export function checkMatchesCli(executable: string, directory: string): void {
  for (const [source, corrected] of [
    [matchesRaw, false],
    [matchesCorrected, true],
  ] as const) {
    const file = join(directory, corrected ? '23mtch-corrected.bas' : '23mtch-raw.bas');
    writeFileSync(file, source);
    const result = runProcess({
      cwd: directory,
      args: [executable, file],
      input: ['0', '4', '1.5', '24', ...Array<string>(7).fill('1'), ''].join('\n'),
      expectedStatus: 1,
    });
    assert.equal(
      result.stdout,
      expectedMatchesOutput(corrected, 4).replaceAll(
        'HOW MANY DO YOU TAKE\n',
        'HOW MANY DO YOU TAKE\n? ',
      ),
    );
    assert.equal(result.stderr, 'Line 230, column 5: Input ended before a value was received\n');
    assert.equal(readFileSync(file, 'utf8'), source);
    const blocked = runProcess({
      cwd: directory,
      args: [executable, file],
      input: '2\n',
      expectedStatus: 1,
    });
    assert.match(blocked.stderr, /Line 330, column \d+: RND expects 0 argument\(s\)/);
    assert.ok(!blocked.stdout.includes('I TOOK'));
  }
  const original = join(directory, '23mtch-corrected.bas');
  const saved = join(directory, '23mtch-saved.basic.json');
  const session = runProcess({
    cwd: directory,
    args: [executable],
    input: `LOAD "${original}"\nLIST\nSAVE "${saved}"\nEXIT\n`,
  });
  assert.equal(session.stderr, '');
  assert.ok(session.stdout.includes(matchesCorrected.trimEnd() + '\n'));
  const document = JSON.parse(readFileSync(saved, 'utf8')) as {source: string; dialect: string};
  // A plain-file editor load uses its existing sorted-line representation.
  assert.equal(document.source, matchesCorrected.trimEnd());
  assert.equal(document.dialect, 'native');
  const portable = runProcess({
    cwd: directory,
    args: [executable, saved],
    input: Array<string>(7).fill('1\n').join(''),
    expectedStatus: 1,
  });
  assert.equal(
    portable.stdout,
    expectedMatchesOutput(true).replaceAll('HOW MANY DO YOU TAKE\n', 'HOW MANY DO YOU TAKE\n? '),
  );
  assert.equal(portable.stderr, 'Line 230, column 5: Input ended before a value was received\n');
}

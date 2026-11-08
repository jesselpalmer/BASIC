import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  assertReviewedTranscript,
  eduSystem30Dialect,
  matchesCorrected,
  matchesRaw,
  matchesReviewed,
  expectedMatchesOutput,
  reviewedAnswers,
} from '../matches-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

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

export async function checkEduSystem30Cli(executable: string, directory: string): Promise<void> {
  const file = join(directory, '23mtch-edusystem30.basic.json');
  const saved = join(directory, '23mtch-edusystem30-copy.basic.json');
  const document = {
    format: 'basic-program',
    version: 1,
    dialect: eduSystem30Dialect,
    source: matchesReviewed,
  };
  writeFileSync(file, JSON.stringify(document));
  const input = reviewedAnswers.join('\n') + '\n';
  const direct = runProcess({cwd: directory, args: [executable, file], input, expectedStatus: 1});
  assert.equal(direct.stderr, 'Line 230, column 5: Input ended before a value was received\n');
  // Pipe input is not echoed by readline. Restore only the recorded user keystrokes.
  let answer = 0;
  assertReviewedTranscript(
    direct.stdout.replaceAll('?', () => {
      const echo = reviewedAnswers[answer++];
      return echo === undefined ? '?' : `?${echo}\n`;
    }),
  );
  assert.equal(answer, reviewedAnswers.length + 1);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'play' | 'stopped' | 'rerun' | 'stopped-again' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args: [executable],
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'play';
        child.stdin.write(`LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input}`);
      } else if (
        phase === 'play' &&
        stdout.endsWith('THERE ARE NOW 19 MATCHES.\n\nHOW MANY DO YOU TAKE?')
      ) {
        phase = 'stopped';
        child.kill('SIGINT');
      } else if (phase === 'stopped' && stdout.endsWith('\n>>> ')) {
        phase = 'rerun';
        child.stdin.write(`LOAD "${saved}"\nRUN\n2\n`);
      } else if (
        phase === 'rerun' &&
        stdout.endsWith('THERE ARE NOW 20 MATCHES.\n\nHOW MANY DO YOU TAKE?')
      ) {
        phase = 'stopped-again';
        child.kill('SIGINT');
      } else if (phase === 'stopped-again' && stdout.endsWith('\n>>> ')) {
        phase = 'exit';
        child.stdin.write('EXIT\n');
      }
    },
  });
  assert.equal(phase, 'exit', editor.stdout);
  assert.equal(editor.status, 0);
  assert.equal(editor.stderr, '');
  assert.ok(editor.stdout.includes(direct.stdout));
  assert.ok(editor.stdout.includes('I TOOK 1 ...THERE ARE NOW 20 MATCHES.'));
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}

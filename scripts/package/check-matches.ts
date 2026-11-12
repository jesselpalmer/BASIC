import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {letterOptions, letterPrompt, letterSource} from '../letter-acceptance.ts';
import {assertLitqzOutput, litqzRounds, litqzSource} from '../litqz-acceptance.ts';
import {mathdOptions, mathdPrompt, mathdSource} from '../mathd-acceptance.ts';
import {assertNumberOutput, numberGames, numberSource} from '../number-acceptance.ts';
import {starsOptions, starsPrompt, starsSource} from '../stars-acceptance.ts';
import {hurkleOptions, hurklePrompt, hurkleSource} from '../hurkle-acceptance.ts';
import {changeOptions, changeRuns, changeSource} from '../change-acceptance.ts';
import {assertChemstOutput, chemstGame, chemstSource} from '../chemst-acceptance.ts';
import {assertDiamndOutput, diamndRuns, diamndSource} from '../diamnd-acceptance.ts';
import {assertBatnumOutput, batnumRuns, batnumSource} from '../batnum-acceptance.ts';
import {assertEvenOutput, evenRuns, evenSource} from '../even-acceptance.ts';
import {assertRocketOutput, rocketRuns, rocketSource} from '../rocket-acceptance.ts';
import {assertKinemaOutput, kinemaRuns, kinemaSource} from '../kinema-acceptance.ts';
import {assertBounceOutput, bounceRuns, bounceSource} from '../bounce-acceptance.ts';
import {
  assertTrapOutput,
  trapAnswers,
  trapNextRound,
  trapOptions,
  trapSource,
} from '../trap-acceptance.ts';
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

export function checkLetterCli(executable: string, directory: string): void {
  const file = join(directory, 'letter-edusystem30.basic.json');
  const document = {format: 'basic-program', version: 1, ...letterOptions, source: letterSource};
  writeFileSync(file, JSON.stringify(document));
  const guesses = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(2)];
  const result = runProcess({
    cwd: directory,
    args: [executable, file],
    input: ['AB', ...guesses, ''].join('\n'),
    expectedStatus: 1,
  });
  assert.match(result.stderr, /^Line 430, column \d+: Input ended before a value was received\n$/);
  assert.match(result.stdout, /Enter one ASCII character\./);
  assert.ok((result.stdout.match(/YOU GOT IT IN \d+ GUESSES!!/g)?.length ?? 0) >= 2);
  assert.ok(result.stdout.endsWith(letterPrompt));
}

export async function checkTrapCli(executable: string, directory: string): Promise<void> {
  const file = join(directory, 'trap-edusystem30.basic.json');
  const saved = join(directory, 'trap-edusystem30-copy.basic.json');
  const document = {format: 'basic-program', version: 1, ...trapOptions, source: trapSource};
  writeFileSync(file, JSON.stringify(document));
  const input = trapAnswers.join('\n') + '\n';
  const direct = runProcess({cwd: directory, args: [executable, file], input, expectedStatus: 1});
  assert.match(direct.stderr, /^Line 220, column \d+: Input ended before a value was received\n$/);
  assertTrapOutput(direct.stdout);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'play' | 'stopped' | 'fresh' | 'stopped-again' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args: [executable],
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'play';
        child.stdin.write(`LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input}23\n`);
      } else if (phase === 'play' && stdout.endsWith(trapNextRound + '?')) {
        phase = 'stopped';
        child.kill('SIGINT');
      } else if (phase === 'stopped' && stdout.endsWith('\n>>> ')) {
        phase = 'fresh';
        child.stdin.write(`LOAD "${saved}"\nRUN\n0\n23,23\n`);
      } else if (phase === 'fresh' && stdout.endsWith(`YOU GOT IT!!!\n\n${trapNextRound}`)) {
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
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}

export function checkMathdCli(executable: string, directory: string): void {
  const file = join(directory, 'mathd-edusystem30.basic.json');
  writeFileSync(
    file,
    JSON.stringify({format: 'basic-program', version: 1, ...mathdOptions, source: mathdSource}),
  );
  const result = runProcess({
    cwd: directory,
    args: [executable, file],
    input: '0\n0\n',
    expectedStatus: 1,
  });
  const rows = result.stdout.match(/^I[ *]+I$/gm) ?? [];
  assert.equal(rows.length, 12);
  const sum = rows.slice(0, 6).join('').match(/\*/g)?.length ?? 0;
  assert.ok(sum >= 2 && sum <= 12);
  assert.ok(result.stdout.includes(`NO, THE ANSWER IS  ${sum} \n`));
  assert.ok(result.stdout.includes('NO, COUNT THE SPOTS AND GIVE ANOTHER ANSWER.'));
  assert.ok(result.stdout.endsWith(mathdPrompt));
  assert.match(result.stderr, /^Line 520, column \d+: Input ended before a value was received\n$/);
}

export function checkStarsCli(executable: string, directory: string): void {
  const file = join(directory, 'stars-edusystem30.basic.json');
  writeFileSync(
    file,
    JSON.stringify({format: 'basic-program', version: 1, ...starsOptions, source: starsSource}),
  );
  const result = runProcess({
    cwd: directory,
    args: [executable, file],
    input: '0\n'.repeat(8),
    expectedStatus: 1,
  });
  const secret = Number(/NUMBER WAS +(\d+)/.exec(result.stdout)?.[1]);
  assert.ok(secret >= 1 && secret <= 100);
  const hints = [...result.stdout.matchAll(/YOUR GUESS\?(\*{1,7})\n/g)];
  assert.deepEqual(
    hints.map((hint) => hint[1].length),
    Array<number>(7).fill(7 - Math.floor(Math.log2(secret))),
  );
  assert.ok(result.stdout.endsWith(starsPrompt));
  assert.match(result.stderr, /^Line 360, column \d+: Input ended before a value was received\n$/);
}

export function checkHurkleCli(executable: string, directory: string): void {
  const file = join(directory, 'hurkle-edusystem30.basic.json');
  writeFileSync(
    file,
    JSON.stringify({format: 'basic-program', version: 1, ...hurkleOptions, source: hurkleSource}),
  );
  const result = runProcess({
    cwd: directory,
    args: [executable, file],
    input: '-1,-1\n'.repeat(5),
    expectedStatus: 1,
  });
  assert.equal(result.stdout.match(/GO NORTHEAST\n/g)?.length, 5);
  assert.match(result.stdout, /THE HURKLE IS AT +[0-9] +, +[0-9] /);
  assert.ok(result.stdout.includes("LET'S PLAY AGAIN. HURKLE IS HIDING."));
  assert.ok(result.stdout.endsWith(hurklePrompt));
  assert.match(result.stderr, /^Line 330, column \d+: Input ended before a value was received\n$/);
}

export async function checkChangeCli(executable: string, directory: string): Promise<void> {
  const file = join(directory, 'change-edusystem30.basic.json');
  const saved = join(directory, 'change-edusystem30-copy.basic.json');
  const document = {format: 'basic-program', version: 1, ...changeOptions, source: changeSource};
  writeFileSync(file, JSON.stringify(document));
  const [full, fresh] = changeRuns;
  const input = (run: (typeof changeRuns)[number]) => run.answers.join('\n') + '\n';
  const direct = runProcess({
    cwd: directory,
    args: [executable, file],
    input: input(full),
    expectedStatus: 1,
  });
  assert.equal(direct.stdout, full.output);
  assert.match(direct.stderr, /^Line 10, column \d+: Input ended before a value was received\n$/);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'play' | 'stopped' | 'fresh' | 'stopped-again' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args: [executable],
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'play';
        child.stdin.write(`LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input(full)}`);
      } else if (phase === 'play' && stdout.endsWith(full.output)) {
        phase = 'stopped';
        child.kill('SIGINT');
      } else if (phase === 'stopped' && stdout.endsWith('\n>>> ')) {
        phase = 'fresh';
        child.stdin.write(`LOAD "${saved}"\nRUN\n${input(fresh)}`);
      } else if (phase === 'fresh' && stdout.endsWith(fresh.output)) {
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
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}

export function checkCompletedEduSystem30Cli(executable: string, directory: string): void {
  checkCompletedGame(executable, directory, 'litqz', litqzSource, litqzRounds, assertLitqzOutput);
  checkCompletedGame(
    executable,
    directory,
    'number',
    numberSource,
    numberGames,
    assertNumberOutput,
  );
  checkCompletedGame(
    executable,
    directory,
    'chemst',
    chemstSource,
    [chemstGame, chemstGame],
    assertChemstOutput,
  );
  checkCompletedGame(executable, directory, 'diamnd', diamndSource, diamndRuns, assertDiamndOutput);
  checkCompletedGame(executable, directory, 'even', evenSource, evenRuns, assertEvenOutput);
}

export async function checkWaitingEduSystem30Cli(
  executable: string,
  directory: string,
): Promise<void> {
  await checkWaitingGame(
    executable,
    directory,
    'batnum',
    batnumSource,
    batnumRuns,
    340,
    assertBatnumOutput,
  );
  await checkWaitingGame(
    executable,
    directory,
    'rocket',
    rocketSource,
    rocketRuns,
    21,
    assertRocketOutput,
  );
  await checkWaitingGame(
    executable,
    directory,
    'kinema',
    kinemaSource,
    kinemaRuns,
    500,
    assertKinemaOutput,
  );
  await checkWaitingGame(
    executable,
    directory,
    'bounce',
    bounceSource,
    bounceRuns,
    136,
    assertBounceOutput,
  );
}

async function checkWaitingGame<Round extends {readonly answers: readonly string[]}>(
  executable: string,
  directory: string,
  name: string,
  source: string,
  runs: readonly Round[],
  inputLabel: number,
  assertOutput: (output: string, run: Round) => void,
): Promise<void> {
  const file = join(directory, `${name}-edusystem30.basic.json`);
  const saved = join(directory, `${name}-edusystem30-copy.basic.json`);
  const document = {format: 'basic-program', version: 1, dialect: eduSystem30Dialect, source};
  writeFileSync(file, JSON.stringify(document));
  const input = (run: Round) => run.answers.join('\n') + '\n';
  const transcripts = runs.map((run) => {
    const result = runProcess({
      cwd: directory,
      args: [executable, file],
      input: input(run),
      expectedStatus: 1,
    });
    assert.match(
      result.stderr,
      new RegExp(`^Line ${inputLabel}, column \\d+: Input ended before a value was received\\n$`),
    );
    assertOutput(result.stdout, run);
    return result.stdout;
  });
  if (process.platform === 'win32') return;
  let phase: 'start' | 'play' | 'stopped' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args: [executable],
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'play';
        child.stdin.write(
          `LOAD "${file}"\nSAVE "${saved}"\nLOAD "${saved}"\nRUN\n${input(runs.at(-1)!)}`,
        );
      } else if (phase === 'play' && stdout.endsWith(transcripts.at(-1)!)) {
        phase = 'stopped';
        child.kill('SIGINT');
      } else if (phase === 'stopped' && stdout.endsWith('\n>>> ')) {
        phase = 'exit';
        child.stdin.write('EXIT\n');
      }
    },
  });
  assert.equal(phase, 'exit', editor.stdout);
  assert.equal(editor.status, 0);
  assert.equal(editor.stderr, '');
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}

function checkCompletedGame<Round extends {readonly answers: readonly string[]}>(
  executable: string,
  directory: string,
  name: string,
  source: string,
  rounds: readonly Round[],
  assertOutput: (output: string, round: Round) => void,
): void {
  const file = join(directory, `${name}-edusystem30.basic.json`);
  const saved = join(directory, `${name}-edusystem30-copy.basic.json`);
  const document = {format: 'basic-program', version: 1, dialect: eduSystem30Dialect, source};
  writeFileSync(file, JSON.stringify(document));
  const transcripts = rounds.map((round) => {
    const result = runProcess({
      cwd: directory,
      args: [executable, file],
      input: round.answers.join('\n') + '\n',
    });
    assert.equal(result.stderr, '');
    assertOutput(result.stdout, round);
    return result.stdout;
  });
  const editor = runProcess({
    cwd: directory,
    args: [executable],
    input: [
      `LOAD "${file}"`,
      `SAVE "${saved}"`,
      `LOAD "${saved}"`,
      ...rounds.flatMap(({answers}) => ['RUN', ...answers]),
      'EXIT',
      '',
    ].join('\n'),
  });
  assert.equal(editor.stderr, '');
  let offset = 0;
  for (const transcript of transcripts) {
    const position = editor.stdout.indexOf(transcript, offset);
    assert.ok(position >= offset, editor.stdout);
    offset = position + transcript.length;
  }
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}

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

import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

const quote = (path: string): string => `"${path.replaceAll('"', '""')}"`;

/** The same real-session assertions run against checkout and installed executables. */
export async function checkPersistenceSessions(executable: string): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'basic-persistence-'));
  const source = '10 INPUT "Name"; N$\n20 PRINT "Hello, ";N$\n30 END';
  const saved = join(directory, 'A "quoted" program.bas');
  const candidate = join(directory, 'candidate.bas');
  const replacement = '10 PRINT "candidate"';
  const changed = '10 PRINT "changed"\n20 END';
  const session = (entries: string[], expectedStatus = 0) =>
    runProcess({
      cwd: directory,
      args: [executable],
      input: [...entries, ''].join('\n'),
      expectedStatus,
    });
  const noTemporaries = () =>
    assert.deepEqual(
      readdirSync(directory).filter((name) => /^\.basic-.*\.tmp$/.test(name)),
      [],
    );
  try {
    const portable = join(directory, 'portable.BASIC.JSON');
    const verbatim = '\r\n20 END\r\n010 PRINT "portable editor"\r\n';
    const document = {format: 'basic-program', version: 1, dialect: 'native', source: verbatim};
    writeFileSync(portable, JSON.stringify(document));
    const portableSession = session([
      `LOAD ${quote(portable)}`,
      'LIST',
      'RUN',
      'RUN',
      'SAVE',
      'yes',
      'EXIT',
    ]);
    assert.equal(portableSession.stderr, '');
    assert.ok(portableSession.stdout.includes(verbatim + '\n'));
    assert.equal(portableSession.stdout.split('portable editor\n').length - 1, 2);
    assert.deepEqual(JSON.parse(readFileSync(portable, 'utf8')), document);
    const plainCopy = join(directory, 'portable-export.bas');
    const converted = session([`LOAD ${quote(portable)}`, `SAVE ${quote(plainCopy)}`, 'EXIT']);
    assert.equal(converted.stderr, '');
    assert.equal(readFileSync(plainCopy, 'utf8'), verbatim);
    const portableCopy = join(directory, 'plain-to-portable.basic.json');
    const imported = session([`LOAD ${quote(plainCopy)}`, `SAVE ${quote(portableCopy)}`, 'EXIT']);
    assert.equal(imported.stderr, '');
    assert.deepEqual(JSON.parse(readFileSync(portableCopy, 'utf8')), {
      ...document,
      source: '010 PRINT "portable editor"\n20 END',
    });
    const executedPortable = runProcess({cwd: directory, args: [executable, portableCopy]});
    assert.equal(executedPortable.stdout, 'portable editor\n');
    assert.equal(executedPortable.stderr, '');
    const badPortable = join(directory, 'bad.basic.json');
    for (const text of [
      '{',
      JSON.stringify({...document, dialect: 'basic-plus'}),
      JSON.stringify({...document, source: '10 END\n20 GOTO 999'}),
    ]) {
      writeFileSync(badPortable, text);
      const rejected = session([
        `LOAD ${quote(portable)}`,
        '30 REM unsaved',
        `LOAD ${quote(badPortable)}`,
        'LIST',
        'SAVE',
        'yes',
        'EXIT',
      ]);
      assert.notEqual(rejected.stderr, '');
      assert.doesNotMatch(rejected.stdout, /Discard unsaved changes and load/);
      const kept = {...document, source: '010 PRINT "portable editor"\n20 END\n30 REM unsaved'};
      assert.deepEqual(JSON.parse(readFileSync(portable, 'utf8')), kept);
      writeFileSync(portable, JSON.stringify(document));
    }
    noTemporaries();
    const first = session([
      '30 END',
      '20 PRINT "Hello, ";N$',
      '10 INPUT "Name"; N$',
      `SAVE ${quote(saved)}`,
      'EXIT',
    ]);
    assert.equal(first.stderr, '');
    assert.equal(readFileSync(saved, 'utf8'), source);
    assert.doesNotMatch(first.stdout, /Discard unsaved/);

    const restarted = session([
      `LOAD ${quote(saved)}`,
      'LIST',
      'RUN',
      'Ada',
      'SAVE',
      'yes',
      'EXIT',
    ]);
    assert.equal(restarted.stderr, '');
    assert.ok(restarted.stdout.includes(source + '\n'));
    assert.ok(restarted.stdout.includes('Hello, Ada\n'));
    assert.match(restarted.stdout, /Overwrite /);
    assert.equal(readFileSync(saved, 'utf8'), source);

    // A failed load must retain not only source, but its previous default filename.
    for (const {invalid, diagnostic} of [
      {invalid: '10 END\n10 END', diagnostic: /Duplicate line label 10/},
      {invalid: '10 GOTO 90', diagnostic: /No line label 90/},
      {invalid: '10 FOR I=1 TO 2', diagnostic: /FOR has no matching NEXT/},
      {invalid: '10 DATA 1:PRINT 2', diagnostic: /DATA must be the last statement/},
      {invalid: '10 END:READ A(0)', diagnostic: /Array A requires DIM/},
      {invalid: '10 END:INPUT A(0)', diagnostic: /Array A requires DIM/},
      {invalid: '10 INPUT A,,B', diagnostic: /Expected a variable or array/},
      {invalid: '10 IF 1=1 THEN PRINT "ok" ELSE 999', diagnostic: /No line label 999/},
      {invalid: '10 IF 1=1 THEN PRINT "ok" ELSE PRINT A(0)', diagnostic: /Array A requires DIM/},
    ]) {
      writeFileSync(saved, '10 PRINT "original"');
      writeFileSync(candidate, invalid);
      const failed = session([
        `LOAD ${quote(saved)}`,
        '10 PRINT "changed"',
        '20 END',
        `LOAD ${quote(candidate)}`,
        'LIST',
        'SAVE',
        'yes',
        'EXIT',
      ]);
      assert.match(failed.stderr, diagnostic);
      assert.doesNotMatch(failed.stderr, /Unsaved program at EOF/);
      assert.ok(failed.stdout.includes(changed + '\n'));
      assert.doesNotMatch(failed.stdout, /Discard unsaved changes and load/);
      assert.equal(readFileSync(saved, 'utf8'), changed);
      assert.equal(readFileSync(candidate, 'utf8'), invalid);
      noTemporaries();
    }

    for (const invalidPath of [join(directory, 'missing.bas'), directory]) {
      writeFileSync(saved, '10 END');
      const failed = session([
        `LOAD ${quote(saved)}`,
        '10 PRINT "changed"',
        '20 END',
        `LOAD ${quote(invalidPath)}`,
        'SAVE',
        'yes',
        'EXIT',
      ]);
      assert.match(failed.stderr, /ENOENT|EISDIR/);
      assert.equal(readFileSync(saved, 'utf8'), changed);
    }

    writeFileSync(saved, '10 END');
    writeFileSync(candidate, replacement);
    const declinedLoad = session([
      `LOAD ${quote(saved)}`,
      '10 PRINT "changed"',
      '20 END',
      `LOAD ${quote(candidate)}`,
      'no',
      'LIST',
      'SAVE',
      'yes',
      'EXIT',
    ]);
    assert.equal(declinedLoad.stderr, '');
    assert.ok(declinedLoad.stdout.includes(changed + '\n'));
    assert.equal(readFileSync(saved, 'utf8'), changed);
    assert.equal(readFileSync(candidate, 'utf8'), replacement);

    const acceptedLoad = session([
      '10 PRINT "discarded"',
      `LOAD ${quote(candidate)}`,
      'yes',
      'LIST',
      'SAVE',
      'yes',
      'EXIT',
    ]);
    assert.equal(acceptedLoad.stderr, '');
    assert.ok(acceptedLoad.stdout.includes(replacement + '\n'));
    assert.doesNotMatch(acceptedLoad.stdout, /discarded/);
    assert.equal(readFileSync(candidate, 'utf8'), replacement);

    const declinedSave = session(['10 PRINT "unsaved"', `SAVE ${quote(candidate)}`, 'no'], 1);
    assert.match(declinedSave.stderr, /Unsaved program at EOF/);
    assert.ok(declinedSave.stderr.includes('10 PRINT "unsaved"'));
    assert.equal(readFileSync(candidate, 'utf8'), replacement);

    for (const target of [join(directory, 'missing-parent', 'program.bas'), directory]) {
      const commands = ['10 PRINT "unsaved"', `SAVE ${quote(target)}`];
      if (target === directory) commands.push('yes');
      const failure = session(commands, 1);
      assert.match(failure.stderr, /ENOENT|EISDIR|ENOTEMPTY|EPERM/);
      assert.match(failure.stderr, /Unsaved program at EOF/);
      assert.equal(readFileSync(candidate, 'utf8'), replacement);
      noTemporaries();
    }

    const incomplete = join(directory, 'incomplete.bas');
    assert.equal(session(['10 GOTO 90', `SAVE ${quote(incomplete)}`, 'EXIT']).stderr, '');
    assert.equal(readFileSync(incomplete, 'utf8'), '10 GOTO 90');
    const rejected = session(['10 PRINT "kept"', `LOAD ${quote(incomplete)}`, 'LIST'], 1);
    assert.match(rejected.stderr, /No line label 90/);
    assert.ok(rejected.stdout.includes('10 PRINT "kept"\n'));
    assert.match(rejected.stderr, /Unsaved program at EOF/);

    if (process.platform !== 'win32') {
      let phase: 'start' | 'saving' | 'cancelled' | 'finished' = 'start';
      let oldPrompts = 0;
      const result = await runWithOpenInput({
        cwd: directory,
        args: [executable],
        onOutput(stdout, child) {
          const prompts = stdout.split('>>> ').length - 1;
          if (phase === 'start' && prompts > 0) {
            phase = 'saving';
            child.stdin.write(`10 PRINT "interrupted"\nSAVE ${quote(candidate)}\n`);
          }
          if (phase === 'saving' && stdout.includes('Overwrite ')) {
            phase = 'cancelled';
            oldPrompts = prompts;
            child.kill('SIGINT');
          }
          if (phase === 'cancelled' && prompts > oldPrompts) {
            phase = 'finished';
            child.stdin.write('LIST\nEXIT\nyes\n');
          }
        },
      });
      assert.equal(phase, 'finished', 'Interrupted SAVE did not return to the editor');
      assert.equal(result.status, 0);
      assert.equal(result.signal, null);
      assert.equal(result.stderr, '');
      assert.ok(result.stdout.includes('10 PRINT "interrupted"\n'));
      assert.equal(readFileSync(candidate, 'utf8'), replacement);
    }
    noTemporaries();
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

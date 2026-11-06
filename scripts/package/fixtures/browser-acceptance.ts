import type {BrowserView, BrowserState, GraphicsCommand} from 'node-basic-lang/browser';

type BrowserAPI = typeof import('node-basic-lang/browser');
type RootAPI = Pick<
  typeof import('node-basic-lang'),
  | 'parseProgram'
  | 'Basic'
  | 'Evaluator'
  | 'validateProgram'
  | 'BasicSyntaxError'
  | 'BasicRuntimeError'
>;
export const browserEmbeddingCases = [
  'unfinished draft envelope and validation on Run',
  'malformed envelope preserves draft',
  'PRINT graphics WAIT keyboard and submitted INPUT',
  'Stop pending INPUT rejects stale callbacks',
  'replacement rejects stale callbacks',
  'repeat Run starts fresh variables',
  'Stop cancels WAIT',
  'unsupported context preserves prior state',
  'native supplied MA2 literals reject before effects',
  'historical numeric expression conformance stays internal',
] as const;

function check(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}
async function until(predicate: () => boolean): Promise<void> {
  for (let count = 0; count < 1000; count++) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Expected embedding event did not arrive');
}

/** Portable independent oracles, run from an installed package in Bun and Chromium. */
export async function runBrowserEmbedding(api: BrowserAPI, root: RootAPI) {
  const {parseProgram} = root;
  const draft = '\t10 PRINT "unfinished🙂\r\n';
  const envelope = api.encodeSourceDocument(draft);
  let document = api.decodeSourceDocument(envelope);
  check(document.source === draft && document.dialect === 'native', 'Exact unfinished draft');
  check(Object.isFrozen(document), 'Frozen source context');
  check(
    document.format === api.SOURCE_DOCUMENT_FORMAT &&
      document.version === api.SOURCE_DOCUMENT_VERSION,
    'Envelope constants',
  );
  let rejected = false;
  try {
    parseProgram(document.source, {dialect: document.dialect});
  } catch {
    rejected = true;
  }
  check(rejected, 'Complete-program parser rejects unfinished draft');
  const previous = document;
  for (const malformed of [
    '{',
    JSON.stringify({...document, version: 99}),
    JSON.stringify({...document, dialect: 'other'}),
  ]) {
    rejected = false;
    try {
      document = api.decodeSourceDocument(malformed);
    } catch {
      rejected = true;
    }
    check(rejected && document === previous, 'Failed import preserves draft/context');
  }
  check(api.createSourceDocument(draft).source === draft, 'Source construction keeps draft');
  const keyboard = new api.KeyboardInput();
  check(api.logicalKey('ArrowUp') === 'UP' && api.logicalKey('Escape') === null, 'Logical keys');
  keyboard.press('a');
  let output = '';
  const drawing: GraphicsCommand[] = [];
  const requests: {prompt: string; submit: (text: string) => boolean}[] = [];
  let presents = 0;
  const states: BrowserState[] = [];
  const view: BrowserView = {
    write: (text) => {
      output += text;
    },
    clear: () => {
      output = '';
      drawing.length = 0;
    },
    draw: (command) => drawing.push(command),
    present: () => {
      presents++;
    },
    readKey: () => keyboard.readKey(),
    keyDown: (key) => keyboard.keyDown(key),
    requestInput: (prompt, submit) => requests.push({prompt, submit}),
    stateChanged: (state) => states.push(state),
  };
  const session = new api.BrowserSession(view);
  try {
    const invalid = await session.run(document.source, {dialect: document.dialect});
    check(
      invalid.status === 'error' && invalid.diagnostic !== null && output === '',
      'Run validates before PRINT',
    );
    check(document.source === draft, 'Run failure preserves editable draft');
    const running = session.run(
      '10 PRINT "EMBED"\n20 COLOR 4\n30 PSET 2,3\n40 WAIT 5\n50 PRINT INKEY$();KEYDOWN("A")\n60 INPUT "Name";N$\n70 PRINT "Hello ";N$\n80 END',
    );
    await until(() => requests.length === 1);
    check(session.state.status === 'waiting' && presents === 1, 'WAIT completed before INPUT');
    check(output === 'EMBED\nA1\n' && requests[0].prompt === 'Name? ', 'Print and prompt output');
    check(
      JSON.stringify(drawing) === JSON.stringify([{kind: 'pset', x: 2, y: 3, color: 4}]),
      'Drawing command',
    );
    check(Object.isFrozen(drawing[0]), 'Drawing command immutable');
    check(
      requests[0].submit('Ada') && !requests[0].submit('again'),
      'Request consumes only one answer',
    );
    check((await running).status === 'finished', 'Submitted run finished');
    check(output === 'EMBED\nA1\nHello Ada\n', 'Host-controlled input and subsequent output');
    const printed = output;
    const command = drawing[0];
    const pending = session.run('10 INPUT "Again";N$\n20 PRINT "stale"');
    await until(() => requests.length === 2);
    check(session.stop().status === 'stopped', 'Stop pending input');
    check(
      (await pending).status === 'stopped' && !requests[1].submit('late'),
      'Stale stopped callback',
    );
    check(output === '', 'Stopped input produced no stale output');
    const replaced = session.run('10 INPUT "Old";N$\n20 PRINT "old"');
    await until(() => requests.length === 3);
    const replacement = session.run('10 PRINT "replacement"');
    check(!requests[2].submit('late'), 'Replacement rejects old callback');
    check(
      (await replaced).status === 'stopped' && (await replacement).status === 'finished',
      'Replacement ownership',
    );
    check(output === 'replacement\n', 'Only replacement output');
    for (let count = 0; count < 2; count++) {
      const result = await session.run('10 N=1\n20 PRINT N\n30 END');
      check(result.status === 'finished' && output === '1\n', 'Fresh repeated Run');
      check(
        JSON.stringify(result.variables) === JSON.stringify([{name: 'N', value: 1}]),
        'No stale variables',
      );
    }
    const waiting = session.run('10 PRINT "before"\n20 WAIT 10000\n30 PRINT "after"');
    await until(() => presents === 2);
    check(
      session.stop().status === 'stopped' && (await waiting).status === 'stopped',
      'Stop releases WAIT',
    );
    check(output === 'before\n', 'Cancelled WAIT has no later output');
    keyboard.clear();
    check(keyboard.readKey() === '' && !keyboard.keyDown('A'), 'Host keyboard cleanup');
    const stopped = session.state;
    rejected = false;
    try {
      await session.run('10 END', {dialect: 'other' as 'native'});
    } catch {
      rejected = true;
    }
    check(rejected && session.state === stopped, 'Unsupported context is atomic');
    check(states.every(Object.isFrozen), 'Immutable state observations');
    const native = parseProgram('10 PRINT "before"\n20 END\n30 PRINT 1');
    const print = native.lines[2].statement;
    if (print.type !== 'PrintStatement') throw new Error('Expected literal PRINT');
    const foreign: Extract<import('node-basic-lang').Expression, {type: 'Ma2NumberLiteral'}> = {
      type: 'Ma2NumberLiteral',
      raw: '1',
      words: [0x4080, 0],
      location: print.items[0].location,
    };
    Object.defineProperty(foreign, 'words', {
      get() {
        throw new Error('Observed foreign words');
      },
    });
    const lines = native.lines.map((line, index) =>
      index === 2 ? {...line, statement: {...print, items: [foreign]}} : line,
    );
    const expectForeign = (action: () => unknown, runtime = false) => {
      try {
        action();
      } catch (error) {
        const expected = runtime ? root.BasicRuntimeError : root.BasicSyntaxError;
        if (!(error instanceof expected)) throw error;
        check(
          error.diagnostic.code === 'UNSUPPORTED_NUMERIC_LITERAL' && error.diagnostic.label === 30,
          'Located foreign literal rejection',
        );
        return;
      }
      throw new Error('Expected MA2 rejection');
    };
    expectForeign(() => root.validateProgram(lines));
    let writes = '';
    const basic = new root.Basic({
      write: (text) => {
        writes += text;
      },
    });
    basic.run('10 PRINT "saved"');
    writes = '';
    expectForeign(() => basic.run({type: 'Program', lines}));
    check(writes === '', 'Reject after-END foreign literal before PRINT');
    basic.run();
    check(writes === 'saved\n', 'Failed replacement preserves prior program');
    let effects = 0;
    const evaluator = new root.Evaluator({
      random: () => {
        effects++;
        return 0.5;
      },
    });
    const random = parseProgram('10 PRINT RND()').lines[0].statement;
    if (random.type !== 'PrintStatement') throw new Error('Expected random PRINT');
    expectForeign(
      () =>
        evaluator.evaluate({
          type: 'BinaryExpression',
          operator: '+',
          operatorLocation: foreign.location,
          location: foreign.location,
          left: random.items[0],
          right: foreign,
        }),
      true,
    );
    check(
      effects === 0 && evaluator.snapshotVariables().length === 0,
      'Foreign tree has no native effects',
    );
    check(!('parseBasicPlusMa2NumericExpression' in root), 'No public conformance parser');
    let historicalRejected = false;
    try {
      root.parseProgram('10 PRINT 1', {dialect: 'basic-plus-v4a12-ma2' as 'native'});
    } catch (error) {
      historicalRejected = error instanceof TypeError;
    }
    check(historicalRejected, 'Historical program context remains gated');
    return {cases: [...browserEmbeddingCases], printed, command, draft};
  } finally {
    session.stop();
    keyboard.clear();
  }
}

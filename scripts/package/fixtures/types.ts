// Compile-only consumer: the rejected operations at the end must never execute.
import {
  Basic,
  parseLine,
  parseProgram,
  BasicSyntaxError,
  BasicRuntimeError,
  Evaluator,
  validateProgram,
  type Dialect,
  type LanguageOptions,
  type SourceOptions,
  type BasicValue,
  type GraphicsCommand,
  type LogicalKey,
  type Host,
  type Program,
  type RunResult,
  type InputOptions,
  type Comparison,
  type ComparisonOperator,
  type RunOptions,
  type ExecutionScheduler,
  type VariableSnapshot,
  type ArraySnapshot,
  type ArrayDeclaration,
  type AssignmentTarget,
  type Location,
  type Expression,
  type SimpleStatement,
} from 'node-basic-lang';
const host: Host = {
  write(text: string) {
    void text;
  },
  clear() {},
  wait(milliseconds, options) {
    void milliseconds;
    void options?.signal;
    return Promise.resolve();
  },
  readLine() {
    return Promise.resolve(null);
  },
  random() {
    return 0.5;
  },
};
const key: LogicalKey = 'UP';
const keyboardHost: Host = {
  ...host,
  readKey: () => 'A',
  keyDown(value) {
    const logical: LogicalKey = value;
    return logical === key;
  },
};
new Basic(keyboardHost).run('10 PRINT INKEY$();KEYDOWN("UP")');
const command: GraphicsCommand = {kind: 'circle', x: 160, y: 100, radius: 20, color: 14};
const graphicsHost: Host = {
  ...host,
  draw(value) {
    const color: number = value.color;
    void color;
  },
};
graphicsHost.draw?.(command);
const program: Program = parseProgram('10 PRINT 1');
const basic = new Basic(host);
const dialect: Dialect = basic.dialect;
const language: LanguageOptions = {dialect};
const fragmentOptions: SourceOptions = {...language, line: 4, offset: 80};
const fragment = parseLine('10 PRINT 4', fragmentOptions);
const configured = new Basic(host, language);
const configuredEvaluator = new Evaluator(host, language);
const configuredProgram = parseProgram('10 PRINT 4', language);
const programDialect: Dialect | undefined = configuredProgram.dialect;
if (fragment) validateProgram([fragment], language);
// Older callers can still construct native programs without metadata.
const legacyProgram: Program = {type: 'Program', lines: program.lines};
configured.run(legacyProgram);
void configuredEvaluator.dialect;
void programDialect;
basic.reset(program);
const result: RunResult = basic.step();
const label: number | null = result.currentLocation?.label ?? null;
const diagnosticCode: string | undefined = basic.state.diagnostic?.code;
basic.run(program);
basic.run();
const options: InputOptions = {signal: new AbortController().signal};
const scheduler: ExecutionScheduler = (signal) => {
  void signal.aborted;
  return Promise.resolve();
};
const runOptions: RunOptions = {...options, instructionLimit: 10, yieldEvery: 2, scheduler};
const asyncResult: RunResult = await basic.runAsync(program, runOptions);
const variables: readonly VariableSnapshot[] = basic.variables;
await basic.runAsync(program, {
  beforeStatement: (signal) => {
    void signal.aborted;
  },
});
await basic.runAsync(program, {beforeStatement: () => Promise.resolve()});
await basic.stepAsync(options);
await basic.readLineAsync('20 REM', options);
basic.cancel();
void asyncResult;
void label;
void diagnosticCode;
const evaluator = new Evaluator(host);
const evaluatorVariables: readonly VariableSnapshot[] = evaluator.snapshotVariables();
void evaluatorVariables;
const loops = parseProgram('10 FOR I=1 TO 2\n20 NEXT I');
const header = loops.lines[0].statement;
if (header.type === 'ForStatement') {
  const name: string = header.variable.name;
  const defaultStep: boolean = header.step === null;
  void name;
  void defaultStep;
}
const branch = parseLine('10 IF 1 < 2 THEN 20');
if (branch?.statement.type === 'IfStatement') {
  const condition: Comparison = branch.statement.condition;
  const operator: ComparisonOperator = condition.operator;
  const result: boolean = evaluator.compare(condition);
  void operator;
  void result;
}
try {
  parseProgram('10 PRINT 1+');
} catch (error) {
  if (!(error instanceof BasicSyntaxError)) throw error;
  const code: string = error.diagnostic.code;
  void code;
}
for (const line of program.lines) {
  if (line.statement.type === 'PrintStatement') {
    const expressions = line.statement.items;
    try {
      const value: BasicValue = evaluator.evaluate(expressions[0]);
      void value;
    } catch (error) {
      if (!(error instanceof BasicRuntimeError)) throw error;
      const code: string = error.diagnostic.code;
      void code;
    }
  }
  if (line.statement.type === 'LetStatement') {
    evaluator.assign(line.statement.target, evaluator.evaluate(line.statement.expression));
  }
}
evaluator.reset();
const arrayProgram = parseProgram('10 DIM BOARD(1,2)\n20 BOARD(1,2)=7');
const dimension = arrayProgram.lines[0].statement;
if (dimension.type === 'DimStatement') {
  const declarations: readonly ArrayDeclaration[] = dimension.declarations;
  evaluator.reset(declarations);
}
const arrayAssignment = arrayProgram.lines[1].statement;
if (arrayAssignment.type === 'LetStatement') {
  const target: AssignmentTarget = arrayAssignment.target;
  evaluator.assign(target, 7);
  if (target.type === 'ArrayReference') {
    const indexExpression: Expression = target.indices[0];
    void indexExpression;
  }
}
const arraySnapshots: readonly ArraySnapshot[] = basic.arrays;
const evaluatorArrays: readonly ArraySnapshot[] = evaluator.snapshotArrays();
void evaluatorArrays;
const formattedStatement = parseProgram('10 PRINT USING "##",1').lines[0].statement;
if (formattedStatement.type === 'PrintUsingStatement') {
  const format: Expression = formattedStatement.format;
  const items: readonly Expression[] = formattedStatement.items;
  const punctuation: readonly import('node-basic-lang').Location[] = formattedStatement.separators;
  void format;
  void items;
  void punctuation;
  // @ts-expect-error Formatted item lists cannot be mutated.
  formattedStatement.items[0] = format;
}

// These rejected assignments are part of the public contract. A missing error
// makes TypeScript report an unused @ts-expect-error directive.
// @ts-expect-error Array observations cannot alter stored values.
arraySnapshots[0].values[0] = 1;
// @ts-expect-error Array bounds are immutable.
arraySnapshots[0].bounds[0] = 2;
// @ts-expect-error Scalars do not acquire array-valued BASIC values.
const invalidArrayValue: BasicValue = [1, 2];
void invalidArrayValue;
// @ts-expect-error Unsupported historical profiles are not public choices.
new Basic(host, {dialect: 'basic-plus-1972'});
// @ts-expect-error Parser options use the same supported dialect set.
parseProgram('10 END', {dialect: 'basic-plus-1972'});
// @ts-expect-error Validation cannot silently choose an unknown profile.
validateProgram([], {dialect: 'basic-plus-1972'});
// @ts-expect-error Evaluator configuration cannot select an unknown profile.
new Evaluator(host, {dialect: 'basic-plus-1972'});
// @ts-expect-error Instance language is immutable after construction.
basic.dialect = 'native';
// @ts-expect-error Evaluator language is immutable after construction.
configuredEvaluator.dialect = 'native';
// @ts-expect-error Prepared program language metadata is readonly.
configuredProgram.dialect = 'native';
// @ts-expect-error Parsed line language metadata is readonly.
if (fragment) fragment.dialect = 'native';
// @ts-expect-error Graphics commands are readonly.
command.color = 1;
const invalidGraphicsHost: Host = {
  ...host,
  // @ts-expect-error A graphics host callback receives a command, not text.
  draw: (text: string) => {
    void text;
  },
};
void invalidGraphicsHost;
// @ts-expect-error Programs expose a readonly line array.
program.lines[0] = loops.lines[0];
// @ts-expect-error Execution snapshots expose readonly status.
result.status = 'ready';
// @ts-expect-error Variable snapshots expose a readonly array.
variables[0] = {name: 'N', value: 1};
// @ts-expect-error Snapshot entries cannot alter interpreter variables.
variables[0].value = 1;
// @ts-expect-error Statement gates return void or a promise.
void basic.runAsync(program, {beforeStatement: () => 'continue'});
// @ts-expect-error Hosts must supply asynchronous waits.
const invalidWaitHost: Host = {...host, wait: () => {}};
void invalidWaitHost;
// @ts-expect-error Hosts must supply asynchronous input.
const invalidHost: Host = {...host, readLine: () => 'answer'};
// @ts-expect-error BASIC has no boolean value type.
const invalidValue: BasicValue = true;
// @ts-expect-error Comparisons use BASIC operators.
const invalidOperator: ComparisonOperator = '===';
// @ts-expect-error Instruction limits are numeric.
void basic.runAsync(program, {instructionLimit: '10'});
// @ts-expect-error Schedulers must return a promise.
void basic.runAsync(program, {scheduler: () => {}});
// @ts-expect-error Cancellation uses an AbortSignal.
void basic.stepAsync({signal: 'abort'});
void invalidHost;
void invalidValue;
void invalidOperator;

// @ts-expect-error Escape is reserved for the host Stop control.
const invalidKey: LogicalKey = 'ESCAPE';
// @ts-expect-error Reading a queued key is synchronous.
const invalidReadKeyHost: Host = {...host, readKey: () => Promise.resolve('A')};
// @ts-expect-error Held-state callbacks return a boolean, not BASIC's numeric value.
const invalidKeyDownHost: Host = {...host, keyDown: () => 1};
void invalidKey;
void invalidReadKeyHost;
void invalidKeyDownHost;

const sequenceLine = parseLine('10 PRINT 1:END');
if (sequenceLine?.statement.type === 'StatementSequence') {
  const leaf: SimpleStatement = sequenceLine.statement.statements[0];
  const separator: Location = sequenceLine.statement.separators[0];
  void leaf;
  void separator;
  // @ts-expect-error Statement members are readonly.
  sequenceLine.statement.statements[0] = leaf;
  // @ts-expect-error A sequence cannot contain another sequence.
  const invalidLeaf: SimpleStatement = sequenceLine.statement;
  void invalidLeaf;
}

const literalCall = parseLine('10 GOSUB 100')?.statement;
if (literalCall?.type === 'GosubStatement') {
  const label: number = literalCall.target.value;
  void label;
  // @ts-expect-error A call target belongs to the immutable parsed snapshot.
  literalCall.target.value = 200;
}
const returnStatement = parseLine('10 RETURN')?.statement;
if (returnStatement?.type === 'ReturnStatement') {
  const kind: 'ReturnStatement' = returnStatement.type;
  void kind;
}

const dataStatement = parseLine('10 DATA 1,"x"')?.statement;
if (dataStatement?.type === 'DataStatement') {
  const value: BasicValue = dataStatement.items[0].value;
  void value;
  const invalidData: (typeof dataStatement.items)[number] = {
    // @ts-expect-error Data items retain literal types, not arbitrary expressions.
    type: 'Variable',
    name: 'A',
    location: dataStatement.location,
  };
  void invalidData;
  // @ts-expect-error Prepared data lists are immutable.
  dataStatement.items[0] = dataStatement.items[1];
}
const readStatement = parseLine('10 READ A,S$(0)')?.statement;
if (readStatement?.type === 'ReadStatement') {
  const target: AssignmentTarget = readStatement.targets[0];
  void target;
  const invalidRead: (typeof readStatement.targets)[number] = {
    // @ts-expect-error READ accepts assignment targets, not values.
    type: 'NumberLiteral',
    value: 1,
    raw: '1',
    location: readStatement.location,
  };
  void invalidRead;
  // @ts-expect-error Read targets belong to the immutable snapshot.
  readStatement.targets[0] = target;
}
const restoreStatement = parseLine('10 RESTORE')?.statement;
if (restoreStatement?.type === 'RestoreStatement') {
  const kind: 'RestoreStatement' = restoreStatement.type;
  void kind;
}

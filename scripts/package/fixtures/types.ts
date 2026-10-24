// Compile-only consumer: the rejected operations at the end must never execute.
import {
  Basic,
  parseLine,
  parseProgram,
  BasicSyntaxError,
  BasicRuntimeError,
  Evaluator,
  type BasicValue,
  type GraphicsCommand,
  type Host,
  type Program,
  type RunResult,
  type InputOptions,
  type Comparison,
  type ComparisonOperator,
  type RunOptions,
  type ExecutionScheduler,
  type VariableSnapshot,
} from 'node-basic-lang';
const host: Host = {
  write(text: string) {
    void text;
  },
  clear() {},
  readLine() {
    return Promise.resolve(null);
  },
  random() {
    return 0.5;
  },
};
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

// These rejected assignments are part of the public contract. A missing error
// makes TypeScript report an unused @ts-expect-error directive.
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

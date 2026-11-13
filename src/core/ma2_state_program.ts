import {ControlFlow, type LoopValues} from './control_flow.ts';
import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {createBasicPlusMa2ArraySession, readHostRandom} from './evaluator.ts';
import {prepareSelectedMa2Candidate} from './prepared_program.ts';
import {injectMa2Value, observeMa2Value, type Ma2Value} from './ma2_value.ts';
import {basicPlusStringLength} from './basic_plus_strings.ts';
import {Ma2StatementOutput} from './ma2_statement_output.ts';
import {readSelectedMa2Input} from './ma2_statement_input.ts';
import {SelectedMa2StringState} from './ma2_replay_strings.ts';
import {selectedMa2CandidateImages} from './ma2_using_image.ts';
import {abortError} from './cancellation.ts';
import {expressionType} from './comparison.ts';
import type {Expression, Host, Location, NodeOf, ParsedLine} from './types.ts';
import type {Instruction} from './instructions.ts';

/** Internal state/control execution slice. It has no host effects or public profile. */
export function runSelectedMa2StateProgram(source: string, instructionLimit = 10_000) {
  return prepareSelectedMa2Program(source, instructionLimit, false).advance();
}

/** Execute reviewed source through its first INPUT and return its rendered opening. */
export function runSelectedMa2Opening(source: string, instructionLimit = 10_000) {
  return prepareSelectedMa2Program(source, instructionLimit, true, true).advance();
}

/** Internal run-owned continuation at selected INPUT boundaries. */
export function createSelectedMa2Session(
  source: string,
  instructionLimit = 10_000,
  supplied?: readonly ParsedLine[],
) {
  return prepareSelectedMa2Program(source, instructionLimit, true, false, supplied);
}

function prepareSelectedMa2Program(
  source: string,
  instructionLimit: number,
  opening: boolean,
  firstInputOnly = false,
  supplied?: readonly ParsedLine[],
  noInput = false,
  externalWrite?: (text: string) => void,
  entropyHost?: Pick<Host, 'random'>,
) {
  if (!Number.isSafeInteger(instructionLimit) || instructionLimit < 0)
    throw new TypeError('Expected a nonnegative instruction limit');
  const candidate = prepareSelectedMa2Candidate(source, supplied);
  // BASIC-PLUS numeric scalars start at zero (§§2.5.2, 3.6.2). The generic
  // MA2 conformance helper keeps its explicit-unbound diagnostic policy.
  let randomSeed = 6715;
  const nextRandom = () => {
    randomSeed = (randomSeed * 31747) & 0xffff;
    // Every 15-bit binary fraction is exactly representable in MA2.
    return (injectMa2Value((randomSeed & 0x7fff) / 32768) as {value: Ma2Value}).value;
  };
  const state = createBasicPlusMa2ArraySession(candidate.arrayDeclarations, {
    defaultNumericScalars: true,
    nextRandom: entropyHost ? nextRandom : undefined,
  });
  const strings = new SelectedMa2StringState();
  const chunks: string[] = [];
  let outputLength = 0;
  let outputLocation = candidate.instructions[0]?.statement.location;
  const output = new Ma2StatementOutput((text) => {
    if (outputLength + text.length > 1_000_000)
      throw new BasicRuntimeError(
        'OUTPUT_LIMIT',
        'Selected MA2 opening output limit reached',
        outputLocation.start,
        outputLocation.label,
      );
    externalWrite?.(text);
    chunks.push(text);
    outputLength += text.length;
  });
  const supported = new Set([
    'DimStatement',
    'LetStatement',
    'IfStatement',
    'GotoStatement',
    'ForStatement',
    'NextStatement',
    'RemStatement',
    'EndStatement',
    ...(opening ? ['PrintStatement', 'PrintUsingStatement'] : []),
    ...(opening && !noInput ? ['InputStatement'] : []),
    ...(externalWrite ? ['SleepStatement'] : []),
    ...(entropyHost ? ['RandomizeStatement'] : []),
  ]);
  // Check every statement, including dead source, before changing state.
  for (const {statement} of candidate.instructions) {
    // The legacy opening preview cannot resume; only the resumable session
    // authorizes an entire source program and must inspect beyond INPUT.
    if (firstInputOnly && statement.type === 'InputStatement') break;
    if (!supported.has(statement.type))
      throw new BasicSyntaxError(
        'UNSUPPORTED_MA2_EXECUTION',
        `Selected MA2 state execution does not support ${statement.type}`,
        statement.location.start,
        statement.location.label,
      );
    if (statement.type === 'LetStatement') {
      if (opening && statement.target.name.endsWith('$')) {
        strings.validateAssignment(statement);
        continue;
      }
      if (statement.target.name.endsWith('$') || statement.target.name.endsWith('%'))
        throw new BasicSyntaxError(
          'UNSUPPORTED_MA2_EXECUTION',
          'Selected MA2 state execution requires numeric targets',
          statement.target.location.start,
          statement.location.label,
        );
      state.validateNode(statement.expression);
      if (statement.target.type === 'ArrayReference') state.validateNode(statement.target);
    } else if (statement.type === 'IfStatement') {
      if (
        opening &&
        (expressionType(statement.condition.left) === 'string' ||
          expressionType(statement.condition.right) === 'string')
      )
        strings.validateReplay(statement.condition);
      else state.validateComparison(statement.condition);
    } else if (statement.type === 'InputStatement') {
      if (!/^[A-Z][0-9]?\$?$/.test(statement.target.name))
        throw new BasicSyntaxError(
          'UNSUPPORTED_MA2_INPUT',
          'Selected MA2 input requires a short numeric or string scalar',
          statement.target.location.start,
          statement.location.label,
        );
      if (statement.prompt) {
        const valid = basicPlusStringLength(statement.prompt.value);
        if (valid.kind !== 'value')
          throw new BasicSyntaxError(
            'UNSUPPORTED_MA2_STRING',
            valid.reason,
            statement.prompt.location.start,
            statement.location.label,
          );
      }
    } else if (statement.type === 'SleepStatement') {
      if (expressionType(statement.seconds) === 'string')
        throw new BasicSyntaxError(
          'TYPE_MISMATCH',
          'SLEEP duration must be numeric',
          statement.seconds.location.start,
          statement.location.label,
        );
      state.validateNode(statement.seconds);
    } else if (statement.type === 'ForStatement') {
      state.validateNode(statement.start);
      state.validateNode(statement.end);
      if (statement.step) state.validateNode(statement.step);
    } else if (
      opening &&
      (statement.type === 'PrintStatement' || statement.type === 'PrintUsingStatement')
    ) {
      const expressions =
        statement.type === 'PrintUsingStatement'
          ? [statement.format, ...statement.items]
          : statement.items;
      for (const expression of expressions) {
        if (
          statement.type === 'PrintStatement' &&
          expression.type === 'CallExpression' &&
          expression.name === 'TAB'
        ) {
          const argument = expression.arguments[0];
          if (expressionType(argument) === 'string')
            throw new BasicSyntaxError(
              'UNSUPPORTED_MA2_TAB',
              'TAB requires a numeric position',
              argument.location.start,
              statement.location.label,
            );
          state.validateNode(argument);
          if (
            argument.type === 'Ma2NumberLiteral' ||
            (argument.type === 'UnaryExpression' && argument.argument.type === 'Ma2NumberLiteral')
          ) {
            const result = state.evaluateNode(argument);
            const observed = result.kind === 'value' ? observeMa2Value(result.value) : result;
            if (
              observed.kind !== 'value' ||
              !Number.isInteger(observed.value) ||
              observed.value < 0 ||
              observed.value > 71
            )
              throw new BasicSyntaxError(
                'UNSUPPORTED_MA2_TAB',
                'TAB position is outside the selected 72-column domain',
                argument.location.start,
                statement.location.label,
              );
          }
          continue;
        }
        if (expressionType(expression) === 'string') strings.validateOperand(expression);
        else state.validateNode(expression);
      }
      if (statement.type === 'PrintUsingStatement') {
        if (statement.format.type !== 'Variable' || statement.format.name !== 'B$')
          throw new BasicSyntaxError(
            'UNSUPPORTED_MA2_STRING',
            'Selected MA2 PRINT USING requires B$ image',
            statement.format.location.start,
            statement.location.label,
          );
        for (const item of statement.items) state.validateNode(item);
      }
    }
  }
  if (opening && !firstInputOnly) selectedMa2CandidateImages(candidate.source);

  const fail = (
    result: {kind: string; location?: Location; reason?: string; code?: number},
    location: Location,
  ): never => {
    const at = result.location ?? location;
    throw new BasicRuntimeError(
      result.kind === 'numeric-event' ? 'MA2_NUMERIC_EVENT' : 'UNSUPPORTED_MA2_VALUE',
      `MA2 ${result.kind}: ${result.code ?? result.reason ?? 'unknown'}`,
      at.start,
      at.label,
    );
  };
  const value = (expression: Expression): number => {
    const result = state.evaluateNode(expression);
    if (result.kind !== 'value') return fail(result, expression.location);
    const observed = observeMa2Value(result.value);
    if (observed.kind !== 'value') return fail(observed, expression.location);
    return observed.value;
  };
  const resolve = (expression: Expression) => {
    if (expression.type === 'StringLiteral') return expression.value;
    if (expression.type === 'Variable' && expression.name.endsWith('$'))
      return strings.resolve(expression);
    const result = state.evaluateNode(expression);
    if (result.kind !== 'value') return fail(result, expression.location);
    return result.value;
  };
  // This slice accepts only exact small integer loop values. This is the
  // reviewed game's domain, so shared cursor/loop guards can be reused without
  // silently applying JS arithmetic to a general historical FOR policy.
  const loopInteger = (number: number, location: Location): number => {
    if (!Number.isInteger(number) || number < -32768 || number > 32767)
      throw new BasicRuntimeError(
        'UNSUPPORTED_MA2_LOOP_VALUE',
        'Selected MA2 loop requires an exact signed-word integer',
        location.start,
        location.label,
      );
    return number;
  };
  const loopValues: LoopValues = {
    evaluate: (expression) => loopInteger(value(expression), expression.location),
    validateIncrement: loopInteger,
    assign: (target: NodeOf<'Variable'>, number: number) => {
      const result = state.injectNode(target, loopInteger(number, target.location));
      if (result.kind !== 'value') fail(result, target.location);
    },
  };
  const flow = new ControlFlow(candidate, loopValues, 'selected-ma2');
  let executed = 0;
  let halted = false;
  let reading = false;
  let terminated = false;
  let failure: Error | null = null;
  const cancellation = new AbortController();
  const snapshot = (status: 'running' | 'waiting' | 'halted', pendingInput: Location | null) =>
    Object.freeze({
      status,
      pendingInput,
      nextLocation: status === 'halted' ? null : (flow.nextInstruction?.statement.location ?? null),
      executed,
      output: chunks.join(''),
      variables: state.snapshot(),
      arrays: state.snapshotArrays(),
    });

  function executeInstruction(
    instruction: Instruction,
    currentFlow: ControlFlow,
    halt: () => void,
  ) {
    const statement = instruction.statement;
    // Whole-source admission rejects every unsupported statement before effects.
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (statement.type) {
      case 'LetStatement': {
        if (opening && statement.target.name.endsWith('$')) {
          strings.assignSource(statement);
          break;
        }
        const result = state.assignNode(statement.target, statement.expression);
        if (result.kind !== 'value') fail(result, statement.expression.location);
        break;
      }
      case 'IfStatement': {
        const matched =
          opening &&
          (expressionType(statement.condition.left) === 'string' ||
            expressionType(statement.condition.right) === 'string')
            ? strings.compareReplay(statement.condition)
            : (() => {
                const result = state.compareNode(statement.condition);
                return 'value' in result
                  ? result.value
                  : fail(result, statement.condition.location);
              })();
        if (matched === true) currentFlow.jump(statement.target.value, statement.target.location);
        else currentFlow.skipLine(statement.location);
        break;
      }
      case 'GotoStatement':
        currentFlow.jump(statement.target.value, statement.target.location);
        break;
      case 'ForStatement':
        currentFlow.beginLoop(statement);
        break;
      case 'NextStatement':
        currentFlow.nextLoop(statement);
        break;
      case 'PrintStatement':
      case 'PrintUsingStatement': {
        outputLocation = statement.location;
        const result = output.execute(statement, resolve);
        if (result.kind !== 'value') fail(result, statement.location);
        break;
      }
      case 'RandomizeStatement': {
        const word = Math.floor(readHostRandom(entropyHost!, statement.location) * 65536);
        randomSeed = ((randomSeed + word) & 0xffff) | 1;
        break;
      }
      case 'EndStatement':
        halt();
        break;
      case 'SleepStatement':
        throw new BasicRuntimeError(
          'ASYNC_WAIT_REQUIRED',
          'Use runAsync or stepAsync for SLEEP',
          statement.location.start,
          instruction.label,
        );
      case 'InputStatement':
        throw new BasicRuntimeError(
          'ASYNC_INPUT_REQUIRED',
          'Use runAsync or stepAsync for selected INPUT',
          statement.location.start,
          instruction.label,
        );
      case 'DimStatement':
      case 'RemStatement':
        break;
    }
  }

  function advance(maxInstructions = Infinity) {
    if (cancellation.signal.aborted) return snapshot('halted', null);
    if (reading) throw new Error('Selected MA2 input is pending');
    if (failure !== null) throw failure;
    if (terminated) return snapshot('halted', null);
    try {
      let stepped = 0;
      while (flow.nextInstruction && !halted && stepped < maxInstructions) {
        const next = flow.nextInstruction;
        if (executed === instructionLimit)
          throw new BasicRuntimeError(
            'INSTRUCTION_LIMIT',
            `Instruction limit of ${instructionLimit} reached`,
            next.statement.location.start,
            next.label,
          );
        if (opening && next.statement.type === 'InputStatement')
          return snapshot('waiting', next.statement.location);
        const instruction = flow.takeInstruction()!;
        executed++;
        stepped++;
        executeInstruction(instruction, flow, () => {
          halted = true;
          flow.clearFrames();
        });
        if (!halted) flow.finishInstruction();
      }
      if (!halted && flow.nextInstruction) {
        const next = flow.nextInstruction;
        return opening && next.statement.type === 'InputStatement'
          ? snapshot('waiting', next.statement.location)
          : snapshot('running', null);
      }
      terminated = true;
      return snapshot('halted', null);
    } catch (error) {
      terminated = true;
      failure = error instanceof Error ? error : new Error(String(error));
      flow.clearFrames();
      throw failure;
    }
  }

  function cancel() {
    if (failure !== null) throw failure;
    if (!terminated) {
      terminated = true;
      halted = true;
      flow.clearFrames();
      cancellation.abort();
    }
    return snapshot('halted', null);
  }

  async function resumeInput(host: Pick<Host, 'readLine'>, signal: AbortSignal) {
    if (terminated) throw new Error('Selected MA2 run has ended');
    if (reading) throw new Error('Selected MA2 input is already pending');
    const instruction = flow.nextInstruction;
    if (!opening || instruction?.statement.type !== 'InputStatement')
      throw new Error('Selected MA2 run is not at INPUT');
    if (executed === instructionLimit)
      throw new BasicRuntimeError(
        'INSTRUCTION_LIMIT',
        `Instruction limit of ${instructionLimit} reached`,
        instruction.statement.location.start,
        instruction.label,
      );
    const statement = instruction.statement;
    reading = true;
    const ownedSignal = AbortSignal.any([signal, cancellation.signal]);
    try {
      const result = await readSelectedMa2Input(host, statement, ownedSignal);
      if (ownedSignal.aborted) throw abortError();
      commitInput(statement, result);
      flow.takeInstruction();
      executed++;
      flow.finishInstruction();
    } catch (error) {
      if (cancellation.signal.aborted) throw abortError();
      terminated = true;
      failure = error instanceof Error ? error : new Error(String(error));
      flow.clearFrames();
      throw failure;
    } finally {
      reading = false;
    }
    return advance();
  }

  function commitInput(
    statement: NodeOf<'InputStatement'>,
    result: Awaited<ReturnType<typeof readSelectedMa2Input>>,
  ) {
    if (result.kind !== 'value')
      throw new BasicRuntimeError(
        'UNSUPPORTED_MA2_INPUT',
        `Selected MA2 input: ${result.reason}`,
        statement.location.start,
        statement.location.label,
      );
    if (typeof result.value === 'string') strings.commitInput(statement, result);
    else {
      const observed = observeMa2Value(result.value);
      const input =
        'value' in observed ? observed.value : fail(observed, statement.target.location);
      const committed = state.injectNode(statement.target, input);
      if (committed.kind !== 'value') fail(committed, statement.target.location);
    }
    // The response's Return starts a fresh terminal line; the host owns the echo.
    output.reset();
  }

  function sleepDuration(statement: NodeOf<'SleepStatement'>): number {
    const seconds = value(statement.seconds);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 32767)
      throw new BasicRuntimeError(
        'INVALID_SLEEP_DURATION',
        'Selected SLEEP requires a whole number of seconds from 0 through 32767',
        statement.seconds.location.start,
        statement.location.label,
      );
    return seconds * 1000;
  }

  const driver = Object.freeze({
    prepared: candidate,
    flow,
    execute(this: void, instruction: Instruction, currentFlow: ControlFlow, halt: () => void) {
      executeInstruction(instruction, currentFlow, halt);
    },
    variables: () => state.snapshot(),
    arrays: () => state.snapshotArrays(),
    readInput: readSelectedMa2Input,
    sleepDuration,
    commitInput,
  });
  return Object.freeze({
    advance: () => advance(),
    step: () => advance(1),
    resumeInput,
    cancel,
    driver,
  });
}

/** Internal source-bound selected execution policy for Basic's existing driver. */
export function prepareSelectedMa2Driver(
  source: string,
  externalWrite: (text: string) => void,
  supplied?: readonly ParsedLine[],
  entropyHost?: Pick<Host, 'random'>,
) {
  return prepareSelectedMa2Program(
    source,
    10_000,
    true,
    false,
    supplied,
    false,
    externalWrite,
    entropyHost,
  ).driver;
}

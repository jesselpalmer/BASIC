import {arrayDeclarations} from './array_declarations.ts';
import {ControlFlow, type LoopValues} from './control_flow.ts';
import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {createBasicPlusMa2ArraySession} from './evaluator.ts';
import {pairLoops} from './loops.ts';
import {observeMa2Value} from './ma2_value.ts';
import {basicPlusStringLength} from './basic_plus_strings.ts';
import {Ma2StatementOutput} from './ma2_statement_output.ts';
import {readSelectedMa2Input} from './ma2_statement_input.ts';
import {SelectedMa2StringState} from './ma2_replay_strings.ts';
import {selectedMa2CandidateImages} from './ma2_using_image.ts';
import {abortError} from './cancellation.ts';
import {preflightBasicPlusMa2Candidate} from '../parser/ma2_candidate_support.ts';
import type {Expression, Host, Location, NodeOf, ParsedLine} from './types.ts';

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
) {
  if (!Number.isSafeInteger(instructionLimit) || instructionLimit < 0)
    throw new TypeError('Expected a nonnegative instruction limit');
  const candidate = preflightBasicPlusMa2Candidate(source, supplied);
  const state = createBasicPlusMa2ArraySession(arrayDeclarations(candidate.lines));
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
    ...(opening ? ['InputStatement', 'PrintStatement', 'PrintUsingStatement'] : []),
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
      if (
        opening &&
        statement.target.type === 'Variable' &&
        statement.target.name.endsWith('$') &&
        statement.expression.type === 'StringLiteral'
      ) {
        if (statement.target.name !== 'B$')
          throw new BasicSyntaxError(
            'UNSUPPORTED_MA2_STRING',
            'Selected MA2 execution only supports literal B$ assignment',
            statement.target.location.start,
            statement.location.label,
          );
        const valid = basicPlusStringLength(statement.expression.value);
        if (valid.kind !== 'value')
          throw new BasicSyntaxError(
            'UNSUPPORTED_MA2_STRING',
            valid.reason,
            statement.expression.location.start,
            statement.location.label,
          );
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
      if (statement.condition.left.type === 'Variable' && statement.condition.left.name === 'A$')
        strings.validateReplay(statement.condition);
      else state.validateComparison(statement.condition);
    } else if (statement.type === 'InputStatement') {
      if (!['F', 'T', 'A$'].includes(statement.target.name))
        throw new BasicSyntaxError(
          'UNSUPPORTED_MA2_INPUT',
          'Selected MA2 input requires F, T or A$',
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
        if (expression.type === 'StringLiteral') {
          const valid = basicPlusStringLength(expression.value);
          if (valid.kind !== 'value')
            throw new BasicSyntaxError(
              'UNSUPPORTED_MA2_STRING',
              valid.reason,
              expression.location.start,
              statement.location.label,
            );
        } else if (expression.type === 'Variable' && expression.name.endsWith('$')) {
          if (expression.name !== 'B$' && expression.name !== 'A$')
            throw new BasicSyntaxError(
              'UNSUPPORTED_MA2_STRING',
              'Selected MA2 output requires A$ or B$',
              expression.location.start,
              statement.location.label,
            );
        } else state.validateNode(expression);
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
  if (opening && !firstInputOnly) selectedMa2CandidateImages(source);
  const instructions = candidate.instructions;
  const loopPairs = pairLoops(instructions);
  const prepared = {
    instructions,
    labelIndices: new Map(instructions.map((instruction, index) => [instruction.label, index])),
    loopPairs,
    pairsByFor: new Map(loopPairs.map((pair) => [pair.forIndex, pair])),
    pairsByNext: new Map(loopPairs.map((pair) => [pair.nextIndex, pair])),
  };

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
    assign: (target: NodeOf<'Variable'>, number: number) => {
      const result = state.injectNode(target, loopInteger(number, target.location));
      if (result.kind !== 'value') fail(result, target.location);
    },
  };
  const flow = new ControlFlow(prepared, loopValues, 'selected-ma2');
  let executed = 0;
  let halted = false;
  let reading = false;
  let terminated = false;
  let failure: Error | null = null;
  const snapshot = (status: 'waiting' | 'halted', pendingInput: Location | null) =>
    Object.freeze({
      status,
      pendingInput,
      executed,
      output: chunks.join(''),
      variables: state.snapshot(),
      arrays: state.snapshotArrays(),
    });

  function advance() {
    if (reading) throw new Error('Selected MA2 input is pending');
    if (failure !== null) throw failure;
    if (terminated) return snapshot('halted', null);
    try {
      while (flow.nextInstruction && !halted) {
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
        const statement = instruction.statement;
        executed++;
        // The preflight above excludes other statement kinds before state changes.
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (statement.type) {
          case 'LetStatement': {
            if (
              opening &&
              statement.target.type === 'Variable' &&
              statement.target.name.endsWith('$') &&
              statement.expression.type === 'StringLiteral'
            ) {
              strings.assignLiteral(statement);
              break;
            }
            const result = state.assignNode(statement.target, statement.expression);
            if (result.kind !== 'value') fail(result, statement.expression.location);
            break;
          }
          case 'IfStatement': {
            const matched =
              statement.condition.left.type === 'Variable' && statement.condition.left.name === 'A$'
                ? strings.compareReplay(statement.condition)
                : (() => {
                    const result = state.compareNode(statement.condition);
                    return 'value' in result
                      ? result.value
                      : fail(result, statement.condition.location);
                  })();
            if (matched === true) flow.jump(statement.target.value, statement.target.location);
            else flow.skipLine(statement.location);
            break;
          }
          case 'GotoStatement':
            flow.jump(statement.target.value, statement.target.location);
            break;
          case 'ForStatement':
            flow.beginLoop(statement);
            break;
          case 'NextStatement':
            flow.nextLoop(statement);
            break;
          case 'PrintStatement':
          case 'PrintUsingStatement': {
            outputLocation = statement.location;
            const result = output.execute(statement, resolve);
            if (result.kind !== 'value') fail(result, statement.location);
            break;
          }
          case 'EndStatement':
            halted = true;
            flow.clearFrames();
            break;
          case 'DimStatement':
          case 'RemStatement':
            break;
        }
        if (!halted) flow.finishInstruction();
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

  async function resumeInput(host: Pick<Host, 'readLine'>, signal: AbortSignal) {
    if (reading) throw new Error('Selected MA2 input is already pending');
    if (terminated) throw new Error('Selected MA2 run has ended');
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
    try {
      const result = await readSelectedMa2Input(host, statement, signal);
      if (signal.aborted) throw abortError();
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
      flow.takeInstruction();
      executed++;
      flow.finishInstruction();
    } catch (error) {
      terminated = true;
      failure = error instanceof Error ? error : new Error(String(error));
      flow.clearFrames();
      throw failure;
    } finally {
      reading = false;
    }
    return advance();
  }

  return Object.freeze({advance, resumeInput});
}

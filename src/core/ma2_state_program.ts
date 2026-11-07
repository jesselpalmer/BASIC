import {arrayDeclarations} from './array_declarations.ts';
import {ControlFlow, type LoopValues} from './control_flow.ts';
import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {createBasicPlusMa2ArraySession} from './evaluator.ts';
import {pairLoops} from './loops.ts';
import {observeMa2Value} from './ma2_value.ts';
import {basicPlusStringLength} from './basic_plus_strings.ts';
import {Ma2StatementOutput} from './ma2_statement_output.ts';
import {preflightBasicPlusMa2Candidate} from '../parser/ma2_candidate_support.ts';
import type {Expression, Location, NodeOf} from './types.ts';

/** Internal state/control execution slice. It has no host effects or public profile. */
export function runSelectedMa2StateProgram(source: string, instructionLimit = 10_000) {
  return runSelectedMa2Program(source, instructionLimit, false);
}

/** Execute reviewed source through its first INPUT and return its rendered opening. */
export function runSelectedMa2Opening(source: string, instructionLimit = 10_000) {
  return runSelectedMa2Program(source, instructionLimit, true);
}

function runSelectedMa2Program(source: string, instructionLimit: number, opening: boolean) {
  if (!Number.isSafeInteger(instructionLimit) || instructionLimit < 0)
    throw new TypeError('Expected a nonnegative instruction limit');
  const candidate = preflightBasicPlusMa2Candidate(source);
  const state = createBasicPlusMa2ArraySession(arrayDeclarations(candidate.lines));
  const strings = new Map<string, string>();
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
    ...(opening ? ['PrintStatement', 'PrintUsingStatement'] : []),
  ]);
  // Check every statement, including dead source, before changing state.
  for (const {statement} of candidate.instructions) {
    if (opening && statement.type === 'InputStatement') break;
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
    } else if (statement.type === 'IfStatement') state.validateComparison(statement.condition);
    else if (statement.type === 'ForStatement') {
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
      for (const expression of expressions)
        if (
          expression.type !== 'StringLiteral' &&
          !(expression.type === 'Variable' && expression.name.endsWith('$'))
        )
          state.validateNode(expression);
    }
  }
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
    if (expression.type === 'Variable' && expression.name.endsWith('$')) {
      const value = strings.get(expression.name);
      if (value === undefined)
        throw new BasicRuntimeError(
          'UNBOUND_MA2_STRING',
          `String ${expression.name} is unbound`,
          expression.location.start,
          expression.location.label,
        );
      return value;
    }
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
  const flow = new ControlFlow(prepared, loopValues);
  let executed = 0;
  let halted = false;
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
      return Object.freeze({
        status: 'waiting' as const,
        pendingInput: next.statement.location,
        executed,
        output: chunks.join(''),
        variables: state.snapshot(),
        arrays: state.snapshotArrays(),
      });
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
          strings.set(statement.target.name, statement.expression.value);
          break;
        }
        const result = state.assignNode(statement.target, statement.expression);
        if (result.kind !== 'value') fail(result, statement.expression.location);
        break;
      }
      case 'IfStatement': {
        const result = state.compareNode(statement.condition);
        const matched =
          'value' in result ? result.value : fail(result, statement.condition.location);
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
  return Object.freeze({
    status: 'halted' as const,
    pendingInput: null,
    executed,
    output: chunks.join(''),
    variables: state.snapshot(),
    arrays: state.snapshotArrays(),
  });
}

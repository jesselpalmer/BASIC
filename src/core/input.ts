import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {abortable, abortError, isAbortError} from './cancellation.ts';
import {signedNumericLiteral} from './numeric_literal.ts';
import {lineStatements} from './instructions.ts';
import type {AssignmentTarget, BasicValue, Host, NodeOf, ParsedLine, Statement} from './types.ts';

export type InputStatement = NodeOf<'InputStatement'> | NodeOf<'InputTargetsStatement'>;
export const maxInputTargets = 4096;
const maxResponseLength = 65_536;

export function isInputStatement(statement?: Statement): statement is InputStatement {
  return statement?.type === 'InputStatement' || statement?.type === 'InputTargetsStatement';
}

export function inputTargets(statement: InputStatement): readonly AssignmentTarget[] {
  return statement.type === 'InputStatement' ? [statement.target] : statement.targets;
}

export function validateInputTargets(lines: readonly ParsedLine[]): void {
  for (const line of lines)
    for (const statement of lineStatements(line)) {
      if (statement.type !== 'InputTargetsStatement') continue;
      const targets = statement.targets;
      const fail = (code: string, message: string): never => {
        throw new BasicSyntaxError(code, message, statement.location.start, line.label);
      };
      if (!Array.isArray(targets) || targets.length === 0)
        fail('INVALID_INPUT', 'INPUT requires a nonempty target list');
      if (targets.length > maxInputTargets)
        fail('INPUT_LIMIT', `INPUT permits at most ${maxInputTargets} targets`);
      for (const target of statement.targets)
        if (!target || (target.type !== 'Variable' && target.type !== 'ArrayReference'))
          fail('INVALID_INPUT', 'INPUT requires variable or array targets');
    }
}

/** Native row syntax only; single-target INPUT never enters this decoder. */
function inputFields(text: string): string[] | null {
  if (/[\r\n]/.test(text)) return null;
  const fields: string[] = [];
  let index = 0;
  for (;;) {
    while (text[index] === ' ' || text[index] === '\t') index++;
    let value = '';
    if (text[index] === '"') {
      index++;
      for (;;) {
        if (index === text.length) return null;
        const character = text[index++];
        if (character !== '"') {
          value += character;
          continue;
        }
        if (text[index] === '"') {
          value += '"';
          index++;
          continue;
        }
        break;
      }
      while (text[index] === ' ' || text[index] === '\t') index++;
      if (index < text.length && text[index] !== ',') return null;
    } else {
      const start = index;
      while (index < text.length && text[index] !== ',') {
        if (text[index] === '"') return null;
        index++;
      }
      value = text.slice(start, index).replace(/[ \t]+$/g, '');
    }
    fields.push(value);
    if (fields.length > maxInputTargets) return null;
    if (index === text.length) return fields;
    index++;
  }
}

function inputValues(text: string, targets: readonly AssignmentTarget[]): BasicValue[] | null {
  const fields = targets.length === 1 ? [text] : inputFields(text);
  if (!fields || fields.length !== targets.length) return null;
  const values: BasicValue[] = [];
  for (let i = 0; i < targets.length; i++) {
    if (targets[i].name.endsWith('$')) values.push(fields[i]);
    else {
      const decimal = fields[i].replace(/^[ \t]+|[ \t]+$/g, '');
      const value = Number(decimal);
      if (!signedNumericLiteral.test(decimal) || !Number.isFinite(value)) return null;
      values.push(value);
    }
  }
  return values;
}

export async function readInput(
  host: Pick<Host, 'readLine' | 'write'>,
  statement: InputStatement,
  signal: AbortSignal,
): Promise<readonly BasicValue[]> {
  const prompt = `${statement.prompt?.value ?? ''}? `;
  const targets = inputTargets(statement);
  for (;;) {
    let text: string | null;
    try {
      text = await abortable(() => host.readLine(prompt, {signal}), signal, 'Input source failed');
    } catch (cause) {
      if (signal.aborted || isAbortError(cause)) throw abortError();
      throw new BasicRuntimeError(
        'INPUT_FAILED',
        'Host input failed',
        statement.location.start,
        statement.location.label,
        {cause},
      );
    }
    if (signal.aborted) throw abortError();
    if (text === null) {
      throw new BasicRuntimeError(
        'INPUT_ENDED',
        'Input ended before a value was received',
        statement.location.start,
        statement.location.label,
      );
    }
    if (typeof text !== 'string') {
      throw new BasicRuntimeError(
        'INPUT_FAILED',
        'Host input must return a string or null',
        statement.location.start,
        statement.location.label,
      );
    }
    if (targets.length > 1 && text.length > maxResponseLength)
      throw new BasicRuntimeError(
        'INPUT_LIMIT',
        `INPUT lists permit at most ${maxResponseLength} response characters`,
        statement.location.start,
        statement.location.label,
      );
    const values = inputValues(text, targets);
    if (values) return values;
    host.write(
      targets.length === 1
        ? 'Invalid number; please enter a finite decimal.\n'
        : `Invalid input; enter ${targets.length} comma-separated values.\n`,
    );
  }
}

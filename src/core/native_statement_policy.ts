import {BasicRuntimeError} from './diagnostic.ts';
import {dispatchTarget} from './dispatch.ts';
import {formatPrintUsing} from './print_using.ts';
import type {ControlFlow} from './control_flow.ts';
import type {DataReader} from './data.ts';
import type {Evaluator} from './evaluator.ts';
import type {GraphicsState} from './graphics.ts';
import type {Instruction} from './instructions.ts';
import type {Expression, Host, Location} from './types.ts';

export interface StatementExecutionContext {
  readonly controlFlow: ControlFlow;
  readonly host: Host;
  callHost(callback: 'write' | 'clear', line: Instruction, text?: string): void;
  halt(): void;
  restart(): void;
}

/** The Basic driver retains status, host callback guards and failure ownership. */
export interface StatementExecutionPolicy {
  execute(line: Instruction, context: StatementExecutionContext): void;
}

export function createNativeStatementPolicy(services: {
  readonly evaluator: Evaluator;
  readonly data: () => DataReader;
  readonly graphics: GraphicsState;
  readonly formatPrintItem?: (item: Expression) => string;
  readonly randomize?: (location: Location) => void;
  readonly fallThroughIfFalse?: boolean;
}): StatementExecutionPolicy {
  const formatPrintItem =
    services.formatPrintItem ?? ((item) => String(services.evaluator.evaluate(item)));
  return Object.freeze({
    execute(line: Instruction, context: StatementExecutionContext) {
      const statement = line.statement;
      switch (statement.type) {
        case 'ChangeStatement':
          services.evaluator.change(statement);
          break;
        case 'ReadStatement':
          services.data().read(statement, services.evaluator);
          break;
        case 'RestoreStatement':
          services.data().restore();
          break;
        case 'ForStatement':
          context.controlFlow.beginLoop(statement);
          break;
        case 'NextStatement':
          context.controlFlow.nextLoop(statement);
          break;
        case 'GotoStatement':
          context.controlFlow.jump(statement.target.value, statement.target.location);
          break;
        case 'GosubStatement':
          context.controlFlow.call(statement.target, statement.location);
          break;
        case 'OnStatement': {
          const target = dispatchTarget(statement, services.evaluator.evaluate(statement.selector));
          if (statement.transfer === 'goto')
            context.controlFlow.jump(target.value, target.location);
          else context.controlFlow.call(target, statement.location);
          break;
        }
        case 'ReturnStatement':
          context.controlFlow.returnFromCall(statement.location);
          break;
        case 'IfStatement':
          if (services.evaluator.compare(statement.condition))
            context.controlFlow.jump(statement.target.value, statement.target.location);
          else if (!services.fallThroughIfFalse) context.controlFlow.skipLine(statement.location);
          break;
        case 'InlineIfStatement':
          context.controlFlow.chooseBranch(
            services.evaluator.compare(statement.condition),
            statement.location,
          );
          break;
        case 'WaitStatement':
          throw new BasicRuntimeError(
            'ASYNC_WAIT_REQUIRED',
            'Use runAsync, stepAsync, or readLineAsync for WAIT',
            statement.location.start,
            line.label,
          );
        case 'InputStatement':
        case 'InputTargetsStatement':
        case 'InputLineStatement':
          throw new BasicRuntimeError(
            'ASYNC_INPUT_REQUIRED',
            'Use runAsync, stepAsync, or readLineAsync for INPUT',
            statement.location.start,
            line.label,
          );
        case 'LetStatement':
          services.evaluator.assign(
            statement.target,
            services.evaluator.evaluate(statement.expression),
          );
          break;
        case 'PrintUsingStatement': {
          const format = services.evaluator.evaluate(statement.format);
          const values = statement.items.map((item) => services.evaluator.evaluate(item));
          const text = formatPrintUsing(format, values, statement.format.location);
          context.callHost('write', line, text + (statement.trailingSemicolon ? '' : '\n'));
          break;
        }
        case 'PrintStatement': {
          const text = statement.items.map(formatPrintItem).join('');
          context.callHost('write', line, text + (statement.trailingSemicolon ? '' : '\n'));
          break;
        }
        case 'ColorStatement':
        case 'PsetStatement':
        case 'LineStatement':
        case 'CircleStatement':
          services.graphics.execute(statement, services.evaluator, context.host);
          break;
        case 'ClsStatement':
          context.callHost('clear', line);
          break;
        case 'RemStatement':
        case 'DimStatement':
        case 'DataStatement':
          break;
        case 'RunStatement':
          context.restart();
          break;
        case 'RandomizeStatement':
          // Whole-program admission binds this statement to the EDUSYSTEM-30 policy.
          services.randomize!(statement.location);
          break;
        case 'EndStatement':
          context.halt();
          break;
      }
    },
  });
}

import {BasicRuntimeError} from './diagnostic.ts';
import type {Evaluator} from './evaluator.ts';
import type {Expression, GraphicsCommand, GraphicsStatement, Host, Location} from './types.ts';

/** Source order is also evaluation order, including across host random calls. */
export function graphicsArguments(statement: GraphicsStatement): readonly Expression[] {
  switch (statement.type) {
    case 'ColorStatement':
      return [statement.color];
    case 'PsetStatement':
      return [statement.x, statement.y];
    case 'LineStatement':
      return [statement.x1, statement.y1, statement.x2, statement.y2];
    case 'CircleStatement':
      return [statement.x, statement.y, statement.radius];
  }
}

function fail(code: string, message: string, location: Location): never {
  throw new BasicRuntimeError(code, message, location.start, location.label);
}

/** Runtime-owned pen state; hosts receive self-contained, immutable commands. */
export class GraphicsState {
  #color = 7;

  reset(): void {
    this.#color = 7;
  }

  execute(statement: GraphicsStatement, evaluator: Evaluator, host: Host): void {
    const args = graphicsArguments(statement);
    // Evaluate every argument before validation or drawing, preserving left-to-right effects.
    const values = args.map((argument) => evaluator.evaluate(argument));
    const numbers = values.map((value, index) => {
      const location = args[index].location;
      if (typeof value !== 'number')
        fail('TYPE_MISMATCH', 'Graphics arguments must be numeric', location);
      if (statement.type === 'ColorStatement') {
        if (!Number.isInteger(value) || value < 0 || value > 15) {
          fail('INVALID_COLOR', 'COLOR requires an integer from 0 through 15', location);
        }
        return value;
      }
      if (statement.type === 'CircleStatement' && index === 2 && value < 0) {
        fail('INVALID_RADIUS', 'CIRCLE radius must be nonnegative', location);
      }
      const rounded = Math.round(value);
      if (!Number.isSafeInteger(rounded)) {
        fail(
          'GRAPHICS_RANGE',
          'Rounded graphics coordinates and radius must be safe integers',
          location,
        );
      }
      return rounded === 0 ? 0 : rounded;
    });
    if (!host.draw) {
      fail('GRAPHICS_UNAVAILABLE', 'Graphics are not supported by this host', statement.location);
    }
    let command: GraphicsCommand;
    switch (statement.type) {
      case 'ColorStatement':
        this.#color = numbers[0];
        return;
      case 'PsetStatement':
        command = {kind: 'pset', x: numbers[0], y: numbers[1], color: this.#color};
        break;
      case 'LineStatement':
        command = {
          kind: 'line',
          x1: numbers[0],
          y1: numbers[1],
          x2: numbers[2],
          y2: numbers[3],
          color: this.#color,
        };
        break;
      case 'CircleStatement':
        command = {
          kind: 'circle',
          x: numbers[0],
          y: numbers[1],
          radius: numbers[2],
          color: this.#color,
        };
        break;
    }
    try {
      host.draw(Object.freeze(command));
    } catch (cause) {
      throw new BasicRuntimeError(
        'HOST_ERROR',
        'Host draw failed',
        statement.location.start,
        statement.location.label,
        {cause},
      );
    }
  }
}

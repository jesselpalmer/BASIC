import {BasicRuntimeError} from './diagnostic.ts';
import {arrayShapes} from './array_declarations.ts';
import type {ArrayShape} from './array_declarations.ts';
import type {ArrayDeclaration, ArraySnapshot, BasicValue, Location, NodeOf} from './types.ts';

interface ArrayStorage extends ArrayShape {
  readonly values: BasicValue[];
}

function fail(code: string, message: string, location: Location): never {
  throw new BasicRuntimeError(code, message, location.start, location.label);
}

/** Mutable cells belong to one execution; declarations and observations never do. */
export class ArrayStore {
  readonly #arrays: ReadonlyMap<string, ArrayStorage>;

  constructor(declarations: readonly ArrayDeclaration[] = []) {
    const shapes = arrayShapes(declarations);
    this.#arrays = new Map(
      shapes.map((shape) => [
        shape.name,
        {
          ...shape,
          values: new Array<BasicValue>(shape.elementCount).fill(shape.name.endsWith('$') ? '' : 0),
        },
      ]),
    );
  }

  checkReference(reference: NodeOf<'ArrayReference'>): void {
    this.lookup(reference);
  }

  private lookup(reference: NodeOf<'ArrayReference'>): ArrayStorage {
    const array = this.#arrays.get(reference.name.toUpperCase());
    if (!array)
      fail('UNDECLARED_ARRAY', `Array ${reference.name} requires DIM`, reference.nameLocation);
    if (reference.indices.length !== array.bounds.length) {
      fail(
        'ARRAY_RANK_MISMATCH',
        `Array ${array.name} requires ${array.bounds.length} index(es)`,
        reference.nameLocation,
      );
    }
    return array;
  }

  read(reference: NodeOf<'ArrayReference'>, indices: readonly BasicValue[]): BasicValue {
    const array = this.lookup(reference);
    return array.values[this.offset(array, reference, indices)];
  }

  write(
    reference: NodeOf<'ArrayReference'>,
    indices: readonly BasicValue[],
    value: BasicValue,
  ): void {
    const array = this.lookup(reference);
    array.values[this.offset(array, reference, indices)] = value;
  }

  private offset(
    array: ArrayStorage,
    reference: NodeOf<'ArrayReference'>,
    indices: readonly BasicValue[],
  ): number {
    let offset = 0;
    for (let i = 0; i < array.bounds.length; i++) {
      const index = indices[i];
      const location = reference.indices[i].location;
      if (typeof index !== 'number')
        fail('TYPE_MISMATCH', 'Array indices must be numeric', location);
      if (!Number.isSafeInteger(index) || index < 0 || index > array.bounds[i]) {
        fail(
          'ARRAY_BOUNDS',
          `Index must be an integer from 0 through ${array.bounds[i]}`,
          location,
        );
      }
      offset = offset * (array.bounds[i] + 1) + index;
    }
    return offset;
  }

  snapshot(): readonly ArraySnapshot[] {
    let remaining = 256;
    return Object.freeze(
      Array.from(this.#arrays.values(), (array) => {
        const values = Object.freeze(array.values.slice(0, Math.min(64, remaining)));
        remaining -= values.length;
        return Object.freeze({
          name: array.name,
          bounds: Object.freeze([...array.bounds]),
          elementCount: array.elementCount,
          values,
          truncated: values.length < array.elementCount,
        });
      }),
    );
  }
}

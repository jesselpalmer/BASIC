import {BasicRuntimeError} from './diagnostic.ts';
import {arrayShapes} from './array_declarations.ts';
import {maxChangeLength} from './change.ts';
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

  private changeArray(variable: NodeOf<'Variable'>): ArrayStorage {
    const array = this.#arrays.get(variable.name.toUpperCase());
    if (!array) fail('UNDECLARED_ARRAY', `Array ${variable.name} requires DIM`, variable.location);
    if (array.bounds.length !== 1)
      fail(
        'ARRAY_RANK_MISMATCH',
        'CHANGE requires a one-dimensional numeric array',
        variable.location,
      );
    return array;
  }

  changeToNumbers(variable: NodeOf<'Variable'>, source: BasicValue): void {
    const array = this.changeArray(variable);
    if (typeof source !== 'string')
      fail('TYPE_MISMATCH', 'CHANGE requires a string source', variable.location);
    if (source.length > maxChangeLength)
      fail(
        'CHANGE_LIMIT',
        `CHANGE permits at most ${maxChangeLength} characters`,
        variable.location,
      );
    if (source.length > array.bounds[0])
      fail('ARRAY_BOUNDS', 'CHANGE string exceeds the array capacity', variable.location);
    // Validate every code unit before the first write, including the length cell.
    for (let i = 0; i < source.length; i++) {
      if (source.charCodeAt(i) > 255)
        fail('CHANGE_CHARACTER', 'CHANGE requires byte characters in 0..255', variable.location);
    }
    array.values[0] = source.length;
    for (let i = 0; i < source.length; i++) array.values[i + 1] = source.charCodeAt(i);
  }

  changeToString(variable: NodeOf<'Variable'>): string {
    const array = this.changeArray(variable);
    const length = array.values[0];
    if (
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > array.bounds[0]
    )
      fail(
        'ARRAY_BOUNDS',
        'CHANGE length must be an integer within the array capacity',
        variable.location,
      );
    if (length > maxChangeLength)
      fail(
        'CHANGE_LIMIT',
        `CHANGE permits at most ${maxChangeLength} characters`,
        variable.location,
      );
    const characters: string[] = [];
    for (let i = 1; i <= length; i++) {
      const code = array.values[i];
      if (typeof code !== 'number' || !Number.isInteger(code) || code < 0 || code > 255)
        fail(
          'CHANGE_CHARACTER',
          'CHANGE character codes must be integers in 0..255',
          variable.location,
        );
      characters.push(String.fromCharCode(code));
    }
    return characters.join('');
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

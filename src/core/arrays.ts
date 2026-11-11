import {BasicRuntimeError} from './diagnostic.ts';
import {arrayShapes} from './array_declarations.ts';
import {maxChangeLength} from './change.ts';
import {
  eduSystem30FromNumber,
  observeEduSystem30,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';
import {bindMa2Words, injectMa2Value, observeMa2Value, type Ma2Value} from './ma2_value.ts';
import type {ArrayShape} from './array_declarations.ts';
import type {ArrayDeclaration, ArraySnapshot, BasicValue, Location, NodeOf} from './types.ts';

type CellValue = BasicValue | Ma2Value | EduSystem30FloatingValue;
type ArrayMode = 'native' | 'ma2-conformance' | 'altair' | 'edusystem-30';

interface ArrayStorage extends ArrayShape {
  readonly values: CellValue[];
}

function fail(code: string, message: string, location: Location): never {
  throw new BasicRuntimeError(code, message, location.start, location.label);
}

type Ma2WriteValue = Extract<ReturnType<typeof bindMa2Words>, {kind: 'value'}>;
type Ma2WriteFailure = Exclude<
  ReturnType<typeof bindMa2Words> | ReturnType<typeof injectMa2Value>,
  {kind: 'value'}
>;
export type Ma2ArrayWriteResult =
  Ma2WriteValue | (Ma2WriteFailure & Readonly<{location: Location}>);

/** Internal explicit numeric-cell conformance; never a historical Program. */
export function createBasicPlusMa2ArrayStore(declarations: readonly ArrayDeclaration[] = []) {
  return new ArrayStore(declarations, 'ma2-conformance');
}

/** Mutable cells belong to one execution; declarations and observations never do. */
export class ArrayStore {
  readonly #arrays: ReadonlyMap<string, ArrayStorage>;
  readonly #mode: ArrayMode;

  constructor(declarations: readonly ArrayDeclaration[] = [], mode: ArrayMode = 'native') {
    if (
      mode !== 'native' &&
      mode !== 'ma2-conformance' &&
      mode !== 'altair' &&
      mode !== 'edusystem-30'
    )
      throw new TypeError('Unsupported array storage context');
    this.#mode = mode;
    const shapes = arrayShapes(declarations);
    if (mode === 'ma2-conformance' && shapes.some((shape) => !/^[A-Z][0-9]?$/.test(shape.name)))
      throw new TypeError('MA2 array conformance requires short numeric names');
    const zero =
      mode === 'ma2-conformance'
        ? Object.freeze({kind: 'ma2' as const, words: Object.freeze([0, 0] as const)})
        : mode === 'edusystem-30'
          ? eduSystem30FromNumber(0)
          : 0;
    this.#arrays = new Map(
      shapes.map((shape) => [
        shape.name,
        {
          ...shape,
          values: new Array<CellValue>(shape.elementCount).fill(
            shape.name.endsWith('$') ? '' : zero,
          ),
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
    this.requireNative();
    const array = this.lookup(reference);
    return array.values[this.offset(array, reference, indices)] as BasicValue;
  }

  write(
    reference: NodeOf<'ArrayReference'>,
    indices: readonly BasicValue[],
    value: BasicValue,
  ): void {
    this.requireNative();
    const array = this.lookup(reference);
    array.values[this.offset(array, reference, indices)] = value;
  }

  private requireNative(): void {
    if (this.#mode === 'ma2-conformance')
      throw new TypeError('Native access is unavailable in MA2 array conformance');
    if (this.#mode === 'edusystem-30')
      throw new TypeError('Native access is unavailable in EDUSYSTEM-30 arrays');
  }

  private requireMa2(): void {
    if (this.#mode !== 'ma2-conformance')
      throw new TypeError('MA2 access requires its explicit array conformance context');
  }

  readMa2(reference: NodeOf<'ArrayReference'>, indices: readonly number[]): Ma2Value {
    this.requireMa2();
    const array = this.lookup(reference);
    return array.values[this.offset(array, reference, indices)] as Ma2Value;
  }

  readEduSystem30(
    reference: NodeOf<'ArrayReference'>,
    indices: readonly EduSystem30FloatingValue[],
  ): EduSystem30FloatingValue {
    this.requireEduSystem30();
    const array = this.lookup(reference);
    return array.values[this.offset(array, reference, indices)] as EduSystem30FloatingValue;
  }

  writeEduSystem30(
    reference: NodeOf<'ArrayReference'>,
    indices: readonly EduSystem30FloatingValue[],
    value: EduSystem30FloatingValue,
  ): void {
    this.requireEduSystem30();
    const array = this.lookup(reference);
    array.values[this.offset(array, reference, indices)] = value;
  }

  private requireEduSystem30(): void {
    if (this.#mode !== 'edusystem-30')
      throw new TypeError('EDUSYSTEM-30 access requires its selected array context');
  }

  writeMa2(
    reference: NodeOf<'ArrayReference'>,
    indices: readonly number[],
    input: Ma2Value,
  ): Ma2ArrayWriteResult {
    this.requireMa2();
    if (input === null || typeof input !== 'object' || input.kind !== 'ma2')
      throw new TypeError('Expected a tagged MA2 array value');
    return this.commitMa2(reference, indices, bindMa2Words(input.words));
  }

  injectMa2(
    reference: NodeOf<'ArrayReference'>,
    indices: readonly number[],
    input: number,
  ): Ma2ArrayWriteResult {
    this.requireMa2();
    return this.commitMa2(reference, indices, injectMa2Value(input));
  }

  private commitMa2(
    reference: NodeOf<'ArrayReference'>,
    indices: readonly number[],
    result: Ma2WriteValue | Ma2WriteFailure,
  ): Ma2ArrayWriteResult {
    if (result.kind !== 'value') {
      const {label, start, end} = reference.location;
      const location = Object.freeze({
        label,
        start: Object.freeze({...start}),
        end: Object.freeze({...end}),
      });
      return Object.freeze({...result, location});
    }
    const array = this.lookup(reference);
    array.values[this.offset(array, reference, indices)] = result.value;
    return result;
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
    this.requireNative();
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
    this.requireNative();
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
    indices: readonly (BasicValue | EduSystem30FloatingValue)[],
  ): number {
    let offset = 0;
    for (let i = 0; i < array.bounds.length; i++) {
      let index = indices[i];
      const location = reference.indices[i].location;
      if (this.#mode === 'edusystem-30' && typeof index === 'object') {
        if (index.significand < 0n) fail('ARRAY_BOUNDS', 'Negative array subscript', location);
        index = Math.trunc(observeEduSystem30(index));
      }
      if (typeof index !== 'number')
        fail('TYPE_MISMATCH', 'Array indices must be numeric', location);
      if (this.#mode === 'altair') {
        if (index < 0) fail('ALTAIR_FC', 'Negative array subscript', location);
        index = Math.trunc(index);
        if (index > array.bounds[i]) fail('ALTAIR_BS', 'Array subscript out of bounds', location);
      }
      if (!Number.isSafeInteger(index) || index < 0 || index > array.bounds[i]) {
        fail(
          this.#mode === 'ma2-conformance' ? 'MA2_SUBSCRIPT_BOUNDS' : 'ARRAY_BOUNDS',
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
        const prefix = array.values.slice(0, Math.min(64, remaining));
        const values = Object.freeze(
          this.#mode === 'edusystem-30'
            ? prefix.map((value) => observeEduSystem30(value as EduSystem30FloatingValue))
            : this.#mode === 'ma2-conformance'
              ? prefix.map((value) => {
                  // This context can store only factory-validated canonical descriptors.
                  const observation = observeMa2Value(value as Ma2Value) as Extract<
                    ReturnType<typeof observeMa2Value>,
                    {kind: 'value'}
                  >;
                  return observation.value;
                })
              : (prefix as BasicValue[]),
        );
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

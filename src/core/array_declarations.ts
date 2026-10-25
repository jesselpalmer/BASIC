import {BasicSyntaxError} from './diagnostic.ts';
import {expressionType} from './comparison.ts';
import type {ArrayDeclaration, Location, NodeOf, ParsedLine} from './types.ts';

const maxArrays = 256;
const maxArrayCells = 65_536;
const maxProgramCells = 262_144;

export interface ArrayShape {
  readonly name: string;
  readonly bounds: readonly number[];
  readonly elementCount: number;
}

function fail(code: string, message: string, location: Location): never {
  throw new BasicSyntaxError(code, message, location.start, location.label);
}

/** All sizes are checked before any element storage is allocated. */
export function arrayShapes(declarations: readonly ArrayDeclaration[]): readonly ArrayShape[] {
  const shapes: ArrayShape[] = [];
  const names = new Set<string>();
  let total = 0;
  for (const declaration of declarations) {
    const name = declaration.name.toUpperCase();
    const location = declaration.nameLocation;
    if (names.has(name))
      fail('DUPLICATE_DIM', `Array ${name} is declared more than once`, location);
    if (names.size === maxArrays)
      fail('ARRAY_LIMIT', `At most ${maxArrays} arrays are allowed`, location);
    if (declaration.bounds.length < 1 || declaration.bounds.length > 2) {
      fail('ARRAY_RANK_MISMATCH', 'Arrays support one or two dimensions', location);
    }
    const bounds: number[] = [];
    let elementCount = 1;
    for (const bound of declaration.bounds) {
      if (!Number.isSafeInteger(bound.value) || bound.value < 0) {
        fail('INVALID_DIMENSION', 'Array bounds must be nonnegative safe integers', bound.location);
      }
      elementCount *= bound.value + 1;
      if (!Number.isSafeInteger(elementCount) || elementCount > maxArrayCells) {
        fail('ARRAY_LIMIT', `An array may contain at most ${maxArrayCells} cells`, bound.location);
      }
      bounds.push(bound.value);
    }
    total += elementCount;
    if (total > maxProgramCells) {
      fail('ARRAY_LIMIT', `A program may contain at most ${maxProgramCells} array cells`, location);
    }
    names.add(name);
    shapes.push(Object.freeze({name, bounds: Object.freeze(bounds), elementCount}));
  }
  return Object.freeze(shapes);
}

export function arrayDeclarations(lines: readonly ParsedLine[]): readonly ArrayDeclaration[] {
  return Object.freeze(
    lines.flatMap(({statement}) =>
      statement.type === 'DimStatement' ? statement.declarations : [],
    ),
  );
}

/** Resolve declarations across the whole snapshot, including unreachable source. */
export function validateArrays(lines: readonly ParsedLine[]): void {
  const shapes = new Map(arrayShapes(arrayDeclarations(lines)).map((shape) => [shape.name, shape]));
  const pending: unknown[] = [...lines];
  const visited = new Set<object>();
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    if ('type' in value && value.type === 'ArrayReference') {
      const reference = value as NodeOf<'ArrayReference'>;
      const shape = shapes.get(reference.name.toUpperCase());
      if (!shape)
        fail('UNDECLARED_ARRAY', `Array ${reference.name} requires DIM`, reference.nameLocation);
      if (reference.indices.length !== shape.bounds.length) {
        fail(
          'ARRAY_RANK_MISMATCH',
          `Array ${shape.name} requires ${shape.bounds.length} index(es)`,
          reference.nameLocation,
        );
      }
      for (const index of reference.indices) {
        if (expressionType(index) === 'string')
          fail('TYPE_MISMATCH', 'Array indices must be numeric', index.location);
      }
    }
    for (const child of Object.values(value)) pending.push(child);
  }
}

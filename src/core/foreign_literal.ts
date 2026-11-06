import type {NodeOf} from './types.ts';

/** Find the unsupported literal without observing its words or evaluating hosts. */
export function firstMa2Literal(root: unknown): NodeOf<'Ma2NumberLiteral'> | null {
  const pending: unknown[] = [root];
  const visited = new Set<object>();
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    if ('type' in value && value.type === 'Ma2NumberLiteral')
      return value as NodeOf<'Ma2NumberLiteral'>;
    const children = Object.values(value);
    for (let index = children.length - 1; index >= 0; index--) pending.push(children[index]);
  }
  return null;
}

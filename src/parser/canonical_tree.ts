// Compare a supplied tree to the parser's complete canonical result without
// recursive stack growth. Reparse returns the trusted copy; no supplied object
// can become part of the snapshot even if it is later mutated.
export function sameTree(expected: unknown, supplied: unknown): boolean {
  const pending: [unknown, unknown][] = [[expected, supplied]];
  const seen = new WeakMap<object, WeakSet<object>>();
  while (pending.length) {
    const [left, right] = pending.pop()!;
    if (left === null || typeof left !== 'object') {
      if (!Object.is(left, right)) return false;
      continue;
    }
    if (right === null || typeof right !== 'object') return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    if (Object.getPrototypeOf(right) !== (Array.isArray(left) ? Array.prototype : Object.prototype))
      return false;
    const visited = seen.get(left);
    if (visited?.has(right)) continue;
    if (visited) visited.add(right);
    else seen.set(left, new WeakSet([right]));
    const keys = Object.keys(left);
    const otherKeys = Object.keys(right);
    if (keys.length !== otherKeys.length || keys.some((key) => !Object.hasOwn(right, key)))
      return false;
    for (const key of keys) pending.push([Reflect.get(left, key), Reflect.get(right, key)]);
  }
  return true;
}

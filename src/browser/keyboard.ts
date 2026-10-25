import type {LogicalKey} from '../core/types.ts';

const arrowKeys = new Map<string, LogicalKey>([
  ['ArrowUp', 'UP'],
  ['ArrowDown', 'DOWN'],
  ['ArrowLeft', 'LEFT'],
  ['ArrowRight', 'RIGHT'],
  ['Enter', 'ENTER'],
  [' ', 'SPACE'],
]);

/** Browser logical keys deliberately exclude Escape, modifiers and layout scan codes. */
export function logicalKey(key: string): LogicalKey | null {
  if (key.length === 1 && /^[a-z0-9]$/i.test(key)) return key.toUpperCase() as LogicalKey;
  return arrowKeys.get(key) ?? null;
}

/** One bounded queue and held-key set, owned by one focused running game. */
export class KeyboardInput {
  readonly #held = new Set<LogicalKey>();
  readonly #queue: LogicalKey[] = [];

  press(key: string, repeat = false): boolean {
    const name = logicalKey(key);
    if (!name) return false;
    // A repeat received after blur must not resurrect a key whose release was lost.
    if (!repeat && !this.#held.has(name)) {
      this.#held.add(name);
      if (this.#queue.length === 64) this.#queue.shift();
      this.#queue.push(name);
    }
    return true;
  }

  release(key: string): void {
    const name = logicalKey(key);
    if (name) this.#held.delete(name);
  }

  readKey(): LogicalKey | '' {
    return this.#queue.shift() ?? '';
  }
  keyDown(key: LogicalKey): boolean {
    return this.#held.has(key);
  }
  clear(): void {
    this.#held.clear();
    this.#queue.length = 0;
  }
}

import {BasicRuntimeError} from './diagnostic.ts';
import type {BasicValue, Host, Location, LogicalKey} from './types.ts';

/** Only ASCII names are folded; Escape is deliberately reserved for host Stop. */
export function normalizeKeyName(name: string): LogicalKey | null {
  const match = /^(?:[A-Z0-9]|UP|DOWN|LEFT|RIGHT|ENTER|SPACE)$/i.exec(name);
  // A JavaScript $ anchor also matches before a final newline; require all text.
  return match?.[0] === name ? (name.toUpperCase() as LogicalKey) : null;
}

function fail(code: string, message: string, location: Location): never {
  throw new BasicRuntimeError(code, message, location.start, location.label);
}

export function readKey(host: Pick<Host, 'readKey'>, location: Location): LogicalKey | '' {
  if (!host.readKey)
    fail('KEYBOARD_UNAVAILABLE', 'Keyboard input is not supported by this host', location);
  let value: unknown;
  try {
    value = host.readKey();
  } catch (cause) {
    throw new BasicRuntimeError(
      'KEYBOARD_FAILED',
      'Host readKey failed',
      location.start,
      location.label,
      {cause},
    );
  }
  if (typeof value !== 'string' || (value !== '' && normalizeKeyName(value) !== value)) {
    fail(
      'INVALID_KEY_VALUE',
      'Host readKey must return a logical key or an empty string',
      location,
    );
  }
  return value;
}

export function keyDown(
  host: Pick<Host, 'keyDown'>,
  value: BasicValue,
  location: Location,
): number {
  if (typeof value !== 'string')
    fail('TYPE_MISMATCH', 'KEYDOWN requires a string key name', location);
  const key = normalizeKeyName(value);
  if (key === null)
    fail('INVALID_KEY_NAME', `Unsupported logical key ${JSON.stringify(value)}`, location);
  if (!host.keyDown)
    fail('KEYBOARD_UNAVAILABLE', 'Keyboard input is not supported by this host', location);
  let held: unknown;
  try {
    held = host.keyDown(key);
  } catch (cause) {
    throw new BasicRuntimeError(
      'KEYBOARD_FAILED',
      'Host keyDown failed',
      location.start,
      location.label,
      {cause},
    );
  }
  if (typeof held !== 'boolean')
    fail('INVALID_KEY_VALUE', 'Host keyDown must return a boolean', location);
  return held ? 1 : 0;
}

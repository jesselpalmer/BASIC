import {expect, test} from 'bun:test';
import {KeyboardInput, logicalKey} from './keyboard.ts';

test('maps only supported browser keys to stable logical names', () => {
  for (const [key, expected] of [
    ['a', 'A'],
    ['Z', 'Z'],
    ['0', '0'],
    ['9', '9'],
    ['ArrowUp', 'UP'],
    ['ArrowDown', 'DOWN'],
    ['ArrowLeft', 'LEFT'],
    ['ArrowRight', 'RIGHT'],
    ['Enter', 'ENTER'],
    [' ', 'SPACE'],
  ] as const)
    expect(logicalKey(key)).toBe(expected);
  for (const key of [
    'Escape',
    'Tab',
    'Shift',
    'UP',
    'é',
    '!',
    'toString',
    '__proto__',
    '',
    'a\n',
    '1\n',
  ])
    expect(logicalKey(key)).toBeNull();
});

test('queue consumption and held state are independent and repeats never enqueue twice', () => {
  const input = new KeyboardInput();
  expect(input.readKey()).toBe('');
  expect(input.keyDown('UP')).toBe(false);
  expect(input.press('ArrowUp')).toBe(true);
  input.press('ArrowUp', true);
  input.press('ArrowUp');
  expect(input.readKey()).toBe('UP');
  expect(input.readKey()).toBe('');
  expect(input.keyDown('UP')).toBe(true);
  input.release('ArrowUp');
  expect(input.keyDown('UP')).toBe(false);
  input.press('ArrowUp');
  input.press('a');
  expect(input.readKey()).toBe('UP');
  expect(input.readKey()).toBe('A');
  expect(input.press('Escape')).toBe(false);
  input.release('Escape');
  expect(input.readKey()).toBe('');
});

test('overflow drops the oldest keys while retaining the latest 64 in order', () => {
  const input = new KeyboardInput();
  for (let index = 0; index < 80; index++) {
    const key = String(index % 10);
    input.press(key);
    input.release(key);
  }
  const actual: string[] = Array.from({length: 65}, () => input.readKey());
  expect(actual).toEqual([
    ...Array.from({length: 64}, (_, index) => String((index + 16) % 10)),
    '',
  ]);
});

test('clear releases queued and held state without accepting a late auto-repeat as a new press', () => {
  const input = new KeyboardInput();
  input.press(' ');
  input.clear();
  expect(input.keyDown('SPACE')).toBe(false);
  expect(input.readKey()).toBe('');
  expect(input.press(' ', true)).toBe(true);
  expect(input.keyDown('SPACE')).toBe(false);
  expect(input.readKey()).toBe('');
  input.release(' ');
  input.press(' ');
  expect(input.keyDown('SPACE')).toBe(true);
  expect(input.readKey()).toBe('SPACE');
});

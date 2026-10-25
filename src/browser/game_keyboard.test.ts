import {expect, test} from 'bun:test';
import {getEventListeners} from 'node:events';
import {GameKeyboard} from './game_keyboard.ts';
import type {Location} from '../core/types.ts';

const location: Location = {
  label: 10,
  start: {line: 1, column: 4, offset: 3},
  end: {line: 1, column: 11, offset: 10},
};
const running = {status: 'running', isPaused: false, currentLocation: location};

function fixture() {
  const surface = new EventTarget();
  const window = new EventTarget();
  const document = new EventTarget();
  let focused = true;
  let hidden = false;
  const keyboard = new GameKeyboard({
    surface,
    window,
    document,
    hasFocus: () => focused,
    isHidden: () => hidden,
  });
  const dispatch = (type: string, key = 'ArrowUp', options: Partial<KeyboardEvent> = {}) => {
    const event = new Event(type, {cancelable: true});
    Object.assign(
      event,
      {key, repeat: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false},
      options,
    );
    surface.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return {
    keyboard,
    surface,
    window,
    document,
    dispatch,
    focus(value: boolean) {
      focused = value;
      surface.dispatchEvent(new Event(value ? 'focus' : 'blur'));
    },
    hide(value: boolean) {
      hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

function expectReleased(ui: ReturnType<typeof fixture>): void {
  expect(ui.keyboard.keyDown('UP')).toBe(false);
  expect(ui.keyboard.readKey()).toBe('');
  expect(getEventListeners(ui.surface, 'keydown')).toHaveLength(0);
  expect(getEventListeners(ui.surface, 'keyup')).toHaveLength(0);
}

test('registers keys only for the focused visible running surface and preserves page shortcuts', () => {
  const ui = fixture();
  expect(ui.dispatch('keydown')).toBe(false);
  ui.focus(false);
  ui.keyboard.update(running);
  expectReleased(ui);
  ui.focus(true);
  expect(getEventListeners(ui.surface, 'keydown')).toHaveLength(1);
  for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'isComposing'] as const)
    expect(ui.dispatch('keydown', 'ArrowUp', {[flag]: true})).toBe(false);
  expect(ui.dispatch('keydown', 'Escape')).toBe(false);
  expect(ui.keyboard.readKey()).toBe('');
  expect(ui.dispatch('keydown')).toBe(true);
  expect(ui.keyboard.keyDown('UP')).toBe(true);
  expect(ui.keyboard.readKey()).toBe('UP');
  expect(ui.dispatch('keyup')).toBe(false);
  expect(ui.keyboard.keyDown('UP')).toBe(false);
  const alreadyHandled = new Event('keydown', {cancelable: true});
  Object.assign(alreadyHandled, {key: 'a'});
  alreadyHandled.preventDefault();
  ui.surface.dispatchEvent(alreadyHandled);
  expect(ui.keyboard.readKey()).toBe('');
  ui.keyboard.dispose();
  expectReleased(ui);
  for (const [target, event] of [
    [ui.surface, 'focus'],
    [ui.surface, 'blur'],
    [ui.window, 'focus'],
    [ui.window, 'blur'],
    [ui.document, 'visibilitychange'],
  ] as const)
    expect(getEventListeners(target, event)).toHaveLength(0);
});

test('focus loss, window blur and hidden tabs release both held keys and queued events', () => {
  const ui = fixture();
  ui.keyboard.update(running);
  ui.dispatch('keydown');
  ui.focus(false);
  expectReleased(ui);
  ui.focus(true);
  ui.dispatch('keydown', 'ArrowUp', {repeat: true});
  expect(ui.keyboard.keyDown('UP')).toBe(false);
  expect(ui.keyboard.readKey()).toBe('');
  ui.dispatch('keyup');
  ui.dispatch('keydown');
  ui.window.dispatchEvent(new Event('blur'));
  expectReleased(ui);
  ui.window.dispatchEvent(new Event('focus'));
  ui.dispatch('keydown');
  ui.hide(true);
  expectReleased(ui);
  ui.hide(false);
  expect(ui.keyboard.keyDown('UP')).toBe(false);
  ui.dispatch('keydown');
  expect(ui.keyboard.readKey()).toBe('UP');
  ui.keyboard.dispose();
});

test('pause, INPUT and terminal transitions remove registrations and repeated resumes do not duplicate them', () => {
  const ui = fixture();
  for (const state of [
    {...running, status: 'paused', isPaused: true},
    {...running, isPaused: true}, // A stepped WAIT is still gated.
    {...running, status: 'waiting'},
    {...running, status: 'stopped'},
    {...running, status: 'finished'},
    {...running, status: 'error'},
    {...running, status: 'idle'},
  ]) {
    ui.keyboard.update(running);
    ui.keyboard.update(running);
    expect(getEventListeners(ui.surface, 'keydown')).toHaveLength(1);
    expect(getEventListeners(ui.surface, 'focus')).toHaveLength(1);
    ui.dispatch('keydown');
    ui.keyboard.update(state);
    expectReleased(ui);
    expect(getEventListeners(ui.surface, 'focus')).toHaveLength(0);
  }
  ui.keyboard.dispose();
});

test('a replacement run clears existing state even when focus and active status are unchanged', () => {
  const ui = fixture();
  ui.keyboard.update(running);
  ui.dispatch('keydown');
  ui.keyboard.update({...running, currentLocation: null});
  expect(ui.keyboard.keyDown('UP')).toBe(false);
  expect(ui.keyboard.readKey()).toBe('');
  expect(getEventListeners(ui.surface, 'keydown')).toHaveLength(1);
  ui.keyboard.dispose();
  ui.keyboard.dispose();
});

test('releases the initial logical key even when modifiers change the keyup spelling', () => {
  const ui = fixture();
  ui.keyboard.update(running);
  ui.dispatch('keydown', '1', {code: 'Digit1'});
  expect(ui.keyboard.keyDown('1')).toBe(true);
  expect(ui.keyboard.readKey()).toBe('1');
  ui.dispatch('keyup', '!', {code: 'Digit1', shiftKey: true});
  expect(ui.keyboard.keyDown('1')).toBe(false);
  ui.keyboard.dispose();
});

test('two physical keys can hold one logical name until both are released', () => {
  const ui = fixture();
  ui.keyboard.update(running);
  ui.dispatch('keydown', 'Enter', {code: 'Enter'});
  ui.dispatch('keydown', 'Enter', {code: 'NumpadEnter'});
  expect(ui.keyboard.readKey()).toBe('ENTER');
  expect(ui.keyboard.readKey()).toBe('');
  ui.dispatch('keyup', 'Enter', {code: 'Enter'});
  expect(ui.keyboard.keyDown('ENTER')).toBe(true);
  ui.dispatch('keyup', 'Enter', {code: 'NumpadEnter'});
  expect(ui.keyboard.keyDown('ENTER')).toBe(false);
  ui.dispatch('keyup', 'Escape');
  ui.dispatch('keyup', 'Enter', {code: 'UnpressedEnter'});
  ui.keyboard.dispose();
});

test('lifecycle clears physical tracking before a later run uses the same logical keys', () => {
  const ui = fixture();
  ui.keyboard.update(running);
  ui.dispatch('keydown', 'Enter', {code: 'NumpadEnter'});
  ui.keyboard.update({...running, currentLocation: null});
  ui.dispatch('keydown', 'Enter', {code: 'Enter'});
  ui.dispatch('keyup', 'Enter', {code: 'Enter'});
  expect(ui.keyboard.keyDown('ENTER')).toBe(false);
  ui.keyboard.dispose();
});

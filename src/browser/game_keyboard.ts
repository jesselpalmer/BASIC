import {KeyboardInput, logicalKey} from './keyboard.ts';
import type {LogicalKey, Location} from '../core/types.ts';

export interface GameKeyboardEnvironment {
  surface: EventTarget;
  window: EventTarget;
  document: EventTarget;
  hasFocus(): boolean;
  isHidden(): boolean;
}

interface KeyboardRunState {
  status: string;
  isPaused: boolean;
  currentLocation: Location | null;
}

/** Own registrations only while a game can receive keys; focus never moves here. */
export class GameKeyboard {
  readonly #input = new KeyboardInput();
  readonly #environment: GameKeyboardEnvironment;
  // Physical identity is used only to release the logical key chosen on keydown.
  readonly #pressed = new Map<string, string>();
  #active = false;
  #listening = false;
  #windowBlurred = false;

  constructor(environment: GameKeyboardEnvironment) {
    this.#environment = environment;
  }

  readKey(): LogicalKey | '' {
    return this.#input.readKey();
  }
  keyDown(key: LogicalKey): boolean {
    return this.#input.keyDown(key);
  }

  update(state: KeyboardRunState): void {
    if (state.currentLocation === null) this.#clear();
    const active = state.status === 'running' && !state.isPaused;
    if (active !== this.#active) {
      this.#active = active;
      const method = active ? 'addEventListener' : 'removeEventListener';
      const {surface, window, document} = this.#environment;
      surface[method]('focus', this.#focus);
      surface[method]('blur', this.#reconcile);
      window[method]('blur', this.#windowBlur);
      window[method]('focus', this.#focus);
      document[method]('visibilitychange', this.#reconcile);
      if (active) this.#windowBlurred = false;
    }
    this.#reconcile();
  }

  dispose(): void {
    this.update({status: 'stopped', isPaused: false, currentLocation: null});
  }

  readonly #focus = () => {
    this.#windowBlurred = false;
    this.#reconcile();
  };
  readonly #windowBlur = () => {
    this.#windowBlurred = true;
    this.#reconcile();
  };
  readonly #reconcile = () => {
    const {surface} = this.#environment;
    const listening =
      this.#active &&
      !this.#windowBlurred &&
      this.#environment.hasFocus() &&
      !this.#environment.isHidden();
    if (listening !== this.#listening) {
      this.#listening = listening;
      const method = listening ? 'addEventListener' : 'removeEventListener';
      surface[method]('keydown', this.#keydown);
      surface[method]('keyup', this.#keyup);
    }
    if (!listening) this.#clear();
  };
  #clear(): void {
    this.#input.clear();
    this.#pressed.clear();
  }

  readonly #keydown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.ctrlKey || key.metaKey || key.altKey || key.isComposing || key.defaultPrevented) return;
    if (this.#input.press(key.key, key.repeat)) {
      if (!key.repeat) this.#pressed.set(key.code || logicalKey(key.key)!, key.key);
      key.preventDefault();
    }
  };
  readonly #keyup = (event: Event) => {
    const key = event as KeyboardEvent;
    const code = key.code || logicalKey(key.key);
    if (!code) return;
    const pressed = this.#pressed.get(code);
    if (pressed === undefined) return;
    this.#pressed.delete(code);
    const name = logicalKey(pressed);
    // Enter and NumpadEnter, for example, can both hold the same logical key.
    if (!Array.from(this.#pressed.values()).some((other) => logicalKey(other) === name))
      this.#input.release(pressed);
  };
}

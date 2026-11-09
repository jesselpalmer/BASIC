// EDU30.SV multiplies its two-word state by this fixed value. A fresh RUN
// starts with the same value as the seed. See docs/edusystem30-rng.md.
const multiplier = 0o14613007;
const wordRange = 2 ** 12;
const stateRange = 2 ** 23;

/** Internal stream for one EDUSYSTEM-30 RUN. */
export class EduSystem30Random {
  #state = multiplier;

  reset(): void {
    this.#state = multiplier;
  }

  randomize(word: number): void {
    // EDU30.SV adds the clock word to the high seed word modulo 4096.
    this.#state = (this.#state + word * wordRange) % (wordRange * wordRange);
  }

  next(): number {
    // The integer product fits in JavaScript's exact range. Keep product bits
    // 12 through 34, then force the new state's low bit to one.
    const middle = Math.floor((this.#state * multiplier) / wordRange);
    this.#state = (middle % stateRange) | 1;
    return this.#state / stateRange;
  }
}

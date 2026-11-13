// EDU30.SV multiplies its two-word state by this fixed value. A fresh RUN
// starts with the same value as the seed. See docs/edusystem30-rng.md.
const multiplier = 0o14613007;
const wordRange = 2 ** 12;
const stateRange = 2 ** 23;
const signedWordPairRange = wordRange * wordRange;

/** Internal stream for one EDUSYSTEM-30 RUN. */
export class EduSystem30Random {
  #state = multiplier;

  reset(): void {
    this.#state = multiplier;
  }

  randomize(word: number): void {
    // EDU30.SV adds the clock word to the high seed word modulo 4096.
    this.#state = (this.#state + word * wordRange) % signedWordPairRange;
  }

  next(): number {
    // The archived multiplier takes the magnitude of the signed word pair.
    // RANDOMIZE can set its sign bit, which each committed draw clears.
    const magnitude = this.#state >= stateRange ? signedWordPairRange - this.#state : this.#state;
    // The product is exact in JavaScript. Keep bits 12 through 34 and set bit 0.
    const middle = Math.floor((magnitude * multiplier) / wordRange);
    this.#state = (middle % stateRange) | 1;
    return this.#state / stateRange;
  }
}

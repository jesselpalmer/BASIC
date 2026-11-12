# DIGITS source review

The [March 1975 printing, pages 91–92](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=91)
credits Dartmouth College's computation center. It leaves the BASIC interpreter
unspecified. The printed game predicts 30 digits in three groups of ten.

The [pinned transcription](../scripts/package/fixtures/classic/digits.bas) has
SHA-256 `260c8a3d4fe9850736db416b5320e18bc5011962c0b181586d916f6e308ac2fa`.
The [reviewed fixture](../scripts/package/fixtures/classic/digits-mar75-text.bas)
has SHA-256 `1f282771128cd8170422071b64a4c43f0ab9d19afdf9457ec95942f20a2aef9b`.

The scan restores the prompt semicolon at 220, the score reset `X=0` at
510, `SGN(W)` at 580, the weighted sum at 700, the `NEXT J` label 760,
the matrix update `M(Z,N)=M(Z,N)+1` at 830 and the loss target 1010 at 940.
The reviewed text retains the five printed `MAT` statements at 400–440,
the ten indexed INPUT targets at 550 and bare `RND` at 730.

## Archived EDUSYSTEM-30 observations

| Source          | Compiler diagnostics in output order                                            |
| --------------- | ------------------------------------------------------------------------------- |
| Pinned DIGITS   | `S1 400`, `S1 400`, `S1 420`, `S1 420`, `S1 440`, `S1 730`, `UL 760`, `UL 1110` |
| Reviewed DIGITS | `S1 400`, `S1 400`, `S1 420`, `S1 420`, `S1 440`, `S1 730`                      |

Isolated probes reject `MAT M=CON`, `MAT K=(9)*K` and bare `RND`. The
same archive returns −1, 0 and 1 for `SGN(-.5)`, `SGN(0)` and `SGN(.5)`.
It reads ten implicit indexed targets with `INPUT N(1),…,N(10)`. Supplying
nine numbers first triggers another prompt, and the final number completes
the list without discarding the first nine.

The full listing stops at compilation. The selected profile still requires
historical evidence for the printed matrix and RNG forms before a DIGITS
playthrough can be certified.

```sh
python3 scripts/research/probe-edusystem30-digits.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```

# EDUSYSTEM-30 default RUN random stream

[DEC's January 1973 handbook, page 7-5](https://deramp.com/downloads/mfe_archive/011-Digital%20Equipment%20Corporation/00%20Digital%20Handbooks/08%20PDP-8%20Family/Edusystem%20Handbook/EduSystemHandbookJan73.pdf#page=293)
describes a new draw on every `RND(X)` and a reproducible sequence on a fresh
`RUN` without `RANDOMIZE`. The [reference run](classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run)
pins the archived EDU30.SV build used to recover the transition.

## State and returned value

SIMH breakpoints in the loaded interpreter show these steps. Machine addresses
and words in the table are octal.

| Observation                          | Interpreter location       | Evidence                                                                                                             |
| ------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Default seed and constant multiplier | Entry at `03532`           | State words `00150/00151` and constant mantissa words `03563/03564` both contain `1461 3007`.                        |
| Middle product words before masking  | Break at `03541`           | Temporary words `00027/00043` contain product bits 12 through 35, counting the least significant bit as zero.        |
| State writeback                      | Instructions `03541–03553` | The high word loses its sign bit and bit zero of the low word is set. Stores at `03551` and `03553` commit the pair. |
| Committed state                      | Break at `03554`           | First pair `0710 5363`, second `1043 1033`. The second product's low word was `1032` before the forced low bit.      |

Combine the two 12-bit words as one integer. Each draw follows this transition.

```text
magnitude = abs(signed24(state))
middle = floor(magnitude * 0o14613007 / 2^12)
state  = (middle mod 2^23) OR 1
draw   = state / 2^23
```

The product fits exactly in the JavaScript integer range. The division returns
the binary fraction represented by the committed state. The terminal's decimal
printing is a separate operation.

The [capture script](../scripts/research/capture-edusystem30.py) uses unmodified
SIMH to read the initial state, multiplier, 12 unmasked middle products and
512 committed states. Its [offline evidence](edusystem30-reference.json)
supplies exact state words for the internal stream test. A fresh stream starts
from the default seed, and replay within one run keeps consuming that stream.
In the reviewed 23MTCH trace, the sixth draw after replay yields a computer
move of two, while a fresh stream's first draw yields one.

The [selected EDUSYSTEM-30 profile](edusystem30-profile.md) uses this stream for
`RND(X)`. The profile evaluates one admitted numeric expression and then draws
from the stream regardless of the argument's value. The regression checks the
first twelve archived states for `RND(I-3)` in two fresh runs. The archive
also consumes two draws for `RND(RND(0))`, starting with the inner call.
The `RANDOMIZE` routine at octal 02755–02757 adds
the 12-bit clock word at 07471 to the high state word at 00150 modulo 4096
and leaves 00151 unchanged. The [LETTER capture](letter-edusystem30-reference.json)
sets that clock word to octal 2304 and observes the high word change from
1461 to 3765. The
[signed-seed capture](edusystem30-signed-rng-reference.json) observes the
initialized word pair and four committed draws just below and above the sign
boundary, before and after high-word wrap, and with the EVEN1 clock word.
For example, clock word 1246 produces octal `4017 3007`. The first draw
multiplies the magnitude of that signed 24-bit value and commits `0752 7373`.
All committed draws clear the sign bit. The portable profile uses `floor(host.random() * 4096)` as
the clock word, preserving an injectable entropy source. The archived
interpreter emits a diagnostic and still draws when `X` divides by zero. The
selected profile currently reports a runtime error in that case. Diagnostic
continuation and wider arithmetic remain open.

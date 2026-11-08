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
middle = floor(state * 0o14613007 / 2^12)
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

The implementation covers the internal default stream. Program activation,
argument evaluation and continuation diagnostics, `RANDOMIZE` and host wiring
remain separate compatibility work.

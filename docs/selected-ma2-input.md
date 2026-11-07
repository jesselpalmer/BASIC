# Bounded selected-MA2 scalar INPUT

This internal selected execution slice accepts one short scalar INPUT target:
`A` through `Z`, optionally followed by one digit, with an optional `$` suffix
for strings. The `1CHECK` targets `F`, `T` and `A$` are ordinary cases of this
bounded policy. It does not activate the historical dialect publicly.

The October 1972 BASIC-PLUS manual §3.3.3 supports the quoted literal prompt
and semicolon separator used by `1CHECK`; see the [source review](classic-source-review.md).
The [pinned selected-MA2 conversion captures](ma2-conversion-callers.md) establish
the complete decimal conversion facts used for this conservative one-field
path. Those captures are from VAL and READ, not INPUT. They do not establish the
full historical INPUT row scanner, terminal prompting or retry behavior.

| Selected response                                     | Behavior                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numeric                                               | One complete uppercase-E decimal field, with optional leading sign, up to 255 printable ASCII bytes. Convert through the bounded MA2 floating conversion facts and retain canonical words. Examples include `65`, `-1.5`, `+1E2`, and `01`. |
| String                                                | One raw printable ASCII field of at most 255 bytes, including empty and trailing spaces. The game controls its own YES/NO retry.                                                                                                            |
| Quoted or comma-separated row                         | Explicit unsupported row; no target commit.                                                                                                                                                                                                 |
| Malformed, out-of-range or unknown numeric conversion | Explicit unsupported response or numeric event; no target commit or inferred untrapped continuation.                                                                                                                                        |
| Host end/failure or cancellation                      | Source-located end/failure; cancellation cannot commit a late result.                                                                                                                                                                       |

Control bytes, high bytes, Unicode, longer strings, numeric whitespace,
lowercase exponent spelling, quoted fields and multi-field rows stay outside
this selected path. The internal BASIC driver tests execute a separate short
numeric target (`Z`), signed decimal conversion, arithmetic and output from
source. The full INPUT scanner, surplus fields, historical error 52 retry and
event/handler flow remain required before public historical activation.

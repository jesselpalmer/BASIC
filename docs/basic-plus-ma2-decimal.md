# Internal selected-MA2 decimal literal conversion

Design and original-machine evidence before implementation for #123/#116.
Implement a bounded converter for complete **unsigned source-literal spellings**,
using the pinned V4A-12 software MA2 ATOF routine as the reference. Keep the
native parser/evaluator and historical scanner's lexical facts unchanged. This
is not a VAL/READ/INPUT parser or public historical profile.

## Exact reference algorithm

Use the [selected linked build](rsts-v4a-build.md), loader SHA-256
`e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596`
and pinned SIMH commit `698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6`.
ATOF starts at octal076624 and completes at077314, before RTS PC. Put an ASCII
spelling and NUL at140040, R2 at140040, R1 at140010, SP at150000 and PSW zero.
At completion R1 is140004; read140004/140006, R2, R4, PSW and a separate monitor
latch140020. Configure data word4064 to select that latch; do not change code or
TRAP vectors. Captured histories identify every completed call and trap path.

The disassembly explains why short and long neighboring decimal spellings can
collapse even though arithmetic constructs a distinct neighboring value:

1. Skip leading zero digits. Leading zeros after the point still decrement a
   decimal scale counter. Once any nonzero digit is processed, all following
   processed digits count, including zeros.
2. Accumulate each processed digit as **MA2 multiply by10, then MA2 add digit**,
   preserving each operation's rounding. Before the decimal point there is no
   seven-digit cutoff. After the point, stop processing digits once the total
   processed count has reached7; ignored digits do not further adjust the scale.
3. Parse an optional uppercase-E signed decimal exponent through the selected
   signed-word boundary -32768..32767, then add it to the decimal scale with a
   checked signed-word sum. Only after both checks does an all-zero mantissa
   return zero without applying the scale.
4. For a nonzero mantissa the effective decimal scale must be within -38..38.
   The original checks this scale before multiplying, even when the mathematical
   final value would be representable. Larger scales are an invalid conversion
   status, not permission to reinterpret the spelling with native binary64.
5. Apply the set bits of the absolute scale in increasing order using the original
   stored powers10^(1,2,4,8,16,32), or their reciprocals, and the already traced
   ordered MA2 multiplication. The stored table words are primary input data;
   do not regenerate them through JavaScript powers or round one exact decimal.

For example `1.0000001`, `1.0000002` and the long `1.00000011920928955078125`
all become exactly1 in the pinned routine. `16777217.` instead rounds during
integer accumulation to16777218. `9.999999E-37` has an effective scale below-38
and receives an invalid conversion status despite its mathematical magnitude.
Zero with a representable signed exponent, such as `0E+999`, remains zero.

## Bounded result boundary

Accept complete spellings matching unsigned decimal/scientific source syntax,
with uppercase E only, at most255 UTF-16 units. Source unary signs remain the
parser's responsibility. Percent/integer-kind rules, whitespace, partial input,
trailing delimiters, repeated exponent/sign forms and VAL/READ/INPUT policies
remain separate. Reject malformed spellings with SyntaxError and non-string
inputs with TypeError; return explicit unsupported input-limit before scanning
an oversized primitive string.

Successful results have frozen detached two-word `words`. Return explicit
unsupported reasons for `conversion-status` and `numeric-event`, as well as the
input bound. Signed-word exponent overflow, effective-scale failure and observed
intermediate numeric events must never silently become a successful native value.
The captured completed words/status/masks for these cases stay in research data;
this slice does not infer a caller's BASIC error code, diagnostic timing or
continuation from an ATOF status. In particular, the routine's successful status
can coexist with an intermediate arithmetic trap. Caller integration must settle
that policy before activation.

## Independent acceptance

Retain original-machine calls as an offline fixture, including complete source
consumption, raw status/PSW, completed words, monitor masks and bounded histories.
Cover leading zeros, decimal cutoff positions, integer accumulation beyond seven
digits, exponent signs and signed-word/scale endpoints, representable neighbors,
zero/exponent interaction and intermediate range events. Add deterministic
spelling families and exact captured power-table identity. A fresh capture must
reproduce the result rows and normalized transcript hashes. Expected words must
come from SIMH, not the converter under test; normal CI never downloads or runs
historical binaries. Preserve existing arithmetic fixtures, installed/native and
browser gates. Literal caller integration, READ/VAL/INPUT, exceptional conversion
policy and public numeric observations remain open.

## Captured records and reproduction

The [offline fixture](../src/core/__tests__/ma2-decimal-reference.json) retains
396 original-machine calls:265 normal values,114 unsupported conversion-status
cases and17 calls with intermediate arithmetic traps. All normal calls consume
the complete ASCII spelling. Complete histories have at most15,107 instructions,
below the100,000-entry capacity and200,000-instruction call bound. No caller's
BASIC diagnostic/continuation policy is inferred from these low-level flags.

The [capture command](../scripts/research/capture-ma2-decimal.py) requires a
separately obtained pinned simulator and exact SY.LDA, verifies loader identity
and the reported simulator revision, and records both the24 stored power-table
words and a normalized stdout SHA-256. It contains no arithmetic expectation
model. Reproduction compares parsed JSON; maintained formatting is separate.

```sh
python scripts/research/capture-ma2-decimal.py \
  --simulator /path/to/pinned/pdp11 \
  --loader /path/to/rebuilt/SY.LDA \
  --output /tmp/ma2-decimal-reference.json
```

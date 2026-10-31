# Historical integer and logical semantics

**Status:** source-backed design for #124/#116, coordinated with #123/#59/#125.
No integer suffix, logical operator, numeric truth condition or historical profile
is enabled by this document. Native finite doubles, exact string equality and
comparison-only IF retain their present behavior. #109 remains **NOT READY**.

## Evidence boundary

The primary source is the [BASIC-PLUS Language Manual, October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf).
The inspected scan has SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Printed pages 6-1 through 6-4 are PDF pages 81 through 84, using one-based PDF
indexes. Printed 8-8/8-9 are PDF pages 100/101. Sections and printed page labels
are the authority; the scan has an out-of-order 8-12 page before chapter 7.
Scanned percent signs and decimal points were inspected directly rather than
inferred from OCR. No manual or complete game source is bundled here.

This establishes rules for that version only. It does not certify an upstream
README's dialect hint, later BASIC-PLUS/BASIC-PLUS-2, DECsystem-10, EduSystem or
other systems. A construct observation is not a whole-game result.

## Verified facts and their implementation consequences

| Primary location           | Verified rule                                                                                                                                                    | Consequence                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §6.1, F.2                  | Integer values occupy one word, use two's complement and span -32768 through 32767. A `%` suffix identifies integer constants, variables and function results.   | Carry numeric kind separately from a JavaScript number's current value; preserve the suffix and original spelling in syntax.                                       |
| §6.1                       | Assigning a floating value to an integer variable discards its fraction toward zero. The negative example assigns -1.1 as -1.                                    | Assignment conversion is FIX-like, not floor, rounding or JavaScript string coercion.                                                                              |
| §6.2                       | Integer arithmetic cycles across the signed endpoints; its example gives `32767% + 2% = -32767%`. Ordinary integer division discards the remainder.              | Integer arithmetic and conversion are distinct policies; do not treat every numeric overflow as a native fatal error.                                              |
| §6.2                       | `2%/4` prints zero, while `2%/4.` prints .5. The rule depends on an explicit integer term on the left and the absence of a floating term on the right.           | Retain raw literal distinctions and resolve arithmetic mode from the historical grammar. `Number.isInteger(4)` and a suffix-only binary dispatch are insufficient. |
| §6.3                       | Fractional input/data cannot be provided to an integer READ/INPUT target; the manual's fractional DATA example reports an error.                                 | Do not reuse assignment truncation for integer INPUT/READ. Integer-looking input accepted in the example lacks a `%` suffix.                                       |
| §6.4                       | Integer and floating function arguments are convertible; numeric/string substitution is not. A function's `%` suffix specifies its integer result.               | Coordinate parameter/result conversion with #125; do not infer user-defined result kind from a JavaScript return value.                                            |
| §6.5                       | Integer zero is false and any nonzero integer is true in a condition. Generated logical values are -1 and 0; logical operations act on the individual word bits. | Keep condition testing separate from bitwise combination. Boolean coercion before AND/OR loses the documented masks.                                               |
| §3.5, printed 3-14         | Precedence runs from arithmetic to relations, NOT, AND, OR/XOR, IMP, then EQV; operations at one level associate left to right.                                  | Represent a structured condition/expression tree, not textual splitting or JavaScript operator precedence.                                                         |
| §8.4 error 51, printed 8-8 | An out-of-range integer conversion is a continued error; without an error-handler transfer its replacement integer is zero.                                      | Preserve a source-located error event and continuation policy; do not silently wrap an out-of-range floating assignment into a word.                               |
| §8.4 error 60, printed 8-9 | Integer FOR has its own overflow error when its index attempts to pass the documented limits of -32766/32766.                                                    | Coordinate with #126; ordinary word endpoints alone do not define integer loop behavior.                                                                           |
| §5.1.5, printed 5-4/5-5    | String relations use alphabetical order, ignore trailing blanks and blank-pad the shorter operand. Empty and all-blank strings compare equal.                    | Preserve native exact equality. Profile string relations require their own comparison policy, coordinated with #59 and character encoding.                         |

Two qualifications prevent overclaiming these facts:

- The printed §6.2 paragraph labels its modulus as `2^15`, yet states a cycle
  through all 65536 signed-word values and supplies the wraparound example above.
  A 16-bit residue model is the engineering inference consistent with the range,
  two's-complement format and example; the conflicting printed label must remain
  recorded. Do not silently cite that label as `2^16` or use a 32768-state cycle.
- §2.5 distinguishes arithmetic and logical expressions and says their permitted
  statement positions differ. §3.5's condition discussion does not grant a
  general arithmetic value from an IF. The internal -1/0 representation therefore
  does **not** by itself authorize `LET A=(B=C)`, `PRINT A=B`, arbitrary numeric
  truth operands, or every bitwise expression in every arithmetic position.
  Verify each required position before broadening that grammar.

## Pinned corpus requirements

The following source observations use corpus commit
`45f75052be3f436f2e575f58d4aa611484268227`. The linked files were read directly;
these examples do not establish a complete dialect attribution.

| Source                                                                                                                                             | Git blob                                   | Required construct                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| [ANIMAL](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/animal.bas), 1350/1400/2200/3000 | `aa73e3b6725bc0a76c5ad23f4d625b2b382241ee` | `%` scalar/index/constants, integer function result, integer conversion from VAL, and mixed string/function operations.           |
| [HEX](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/hex.bas), 230/430/500/2015/2025     | `5b49ed4f5ffbc2bde8686fcbce53a793f2d6eb78` | Compound OR/AND, a bare INSTR result in a condition, postfix numeric truth `IF I%`, and integer arithmetic for board coordinates. |
| [BOWL](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/bowl.bas), 5220/5490/5760/6030     | `07b670fac3f0e98a7a2a50ebd78703080382237a` | NOT around AND-combined numeric comparisons; no implication that all its other grammar is BASIC-PLUS.                             |
| [BOMBER](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/bomber.bas), 20/40/120/345       | `4ed45348e7f2d7839d385a8c5909624af401e47f` | Range checks formed from AND-combined comparisons. Duplicate label 260 and malformed line 325 remain source-review blockers.      |

No source spelling is repaired to obtain a pass. The logical constructs must be
verified independently of compact lexing, continuation/modifiers, RNG, file I/O,
function bodies and source defects. For example, ANIMAL's files and HEX's string
functions cannot be bypassed and still count as complete game compatibility.

## Implementation contract

Keep the existing shared parser/evaluator and immutable language context.
Introduce historical numeric kind only with a separately reviewed syntax/type
change: integer literals, references and function results must remain
unambiguous in a prepared snapshot. Do not reinterpret native numeric ASTs or
add `%`, AND, OR, NOT or other words to native reservation by default.

An internal arithmetic value must carry integer-versus-floating kind while
public `BasicValue` remains the documented number/string union unless the public
API is separately changed. An integral floating value is still floating; its
kind must survive assignment, array access, function conversion and reruns.
Literal `4` and `4.` cannot be collapsed during preparation. Resolve and record
operation mode before value evaluation once the §6.2 mixed-mode rules are fully
specified; runtime variable existence must not select a different grammar.

For word operations, map an already validated integer to its unsigned 16-bit
pattern and decode bit 15 as the sign on return. Use explicit 16-bit arithmetic
or exact bounded integer operations; implicit JavaScript 32-bit coercion is not
the language rule. Separate helpers should own checked conversion, wrapping
arithmetic, truncated division, bitwise combination, relation-to-logical result
and final condition testing. Error continuation belongs to the runtime policy;
a pure helper must not write output, call a host, mutate variables or hide an
error behind an arbitrary result.

Retain structured relations and logical operators until evaluation. A comparison
produces the profile's internal logical representation; AND/OR/etc combine the
word patterns; IF finally tests zero/nonzero where that operand kind is admitted.
Do not short-circuit using JavaScript `&&`/`||`. The manual establishes bitwise
results, but observable argument/operand evaluation and first-error sequencing
still need verified historical conformance; do not silently import native order
as a historical guarantee. Native's present left-to-right order remains intact.

Program validation must reject every unsupported historical kind/operator or
statement position before effects, including unreachable branches and supplied
ASTs. Malformed suffixes, literal ranges, mixed contexts and unsupported string
relations need exact source diagnostics. Runtime errors, failed loads, Stop,
replacement and reruns must preserve the existing ownership guarantees. No
synthetic instructions or extra Step/budget units arise from pure operators.

## Independent acceptance oracles

These are authored expectations for future tests, not reported test results:

| Authored input                                        | Expected result / reason                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Assign 1.9 and -1.9 to an in-range integer target     | 1 and -1, distinguishing truncation from floor.                                          |
| `32767%+2%`                                           | -32767, matching the manual's endpoint example.                                          |
| Integer add `-32768-1`; multiply `300*300`            | 32767 and 24464 under the stated signed-word cycle; these are derived wrap-model checks. |
| Integer divide `199/100`, `-199/100`                  | 1 and -1 for ordinary in-range truncated quotients.                                      |
| Historical `2%/4` versus `2%/4.`                      | 0 versus .5; retain the distinguishing raw decimal point.                                |
| `6% AND 3%`, OR, XOR                                  | 2, 7, 5 from low-bit patterns 0110 and 0011.                                             |
| `NOT 5%`, `6% IMP 3%`, `6% EQV 3%`                    | -6, -5, -6 from complement, complement-left OR, and complemented XOR on 16 bits.         |
| Conditions `4% AND 2%`, `-1%`, `0%`                   | False, true, false; the first defeats Boolean-AND substitution.                          |
| BOWL's `NOT(B=1 AND D=10)`                            | False for B=1/D=10; true for B=2/D=10 or B=1/D=9.                                        |
| BOMBER's `A>0 AND A<5`                                | True for 1/4, false for 0/5, checked without invoking the game.                          |
| Historical strings `"YES"`/`"YES "`, empty/all blanks | Equal; native retains its unequal exact-string results.                                  |

Test all six logical operators across canonical truth values and independently
chosen non-Boolean word patterns. Include both signed endpoints and all 16 bit
positions; do not use the implementation's own bit helper as the expected-value
oracle. Check grouping and precedence with relations, NOT, AND, OR/XOR, IMP and
EQV, using source-located malformed cases as well as positive traces.

## Remaining activation blockers and next executable slice

The next safe code slice is internal, pure word-kind/conversion/bit-operation
conformance, without exposing a public historical profile or accepting new
native grammar. Integer suffix syntax and AST changes need their own focused
integration once the scanner and expression contracts are ready.

Before public activation, settle the precise mixed-mode scope for grouped and
chained expressions, unsuffixed integer-looking constants, floating variables,
function returns and exponentiation. The two printed division examples do not
establish every case. Resolve conversion boundaries adjacent to the signed
endpoints, out-of-range integer constants, the exceptional quotient
`-32768/-1`, minimum-word negation and divide-by-zero/continued-error behavior
against the selected implementation and manual. Keep assignment conversion,
integer INPUT/READ decoding and FOR overflow separate.

Also verify numeric truth for fractional floating operands, comparison/logical
values outside conditions, historical evaluation order, character ordering and
blank-padding edge cases, exact numeric equality/approximately-equal precision,
and error trapping/reporting. The wider float-format contract remains #123;
function argument/result scopes remain #125. These unresolved cases must be
explicit unsupported features until settled, not native fallbacks.

After implementation, require direct/installed ESM/CommonJS, public consumer
types, CLI/editor and relevant real browser/extracted-archive checks on Linux and
macOS. Keep the full pinned 108-file corpus gate, independent game oracles and
source/dialect certification open. A passing integer probe closes no game or
release gate.

## Internal word conformance slice

**Status:** implemented after the design-only contract. `core/basic_plus_words.ts`
exercises the settled October 1972 word rules without activating a historical
profile, changing public exports or reserving additional native words. It accepts
explicitly selected signed words, represented exactly as JavaScript numbers.

The pure boundary validates operands as integers in -32768..32767. Assignment
conversion rejects nonfinite values, truncates finite fractions toward zero and
returns an explicit `assignment-boundary` outcome outside the word range. That
outcome records the unresolved continued-error boundary; it does not silently
assign zero. Arithmetic add, subtract and multiply use the documented 16-bit
cycle. In-range division truncates toward zero, while division by zero and the
exceptional -32768/-1 quotient remain explicit unsupported outcomes. Negating
-32768 is likewise unsupported until its historical error policy is settled;
all other word negations are exact.

NOT and the five binary logical operations work on all 16 bits. Relations map
only an already evaluated Boolean result to -1 or 0, and condition testing treats
zero as false and every other validated word as true. These helpers do not decide
where syntax is legal, evaluation order, mixed numeric mode, source diagnostics,
error continuation or host effects.

The tests independently cover endpoint cycling, truncation signs, all word
values for complement and negation, all 16 bit positions, non-Boolean patterns,
malformed constructed operands/operators and immutable unsupported outcomes.
This slice closes no game, profile or release gate; #124 and #109 remain open.
